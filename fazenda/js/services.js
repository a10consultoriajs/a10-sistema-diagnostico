// Regras de negócio e fluxos automáticos. As telas chamam estas funções;
// nenhuma tela grava diretamente em mais de uma tabela.
import * as db from './db.js';
import { registerSource } from './ui.js';
import { INACTIVE_STATUS, gestationDays, list, payrollCfg } from './config.js';
import { today, addDays, diffDays, pad, num, round, sum, hoursBetween, monthKey, addMonthKey, fmtDate, fmtNum, fmtMoney, fmtMonth } from './util.js';
import { shiftLabel } from './config.js';

// ---------- Rótulos ----------
export const animalCode = (a) => a ? pad(a.code) : '';
export const animalLabel = (a) => a ? `${a.name || (a.tag ? 'Brinco ' + a.tag : 'Sem nome')} · #${animalCode(a)}` : '—';
export const animalName = (a) => a ? (a.name || (a.tag ? 'Brinco ' + a.tag : `#${animalCode(a)}`)) : '—';
export const isActive = (a) => a && !INACTIVE_STATUS.includes(a.status);
export const sexLabel = (s) => s === 'F' ? 'Fêmea' : s === 'M' ? 'Macho' : '—';
export const employeeName = (id) => db.get('employees', id)?.name || '—';
export const machineName = (id) => { const m = db.get('machines', id); return m ? `${m.name}${m.identification ? ' (' + m.identification + ')' : ''}` : '—'; };
export const productName = (id) => db.get('inventory', id)?.name || '—';
export const batchLabel = (b) => b ? `Lote ${b.lot_number} · ${b.feed_type || ''}` : '—';

db.setLabeler((table, r) => {
  switch (table) {
    case 'animals': return animalLabel(r);
    case 'milk_production': return `${animalLabel(db.get('animals', r.animal_id))} — ${fmtDate(r.date)} ${shiftLabel(r.shift)} (${fmtNum(r.liters)} L)`;
    case 'animal_births': return `Nº ${r.number} — ${animalLabel(db.get('animals', r.animal_id))}`;
    case 'animal_deaths': case 'animal_weights': case 'animal_health': case 'animal_reproduction':
      return `${animalLabel(db.get('animals', r.animal_id))} — ${fmtDate(r.date)}`;
    case 'feed_batches': return `Lote ${r.lot_number}`;
    case 'feed_distribution': return `${fmtDate(r.date)} — ${fmtNum(r.quantity_kg)} kg (lote ${db.get('feed_batches', r.batch_id)?.lot_number || '?'})`;
    case 'inventory': return `${r.name}${r.code ? ' [' + r.code + ']' : ''}`;
    case 'inventory_movements': return `${r.type} de ${fmtNum(Math.abs(r.quantity), 2)} ${db.get('inventory', r.product_id)?.unit || ''} — ${productName(r.product_id)}`;
    case 'machines': return r.name;
    case 'machine_services': return `${machineName(r.machine_id)} — ${fmtDate(r.date)} ${r.activity || ''}`;
    case 'machine_maintenance': case 'fuel_records': return `${machineName(r.machine_id)} — ${fmtDate(r.date)}`;
    case 'employees': return r.name;
    case 'employee_payments': return `${employeeName(r.employee_id)} — ${fmtMonth(r.month)}`;
    case 'employee_advances': case 'employee_discounts': return `${employeeName(r.employee_id)} — ${fmtMoney(r.amount)}`;
    case 'users': return r.username;
    case 'roles': return r.name;
    default: return r.name || r.id;
  }
});

// ---------- Fontes de autocomplete ----------
registerSource('animal', (f, vals) => {
  let rows = db.all('animals');
  const flt = f.filter || 'active';
  const fns = {
    active: isActive, all: () => true,
    female: (a) => isActive(a) && a.sex === 'F', male: (a) => a.sex === 'M',
    producing: (a) => isActive(a) && a.sex === 'F',
  };
  rows = rows.filter(typeof flt === 'function' ? (a) => flt(a, vals) : fns[flt] || fns.active);
  return rows.sort((a, b) => animalName(a).localeCompare(animalName(b), 'pt-BR'))
    .map(a => ({ value: a.id, label: animalLabel(a), sub: [a.tag && `Brinco ${a.tag}`, sexLabel(a.sex), a.breed, a.status].filter(Boolean).join(' · '), search: `${a.tag || ''} ${a.code} ${pad(a.code)}` }));
});
registerSource('employee', (f) => db.all('employees').filter(e => (f.filter ? f.filter(e) : e.status !== 'Desligado'))
  .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map(e => ({ value: e.id, label: e.name, sub: e.position })));
