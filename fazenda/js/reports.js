// Central de relatórios: definição de cada relatório (filtros + cálculo).
import * as db from './db.js';
import * as S from './services.js';
import * as St from './stats.js';
import { list } from './config.js';
import { today, fmtDate, fmtNum, fmtMoney, fmtHours, fmtMonth, fmtAge, inRange, sum, groupBy, num, monthKey, parseDate, toISODate, addDays, daysOf, round } from './util.js';
import { shiftLabel, INACTIVE_STATUS } from './config.js';

// Formatadores de coluna
export const FMT = {
  date: fmtDate, int: (v) => fmtNum(v, 0), num: (v) => fmtNum(v, 1), num2: (v) => fmtNum(v, 2), money: fmtMoney,
  L: (v) => `${fmtNum(v, 1)} L`, kg: (v) => `${fmtNum(v, 1)} kg`, h: fmtHours, pct: (v) => v == null ? '—' : `${fmtNum(v, 1)}%`, month: fmtMonth,
};
const col = (key, label, type = 'text', opts = {}) => ({ key, label, type, ...opts });
const aLabel = (id, name) => { const a = db.get('animals', id); return a ? S.animalLabel(a) : (name || '—'); };

const weekKey = (d) => { const x = parseDate(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); return toISODate(x); };
const GROUPS = {
  dia: { label: 'Dia', key: (d) => d, fmt: fmtDate },
  semana: { label: 'Semana', key: weekKey, fmt: (k) => `Semana de ${fmtDate(k)}` },
  mes: { label: 'Mês', key: monthKey, fmt: fmtMonth },
  semestre: { label: 'Semestre', key: (d) => `${d.slice(0, 4)}-S${+d.slice(5, 7) <= 6 ? 1 : 2}`, fmt: (k) => `${k.slice(6)}º semestre/${k.slice(0, 4)}` },
  ano: { label: 'Ano', key: (d) => d.slice(0, 4), fmt: (k) => k },
};
const groupOpt = (def = 'mes') => ({ key: 'group', label: 'Agrupar por', options: Object.entries(GROUPS).map(([k, g]) => [k, g.label]), default: def });

export const CATEGORIES = [
  ['rebanho', 'Rebanho', 'cow', 'herd.view'], ['producao', 'Produção de leite', 'milk', 'milk.view'], ['racao', 'Ração', 'wheat', 'feed.view'],
  ['maquinas', 'Máquinas', 'tractor', 'machines.view'], ['funcionarios', 'Funcionários', 'users', 'employees.view'], ['estoque', 'Estoque', 'package', 'inventory.view'],
];

