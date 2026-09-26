// MÁQUINAS E SERVIÇOS — máquinas, serviços (tratorista), operadores, horas, combustível e manutenção.
import * as db from '../db.js';
import * as S from '../services.js';
import * as F from '../forms.js';
import * as St from '../stats.js';
import { can } from '../auth.js';
import { icon, $, $$, badge, mountTable, chart, COLORS, SERIES, pageHead, statCard, tabs } from '../ui.js';
import { esc, fmtDate, fmtNum, fmtMoney, fmtHours, today, addDays, inRange, sum, groupBy, num, diffDays, periodLabel } from '../util.js';
import { MACHINE_STATUS, list, alertsCfg } from '../config.js';
import { listPage, pageState, periodSelect, bindPeriod, rangeOf, sumBox, cellMain } from './common.js';

const mTone = { 'Disponível': 'green', 'Em uso': 'blue', 'Manutenção': 'gold', 'Parada': 'rose', 'Vendida': 'neutral' };
const mLink = (id) => { const m = db.get('machines', id); return m ? `<a href="#/maquina/${m.id}">${esc(m.name)}</a>` : '—'; };
const empName = (id) => esc(S.employeeName(id));
const addBtn = (id, label, ic = 'plus', cls = 'btn-primary') => can('machines.edit') ? `<button class="btn ${cls}" data-act="${id}">${icon(ic, 18)} ${esc(label)}</button>` : '';
const bindAdd = (root, map) => Object.entries(map).forEach(([k, fn]) => { const b = $(`[data-act=${k}]`, root); if (b) b.onclick = fn; });

export { listMachines as list };
function listMachines(el) {
  const r30 = { from: addDays(today(), -29), to: today() };
  const h30 = new Map(St.hoursByMachine(r30).map(x => [x.machine?.id, x.hours]));
  listPage(el, {
    id: 'machines', title: 'Máquinas', sub: 'O horímetro é atualizado automaticamente pelos serviços, abastecimentos e manutenções.',
    actions: addBtn('svc', 'Serviço', 'tractor', 'btn-ghost') + addBtn('new', 'Nova máquina'),
    bindActions: (root) => bindAdd(root, { new: () => F.machineForm(), svc: () => F.serviceForm() }),
    filters: [{ type: 'search', key: 'q', text: (m) => `${m.name} ${m.brand} ${m.model} ${m.identification}` }, { type: 'select', key: 'status', label: 'Situação', options: MACHINE_STATUS, match: (m, v) => m.status === v }],
    rows: () => db.all('machines'), defaultSort: { key: 'name', dir: 'asc' },
    columns: [
      { key: 'name', label: 'Máquina', render: (m) => cellMain(esc(m.name), [m.type, m.brand, m.model, m.year].filter(Boolean).map(esc).join(' · ')) },
      { key: 'identification', label: 'Identificação', hideSm: true },
      { key: 'hourmeter', label: 'Horímetro', align: 'right', value: (m) => num(m.hourmeter), render: (m) => num(m.hourmeter) ? `${fmtNum(m.hourmeter)} h` : '—' },
      { key: 'h30', label: 'Horas (30 dias)', align: 'right', value: (m) => h30.get(m.id) || 0, render: (m) => fmtHours(h30.get(m.id) || 0) },
      { key: 'status', label: 'Situação', render: (m) => badge(m.status, mTone[m.status]) },
      { key: 'resp', label: 'Responsável', text: (m) => S.employeeName(m.responsible_id), render: (m) => m.responsible_id ? empName(m.responsible_id) : '—', hideSm: true },
    ],
    onRowClick: (m) => { location.hash = `#/maquina/${m.id}`; },
  });
}

