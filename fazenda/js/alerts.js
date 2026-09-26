// Central de alertas: gerados automaticamente a partir dos dados.
// O estado (lido / resolvido / ignorado) fica gravado na tabela "alerts" pela chave do alerta.
import * as db from './db.js';
import { alertsCfg } from './config.js';
import { today, addDays, diffDays, fmtDate, fmtNum, num, monthKey, addMonthKey, sum } from './util.js';
import { animalLabel, isActive, lowStock, machineName, employeeName } from './services.js';
import { periodStat } from './stats.js';

export const ALERT_TYPES = {
  stock: 'Estoque baixo', vaccine: 'Vacinação / procedimento', calving: 'Parto', repro: 'Reprodução', maintenance: 'Manutenção',
  milk_missing: 'Sem produção registrada', milk_drop: 'Queda de produção', payroll: 'Pagamento', pending: 'Informações pendentes', feed: 'Ração',
};

export function computeAlerts() {
  const c = alertsCfg(), t = today(), out = [];
  const push = (a) => out.push({ severity: 'warn', ...a });

  // Estoque baixo
  for (const p of lowStock()) push({
    key: `stock:${p.id}:${(p.updated_at || '').slice(0, 10)}`, type: 'stock', severity: num(p.quantity) <= 0 ? 'high' : 'warn',
    title: `ESTOQUE BAIXO — ${p.name}`, message: `Quantidade atual: ${fmtNum(p.quantity, 2)} ${p.unit} · Estoque mínimo: ${fmtNum(p.min_qty, 2)} ${p.unit}`, link: `#/estoque/produtos?id=${p.id}`,
  });

  // Vacinas e procedimentos futuros
  for (const h of db.where('animal_health', h => h.next_date && !h.next_done)) {
    const a = db.get('animals', h.animal_id); if (!a || !isActive(a)) continue;
    const d = diffDays(t, h.next_date);
    if (d > c.vaccine_days) continue;
    push({
      key: `vaccine:${h.id}:${h.next_date}`, type: 'vaccine', severity: d < 0 ? 'high' : 'warn',
      title: d < 0 ? `${h.type} atrasada — ${animalLabel(a)}` : `${h.type} próxima — ${animalLabel(a)}`,
      message: `${h.description || h.type} · previsto para ${fmtDate(h.next_date)} (${d < 0 ? `${-d} dia(s) de atraso` : d === 0 ? 'hoje' : `em ${d} dia(s)`})`, link: `#/animal/${a.id}?tab=saude`, date: h.next_date,
    });
  }

  // Parto próximo / atrasado, gestação confirmada, sem acompanhamento
  for (const r of db.where('animal_reproduction', r => !r.actual_calving)) {
    const a = db.get('animals', r.animal_id); if (!a || !isActive(a)) continue;
    if (r.pregnancy_status === 'Confirmada' && r.expected_calving) {
      const d = diffDays(t, r.expected_calving);
      if (d < 0) push({ key: `calving_late:${r.id}`, type: 'calving', severity: 'high', title: `Parto atrasado — ${animalLabel(a)}`, message: `Previsão era ${fmtDate(r.expected_calving)} (${-d} dia(s) de atraso). Registre o nascimento ou revise a gestação.`, link: `#/animal/${a.id}?tab=reproducao` });
      else if (d <= c.calving_days) push({ key: `calving:${r.id}`, type: 'calving', title: `Parto próximo — ${animalLabel(a)}`, message: `Previsto para ${fmtDate(r.expected_calving)} (${d === 0 ? 'hoje' : `em ${d} dia(s)`}).`, link: `#/animal/${a.id}?tab=reproducao` });
      if (r.confirmation_date && diffDays(r.confirmation_date, t) <= 7) push({ key: `preg_ok:${r.id}`, type: 'repro', severity: 'info', title: `Gestação confirmada — ${animalLabel(a)}`, message: `Confirmada em ${fmtDate(r.confirmation_date)}. Parto previsto para ${fmtDate(r.expected_calving)}.`, link: `#/animal/${a.id}?tab=reproducao` });
    } else if ((r.pregnancy_status || 'Aguardando') === 'Aguardando' && diffDays(r.date, t) >= c.repro_check_days) {
      push({ key: `repro_check:${r.id}`, type: 'repro', title: `Animal sem acompanhamento — ${animalLabel(a)}`, message: `Cobertura em ${fmtDate(r.date)} (${diffDays(r.date, t)} dias) sem diagnóstico de gestação.`, link: `#/animal/${a.id}?tab=reproducao` });
    }
  }

  // Manutenção por data ou por horímetro
  for (const mt of db.where('machine_maintenance', m => m.next_date || m.next_hourmeter)) {
    const m = db.get('machines', mt.machine_id); if (!m || m.status === 'Vendida') continue;
    const newer = db.find('machine_maintenance', x => x.machine_id === mt.machine_id && x.id !== mt.id && x.date > mt.date);
    if (newer) continue; // já houve manutenção posterior
    if (mt.next_date) {
      const d = diffDays(t, mt.next_date);
      if (d <= c.maintenance_days) push({ key: `maint:${mt.id}:${mt.next_date}`, type: 'maintenance', severity: d < 0 ? 'high' : 'warn', title: `Manutenção ${d < 0 ? 'atrasada' : 'próxima'} — ${m.name}`, message: `${mt.type || 'Manutenção'} prevista para ${fmtDate(mt.next_date)}.`, link: `#/maquinas/manutencao` });
    }
    if (mt.next_hourmeter && num(m.hourmeter) >= num(mt.next_hourmeter) - c.maintenance_hours) {
      const late = num(m.hourmeter) >= num(mt.next_hourmeter);
      push({ key: `maint_h:${mt.id}:${mt.next_hourmeter}`, type: 'maintenance', severity: late ? 'high' : 'warn', title: `Manutenção por horímetro — ${m.name}`, message: `Horímetro atual ${fmtNum(m.hourmeter)} h · manutenção em ${fmtNum(mt.next_hourmeter)} h.`, link: `#/maquinas/manutencao` });
    }
  }

  // Leite: sem produção registrada e queda de produção
  const producing = db.where('animals', a => a.status === 'Em produção');
  const since = addDays(t, -(c.no_milk_days - 1));
  const recent = new Set(db.where('milk_production', m => m.date >= addDays(t, -c.no_milk_days)).map(m => m.animal_id));
  for (const a of producing) {
    const any = db.find('milk_production', m => m.animal_id === a.id);
    if (!recent.has(a.id)) push({ key: `milk_missing:${a.id}:${t}`, type: 'milk_missing', severity: 'info', title: `Sem produção registrada — ${animalLabel(a)}`, message: `Nenhuma ordenha lançada desde ${fmtDate(any ? db.where('milk_production', m => m.animal_id === a.id).map(m => m.date).sort().pop() : since)}. Verifique se o animal secou ou se falta lançamento.`, link: `#/leite/registrar` });
    else {
      const last7 = periodStat(a.id, { from: addDays(t, -6), to: t }), prev = periodStat(a.id, { from: addDays(t, -36), to: addDays(t, -7) });
      if (prev.days >= 7 && last7.days >= 3 && last7.avg < prev.avg * (1 - c.milk_drop_pct / 100))
        push({ key: `milk_drop:${a.id}:${monthKey(t)}-${Math.floor(new Date().getDate() / 7)}`, type: 'milk_drop', title: `Queda de produção — ${animalLabel(a)}`, message: `Média dos últimos 7 dias: ${fmtNum(last7.avg)} L/dia · média anterior: ${fmtNum(prev.avg)} L/dia (queda de ${fmtNum((1 - last7.avg / prev.avg) * 100, 0)}%).`, link: `#/animal/${a.id}?tab=producao` });
    }
  }

  // Ração: saldo acaba em poucos dias
  const dist14 = sum(db.where('feed_distribution', d => d.date >= addDays(t, -13)), d => d.quantity_kg) / 14;
  const bal = sum(db.all('feed_batches'), b => Math.max(0, num(b.balance_kg)));
  if (dist14 > 0 && bal / dist14 < c.feed_days_left) push({ key: `feed_low:${t}`, type: 'feed', title: 'Ração pronta acabando', message: `Saldo de ${fmtNum(bal)} kg dá para cerca de ${fmtNum(bal / dist14, 1)} dia(s) no consumo atual (${fmtNum(dist14)} kg/dia). Programe uma nova batida.`, link: '#/racao/fabricacao' });

  // Pagamento de funcionários
  const day = new Date().getDate();
  const payMonth = day <= c.payday + 1 ? addMonthKey(monthKey(t), -1) : monthKey(t);
  const payDate = `${addMonthKey(payMonth, 1)}-${String(c.payday).padStart(2, '0')}`;
  const dd = diffDays(t, payDate);
  if (dd <= c.payday_days) {
    const active = db.where('employees', e => e.status !== 'Desligado');
    const paid = db.where('employee_payments', p => p.month === payMonth && p.status === 'Pago').length;
    if (active.length && paid < active.length) push({ key: `payroll:${payMonth}`, type: 'payroll', severity: dd < 0 ? 'high' : 'warn', title: `Pagamento de funcionários — ${payMonth}`, message: `${active.length - paid} funcionário(s) sem pagamento marcado como pago. Data de pagamento: ${fmtDate(payDate)}.`, link: '#/funcionarios/salarios', perm: 'payroll.view' });
  }

  // Informações pendentes
  const noBreed = db.where('animals', a => isActive(a) && (!a.breed || !a.birth_date));
  if (noBreed.length) push({ key: `pending_animals:${noBreed.length}`, type: 'pending', severity: 'info', title: 'Cadastro de animais incompleto', message: `${noBreed.length} animal(is) sem raça ou data de nascimento: ${noBreed.slice(0, 5).map(a => a.name || a.tag).join(', ')}${noBreed.length > 5 ? '…' : ''}`, link: '#/rebanho/animais' });
  const noOp = db.where('feed_batches', b => !b.operator_id);
  if (noOp.length) push({ key: `pending_batches:${noOp.length}`, type: 'pending', severity: 'info', title: 'Lotes de ração sem operador', message: `${noOp.length} lote(s) sem operador informado.`, link: '#/racao/lotes' });
  const noCpf = db.where('employees', e => e.status !== 'Desligado' && !e.cpf);
  if (noCpf.length) push({ key: `pending_emp:${noCpf.length}`, type: 'pending', severity: 'info', title: 'Funcionários sem CPF', message: `${noCpf.map(e => e.name).join(', ')}`, link: '#/funcionarios/cadastro', perm: 'employees.view' });

  const order = { high: 0, warn: 1, info: 2 };
  return out.map(a => ({ ...a, state: db.get('alerts', a.key)?.status || 'novo' }))
    .sort((a, b) => order[a.severity] - order[b.severity]);
}

export function setAlertState(key, status) {
  const ex = db.get('alerts', key);
  if (ex) db.update('alerts', key, { status, by: db.getAuditUser()?.name });
  else db.insert('alerts', { id: key, status, by: db.getAuditUser()?.name });
}
export const openAlerts = (list) => list.filter(a => a.state === 'novo' || a.state === 'lido');