export const REPORTS = [
  // ---------------- REBANHO ----------------
  { id: 'rebanho-total', cat: 'rebanho', title: 'Rebanho atual', period: false,
    extra: [{ key: 'scope', label: 'Animais', options: [['ativos', 'Somente ativos'], ['todos', 'Todos']], default: 'ativos' }],
    build: (f) => {
      const rows = db.all('animals').filter(a => f.scope === 'todos' || S.isActive(a));
      const g = [...groupBy(rows, a => a.status)];
      return {
        summary: [['Total', rows.length], ...g.map(([k, v]) => [k, v.length])],
        chart: { type: 'doughnut', labels: g.map(x => x[0]), data: g.map(x => x[1].length) },
        columns: [col('code', 'ID'), col('name', 'Nome'), col('tag', 'Brinco'), col('sex', 'Sexo'), col('breed', 'Raça'), col('category', 'Categoria'), col('birth', 'Nascimento', 'date'), col('age', 'Idade'), col('weight', 'Peso (kg)', 'num'), col('status', 'Situação'), col('sire', 'Pai'), col('dam', 'Mãe')],
        rows: rows.sort((a, b) => a.code - b.code).map(a => ({ code: S.animalCode(a), name: a.name, tag: a.tag, sex: S.sexLabel(a.sex), breed: a.breed, category: a.category, birth: a.birth_date, age: fmtAge(a.birth_date), weight: a.current_weight, status: a.status, sire: aLabel(a.sire_id, a.sire_name), dam: aLabel(a.dam_id, a.dam_name) })),
      };
    } },
  ...[['sexo', 'Rebanho por sexo', (a) => S.sexLabel(a.sex)], ['raca', 'Rebanho por raça', (a) => a.breed || 'Não informada'], ['idade', 'Rebanho por idade', St.ageBand], ['categoria', 'Rebanho por categoria', (a) => a.category || 'Não informada']].map(([id, title, fn]) => ({
    id: 'rebanho-' + id, cat: 'rebanho', title, period: false,
    build: () => {
      const rows = db.all('animals').filter(S.isActive);
      const g = [...groupBy(rows, fn)].sort((a, b) => b[1].length - a[1].length);
      return {
        summary: [['Animais ativos', rows.length]], chart: { type: 'doughnut', labels: g.map(x => x[0]), data: g.map(x => x[1].length) },
        columns: [col('k', 'Grupo'), col('n', 'Quantidade', 'int'), col('f', 'Fêmeas', 'int'), col('m', 'Machos', 'int'), col('p', '% do rebanho', 'pct')],
        rows: g.map(([k, v]) => ({ k, n: v.length, f: v.filter(a => a.sex === 'F').length, m: v.filter(a => a.sex === 'M').length, p: v.length / rows.length * 100 })),
        totals: { k: 'Total', n: rows.length, f: rows.filter(a => a.sex === 'F').length, m: rows.filter(a => a.sex === 'M').length, p: 100 },
      };
    },
  })),
  { id: 'rebanho-nascimentos', cat: 'rebanho', title: 'Nascimentos', defaultPeriod: 'year',
    build: (f) => {
      const rows = St.birthsIn(f.range);
      const an = (b) => db.get('animals', b.animal_id) || {};
      return {
        summary: [['Nascimentos', rows.length], ['Fêmeas', rows.filter(b => an(b).sex === 'F').length], ['Machos', rows.filter(b => an(b).sex === 'M').length], ['Peso médio (kg)', fmtNum(sum(rows.filter(b => b.weight), b => b.weight) / (rows.filter(b => b.weight).length || 1))]],
        chart: { type: 'bar', labels: St.birthsDeathsByMonth(f.range).map(x => fmtMonth(x.month)), data: St.birthsDeathsByMonth(f.range).map(x => x.births), label: 'Nascimentos' },
        columns: [col('number', 'Nº', 'int'), col('name', 'Nome da cria'), col('code', 'ID'), col('tag', 'Brinco'), col('date', 'Nascimento', 'date'), col('sex', 'Sexo'), col('breed', 'Raça'), col('sire', 'Pai'), col('dam', 'Mãe'), col('weight', 'Peso ao nascer (kg)', 'num'), col('resp', 'Responsável'), col('notes', 'Observação')],
        rows: rows.sort((a, b) => a.number - b.number).map(b => ({ number: b.number, name: S.animalName(an(b)), code: S.animalCode(an(b)), tag: an(b).tag, date: b.birth_date, sex: S.sexLabel(an(b).sex), breed: an(b).breed, sire: aLabel(b.sire_id, b.sire_name), dam: aLabel(b.dam_id, b.dam_name), weight: b.weight, resp: b.responsible, notes: b.notes })),
      };
    } },
  { id: 'rebanho-mortalidade', cat: 'rebanho', title: 'Mortalidade', defaultPeriod: 'year',
    extra: [{ key: 'by', label: 'Agrupar por', options: [['cause', 'Causa'], ['sex', 'Sexo'], ['breed', 'Raça'], ['age', 'Faixa etária'], ['dia', 'Dia'], ['semana', 'Semana'], ['mes', 'Mês'], ['semestre', 'Semestre'], ['ano', 'Ano']], default: 'cause' }],
    build: (f) => {
      const rows = St.deathsIn(f.range);
      const an = (d) => db.get('animals', d.animal_id) || {};
      const key = { cause: (d) => d.cause || 'Não informada', sex: (d) => S.sexLabel(an(d).sex), breed: (d) => an(d).breed || 'Não informada', age: (d) => St.ageBand(an(d), d.date) }[f.by] || ((d) => GROUPS[f.by].key(d.date));
      const fmtK = GROUPS[f.by]?.fmt || ((k) => k);
      const g = [...groupBy(rows, key)].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
      return {
        summary: [['Mortes', rows.length], ['Taxa sobre o rebanho', FMT.pct(rows.length / ((St.herdCounts().active + rows.length) || 1) * 100)]],
        chart: { type: 'bar', labels: g.map(x => fmtK(x[0])), data: g.map(x => x[1].length), label: 'Mortes' },
        groupTable: { columns: [col('k', 'Grupo'), col('n', 'Mortes', 'int')], rows: g.map(([k, v]) => ({ k: fmtK(k), n: v.length })) },
        columns: [col('date', 'Data', 'date'), col('animal', 'Animal'), col('age', 'Idade'), col('sex', 'Sexo'), col('breed', 'Raça'), col('cause', 'Causa'), col('resp', 'Responsável'), col('notes', 'Observações')],
        rows: rows.sort((a, b) => a.date.localeCompare(b.date)).map(d => ({ date: d.date, animal: aLabel(d.animal_id), age: fmtAge(an(d).birth_date, d.date), sex: S.sexLabel(an(d).sex), breed: an(d).breed, cause: d.cause, resp: d.responsible, notes: d.notes })),
      };
    } },
  { id: 'rebanho-evolucao', cat: 'rebanho', title: 'Evolução do rebanho', period: false,
    extra: [{ key: 'months', label: 'Meses', options: [['6', '6 meses'], ['12', '12 meses'], ['24', '24 meses']], default: '12' }],
    build: (f) => {
      const ev = St.herdEvolution(+f.months);
      const rows = ev.map(x => {
        const r = { from: `${x.month}-01`, to: `${x.month}-31` };
        return { month: x.month, count: x.count, births: St.birthsIn(r).length, deaths: St.deathsIn(r).length, entries: db.count('animals', a => a.origin !== 'Nascido na fazenda' && inRange(St.entryDate(a), r)), exits: db.count('animals', a => a.exit_date && a.status !== 'Morto' && inRange(a.exit_date, r)) };
      });
      return { summary: [['Rebanho atual', St.herdCounts().active]], chart: { type: 'line', labels: rows.map(r => fmtMonth(r.month)), data: rows.map(r => r.count), label: 'Animais' },
        columns: [col('month', 'Mês', 'month'), col('count', 'Rebanho no fim do mês', 'int'), col('births', 'Nascimentos', 'int'), col('entries', 'Entradas (compras)', 'int'), col('deaths', 'Mortes', 'int'), col('exits', 'Saídas (vendas/transf.)', 'int')], rows };
    } },

  // ---------------- PRODUÇÃO ----------------
  { id: 'producao-animal', cat: 'producao', title: 'Produção por animal', defaultPeriod: '30d',
    build: (f) => {
      const rows = St.milkByAnimal(f.range);
      return { summary: [['Total (L)', fmtNum(sum(rows, r => r.total))], ['Animais', rows.length], ['Média por animal/dia (L)', fmtNum(St.milkAvgPerAnimal(f.range))]],
        chart: { type: 'bar', labels: rows.slice(0, 20).map(r => S.animalName(r.animal)), data: rows.slice(0, 20).map(r => r.total), label: 'Litros' },
        columns: [col('animal', 'Animal'), col('status', 'Situação'), col('total', 'Total (L)', 'num'), col('days', 'Dias ordenhados', 'int'), col('avg', 'Média diária (L)', 'num2')],
        rows: rows.map(r => ({ animal: S.animalLabel(r.animal), status: r.animal?.status, total: r.total, days: r.days, avg: r.avg })), totals: { animal: 'Total', total: sum(rows, r => r.total) } };
    } },
  ...[['dia', 'Produção por dia', '30d'], ['semana', 'Produção por semana', '3m'], ['mes', 'Produção por mês', 'year'], ['semestre', 'Produção por semestre', 'year'], ['ano', 'Produção por ano', 'year']].map(([g, title, dp]) => ({
    id: 'producao-' + g, cat: 'producao', title, defaultPeriod: dp,
    build: (f) => {
      const G = GROUPS[g];
      const rows = St.milkIn(f.range);
      const gr = [...groupBy(rows, m => G.key(m.date))].sort((a, b) => a[0].localeCompare(b[0])).map(([k, ms]) => {
        const days = new Set(ms.map(m => m.date)).size, pairs = new Set(ms.map(m => m.animal_id + m.date)).size, tot = sum(ms, m => m.liters);
        return { k: G.fmt(k), manha: sum(ms.filter(m => m.shift === 'manha'), m => m.liters), tarde: sum(ms.filter(m => m.shift === 'tarde'), m => m.liters), total: tot, days, avgDay: days ? tot / days : 0, animals: new Set(ms.map(m => m.animal_id)).size, avgAnimal: pairs ? tot / pairs : 0 };
      });
      const tot = sum(rows, m => m.liters);
      return { summary: [['Total (L)', fmtNum(tot)], ['Média diária (L)', fmtNum(tot / (new Set(rows.map(m => m.date)).size || 1))], ['Média por animal/dia (L)', fmtNum(St.milkAvgPerAnimal(f.range))]],
        chart: { type: 'bar', labels: gr.map(x => x.k), data: gr.map(x => x.total), label: 'Litros' },
        columns: [col('k', G.label), col('manha', 'Manhã (L)', 'num'), col('tarde', 'Tarde (L)', 'num'), col('total', 'Total (L)', 'num'), col('days', 'Dias', 'int'), col('avgDay', 'Média/dia (L)', 'num'), col('animals', 'Animais', 'int'), col('avgAnimal', 'Média/animal/dia (L)', 'num2')],
        rows: gr, totals: { k: 'Total', manha: sum(gr, x => x.manha), tarde: sum(gr, x => x.tarde), total: tot } };
    },
  })),
  { id: 'producao-animal-detalhe', cat: 'producao', title: 'Histórico de um animal (manhã/tarde)', defaultPeriod: '30d',
    extra: [{ key: 'animal', label: 'Animal', options: () => db.all('animals').filter(a => a.sex === 'F').sort((a, b) => S.animalName(a).localeCompare(S.animalName(b))).map(a => [a.id, S.animalLabel(a)]) }],
    build: (f) => {
      if (!f.animal) return { message: 'Selecione o animal.', columns: [], rows: [] };
      const rows = St.animalDaily(f.animal, f.range).sort((a, b) => a.date.localeCompare(b.date));
      const s = St.periodStat(f.animal, f.range);
      return { title: `Produção — ${aLabel(f.animal)}`, summary: [['Total (L)', fmtNum(s.total)], ['Dias', s.days], ['Média diária (L)', fmtNum(s.avg)]],
        chart: { type: 'line', labels: rows.map(r => fmtDate(r.date)), data: rows.map(r => r.total), label: 'Litros/dia' },
        columns: [col('date', 'Data', 'date'), col('manha', 'Manhã', 'num'), col('tarde', 'Tarde', 'num'), col('total', 'Total', 'num')], rows, totals: { date: 'Total', manha: sum(rows, r => r.manha), tarde: sum(rows, r => r.tarde), total: s.total } };
    } },

  // ---------------- RAÇÃO ----------------
  { id: 'racao-producao', cat: 'racao', title: 'Produção de ração (batidas)', defaultPeriod: '30d',
    build: (f, can) => {
      const rows = St.batchesIn(f.range).sort((a, b) => a.date.localeCompare(b.date));
      const ing = [...groupBy(db.where('feed_batch_items', i => rows.some(b => b.id === i.batch_id)), i => i.product_id)].map(([id, is]) => ({ k: S.productName(id), q: sum(is, i => i.quantity), kg: sum(is, i => i.kg), unit: db.get('inventory', id)?.unit }));
      return { summary: [['Batidas', rows.length], ['Produzido (kg)', fmtNum(sum(rows, b => b.total_kg), 0)], ...(can('inventory.cost') ? [['Custo', fmtMoney(sum(rows, b => b.cost_total))]] : [])],
        chart: { type: 'bar', labels: ing.map(x => x.k), data: ing.map(x => x.kg), label: 'kg de ingrediente' },
        groupTable: { columns: [col('k', 'Ingrediente'), col('q', 'Quantidade', 'num2'), col('unit', 'Unidade'), col('kg', 'Kg', 'num')], rows: ing },
        columns: [col('date', 'Data', 'date'), col('lot', 'Lote'), col('type', 'Categoria'), col('op', 'Operador'), col('ingr', 'Ingredientes'), col('kg', 'Kg total', 'num'), ...(can('inventory.cost') ? [col('cost', 'Custo', 'money')] : [])],
        rows: rows.map(b => ({ date: b.date, lot: b.lot_number, type: b.feed_type, op: S.employeeName(b.operator_id), ingr: db.where('feed_batch_items', i => i.batch_id === b.id).map(i => `${S.productName(i.product_id)} ${fmtNum(i.quantity)}`).join('; '), kg: b.total_kg, cost: b.cost_total })),
        totals: { date: 'Total', kg: sum(rows, b => b.total_kg), cost: sum(rows, b => b.cost_total) } };
    } },
  { id: 'racao-distribuicao', cat: 'racao', title: 'Distribuição de ração', defaultPeriod: '30d',
    build: (f) => {
      const rows = St.distributionsIn(f.range).sort((a, b) => a.date.localeCompare(b.date));
      return { summary: [['Distribuído (kg)', fmtNum(sum(rows, d => d.quantity_kg), 0)], ['Tratos', rows.length], ['Média kg/animal', fmtNum(St.feedPerAnimal(f.range), 2)]],
        columns: [col('date', 'Data', 'date'), col('resp', 'Responsável'), col('lot', 'Lote'), col('type', 'Ração'), col('kg', 'Quantidade (kg)', 'num'), col('n', 'Nº de animais', 'int'), col('kpa', 'Kg/animal', 'num2'), col('area', 'Local'), col('cat', 'Categoria do rebanho')],
        rows: rows.map(d => ({ date: d.date, resp: S.employeeName(d.responsible_id), lot: db.get('feed_batches', d.batch_id)?.lot_number, type: d.feed_type, kg: d.quantity_kg, n: d.animals_count, kpa: d.kg_per_animal, area: d.area, cat: d.herd_category })),
        totals: { date: 'Total', kg: sum(rows, d => d.quantity_kg) } };
    } },
  { id: 'racao-consumo', cat: 'racao', title: 'Consumo de ração', defaultPeriod: '30d',
    extra: [{ key: 'by', label: 'Agrupar por', options: [['herd_category', 'Categoria do rebanho'], ['area', 'Local'], ['feed_type', 'Tipo de ração']], default: 'herd_category' }],
    build: (f) => {
      const rows = St.distributionsIn(f.range);
      const g = [...groupBy(rows, d => d[f.by] || 'Não informado')].map(([k, ds]) => ({ k, kg: sum(ds, d => d.quantity_kg), n: ds.length, animals: sum(ds, d => d.animals_count) })).map(x => ({ ...x, kpa: x.animals ? x.kg / x.animals : null })).sort((a, b) => b.kg - a.kg);
      return { summary: [['Consumo total (kg)', fmtNum(sum(rows, d => d.quantity_kg), 0)], ['Média kg/animal', fmtNum(St.feedPerAnimal(f.range), 2)]], chart: { type: 'doughnut', labels: g.map(x => x.k), data: g.map(x => x.kg) },
        columns: [col('k', 'Grupo'), col('kg', 'Consumo (kg)', 'num'), col('n', 'Tratos', 'int'), col('animals', 'Animais tratados (soma)', 'int'), col('kpa', 'Kg/animal', 'num2')], rows: g };
    } },
  { id: 'racao-estoque', cat: 'racao', title: 'Estoque de ração', period: false,
    build: () => {
      const rows = S.feedStock().sort((a, b) => a.date.localeCompare(b.date));
      return { summary: [['Total disponível (kg)', fmtNum(sum(rows, b => b.balance_kg), 0)], ['Lotes', rows.length]],
        columns: [col('lot', 'Lote'), col('date', 'Fabricação', 'date'), col('type', 'Categoria'), col('total', 'Produzido (kg)', 'num'), col('bal', 'Saldo (kg)', 'num')], rows: rows.map(b => ({ lot: b.lot_number, date: b.date, type: b.feed_type, total: b.total_kg, bal: b.balance_kg })) };
    } },
  { id: 'racao-lotes', cat: 'racao', title: 'Lotes — rastreabilidade', defaultPeriod: '30d',
    build: (f) => {
      const rows = St.batchesIn(f.range).sort((a, b) => a.date.localeCompare(b.date));
      return { summary: [['Lotes', rows.length]],
        columns: [col('lot', 'Lote'), col('date', 'Data', 'date'), col('type', 'Categoria'), col('op', 'Fabricado por'), col('ingr', 'Composição'), col('total', 'Qtd (kg)', 'num'), col('dist', 'Distribuído (kg)', 'num'), col('bal', 'Saldo (kg)', 'num'), col('who', 'Distribuído por'), col('where', 'Onde')],
        rows: rows.map(b => { const ds = db.where('feed_distribution', d => d.batch_id === b.id); return { lot: b.lot_number, date: b.date, type: b.feed_type, op: S.employeeName(b.operator_id), ingr: db.where('feed_batch_items', i => i.batch_id === b.id).map(i => `${S.productName(i.product_id)}: ${fmtNum(i.kg)} kg`).join('; '), total: b.total_kg, dist: sum(ds, d => d.quantity_kg), bal: b.balance_kg, who: [...new Set(ds.map(d => S.employeeName(d.responsible_id)))].join(', '), where: [...new Set(ds.map(d => d.area).filter(Boolean))].join(', ') }; }) };
    } },

  // ---------------- MÁQUINAS ----------------
  ...[['maquina', 'Horas por máquina', (s) => db.get('machines', s.machine_id)?.name || '?'], ['operador', 'Horas por operador', (s) => S.employeeName(s.operator_id)], ['area', 'Horas por área', (s) => s.area || 'Não informada'], ['servico', 'Horas por tipo de serviço', (s) => s.service_type || 'Não informado']].map(([id, title, fn]) => ({
    id: 'maquinas-' + id, cat: 'maquinas', title, defaultPeriod: '30d',
    build: (f) => {
      const rows = St.servicesIn(f.range);
      const g = [...groupBy(rows, fn)].map(([k, ss]) => ({ k, n: ss.length, h: sum(ss, s => s.hours), fuel: sum(ss, s => s.fuel_liters) })).sort((a, b) => b.h - a.h);
      return { summary: [['Horas', fmtHours(sum(rows, s => s.hours))], ['Serviços', rows.length]], chart: { type: 'bar', labels: g.map(x => x.k), data: g.map(x => round(x.h, 2)), label: 'Horas' },
        columns: [col('k', title.replace('Horas por ', '').replace(/^\w/, c => c.toUpperCase())), col('n', 'Serviços', 'int'), col('h', 'Horas', 'h'), col('fuel', 'Combustível informado (L)', 'num')], rows: g, totals: { k: 'Total', n: rows.length, h: sum(rows, s => s.hours), fuel: sum(rows, s => s.fuel_liters) } };
    },
  })),
  { id: 'maquinas-servicos', cat: 'maquinas', title: 'Serviços realizados', defaultPeriod: '30d',
    build: (f) => {
      const rows = St.servicesIn(f.range).sort((a, b) => a.date.localeCompare(b.date));
      return { summary: [['Serviços', rows.length], ['Horas', fmtHours(sum(rows, s => s.hours))]],
        columns: [col('date', 'Data', 'date'), col('op', 'Operador'), col('m', 'Máquina'), col('type', 'Tipo'), col('act', 'Atividade'), col('start', 'Início'), col('end', 'Fim'), col('h', 'Horas', 'h'), col('area', 'Área'), col('hm', 'Horímetro'), col('fuel', 'Comb. (L)', 'num'), col('notes', 'Observações')],
        rows: rows.map(s => ({ date: s.date, op: S.employeeName(s.operator_id), m: db.get('machines', s.machine_id)?.name, type: s.service_type, act: s.activity, start: s.start_time, end: s.end_time, h: s.hours, area: s.area, hm: s.hourmeter_start != null ? `${s.hourmeter_start} → ${s.hourmeter_end}` : '', fuel: s.fuel_liters, notes: s.notes })),
        totals: { date: 'Total', h: sum(rows, s => s.hours), fuel: sum(rows, s => s.fuel_liters) } };
    } },
  { id: 'maquinas-combustivel', cat: 'maquinas', title: 'Combustível por máquina', defaultPeriod: '30d',
    build: (f, can) => {
      const fu = St.fuelIn(f.range), sv = St.servicesIn(f.range);
      const g = db.all('machines').map(m => { const fs = fu.filter(x => x.machine_id === m.id), h = sum(sv.filter(s => s.machine_id === m.id), s => s.hours); return { k: m.name, l: sum(fs, x => x.liters), v: sum(fs, x => x.total_value), n: fs.length, h, lh: h ? sum(fs, x => x.liters) / h : null }; }).filter(x => x.n || x.h);
      return { summary: [['Litros', fmtNum(sum(fu, x => x.liters))], ...(can('inventory.cost') ? [['Valor', fmtMoney(sum(fu, x => x.total_value))]] : [])], chart: { type: 'bar', labels: g.map(x => x.k), data: g.map(x => x.l), label: 'Litros' },
        columns: [col('k', 'Máquina'), col('n', 'Abastecimentos', 'int'), col('l', 'Litros', 'num'), ...(can('inventory.cost') ? [col('v', 'Valor', 'money')] : []), col('h', 'Horas trabalhadas', 'h'), col('lh', 'L/hora', 'num2')], rows: g };
    } },
  { id: 'maquinas-manutencao', cat: 'maquinas', title: 'Manutenções', defaultPeriod: 'year',
    build: (f, can) => {
      const rows = db.where('machine_maintenance', m => inRange(m.date, f.range)).sort((a, b) => a.date.localeCompare(b.date));
      return { summary: [['Manutenções', rows.length], ...(can('inventory.cost') ? [['Custo', fmtMoney(sum(rows, m => m.cost))]] : [])],
        columns: [col('date', 'Data', 'date'), col('m', 'Máquina'), col('type', 'Tipo'), col('desc', 'Serviço realizado'), col('parts', 'Peças'), ...(can('inventory.cost') ? [col('cost', 'Custo', 'money')] : []), col('hm', 'Horímetro', 'num'), col('resp', 'Responsável'), col('next', 'Próxima')],
        rows: rows.map(m => ({ date: m.date, m: db.get('machines', m.machine_id)?.name, type: m.type, desc: m.description, parts: m.parts, cost: m.cost, hm: m.hourmeter, resp: m.responsible, next: [m.next_date && fmtDate(m.next_date), m.next_hourmeter && `${m.next_hourmeter} h`].filter(Boolean).join(' / ') })) };
    } },

  // ---------------- FUNCIONÁRIOS ----------------
  { id: 'funcionarios-ativos', cat: 'funcionarios', title: 'Funcionários ativos', period: false,
    build: (f, can) => {
      const rows = db.where('employees', e => e.status !== 'Desligado');
      return { summary: [['Funcionários', rows.length], ...(can('payroll.view') ? [['Soma dos salários', fmtMoney(sum(rows, e => e.salary))]] : [])],
        columns: [col('name', 'Nome'), col('pos', 'Cargo'), col('adm', 'Admissão', 'date'), col('ct', 'Contratação'), col('phone', 'Telefone'), col('status', 'Situação'), ...(can('payroll.view') ? [col('sal', 'Salário', 'money')] : [])],
        rows: rows.map(e => ({ name: e.name, pos: e.position, adm: e.admission_date, ct: e.contract_type, phone: e.phone, status: e.status, sal: e.salary })) };
    } },
  { id: 'funcionarios-folha', cat: 'funcionarios', title: 'Folha do mês', period: false, perm: 'payroll.view',
    extra: [{ key: 'month', label: 'Mês', type: 'month', default: () => monthKey(today()) }],
    build: (f) => {
      const rows = db.where('employee_payments', p => p.month === f.month);
      return { title: `Folha — ${fmtMonth(f.month)}`, note: 'Controle administrativo interno — não substitui a folha oficial.', summary: [['Líquido total', fmtMoney(sum(rows, p => p.net))], ['Pagos', rows.filter(p => p.status === 'Pago').length], ['Pendentes', rows.filter(p => p.status !== 'Pago').length]],
        columns: [col('e', 'Funcionário'), col('base', 'Base', 'money'), col('add', 'Adicionais', 'money'), col('ot', 'Horas extras', 'money'), col('vales', 'Vales', 'money'), col('adv', 'Adiantamentos', 'money'), col('disc', 'Descontos', 'money'), col('oth', 'Outros', 'money'), col('net', 'Líquido', 'money'), col('st', 'Situação'), col('pd', 'Pago em', 'date')],
        rows: rows.map(p => ({ e: S.employeeName(p.employee_id), base: p.base_salary, add: p.additions, ot: p.overtime_value, vales: p.vales_value, adv: p.advances_value, disc: p.discounts_value, oth: p.others, net: p.net, st: p.status, pd: p.payment_date })).sort((a, b) => a.e.localeCompare(b.e)),
        totals: { e: 'Total', base: sum(rows, p => p.base_salary), add: sum(rows, p => p.additions), ot: sum(rows, p => p.overtime_value), vales: sum(rows, p => p.vales_value), adv: sum(rows, p => p.advances_value), disc: sum(rows, p => p.discounts_value), oth: sum(rows, p => p.others), net: sum(rows, p => p.net) } };
    } },
  { id: 'funcionarios-vales', cat: 'funcionarios', title: 'Vales e adiantamentos', defaultPeriod: 'year', perm: 'payroll.view',
    build: (f) => {
      const rows = db.where('employee_advances', a => inRange(a.date, f.range)).sort((a, b) => a.date.localeCompare(b.date));
      return { summary: [['Total', fmtMoney(sum(rows, a => a.amount))], ['Em aberto', fmtMoney(sum(rows.filter(a => a.status === 'Aberto'), a => a.amount))]],
        columns: [col('date', 'Data', 'date'), col('e', 'Funcionário'), col('type', 'Tipo'), col('amount', 'Valor', 'money'), col('inst', 'Parcelas'), col('reason', 'Motivo'), col('pm', 'Forma'), col('st', 'Situação')],
        rows: rows.map(a => ({ date: a.date, e: S.employeeName(a.employee_id), type: a.type, amount: a.amount, inst: `${a.installments}× ${fmtMoney(a.installment_value)}`, reason: a.reason, pm: a.payment_method, st: a.status })), totals: { date: 'Total', amount: sum(rows, a => a.amount) } };
    } },
  { id: 'funcionarios-descontos', cat: 'funcionarios', title: 'Descontos', defaultPeriod: 'year', perm: 'payroll.view',
    build: (f) => {
      const rows = db.where('employee_discounts', d => inRange(d.date, f.range));
      return { summary: [['Total', fmtMoney(sum(rows, d => d.amount))]], columns: [col('date', 'Data', 'date'), col('e', 'Funcionário'), col('m', 'Mês ref.', 'month'), col('desc', 'Descrição'), col('amount', 'Valor', 'money')],
        rows: rows.map(d => ({ date: d.date, e: S.employeeName(d.employee_id), m: d.month, desc: d.description, amount: d.amount })), totals: { date: 'Total', amount: sum(rows, d => d.amount) } };
    } },
  { id: 'funcionarios-pagamentos', cat: 'funcionarios', title: 'Pagamentos realizados', defaultPeriod: 'year', perm: 'payroll.view',
    build: (f) => {
      const rows = db.where('employee_payments', p => p.status === 'Pago' && p.payment_date && inRange(p.payment_date, f.range)).sort((a, b) => a.payment_date.localeCompare(b.payment_date));
      const g = [...groupBy(rows, p => p.month)].sort();
      return { summary: [['Total pago', fmtMoney(sum(rows, p => p.net))], ['Pagamentos', rows.length]], chart: { type: 'bar', labels: g.map(x => fmtMonth(x[0])), data: g.map(x => sum(x[1], p => p.net)), label: 'R$' },
        columns: [col('pd', 'Data', 'date'), col('e', 'Funcionário'), col('m', 'Mês', 'month'), col('net', 'Líquido', 'money')], rows: rows.map(p => ({ pd: p.payment_date, e: S.employeeName(p.employee_id), m: p.month, net: p.net })), totals: { pd: 'Total', net: sum(rows, p => p.net) } };
    } },

  // ---------------- ESTOQUE ----------------
  ...[['entradas', 'Entradas de estoque', 'entrada'], ['saidas', 'Saídas de estoque', 'saida']].map(([id, title, type]) => ({
    id: 'estoque-' + id, cat: 'estoque', title, defaultPeriod: '30d',
    extra: [{ key: 'cat', label: 'Categoria', options: () => [['', 'Todas'], ...list('product_categories').map(c => [c, c])], default: '' }],
    build: (f, can) => {
      const rows = db.where('inventory_movements', m => m.type === type && inRange(m.date, f.range) && (!f.cat || db.get('inventory', m.product_id)?.category === f.cat)).sort((a, b) => a.date.localeCompare(b.date));
      return { summary: [['Lançamentos', rows.length], ...(can('inventory.cost') ? [['Valor total', fmtMoney(sum(rows, m => m.total))]] : [])],
        columns: [col('date', 'Data', 'date'), col('p', 'Produto'), col('cat', 'Categoria'), col('q', 'Quantidade', 'num2'), col('u', 'Unidade'), ...(can('inventory.cost') ? [col('total', 'Valor', 'money')] : []), col('who', type === 'entrada' ? 'Fornecedor' : 'Destino'), col('nf', 'NF'), col('reason', 'Motivo'), col('resp', 'Responsável')],
        rows: rows.map(m => { const p = db.get('inventory', m.product_id) || {}; return { date: m.date, p: p.name, cat: p.category, q: m.quantity, u: p.unit, total: m.total, who: m.supplier || m.destination, nf: m.invoice, reason: m.reason, resp: m.responsible }; }), totals: { date: 'Total', total: sum(rows, m => m.total) } };
    },
  })),
  { id: 'estoque-saldo', cat: 'estoque', title: 'Saldo de estoque', period: false,
    extra: [{ key: 'cat', label: 'Categoria', options: () => [['', 'Todas'], ...list('product_categories').map(c => [c, c])], default: '' }],
    build: (f, can) => {
      const rows = db.where('inventory', p => p.active !== false && (!f.cat || p.category === f.cat)).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
      return { summary: [['Produtos', rows.length], ...(can('inventory.cost') ? [['Valor do estoque', fmtMoney(sum(rows, p => Math.max(0, num(p.quantity)) * num(p.unit_cost)))]] : [])],
        columns: [col('code', 'Código'), col('name', 'Produto'), col('cat', 'Categoria'), col('q', 'Quantidade', 'num2'), col('u', 'Unidade'), col('min', 'Mínimo', 'num2'), col('max', 'Máximo', 'num2'), ...(can('inventory.cost') ? [col('c', 'Valor unit.', 'money'), col('v', 'Valor total', 'money')] : []), col('loc', 'Localização')],
        rows: rows.map(p => ({ code: p.code, name: p.name, cat: p.category, q: p.quantity, u: p.unit, min: p.min_qty, max: p.max_qty, c: p.unit_cost, v: Math.max(0, num(p.quantity)) * num(p.unit_cost), loc: p.location })) };
    } },
  { id: 'estoque-minimo', cat: 'estoque', title: 'Produtos abaixo do mínimo', period: false,
    build: () => {
      const rows = S.lowStock();
      return { summary: [['Produtos', rows.length]], columns: [col('name', 'Produto'), col('cat', 'Categoria'), col('q', 'Quantidade atual', 'num2'), col('min', 'Estoque mínimo', 'num2'), col('u', 'Unidade'), col('sup', 'Fornecedor')],
        rows: rows.map(p => ({ name: p.name, cat: p.category, q: p.quantity, min: p.min_qty, u: p.unit, sup: p.supplier })) };
    } },
  { id: 'estoque-valor', cat: 'estoque', title: 'Valor do estoque por categoria', period: false, perm: 'inventory.cost',
    build: () => {
      const g = [...groupBy(db.where('inventory', p => p.active !== false), p => p.category)].map(([k, ps]) => ({ k, n: ps.length, v: sum(ps, p => Math.max(0, num(p.quantity)) * num(p.unit_cost)) })).sort((a, b) => b.v - a.v);
      return { summary: [['Valor total', fmtMoney(sum(g, x => x.v))]], chart: { type: 'doughnut', labels: g.map(x => x.k), data: g.map(x => round(x.v, 2)) },
        columns: [col('k', 'Categoria'), col('n', 'Produtos', 'int'), col('v', 'Valor', 'money')], rows: g, totals: { k: 'Total', n: sum(g, x => x.n), v: sum(g, x => x.v) } };
    } },
];
export const reportById = (id) => REPORTS.find(r => r.id === id);