registerSource('person', () => {
  const names = new Set([...db.all('employees').filter(e => e.status !== 'Desligado').map(e => e.name), ...db.all('users').filter(u => u.active).map(u => u.name)]);
  return [...names].sort((a, b) => a.localeCompare(b, 'pt-BR')).map(n => ({ value: n, label: n }));
});
registerSource('product', (f, vals) => db.all('inventory').filter(p => p.active !== false && (!f.category || [].concat(f.category).includes(p.category)))
  .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  .map(p => ({ value: p.id, label: p.name, sub: `${p.category} · saldo ${fmtNum(p.quantity, 2)} ${p.unit}`, search: p.code })));
registerSource('machine', () => db.all('machines').filter(m => m.status !== 'Vendida')
  .map(m => ({ value: m.id, label: m.name, sub: [m.type, m.brand, m.model, m.identification].filter(Boolean).join(' · ') })));
registerSource('batch', (f, vals) => db.all('feed_batches').filter(b => num(b.balance_kg) > 0.0001 || b.id === vals?.batch_id)
  .sort((a, b) => a.date.localeCompare(b.date))
  .map(b => ({ value: b.id, label: batchLabel(b), sub: `${fmtDate(b.date)} · saldo ${fmtNum(b.balance_kg)} kg de ${fmtNum(b.total_kg)} kg`, search: b.lot_number })));

// ---------- Rebanho ----------
export const pregnancyOpen = (animalId) => db.where('animal_reproduction', r => r.animal_id === animalId && r.pregnancy_status === 'Confirmada' && !r.actual_calving)
  .sort((a, b) => b.date.localeCompare(a.date))[0] || null;
export const isPregnant = (a) => a && isActive(a) && (a.status === 'Gestante' || !!pregnancyOpen(a.id));
export const children = (id) => db.where('animals', a => a.sire_id === id || a.dam_id === id).sort((a, b) => (a.birth_date || '').localeCompare(b.birth_date || ''));
export const siblings = (a) => !a ? [] : db.where('animals', x => x.id !== a.id && ((a.dam_id && x.dam_id === a.dam_id) || (a.sire_id && x.sire_id === a.sire_id)));
// Registros de demonstração removidos não contam para numeração (os reais nunca são reutilizados)
const numbered = (t) => db.all(t, { withDeleted: true }).filter(r => !(r.is_demo && r.deleted_at));
export const maxAnimalCode = () => Math.max(0, ...numbered('animals').map(a => a.code || 0));

function isDescendant(ancestorId, id, depth = 0) {
  if (!id || depth > 30) return false;
  if (id === ancestorId) return true;
  const a = db.get('animals', id);
  return !!a && (isDescendant(ancestorId, a.sire_id, depth + 1) || isDescendant(ancestorId, a.dam_id, depth + 1));
}

function validateAnimal(v, id) {
  if (v.tag) {
    const dup = db.find('animals', a => a.id !== id && a.tag && String(a.tag).trim().toLowerCase() === String(v.tag).trim().toLowerCase());
    if (dup) throw new Error(`O brinco ${v.tag} já pertence a ${animalLabel(dup)}.`);
  }
  if (!v.name && !v.tag) throw new Error('Informe o nome ou o número do brinco.');
  for (const [k, sx, lbl] of [['sire_id', 'M', 'pai'], ['dam_id', 'F', 'mãe']]) {
    if (!v[k]) continue;
    if (id && v[k] === id) throw new Error(`O animal não pode ser ${lbl} dele mesmo.`);
    const p = db.get('animals', v[k]);
    if (p && p.sex !== sx) throw new Error(`O ${lbl} selecionado não é ${sx === 'M' ? 'macho' : 'fêmea'}.`);
    if (id && isDescendant(id, v[k])) throw new Error(`O ${lbl} selecionado é descendente deste animal.`);
  }
  if (v.birth_date && v.birth_date > today()) throw new Error('A data de nascimento não pode ser futura.');
}

export function saveAnimal(v, id = null) {
  validateAnimal(v, id);
  if (v.sire_id) v.sire_name = null;
  if (v.dam_id) v.dam_name = null;
  if (INACTIVE_STATUS.includes(v.status) && !v.exit_date) v.exit_date = today();
  if (!INACTIVE_STATUS.includes(v.status)) v.exit_date = null;
  if (id) return db.update('animals', id, v);
  const code = db.nextCounter('animal', maxAnimalCode());
  const a = db.insert('animals', { ...v, code, current_weight: v.current_weight ?? v.birth_weight ?? null });
  if (v.birth_weight && v.birth_date) db.insert('animal_weights', { animal_id: a.id, date: v.birth_date, weight: v.birth_weight, age_days: 0, notes: 'Peso ao nascimento', is_demo: v.is_demo }, { audit: false });
  return a;
}