export function machinePage(el, { params }) {
  const m = db.get('machines', params.id);
  if (!m) { el.innerHTML = '<div class="card">Máquina não encontrada.</div>'; return; }
  const st = pageState('mach:' + m.id, { tab: 'servicos' });
  const svc = db.where('machine_services', s => s.machine_id === m.id), mt = db.where('machine_maintenance', x => x.machine_id === m.id), fu = db.where('fuel_records', f => f.machine_id === m.id);
  const hrs = sum(svc, s => s.hours), lit = sum(fu, f => f.liters);
  el.innerHTML = `<div class="crumbs"><a href="#/maquinas/lista">Máquinas</a> › ${esc(m.name)}</div>
    ${pageHead(m.name, [m.type, m.brand, m.model, m.year, m.identification].filter(Boolean).map(esc).join(' · '), (can('machines.edit') ? `<button class="btn btn-ghost" data-a="edit">${icon('edit', 18)} Editar</button><button class="btn btn-ghost" data-a="fuel">${icon('fuel', 18)} Abastecer</button><button class="btn btn-ghost" data-a="maint">${icon('wrench', 18)} Manutenção</button><button class="btn btn-primary" data-a="svc">${icon('tractor', 18)} Serviço</button>` : ''))}
    <div class="stats">${statCard({ label: 'Situação', value: badge(m.status, mTone[m.status]), icon: 'tractor' })}
      ${statCard({ label: 'Horímetro', value: `${fmtNum(m.hourmeter)} h`, icon: 'clock', tone: 'blue' })}
      ${statCard({ label: 'Horas registradas', value: fmtHours(hrs), sub: `${svc.length} serviços`, icon: 'clock', tone: 'brown' })}
      ${statCard({ label: 'Combustível', value: `${fmtNum(lit, 0)} L`, sub: hrs ? `${fmtNum(lit / hrs, 2)} L/h` : '', icon: 'fuel', tone: 'gold' })}
      ${statCard({ label: 'Manutenções', value: fmtNum(mt.length, 0), sub: can('inventory.cost') ? fmtMoney(sum(mt, x => x.cost)) : '', icon: 'wrench', tone: 'rose' })}</div>
    ${tabs([['servicos', 'Histórico de serviços'], ['manutencao', 'Manutenção'], ['combustivel', 'Combustível']], st.tab)}<div class="card" id="m-body"></div>`;
  const on = (a, fn) => { const b = $(`[data-a=${a}]`, el); if (b) b.onclick = fn; };
  on('edit', () => F.machineForm(m.id)); on('svc', () => F.serviceForm(null, { machine_id: m.id, hourmeter_start: m.hourmeter || null }));
  on('fuel', () => F.fuelForm(null, { machine_id: m.id, fuel_type: m.fuel_type })); on('maint', () => F.maintenanceForm(null, { machine_id: m.id, hourmeter: m.hourmeter }));
  $$('[data-tab]', el).forEach(b => b.onclick = () => { st.tab = b.dataset.tab; machinePage(el, { params }); });
  const body = $('#m-body', el);
  if (st.tab === 'servicos') mountTable(body, { id: 'ms-' + m.id, rows: svc, defaultSort: { key: 'date', dir: 'desc' }, empty: 'Nenhum serviço.', columns: svcCols().filter(c => c.key !== 'machine'), onRowClick: can('machines.edit') ? (s) => F.serviceForm(s.id) : null });
  if (st.tab === 'manutencao') mountTable(body, { id: 'mm-' + m.id, rows: mt, defaultSort: { key: 'date', dir: 'desc' }, empty: 'Nenhuma manutenção.', columns: maintCols().filter(c => c.key !== 'machine'), onRowClick: can('machines.edit') ? (x) => F.maintenanceForm(x.id) : null });
  if (st.tab === 'combustivel') mountTable(body, { id: 'mf-' + m.id, rows: fu, defaultSort: { key: 'date', dir: 'desc' }, empty: 'Nenhum abastecimento.', columns: fuelCols().filter(c => c.key !== 'machine'), onRowClick: can('machines.edit') ? (x) => F.fuelForm(x.id) : null });
}

