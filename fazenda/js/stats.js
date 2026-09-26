// Indicadores calculados a partir dos dados reais (usados no painel, fichas e relatórios).
import * as db from './db.js';
import { inRange, daysOf, monthsOf, num, sum, round, groupBy, today, addDays, toISODate, parseDate, monthKey } from './util.js';
import { isActive, isPregnant, animalName } from './services.js';

// ---------- Rebanho ----------
export const entryDate = (a) => a.entry_date || a.birth_date || (a.created_at || '').slice(0, 10);
export function herdCounts() {
  const all = db.all('animals');
  const active = all.filter(isActive);
  return {
    total: all.length, active: active.length,
    producing: active.filter(a => a.status === 'Em produção').length,
    pregnant: active.filter(isPregnant).length,
    females: active.filter(a => a.sex === 'F').length, males: active.filter(a => a.sex === 'M').length,
  };
}
export const herdAt = (date) => db.all('animals').filter(a => entryDate(a) <= date && (!a.exit_date || a.exit_date > date)).length;
export const birthsIn = (r) => db.where('animal_births', b => inRange(b.birth_date, r));
export const deathsIn = (r) => db.where('animal_deaths', d => inRange(d.date, r));

// ---------- Leite ----------
export const milkIn = (r, animalId = null) => db.where('milk_production', m => inRange(m.date, r) && (!animalId || m.animal_id === animalId));
export const milkTotal = (r, animalId) => round(sum(milkIn(r, animalId), m => m.liters), 2);
export function milkByDay(r, animalId) {
  const g = groupBy(milkIn(r, animalId), m => m.date);
  return daysOf(r).map(d => ({ date: d, liters: round(sum(g.get(d) || [], m => m.liters), 2) }));
}
export function milkByMonth(r, animalId) {
  const g = groupBy(milkIn(r, animalId), m => monthKey(m.date));
  return monthsOf(r).map(mk => ({ month: mk, liters: round(sum(g.get(mk) || [], m => m.liters), 2) }));
}
// Média por animal/dia: total ÷ nº de pares (animal, dia) com ordenha registrada
export function milkAvgPerAnimal(r) {
  const rows = milkIn(r);
  const pairs = new Set(rows.map(m => m.animal_id + '|' + m.date));
  return pairs.size ? round(sum(rows, m => m.liters) / pairs.size, 2) : 0;
}
export const milkAnimalsCount = (r) => new Set(milkIn(r).map(m => m.animal_id)).size;
// Linhas diárias de um animal: manhã, tarde, total
export function animalDaily(animalId, r) {
  const g = groupBy(milkIn(r, animalId), m => m.date);
  return [...g.entries()].map(([date, rows]) => {
    const manha = sum(rows.filter(x => x.shift === 'manha'), x => x.liters), tarde = sum(rows.filter(x => x.shift === 'tarde'), x => x.liters);
    return { date, manha: round(manha, 2), tarde: round(tarde, 2), total: round(manha + tarde, 2), rows };
  }).sort((a, b) => b.date.localeCompare(a.date));
}
// Total e média diária (sobre dias com ordenha) num período
export function periodStat(animalId, r) {
  const d = animalDaily(animalId, r);
  const total = round(sum(d, x => x.total), 2);
  return { total, days: d.length, avg: d.length ? round(total / d.length, 2) : 0 };
}
export function animalMilkSummary(animalId) {
  const t = today();
  const all = db.where('milk_production', m => m.animal_id === animalId);
  const first = all.map(m => m.date).sort()[0];
  return {
    today: milkTotal({ from: t, to: t }, animalId),
    avg30: periodStat(animalId, { from: addDays(t, -29), to: t }).avg,
    total: round(sum(all, m => m.liters), 2),
    first, last: all.map(m => m.date).sort().pop(),
  };
}
// Ranking por animal no período
export function milkByAnimal(r) {
  const g = groupBy(milkIn(r), m => m.animal_id);
  return [...g.entries()].map(([id, rows]) => {
    const days = new Set(rows.map(x => x.date)).size;
    const total = round(sum(rows, x => x.liters), 2);
    return { animal: db.get('animals', id), animal_id: id, total, days, avg: days ? round(total / days, 2) : 0 };
  }).sort((a, b) => b.total - a.total);
}

// ---------- Ração ----------
export const batchesIn = (r) => db.where('feed_batches', b => inRange(b.date, r));
export const distributionsIn = (r) => db.where('feed_distribution', d => inRange(d.date, r));
export const feedProduced = (r) => round(sum(batchesIn(r), b => b.total_kg), 2);
export const feedDistributed = (r) => round(sum(distributionsIn(r), d => d.quantity_kg), 2);
export const feedBalance = () => round(sum(db.all('feed_batches'), b => Math.max(0, num(b.balance_kg))), 2);
export function feedByDay(r, which = 'dist') {
  const src = which === 'dist' ? distributionsIn(r) : batchesIn(r);
  const g = groupBy(src, x => x.date);
  return daysOf(r).map(d => ({ date: d, kg: round(sum(g.get(d) || [], x => which === 'dist' ? x.quantity_kg : x.total_kg), 2) }));
}
// Consumo médio por animal/dia = Σ kg ÷ Σ animais tratados (por distribuição)
export function feedPerAnimal(r) {
  const d = distributionsIn(r).filter(x => num(x.animals_count) > 0);
  const animals = sum(d, x => x.animals_count);
  return animals ? round(sum(d, x => x.quantity_kg) / animals, 2) : 0;
}

// ---------- Máquinas ----------
export const servicesIn = (r) => db.where('machine_services', s => inRange(s.date, r));
export const machineHours = (r) => round(sum(servicesIn(r), s => s.hours), 2);
export function hoursByMachine(r) {
  const g = groupBy(servicesIn(r), s => s.machine_id);
  return [...g.entries()].map(([id, rows]) => ({ machine: db.get('machines', id), hours: round(sum(rows, x => x.hours), 2), services: rows.length }))
    .sort((a, b) => b.hours - a.hours);
}
export const fuelIn = (r) => db.where('fuel_records', f => inRange(f.date, r));

// ---------- Série mensal do rebanho ----------
export function herdEvolution(months = 12) {
  const out = [];
  const d = new Date(); d.setDate(1);
  for (let i = months - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i + 1, 0); // último dia do mês
    const end = toISODate(x) > today() ? today() : toISODate(x);
    out.push({ month: monthKey(end), count: herdAt(end) });
  }
  return out;
}
export function birthsDeathsByMonth(r) {
  const b = groupBy(birthsIn(r), x => monthKey(x.birth_date)), dd = groupBy(deathsIn(r), x => monthKey(x.date));
  return monthsOf(r).map(mk => ({ month: mk, births: (b.get(mk) || []).length, deaths: (dd.get(mk) || []).length }));
}
export const ageYears = (a, ref = today()) => a.birth_date ? (parseDate(ref) - parseDate(a.birth_date)) / (365.25 * 86400000) : null;
export function ageBand(a, ref) {
  const y = ageYears(a, ref); if (y == null) return 'Sem data';
  if (y < 1) return '0–12 meses'; if (y < 2) return '1–2 anos'; if (y < 4) return '2–4 anos'; if (y < 8) return '4–8 anos'; return '8+ anos';
}
export { animalName };