// FLUXO 1 — NASCIMENTO
export function registerBirth(v) {
  const dam = db.get('animals', v.dam_id), sire = db.get('animals', v.sire_id);
  if (v.birth_date > today()) throw new Error('A data de nascimento não pode ser futura.');
  const repro = dam ? db.where('animal_reproduction', r => r.animal_id === dam.id && !r.actual_calving && r.pregnancy_status !== 'Negativa')
    .sort((a, b) => b.date.localeCompare(a.date))[0] : null;
  const sireId = v.sire_id || repro?.bull_id || null;
  const animal = saveAnimal({
    name: v.name, tag: v.tag, sex: v.sex, species: v.species || dam?.species || 'Bovino', breed: v.breed || dam?.breed || sire?.breed || null,
    category: v.category || 'Bezerro(a)', birth_date: v.birth_date, birth_weight: v.weight, current_weight: v.weight,
    sire_id: sireId, sire_name: sireId ? null : (v.sire_name || repro?.bull_name || null),
    dam_id: v.dam_id || null, dam_name: v.dam_id ? null : v.dam_name, entry_date: v.birth_date, origin: 'Nascido na fazenda',
    status: 'Ativo', notes: v.notes, is_demo: v.is_demo,
  });
  const number = db.nextCounter('birth', Math.max(0, ...numbered('animal_births').map(b => b.number || 0)));
  const birth = db.insert('animal_births', {
    number, animal_id: animal.id, birth_date: v.birth_date, sire_id: animal.sire_id, dam_id: animal.dam_id,
    sire_name: animal.sire_name, dam_name: animal.dam_name, weight: v.weight, responsible: v.responsible,
    reproduction_id: repro?.id || null, notes: v.notes, is_demo: v.is_demo,
  }, { description: `${db.getAuditUser()?.name || 'Sistema'} registrou o nascimento nº ${number}: ${animalLabel(animal)}${dam ? ', filho(a) de ' + animalName(dam) : ''}` });
  if (repro) db.update('animal_reproduction', repro.id, { actual_calving: v.birth_date, birth_id: birth.id, pregnancy_status: 'Confirmada' });
  if (dam && ['Gestante', 'Seco', 'Ativo'].includes(dam.status)) db.update('animals', dam.id, { status: 'Em produção', category: dam.category === 'Novilha' || dam.category === 'Vaca seca' ? 'Vaca em lactação' : dam.category });
  return { animal, birth };
}

// FLUXO 5 — MORTALIDADE
export function registerDeath(v) {
  const a = db.get('animals', v.animal_id);
  if (!a) throw new Error('Selecione o animal.');
  if (a.status === 'Morto') throw new Error('Este animal já está registrado como morto.');
  if (a.birth_date && v.date < a.birth_date) throw new Error('A data da morte é anterior ao nascimento.');
  const death = db.insert('animal_deaths', {
    animal_id: a.id, date: v.date, age_days: a.birth_date ? diffDays(a.birth_date, v.date) : null, cause: v.cause,
    notes: v.notes, responsible: v.responsible, is_demo: v.is_demo,
  }, { description: `${db.getAuditUser()?.name || 'Sistema'} registrou a morte de ${animalLabel(a)} (${v.cause || 'causa não informada'})` });
  db.update('animals', a.id, { status: 'Morto', exit_date: v.date });
  return death;
}

// FLUXO 2 — PRODUÇÃO DE LEITE (um registro por animal/data/ordenha)
export function saveMilk(v, id = null) {
  const a = db.get('animals', v.animal_id);
  if (!a) throw new Error('Selecione o animal.');
  if (a.sex !== 'F') throw new Error('Somente fêmeas podem ter produção de leite.');
  const l = num(v.liters);
  if (l < 0 || l > 100) throw new Error('Quantidade de litros inválida.');
  if (v.date > today()) throw new Error('A data não pode ser futura.');
  const existing = id ? db.get('milk_production', id) : db.find('milk_production', m => m.animal_id === a.id && m.date === v.date && m.shift === v.shift);
  let row;
  if (existing) row = db.update('milk_production', existing.id, { ...v, liters: l });
  else row = db.insert('milk_production', { ...v, liters: l });
  if (a.status === 'Ativo' || a.status === 'Seco') db.update('animals', a.id, { status: 'Em produção' });
  return { row, updated: !!existing };
}