const svcCols = () => [
  { key: 'date', label: 'Data', text: (s) => fmtDate(s.date), render: (s) => fmtDate(s.date) },
  { key: 'machine', label: 'Máquina', text: (s) => db.get('machines', s.machine_id)?.name, render: (s) => mLink(s.machine_id) },
  { key: 'operator', label: 'Operador', text: (s) => S.employeeName(s.operator_id), render: (s) => empName(s.operator_id) },
  { key: 'service_type', label: 'Tipo', hideSm: true },
  { key: 'activity', label: 'Atividade' },
  { key: 'start_time', label: 'Início', hideSm: true }, { key: 'end_time', label: 'Fim', hideSm: true },
  { key: 'hours', label: 'Horas', align: 'right', value: (s) => num(s.hours), text: (s) => fmtHours(s.hours), render: (s) => `<b>${fmtHours(s.hours)}</b>` },
  { key: 'area', label: 'Área', hideSm: true },
  { key: 'hm', label: 'Horímetro', text: (s) => s.hourmeter_start != null ? `${s.hourmeter_start} → ${s.hourmeter_end}` : '', render: (s) => s.hourmeter_start != null && s.hourmeter_end != null ? `${fmtNum(s.hourmeter_start)} → ${fmtNum(s.hourmeter_end)}` : '—', hideSm: true },
  { key: 'fuel_liters', label: 'Comb. (L)', align: 'right', render: (s) => s.fuel_liters ? fmtNum(s.fuel_liters) : '—', hideSm: true },
  { key: 'notes', label: 'Observações', hideSm: true },
];
export function services(el) {
  listPage(el, {
    id: 'svc', title: 'Serviços', sub: 'Controle de serviços — tratorista. Horas calculadas automaticamente (fim − início, ou horímetro final − inicial).',
    actions: addBtn('new', 'Registrar serviço', 'tractor'), bindActions: (root) => bindAdd(root, { new: () => F.serviceForm() }),
    defaultPeriod: '30d',
    filters: [{ type: 'period' }, { type: 'search', key: 'q', text: (s) => `${db.get('machines', s.machine_id)?.name} ${S.employeeName(s.operator_id)} ${s.activity} ${s.area} ${s.service_type}` },
      { type: 'select', key: 'machine', label: 'Máquina', options: () => db.all('machines').map(m => [m.id, m.name]), match: (s, v) => s.machine_id === v },
      { type: 'select', key: 'type', label: 'Tipo', options: () => list('service_types'), match: (s, v) => s.service_type === v }],
    rows: (st) => St.servicesIn(rangeOf(st)), defaultSort: { key: 'date', dir: 'desc' }, columns: svcCols(),
    summary: (rows) => sumBox([['Serviços', fmtNum(rows.length, 0)], ['Horas', fmtHours(sum(rows, s => s.hours))], ['Combustível', `${fmtNum(sum(rows, s => s.fuel_liters))} L`]]),
    onRowClick: can('machines.edit') ? (s) => F.serviceForm(s.id) : null,
  });
}

export function operators(el) {
  listPage(el, {
    id: 'ops', title: 'Operadores', sub: 'Funcionários que operaram máquinas no período.', defaultPeriod: '30d',
    filters: [{ type: 'period' }, { type: 'search', key: 'q', text: (o) => o.name }],
    rows: (st) => [...groupBy(St.servicesIn(rangeOf(st)), s => s.operator_id)].map(([id, ss]) => ({ id, name: S.employeeName(id), n: ss.length, hours: sum(ss, s => s.hours), machines: [...new Set(ss.map(s => db.get('machines', s.machine_id)?.name))].join(', '), areas: [...new Set(ss.map(s => s.area).filter(Boolean))].join(', ') })),
    defaultSort: { key: 'hours', dir: 'desc' },
    columns: [{ key: 'name', label: 'Operador' }, { key: 'n', label: 'Serviços', align: 'right' }, { key: 'hours', label: 'Horas', align: 'right', text: (o) => fmtHours(o.hours), render: (o) => `<b>${fmtHours(o.hours)}</b>` }, { key: 'machines', label: 'Máquinas' }, { key: 'areas', label: 'Áreas', hideSm: true }],
  });
}

