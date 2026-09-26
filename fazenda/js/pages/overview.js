// VISÃO GERAL DA FAZENDA — resumo gerencial para o proprietário.
import * as db from '../db.js';
import * as St from '../stats.js';
import { can } from '../auth.js';
import { icon, $ } from '../ui.js';
import { esc, fmtNum, fmtMoney, fmtHours, today, addDays, periodLabel, previousRange, inRange, sum, monthKey, num, diffDays } from '../util.js';
import { stockValue, lowStock, pregnancyOpen, isActive } from '../services.js';
import { computeAlerts, openAlerts } from '../alerts.js';
import { pageState, periodSelect, bindPeriod, rangeOf } from './common.js';
import { farm } from '../config.js';

const kv = (items) => `<dl class="kv">${items.map(([k, v, s]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd>${s ? `<div class="muted small">${s}</div>` : ''}</div>`).join('')}</dl>`;
const block = (title, ic, body, href) => `<div class="card overview-block"><h2>${icon(ic, 22)} ${esc(title)}${href ? ` <a href="${href}" class="small" style="margin-left:auto;font-weight:600">detalhes ›</a>` : ''}</h2>${body}</div>`;

export function render(el) {
  const st = pageState('overview', { period: 'month' });
  el.innerHTML = `<div class="page-head"><div><h1>Visão geral da fazenda</h1><p class="muted" id="o-range"></p></div><div class="page-actions">${periodSelect(st)}<button class="btn btn-ghost" onclick="window.print()">${icon('printer', 18)} Imprimir</button></div></div>
    <div class="print-head"><b>${esc(farm().name)} — Visão geral</b><span id="o-range-p"></span></div><div id="o-body" class="grid g2"></div>`;
  bindPeriod(el, st, () => draw(el, st));
  draw(el, st);
}

function draw(el, st) {
  const r = rangeOf(st), t = today(), days = diffDays(r.from, r.to) + 1;
  $('#o-range', el).textContent = `Período: ${periodLabel(r)}`; $('#o-range-p', el).textContent = periodLabel(r);
  const h = St.herdCounts();
  const out = [];
  if (can('herd.view')) {
    const repro = db.where('animal_reproduction', x => inRange(x.date, r));
    const due = db.where('animal_reproduction', x => x.pregnancy_status === 'Confirmada' && !x.actual_calving && x.expected_calving && diffDays(t, x.expected_calving) <= 30);
    out.push(block('Rebanho', 'cow', kv([
      ['Quantidade (ativos)', fmtNum(h.active, 0), `${fmtNum(h.total, 0)} cadastrados`],
      ['Nascimentos', fmtNum(St.birthsIn(r).length, 0)], ['Mortalidade', fmtNum(St.deathsIn(r).length, 0)],
      ['Gestantes', fmtNum(h.pregnant, 0), `${due.length} parto(s) nos próximos 30 dias`],
      ['Coberturas / IA', fmtNum(repro.length, 0), 'no período'], ['Em produção', fmtNum(h.producing, 0)],
    ]), '#/rebanho/animais'));
  }
  if (can('milk.view')) {
    const total = St.milkTotal(r), prev = St.milkTotal(previousRange(r));
    const month = St.milkTotal({ from: `${monthKey(t)}-01`, to: t });
    out.push(block('Leite', 'milk', kv([
      ['Litros/dia (média)', `${fmtNum(total / days)} L`], ['Hoje', `${fmtNum(St.milkTotal({ from: t, to: t }))} L`],
      ['Litros no período', `${fmtNum(total)} L`, prev ? `${total >= prev ? '▲' : '▼'} ${fmtNum(Math.abs((total - prev) / prev * 100), 0)}% vs período anterior` : ''],
      ['Litros no mês', `${fmtNum(month)} L`], ['Média por animal', `${fmtNum(St.milkAvgPerAnimal(r))} L/dia`], ['Animais ordenhados', fmtNum(St.milkAnimalsCount(r), 0)],
    ]), '#/leite/painel'));
  }
  if (can('feed.view')) {
    out.push(block('Ração', 'wheat', kv([
      ['Produzida', `${fmtNum(St.feedProduced(r), 0)} kg`, `${St.batchesIn(r).length} lotes`], ['Distribuída', `${fmtNum(St.feedDistributed(r), 0)} kg`],
      ['Estoque de ração', `${fmtNum(St.feedBalance(), 0)} kg`], ['Consumo por animal', `${fmtNum(St.feedPerAnimal(r), 2)} kg`, 'média por trato'],
      ...(can('inventory.cost') ? [['Custo de fabricação', fmtMoney(sum(St.batchesIn(r), b => b.cost_total))]] : []),
    ]), '#/racao/lotes'));
  }
  if (can('machines.view')) {
    const maint = db.where('machine_maintenance', m => inRange(m.date, r)), fuel = St.fuelIn(r);
    out.push(block('Máquinas', 'tractor', kv([
      ['Horas trabalhadas', fmtHours(St.machineHours(r))], ['Serviços', fmtNum(St.servicesIn(r).length, 0)],
      ['Manutenções', fmtNum(maint.length, 0), can('inventory.cost') ? fmtMoney(sum(maint, m => m.cost)) : ''],
      ['Combustível', `${fmtNum(sum(fuel, f => f.liters), 0)} L`, can('inventory.cost') ? fmtMoney(sum(fuel, f => f.total_value)) : ''],
      ['Máquinas', fmtNum(db.count('machines', m => m.status !== 'Vendida'), 0), `${db.count('machines', m => m.status === 'Manutenção')} em manutenção`],
    ]), '#/maquinas/horas'));
  }
  if (can('payroll.view')) {
    const mk = monthKey(r.to);
    const pay = db.where('employee_payments', p => p.month === mk);
    const adv = db.where('employee_advances', a => inRange(a.date, r));
    const disc = db.where('employee_discounts', d => inRange(d.date, r));
    out.push(block('Funcionários', 'users', kv([
      ['Quantidade', fmtNum(db.count('employees', e => e.status !== 'Desligado'), 0), 'ativos'],
      [`Folha (${mk})`, fmtMoney(sum(pay, p => p.net)), `${pay.filter(p => p.status === 'Pago').length} de ${pay.length} pagos`],
      ['Vales/adiant. no período', fmtMoney(sum(adv, a => a.amount)), `${adv.length} lançamentos`], ['Descontos no período', fmtMoney(sum(disc, d => d.amount))],
    ]), '#/funcionarios/salarios'));
  } else if (can('employees.view')) out.push(block('Funcionários', 'users', kv([['Quantidade', fmtNum(db.count('employees', e => e.status !== 'Desligado'), 0), 'ativos']]), '#/funcionarios/cadastro'));
  if (can('inventory.view')) {
    const mv = db.where('inventory_movements', m => inRange(m.date, r));
    const alerts = openAlerts(computeAlerts()).length;
    out.push(block('Estoque', 'package', kv([
      ...(can('inventory.cost') ? [['Valor do estoque', fmtMoney(stockValue())]] : []),
      ['Entradas', fmtNum(mv.filter(m => m.type === 'entrada').length, 0), can('inventory.cost') ? fmtMoney(sum(mv.filter(m => m.type === 'entrada'), m => m.total)) : ''],
      ['Saídas', fmtNum(mv.filter(m => m.type === 'saida').length, 0), can('inventory.cost') ? fmtMoney(sum(mv.filter(m => m.type === 'saida'), m => m.total)) : ''],
      ['Abaixo do mínimo', `<span class="${lowStock().length ? 'delta-down' : ''}">${fmtNum(lowStock().length, 0)}</span>`], ['Alertas abertos (todos)', fmtNum(alerts, 0)],
    ]), '#/estoque/produtos'));
  }
  $('#o-body', el).innerHTML = out.join('') || '<div class="card">Sem módulos liberados para o seu perfil.</div>';
}