// REPRODUÇÃO
export function saveRepro(v, id = null) {
  const a = db.get('animals', v.animal_id);
  if (!a) throw new Error('Selecione o animal.');
  if (a.sex !== 'F') throw new Error('Selecione uma fêmea.');
  if (!v.expected_calving && v.date) v.expected_calving = addDays(v.date, gestationDays(a.species));
  if (v.bull_id) v.bull_name = null;
  const row = id ? db.update('animal_reproduction', id, v) : db.insert('animal_reproduction', v);
  if (!v.actual_calving) {
    if (v.pregnancy_status === 'Confirmada' && ['Ativo', 'Seco'].includes(a.status)) db.update('animals', a.id, { status: 'Gestante' });
    if (v.pregnancy_status === 'Negativa' && a.status === 'Gestante') db.update('animals', a.id, { status: 'Ativo' });
  }
  return row;
}

// PESAGENS
export function saveWeight(v, id = null) {
  const a = db.get('animals', v.animal_id);
  if (!a) throw new Error('Selecione o animal.');
  v.age_days = a.birth_date ? diffDays(a.birth_date, v.date) : null;
  const row = id ? db.update('animal_weights', id, v) : db.insert('animal_weights', v);
  const last = db.where('animal_weights', w => w.animal_id === a.id).sort((x, y) => y.date.localeCompare(x.date))[0];
  if (last && num(last.weight) !== num(a.current_weight)) db.update('animals', a.id, { current_weight: num(last.weight) });
  return row;
}

// ---------- Estoque ----------
const signed = (m) => m.type === 'entrada' ? num(m.quantity) : m.type === 'saida' ? -num(m.quantity) : num(m.quantity);
function applyToProduct(productId, delta) {
  const p = db.get('inventory', productId); if (!p) return;
  db.update('inventory', p.id, { quantity: round(num(p.quantity) + delta, 4) }, { audit: false });
}
export function stockMove(v) {
  const p = db.get('inventory', v.product_id);
  if (!p) throw new Error('Selecione o produto.');
  const q = num(v.quantity);
  if (v.type !== 'ajuste' && !(q > 0)) throw new Error('Informe uma quantidade maior que zero.');
  if (v.type === 'entrada' && v.unit_cost != null && v.unit_cost !== '') {
    const oldQ = Math.max(0, num(p.quantity)), oldC = num(p.unit_cost), c = num(v.unit_cost);
    const avg = oldQ + q > 0 ? (oldQ * oldC + q * c) / (oldQ + q) : c;
    db.update('inventory', p.id, { unit_cost: round(avg, 4) }, { audit: false });
  }
  const unit_cost = v.unit_cost != null && v.unit_cost !== '' ? num(v.unit_cost) : num(p.unit_cost);
  const row = db.insert('inventory_movements', { ...v, quantity: q, unit_cost, total: round(Math.abs(q) * unit_cost, 2) });
  applyToProduct(p.id, signed(row));
  return row;
}
export function cancelMovement(id, reason = '') {
  const m = db.get('inventory_movements', id); if (!m || m.deleted_at) return;
  applyToProduct(m.product_id, -signed(m));
  db.remove('inventory_movements', id, { reason });
}
// Mantém uma movimentação vinculada a outro registro (saúde, abastecimento, manutenção)
export function syncLinkedMovement(refTable, refId, { product_id, quantity, date, reason, destination, responsible, is_demo }) {
  const old = db.find('inventory_movements', m => m.ref_table === refTable && m.ref_id === refId);
  if (old) cancelMovement(old.id, 'Registro de origem alterado');
  if (product_id && num(quantity) > 0) return stockMove({ product_id, type: 'saida', quantity: num(quantity), date, reason, destination, responsible, ref_table: refTable, ref_id: refId, is_demo });
  return null;
}
export const lowStock = () => db.where('inventory', p => p.active !== false && num(p.min_qty) > 0 && num(p.quantity) <= num(p.min_qty));
export const stockValue = (pred = () => true) => sum(db.where('inventory', p => p.active !== false && pred(p)), p => Math.max(0, num(p.quantity)) * num(p.unit_cost));

export function saveProduct(v, id = null) {
  if (v.code) {
    const dup = db.find('inventory', p => p.id !== id && p.code && p.code.toLowerCase() === v.code.toLowerCase());
    if (dup) throw new Error(`O código ${v.code} já é usado por ${dup.name}.`);
  }
  if (id) { const { quantity, ...rest } = v; return db.update('inventory', id, rest); }
  const initial = num(v.quantity);
  const p = db.insert('inventory', { ...v, quantity: 0, active: true, code: v.code || `P${pad(db.nextCounter('product', db.all('inventory').length), 4)}` });
  if (initial > 0) stockMove({ product_id: p.id, type: 'entrada', quantity: initial, unit_cost: v.unit_cost, date: today(), reason: 'Saldo inicial', responsible: db.getAuditUser()?.name, is_demo: v.is_demo });
  return db.get('inventory', p.id);
}