export function hours(el) {
  const st = pageState('mhours', { period: '30d' });
  el.innerHTML = `${pageHead('Horas trabalhadas', 'Por máquina, por área e por dia.')}<div class="filters">${periodSelect(st)}</div><div id="h-sum"></div>
    <div class="grid g2"><div class="card"><h3>Por máquina</h3><div class="chart-box"><canvas id="h-m"></canvas></div></div><div class="card"><h3>Por área</h3><div class="chart-box"><canvas id="h-a"></canvas></div></div></div>
    <div class="card" style="margin-top:16px"><div id="h-t"></div></div>`;
  const draw = () => {
    const r = rangeOf(st), rows = St.servicesIn(r);
    const bm = St.hoursByMachine(r), ba = [...groupBy(rows, s => s.area || 'Não informada')].map(([k, ss]) => ({ k, h: sum(ss, s => s.hours) })).sort((a, b) => b.h - a.h);
    $('#h-sum', el).innerHTML = sumBox([['Horas no período', fmtHours(sum(rows, s => s.hours))], ['Serviços', fmtNum(rows.length, 0)], ['Máquinas usadas', fmtNum(bm.length, 0)], ['Período', periodLabel(r)]]);
    chart($('#h-m', el), { type: 'bar', data: { labels: bm.map(x => x.machine?.name), datasets: [{ label: 'Horas', data: bm.map(x => x.hours), backgroundColor: SERIES, borderRadius: 4 }] } });
    chart($('#h-a', el), { type: 'doughnut', data: { labels: ba.map(x => x.k), datasets: [{ data: ba.map(x => x.h), backgroundColor: SERIES }] } });
    mountTable($('#h-t', el), { id: 'mh-t', rows: bm.map(x => { const f = sum(St.fuelIn(r).filter(y => y.machine_id === x.machine?.id), y => y.liters); return { ...x, fuel: f }; }),
      columns: [{ key: 'm', label: 'Máquina', render: (x) => mLink(x.machine?.id) }, { key: 'services', label: 'Serviços', align: 'right' }, { key: 'hours', label: 'Horas', align: 'right', render: (x) => fmtHours(x.hours) }, { key: 'fuel', label: 'Combustível (L)', align: 'right', render: (x) => fmtNum(x.fuel) }, { key: 'lh', label: 'L/hora', align: 'right', render: (x) => x.hours ? fmtNum(x.fuel / x.hours, 2) : '—' }] });
  };
  bindPeriod(el, st, draw); draw();
}

const fuelCols = () => [
  { key: 'date', label: 'Data', text: (f) => fmtDate(f.date), render: (f) => fmtDate(f.date) },
  { key: 'machine', label: 'Máquina', text: (f) => db.get('machines', f.machine_id)?.name, render: (f) => mLink(f.machine_id) },
  { key: 'fuel_type', label: 'Combustível' }, { key: 'liters', label: 'Litros', align: 'right', value: (f) => num(f.liters), render: (f) => `<b>${fmtNum(f.liters)}</b>` },
  ...(can('inventory.cost') ? [{ key: 'total_value', label: 'Valor', align: 'right', value: (f) => num(f.total_value), render: (f) => f.total_value ? fmtMoney(f.total_value) : '—' }] : []),
  { key: 'hourmeter', label: 'Horímetro', align: 'right', render: (f) => f.hourmeter ? fmtNum(f.hourmeter) : '—', hideSm: true },
  { key: 'origin', label: 'Origem', text: (f) => f.service_id ? 'Serviço' : f.product_id ? 'Tanque da fazenda' : 'Posto/externo', render: (f) => f.service_id ? badge('informado no serviço', 'neutral') : f.product_id ? badge('tanque da fazenda', 'green') : badge('externo', 'gold'), hideSm: true },
  { key: 'responsible', label: 'Responsável', hideSm: true },
];
export function fuel(el) {
  listPage(el, {
    id: 'fuel', title: 'Combustível', sub: 'Abastecimentos e consumo por máquina. Retiradas do tanque da fazenda dão baixa no estoque.',
    actions: addBtn('new', 'Registrar abastecimento', 'fuel'), bindActions: (root) => bindAdd(root, { new: () => F.fuelForm() }),
    defaultPeriod: '30d',
    filters: [{ type: 'period' }, { type: 'select', key: 'machine', label: 'Máquina', options: () => db.all('machines').map(m => [m.id, m.name]), match: (f, v) => f.machine_id === v }],
    rows: (st) => St.fuelIn(rangeOf(st)), defaultSort: { key: 'date', dir: 'desc' }, columns: fuelCols(),
    summary: (rows, st) => { const r = rangeOf(st); const h = St.machineHours(r); return sumBox([['Litros', fmtNum(sum(rows, f => f.liters))], ...(can('inventory.cost') ? [['Valor', fmtMoney(sum(rows, f => f.total_value))]] : []), ['Horas trabalhadas', fmtHours(h)], ['Consumo médio', h ? `${fmtNum(sum(rows, f => f.liters) / h, 2)} L/h` : '—']]); },
    onRowClick: can('machines.edit') ? (f) => F.fuelForm(f.id) : null,
  });
}