// Inventário: ajusta o saldo para a quantidade contada
export function inventoryCount(productId, counted, responsible, date = today()) {
  const p = db.get('inventory', productId);
  const delta = round(num(counted) - num(p.quantity), 4);
  if (Math.abs(delta) < 0.0001) return null;
  const row = db.insert('inventory_movements', { product_id: p.id, type: 'ajuste', quantity: delta, unit_cost: num(p.unit_cost), total: round(Math.abs(delta) * num(p.unit_cost), 2), date, reason: `Inventário: contado ${fmtNum(counted, 2)} ${p.unit} (sistema ${fmtNum(p.quantity, 2)})`, responsible });
  applyToProduct(p.id, delta);
  return row;
}

// ---------- Ração ----------
export const kgOf = (p, q) => {
  if (!p) return 0;
  if (p.unit === 'kg') return num(q);
  if (p.unit === 't') return num(q) * 1000;
  return num(q) * (num(p.unit_weight_kg) || 0);
};
export function feedShortfalls(items) {
  return items.filter(i => i.product_id).map(i => ({ p: db.get('inventory', i.product_id), q: num(i.quantity) }))
    .filter(x => x.p && x.q > num(x.p.quantity)).map(x => `${x.p.name}: precisa ${fmtNum(x.q, 2)} ${x.p.unit}, saldo ${fmtNum(x.p.quantity, 2)} ${x.p.unit}`);
}
export const nextLotNumber = () => pad(Math.max(db.setting('counters', {}).feed_lot || 0, ...numbered('feed_batches').map(b => parseInt(b.lot_number) || 0)) + 1, 6);

// FLUXO 3 — FABRICAÇÃO (batida da ração)
export function fabricateFeed(v) {
  const items = (v.items || []).filter(i => i.product_id && num(i.quantity) > 0);
  if (!items.length) throw new Error('Adicione pelo menos um ingrediente com quantidade.');
  let lot = v.lot_number;
  const maxLot = Math.max(0, ...numbered('feed_batches').map(b => parseInt(b.lot_number) || 0));
  if (!lot) lot = pad(db.nextCounter('feed_lot', maxLot), 6);
  else {
    if (db.find('feed_batches', b => b.lot_number === lot)) throw new Error(`O lote ${lot} já existe.`);
    if (parseInt(lot) > (db.setting('counters', {}).feed_lot || 0)) db.setSetting('counters', { ...db.setting('counters', {}), feed_lot: parseInt(lot) || 0 });
  }
  const lines = items.map(i => { const p = db.get('inventory', i.product_id); return { p, quantity: num(i.quantity), kg: round(kgOf(p, i.quantity), 3), unit_cost: num(p.unit_cost) }; });
  const computedKg = round(sum(lines, l => l.kg), 2);
  const total = num(v.total_kg) > 0 ? num(v.total_kg) : computedKg;
  if (!(total > 0)) throw new Error('Não foi possível calcular o total em kg. Informe o peso por saco dos ingredientes ou o Kg total.');
  const cost = round(sum(lines, l => l.quantity * l.unit_cost), 2);
  const batch = db.insert('feed_batches', {
    lot_number: lot, date: v.date, time: v.time, operator_id: v.operator_id, feed_type: v.feed_type,
    total_kg: total, balance_kg: total, cost_total: cost, cost_per_kg: round(cost / total, 4), notes: v.notes, is_demo: v.is_demo,
  }, { description: `${db.getAuditUser()?.name || 'Sistema'} fabricou o lote ${lot} (${v.feed_type}, ${fmtNum(total)} kg)` });
  for (const l of lines) {
    db.insert('feed_batch_items', { batch_id: batch.id, product_id: l.p.id, quantity: l.quantity, kg: l.kg, unit_cost: l.unit_cost, is_demo: v.is_demo }, { audit: false });
    stockMove({ product_id: l.p.id, type: 'saida', quantity: l.quantity, date: v.date, reason: `Fabricação de ração — lote ${lot}`, destination: 'Fábrica de ração', responsible: employeeName(v.operator_id), ref_table: 'feed_batches', ref_id: batch.id, is_demo: v.is_demo });
  }
  return batch;
}
export function cancelBatch(id, reason) {
  const b = db.get('feed_batches', id);
  if (db.where('feed_distribution', d => d.batch_id === id).length) throw new Error('Este lote já possui distribuições. Exclua as distribuições antes de cancelar o lote.');
  db.where('inventory_movements', m => m.ref_table === 'feed_batches' && m.ref_id === id).forEach(m => cancelMovement(m.id, 'Lote cancelado'));
  db.where('feed_batch_items', i => i.batch_id === id).forEach(i => db.remove('feed_batch_items', i.id, { audit: false }));
  db.remove('feed_batches', b.id, { reason });
}
export function recomputeBatch(id) {
  const b = db.get('feed_batches', id); if (!b) return;
  const used = sum(db.where('feed_distribution', d => d.batch_id === id), d => d.quantity_kg);
  db.update('feed_batches', id, { balance_kg: round(num(b.total_kg) - used, 3) }, { audit: false });
}

// FLUXO 4 — DISTRIBUIÇÃO
export function distributeFeed(v, id = null) {
  const b = db.get('feed_batches', v.batch_id);
  if (!b) throw new Error('Selecione o lote de ração.');
  const q = num(v.quantity_kg);
  if (!(q > 0)) throw new Error('Informe a quantidade em kg.');
  const prev = id ? num(db.get('feed_distribution', id)?.quantity_kg) : 0;
  const prevBatch = id ? db.get('feed_distribution', id)?.batch_id : null;
  const available = num(b.balance_kg) + (prevBatch === b.id ? prev : 0);
  if (q > available + 0.001) throw new Error(`Saldo insuficiente no lote ${b.lot_number}: disponível ${fmtNum(available)} kg.`);
  const n = num(v.animals_count);
  const row = { ...v, feed_type: b.feed_type, quantity_kg: q, animals_count: n || null, kg_per_animal: n > 0 ? round(q / n, 3) : null };
  const saved = id ? db.update('feed_distribution', id, row) : db.insert('feed_distribution', row);
  recomputeBatch(b.id);
  if (prevBatch && prevBatch !== b.id) recomputeBatch(prevBatch);
  return saved;
}
export function removeDistribution(id, reason) {
  const d = db.get('feed_distribution', id);
  db.remove('feed_distribution', id, { reason });
  recomputeBatch(d.batch_id);
}
export const feedStock = () => db.where('feed_batches', b => num(b.balance_kg) > 0.0001);

// ---------- Máquinas ----------
export function serviceHours(v) {
  const hs = num(v.hourmeter_start), he = num(v.hourmeter_end);
  if (v.hourmeter_start != null && v.hourmeter_start !== '' && v.hourmeter_end != null && v.hourmeter_end !== '' && he >= hs) return round(he - hs, 2);
  return hoursBetween(v.start_time, v.end_time);
}
function bumpHourmeter(machineId, h) {
  const m = db.get('machines', machineId);
  if (m && num(h) > num(m.hourmeter)) db.update('machines', m.id, { hourmeter: num(h) }, { audit: false });
}
// FLUXO 6 — SERVIÇO DE MÁQUINA
export function saveService(v, id = null) {
  if (!db.get('machines', v.machine_id)) throw new Error('Selecione a máquina.');
  if (v.hourmeter_start != null && v.hourmeter_end != null && num(v.hourmeter_end) < num(v.hourmeter_start)) throw new Error('O horímetro final é menor que o inicial.');
  const hours = serviceHours(v);
  if (!(hours > 0)) throw new Error('Informe início e fim (ou horímetro inicial e final) para calcular as horas.');
  const row = { ...v, hours };
  const saved = id ? db.update('machine_services', id, row) : db.insert('machine_services', row);
  if (v.hourmeter_end) bumpHourmeter(v.machine_id, v.hourmeter_end);
  // combustível informado no serviço gera (ou atualiza) um abastecimento vinculado
  const fuel = db.find('fuel_records', f => f.service_id === saved.id);
  if (num(v.fuel_liters) > 0) {
    const m = db.get('machines', v.machine_id);
    const data = { date: v.date, machine_id: v.machine_id, fuel_type: fuel?.fuel_type || m.fuel_type || list('fuel_types')[0], liters: num(v.fuel_liters), responsible: employeeName(v.operator_id), hourmeter: v.hourmeter_end, service_id: saved.id, notes: 'Informado no serviço', is_demo: v.is_demo };
    if (fuel) db.update('fuel_records', fuel.id, data, { audit: false }); else db.insert('fuel_records', data, { audit: false });
  } else if (fuel) db.remove('fuel_records', fuel.id, { audit: false });
  return saved;
}
export function saveMaintenance(v, id = null) {
  const saved = id ? db.update('machine_maintenance', id, v) : db.insert('machine_maintenance', v);
  if (v.hourmeter) bumpHourmeter(v.machine_id, v.hourmeter);
  syncLinkedMovement('machine_maintenance', saved.id, { product_id: v.product_id, quantity: v.product_qty, date: v.date, reason: `Manutenção — ${machineName(v.machine_id)}`, destination: machineName(v.machine_id), responsible: v.responsible, is_demo: v.is_demo });
  return saved;
}
export function saveFuel(v, id = null) {
  if (!(num(v.liters) > 0)) throw new Error('Informe a quantidade de litros.');
  const saved = id ? db.update('fuel_records', id, v) : db.insert('fuel_records', v);
  if (v.hourmeter) bumpHourmeter(v.machine_id, v.hourmeter);
  syncLinkedMovement('fuel_records', saved.id, { product_id: v.product_id, quantity: v.liters, date: v.date, reason: `Abastecimento — ${machineName(v.machine_id)}`, destination: machineName(v.machine_id), responsible: v.responsible, is_demo: v.is_demo });
  return saved;
}