const maintCols = () => {
  const t = today(), c = alertsCfg();
  return [
    { key: 'date', label: 'Data', text: (x) => fmtDate(x.date), render: (x) => fmtDate(x.date) },
    { key: 'machine', label: 'Máquina', text: (x) => db.get('machines', x.machine_id)?.name, render: (x) => mLink(x.machine_id) },
    { key: 'type', label: 'Tipo' }, { key: 'description', label: 'Serviço realizado' },
    { key: 'parts', label: 'Peças', hideSm: true },
    ...(can('inventory.cost') ? [{ key: 'cost', label: 'Custo', align: 'right', value: (x) => num(x.cost), render: (x) => x.cost ? fmtMoney(x.cost) : '—' }] : []),
    { key: 'hourmeter', label: 'Horímetro', align: 'right', render: (x) => x.hourmeter ? fmtNum(x.hourmeter) : '—', hideSm: true },
    { key: 'next', label: 'Próxima', text: (x) => [x.next_date && fmtDate(x.next_date), x.next_hourmeter && `${x.next_hourmeter} h`].filter(Boolean).join(' / '), render: (x) => {
      const parts = []; const m = db.get('machines', x.machine_id);
      if (x.next_date) parts.push(`${fmtDate(x.next_date)}${x.next_date < t ? ' ' + badge('atrasada', 'rose') : diffDays(t, x.next_date) <= c.maintenance_days ? ' ' + badge('próxima', 'gold') : ''}`);
      if (x.next_hourmeter) parts.push(`${fmtNum(x.next_hourmeter)} h${m && num(m.hourmeter) >= num(x.next_hourmeter) ? ' ' + badge('vencida', 'rose') : ''}`);
      return parts.join('<br>') || '—';
    } },
    { key: 'responsible', label: 'Responsável', hideSm: true },
  ];
};
export function maintenance(el) {
  listPage(el, {
    id: 'maint', title: 'Manutenção', sub: 'Manutenções realizadas e programadas (por data ou horímetro), com alertas automáticos.',
    actions: addBtn('new', 'Registrar manutenção', 'wrench'), bindActions: (root) => bindAdd(root, { new: () => F.maintenanceForm() }),
    defaultPeriod: 'year',
    filters: [{ type: 'period' }, { type: 'select', key: 'machine', label: 'Máquina', options: () => db.all('machines').map(m => [m.id, m.name]), match: (x, v) => x.machine_id === v }],
    rows: (st) => db.where('machine_maintenance', x => inRange(x.date, rangeOf(st))), defaultSort: { key: 'date', dir: 'desc' }, columns: maintCols(),
    summary: (rows) => sumBox([['Manutenções', fmtNum(rows.length, 0)], ...(can('inventory.cost') ? [['Custo total', fmtMoney(sum(rows, x => x.cost))]] : [])]),
    onRowClick: can('machines.edit') ? (x) => F.maintenanceForm(x.id) : null,
  });
}