// ---------- Saúde ----------
export function saveHealth(v, id = null) {
  if (!db.get('animals', v.animal_id)) throw new Error('Selecione o animal.');
  const saved = id ? db.update('animal_health', id, v) : db.insert('animal_health', v);
  syncLinkedMovement('animal_health', saved.id, { product_id: v.product_id, quantity: v.quantity, date: v.date, reason: `${v.type} — ${animalLabel(db.get('animals', v.animal_id))}`, destination: 'Rebanho', responsible: v.responsible, is_demo: v.is_demo });
  return saved;
}

// ---------- Funcionários / folha ----------
export function validCPF(cpf) {
  const c = String(cpf || '').replace(/\D/g, '');
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  const dv = (n) => { let s = 0; for (let i = 0; i < n; i++) s += +c[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === +c[9] && dv(10) === +c[10];
}
export function saveEmployee(v, id = null) {
  if (v.cpf) {
    if (!validCPF(v.cpf)) throw new Error('CPF inválido. Verifique os números.');
    const dup = db.find('employees', e => e.id !== id && e.cpf && e.cpf.replace(/\D/g, '') === v.cpf.replace(/\D/g, ''));
    if (dup) throw new Error(`Este CPF já está cadastrado para ${dup.name}.`);
  }
  return id ? db.update('employees', id, v) : db.insert('employees', v);
}
export function saveAdvance(v, id = null) {
  const n = Math.max(1, parseInt(v.installments) || 1);
  const row = { ...v, installments: n, installment_value: round(num(v.amount) / n, 2), first_month: v.first_month || monthKey(v.date), status: v.status || 'Aberto' };
  return id ? db.update('employee_advances', id, row) : db.insert('employee_advances', row);
}
// Parcelas de vales/adiantamentos que caem no mês
export function advancesDue(employeeId, month) {
  return db.where('employee_advances', a => a.employee_id === employeeId && a.status !== 'Cancelado').map(a => {
    const first = a.first_month || monthKey(a.date);
    const idx = [...Array(a.installments || 1).keys()].find(i => addMonthKey(first, i) === month);
    return idx == null ? null : { adv: a, n: idx + 1, value: num(a.installment_value) || num(a.amount) };
  }).filter(Boolean);
}
export function payrollParts(employeeId, month) {
  const cfg = payrollCfg();
  const due = advancesDue(employeeId, month);
  const vales = cfg.include_vales ? round(sum(due.filter(d => d.adv.type === 'Vale'), d => d.value), 2) : 0;
  const advances = cfg.include_advances ? round(sum(due.filter(d => d.adv.type !== 'Vale'), d => d.value), 2) : 0;
  const discounts = cfg.include_discounts ? round(sum(db.where('employee_discounts', d => d.employee_id === employeeId && (d.month || monthKey(d.date)) === month), d => d.amount), 2) : 0;
  return { vales_value: vales, advances_value: advances, discounts_value: discounts };
}
export const overtimeValue = (salary, hours) => { const c = payrollCfg(); return round(num(salary) / (num(c.hours_month) || 220) * num(c.overtime_rate) * num(hours), 2); };
export const netSalary = (p) => round(num(p.base_salary) + num(p.additions) + num(p.overtime_value) + num(p.others) - num(p.vales_value) - num(p.discounts_value) - num(p.advances_value), 2);

export function generatePayroll(month) {
  let created = 0, updated = 0;
  for (const e of db.where('employees', e => e.status !== 'Desligado')) {
    if (e.admission_date && monthKey(e.admission_date) > month) continue;
    const ex = db.find('employee_payments', p => p.employee_id === e.id && p.month === month);
    if (ex) { if (ex.status !== 'Pago') { recalcPayment(ex.id); updated++; } continue; }
    const row = { employee_id: e.id, month, base_salary: num(e.salary), additions: 0, overtime_hours: 0, overtime_value: 0, others: 0, ...payrollParts(e.id, month), status: 'Pendente' };
    row.net = netSalary(row);
    db.insert('employee_payments', row);
    created++;
  }
  return { created, updated };
}
export function recalcPayment(id) {
  const p = db.get('employee_payments', id);
  if (!p || p.status === 'Pago') return p;
  const row = { ...p, ...payrollParts(p.employee_id, p.month) };
  row.net = netSalary(row);
  return db.update('employee_payments', id, { vales_value: row.vales_value, advances_value: row.advances_value, discounts_value: row.discounts_value, net: row.net });
}
export function savePayment(v, id = null) {
  const e = db.get('employees', v.employee_id);
  if (!e) throw new Error('Selecione o funcionário.');
  if (!id && db.find('employee_payments', p => p.employee_id === v.employee_id && p.month === v.month)) throw new Error('Já existe lançamento deste funcionário neste mês. Edite o lançamento existente.');
  const row = { ...v };
  row.overtime_value = v.overtime_value != null && v.overtime_value !== '' ? num(v.overtime_value) : overtimeValue(v.base_salary, v.overtime_hours);
  row.net = netSalary(row);
  if (row.status === 'Pago' && !row.payment_date) row.payment_date = today();
  const saved = id ? db.update('employee_payments', id, row) : db.insert('employee_payments', row);
  if (saved.status === 'Pago') refreshAdvanceStatus(saved.employee_id);
  return saved;
}
export function refreshAdvanceStatus(employeeId) {
  const paidMonths = new Set(db.where('employee_payments', p => p.employee_id === employeeId && p.status === 'Pago').map(p => p.month));
  for (const a of db.where('employee_advances', a => a.employee_id === employeeId && a.status !== 'Cancelado')) {
    const first = a.first_month || monthKey(a.date);
    const allPaid = [...Array(a.installments || 1).keys()].every(i => paidMonths.has(addMonthKey(first, i)));
    const st = allPaid ? 'Quitado' : 'Aberto';
    if (a.status !== st) db.update('employee_advances', a.id, { status: st });
  }
}

// ---------- Exclusão segura ----------
// Retorna motivo de bloqueio (vínculos que seriam quebrados) ou null
export function deleteBlocker(table, id) {
  if (table === 'animals') {
    const n = db.count('milk_production', m => m.animal_id === id) + db.count('animal_births', b => b.animal_id === id) + children(id).length;
    if (n) return 'Este animal possui histórico (produção, nascimento ou filhos). Em vez de excluir, altere a situação (Vendido, Transferido, Morto…).';
  }
  if (table === 'employees' && (db.count('employee_payments', p => p.employee_id === id) || db.count('machine_services', s => s.operator_id === id)))
    return 'Este funcionário possui histórico. Altere a situação para "Desligado" em vez de excluir.';
  if (table === 'inventory' && db.count('inventory_movements', m => m.product_id === id)) return 'Este produto possui movimentações. Desative o produto em vez de excluir.';
  if (table === 'machines' && (db.count('machine_services', s => s.machine_id === id) || db.count('fuel_records', f => f.machine_id === id))) return 'Esta máquina possui histórico. Altere a situação para "Vendida" ou "Parada".';
  return null;
}
export function deleteRecord(table, id, reason) {
  const block = deleteBlocker(table, id);
  if (block) throw new Error(block);
  const r = db.get(table, id);
  if (table === 'animal_deaths') { db.remove(table, id, { reason }); const a = db.get('animals', r.animal_id); if (a?.status === 'Morto') db.update('animals', a.id, { status: 'Ativo', exit_date: null }); return; }
  if (table === 'animal_births') { db.remove(table, id, { reason }); return; }
  if (table === 'feed_distribution') return removeDistribution(id, reason);
  if (table === 'feed_batches') return cancelBatch(id, reason);
  if (table === 'inventory_movements') { if (r.ref_table) throw new Error('Esta movimentação foi gerada automaticamente por outro registro. Altere o registro de origem.'); return cancelMovement(id, reason); }
  if (['animal_health', 'fuel_records', 'machine_maintenance'].includes(table)) syncLinkedMovement(table, id, {});
  if (table === 'machine_services') { const f = db.find('fuel_records', x => x.service_id === id); if (f) db.remove('fuel_records', f.id, { reason }); }
  db.remove(table, id, { reason });
  if (table === 'animal_weights') { const a = db.get('animals', r.animal_id); const last = db.where('animal_weights', w => w.animal_id === r.animal_id).sort((x, y) => y.date.localeCompare(x.date))[0]; if (a && last) db.update('animals', a.id, { current_weight: last.weight }, { audit: false }); }
}
