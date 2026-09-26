// RAÇÃO — ingredientes, fabricação (batida), lotes com rastreabilidade, distribuição, estoque e consumo.
import * as db from '../db.js';
import * as S from '../services.js';
import * as F from '../forms.js';
import * as St from '../stats.js';
import { can } from '../auth.js';
import { icon, $, $$, badge, mountTable, chart, COLORS, SERIES, pageHead, statCard } from '../ui.js';
import { esc, fmtDate, fmtNum, fmtMoney, today, addDays, inRange, sum, groupBy, num, periodLabel, fmtKg } from '../util.js';
import { list } from '../config.js';
import { listPage, pageState, periodSelect, bindPeriod, rangeOf, sumBox, cellMain } from './common.js';

const empLink = (id) => id ? esc(S.employeeName(id)) : '<span class="muted">—</span>';
const batchLink = (id) => { const b = db.get('feed_batches', id); return b ? `<a href="#/racao/lote/${b.id}">#${esc(b.lot_number)}</a>` : '—'; };
const bar = (part, total) => `<div class="bar" title="${fmtNum(part)} de ${fmtNum(total)}"><span style="width:${total ? Math.max(0, Math.min(100, part / total * 100)) : 0}%"></span></div>`;

export function ingredients(el) {
  const used30 = groupBy(db.where('inventory_movements', m => m.ref_table === 'feed_batches' && m.date >= addDays(today(), -29)), m => m.product_id);
  listPage(el, {
    id: 'feed-ing', title: 'Ingredientes', sub: 'Ingredientes fazem parte do estoque central (categoria "Ingredientes") e recebem baixa automática a cada batida.',
    actions: (can('inventory.edit') ? `<button class="btn btn-ghost" data-act="in">${icon('arrowIn', 18)} Entrada</button>` : '') + (can('inventory.edit') ? `<button class="btn btn-primary" data-act="new">${icon('plus', 18)} Novo ingrediente</button>` : ''),
    bindActions: (root) => { $('[data-act=new]', root) && ($('[data-act=new]', root).onclick = () => F.productForm(null, { category: 'Ingredientes', unit: 'saco' })); $('[data-act=in]', root) && ($('[data-act=in]', root).onclick = () => F.stockInForm()); },
    filters: [{ type: 'search', key: 'q', text: (p) => `${p.name} ${p.code} ${p.supplier}` }],
    rows: () => db.where('inventory', p => p.category === 'Ingredientes' && p.active !== false),
    defaultSort: { key: 'name', dir: 'asc' },
    columns: [
      { key: 'name', label: 'Ingrediente', render: (p) => cellMain(esc(p.name), esc(p.code || '')) },
      { key: 'unit', label: 'Unidade', render: (p) => `${esc(p.unit)}${p.unit_weight_kg ? ` <span class="muted small">(${fmtNum(p.unit_weight_kg)} kg)</span>` : ''}` },
      { key: 'quantity', label: 'Estoque atual', align: 'right', value: (p) => num(p.quantity), render: (p) => `<b>${fmtNum(p.quantity, 2)}</b> ${esc(p.unit)}${num(p.min_qty) && num(p.quantity) <= num(p.min_qty) ? ' ' + badge('baixo', 'rose') : ''}` },
      { key: 'kg', label: 'Equivale a', align: 'right', value: (p) => S.kgOf(p, p.quantity), render: (p) => S.kgOf(p, p.quantity) ? fmtKg(S.kgOf(p, p.quantity)) : '—', hideSm: true },
      { key: 'min_qty', label: 'Mínimo', align: 'right', render: (p) => fmtNum(p.min_qty, 2) },
      { key: 'used', label: 'Usado 30 dias', align: 'right', value: (p) => sum(used30.get(p.id) || [], m => m.quantity), render: (p) => fmtNum(sum(used30.get(p.id) || [], m => m.quantity), 2), hideSm: true },
      ...(can('inventory.cost') ? [{ key: 'unit_cost', label: 'Valor', align: 'right', render: (p) => fmtMoney(p.unit_cost), hideSm: true }] : []),
      { key: 'supplier', label: 'Fornecedor', hideSm: true },
    ],
    onRowClick: (p) => { location.hash = `#/produto/${p.id}`; },
  });
}

export function fabrication(el) {
  listPage(el, {
    id: 'feed-fab', title: 'Fabricação de ração', sub: 'Controle de fábrica — batida da ração. Cada batida gera um lote rastreável.',
    actions: can('feed.edit') ? `<button class="btn btn-primary" data-act="new">${icon('factory', 18)} Nova batida</button>` : '',
    bindActions: (root) => { const b = $('[data-act=new]', root); if (b) b.onclick = () => F.fabricationForm(); },
    defaultPeriod: '30d',
    filters: [{ type: 'period' }, { type: 'select', key: 'ft', label: 'Categoria', options: () => list('feed_types'), match: (b, v) => b.feed_type === v }, { type: 'search', key: 'q', text: (b) => `${b.lot_number} ${S.employeeName(b.operator_id)} ${b.feed_type}` }],
    rows: (st) => db.where('feed_batches', b => inRange(b.date, rangeOf(st))),
    defaultSort: { key: 'date', dir: 'desc' },
    columns: [
      { key: 'date', label: 'Data', text: (b) => fmtDate(b.date), render: (b) => `${fmtDate(b.date)} <span class="muted small">${esc(b.time || '')}</span>` },
      { key: 'lot_number', label: 'Lote', render: (b) => batchLink(b.id) },
      { key: 'operator', label: 'Operador', text: (b) => S.employeeName(b.operator_id), render: (b) => empLink(b.operator_id) },
      { key: 'feed_type', label: 'Categoria' },
      { key: 'ingr', label: 'Ingredientes', sortable: false, text: (b) => db.where('feed_batch_items', i => i.batch_id === b.id).map(i => `${S.productName(i.product_id)} ${i.quantity}`).join('; '), render: (b) => db.where('feed_batch_items', i => i.batch_id === b.id).map(i => { const p = db.get('inventory', i.product_id); return `${esc(p?.name || '?')}: ${fmtNum(i.quantity)} ${esc(p?.unit || '')}`; }).join('<br>'), hideSm: true },
      { key: 'sacos', label: 'Sacos', align: 'right', value: (b) => sum(db.where('feed_batch_items', i => i.batch_id === b.id && db.get('inventory', i.product_id)?.unit === 'saco'), i => i.quantity), hideSm: true },
      { key: 'nucleo', label: 'Núcleo', align: 'right', value: (b) => sum(db.where('feed_batch_items', i => i.batch_id === b.id && /n[uú]cleo/i.test(S.productName(i.product_id))), i => i.quantity) || null, render: (b) => { const v = sum(db.where('feed_batch_items', i => i.batch_id === b.id && /n[uú]cleo/i.test(S.productName(i.product_id))), i => i.quantity); return v ? fmtNum(v) : '—'; }, hideSm: true },
      { key: 'total_kg', label: 'Kg total', align: 'right', value: (b) => num(b.total_kg), render: (b) => `<b>${fmtNum(b.total_kg)}</b>` },
    ],
    summary: (rows) => sumBox([['Batidas', fmtNum(rows.length, 0)], ['Produzido', fmtKg(sum(rows, b => b.total_kg))], ...(can('inventory.cost') ? [['Custo', fmtMoney(sum(rows, b => b.cost_total))], ['Custo médio', rows.length ? fmtMoney(sum(rows, b => b.cost_total) / sum(rows, b => b.total_kg)) + '/kg' : '—']] : [])]),
    onRowClick: (b) => { location.hash = `#/racao/lote/${b.id}`; },
  });
}

export function batches(el) {
  listPage(el, {
    id: 'feed-lots', title: 'Lotes de ração', sub: 'Saldo de cada lote: fabricado − distribuído.',
    actions: can('feed.edit') ? `<button class="btn btn-primary" data-act="new">${icon('factory', 18)} Nova batida</button>` : '',
    bindActions: (root) => { const b = $('[data-act=new]', root); if (b) b.onclick = () => F.fabricationForm(); },
    defaults: { saldo: 'com' },
    filters: [{ type: 'search', key: 'q', text: (b) => `${b.lot_number} ${b.feed_type}` }, { type: 'select', key: 'saldo', label: 'Saldo', options: [['com', 'Com saldo'], ['sem', 'Esgotados']], match: (b, v) => v === 'com' ? num(b.balance_kg) > 0.0001 : num(b.balance_kg) <= 0.0001 },
      { type: 'select', key: 'ft', label: 'Categoria', options: () => list('feed_types'), match: (b, v) => b.feed_type === v }],
    rows: () => db.all('feed_batches'),
    defaultSort: { key: 'date', dir: 'desc' },
    columns: [
      { key: 'lot_number', label: 'Lote', render: (b) => batchLink(b.id) }, { key: 'date', label: 'Fabricação', text: (b) => fmtDate(b.date), render: (b) => fmtDate(b.date) },
      { key: 'feed_type', label: 'Categoria' }, { key: 'total_kg', label: 'Produzido', align: 'right', value: (b) => num(b.total_kg), render: (b) => fmtKg(b.total_kg) },
      { key: 'dist', label: 'Distribuído', align: 'right', value: (b) => num(b.total_kg) - num(b.balance_kg), render: (b) => fmtKg(num(b.total_kg) - num(b.balance_kg)), hideSm: true },
      { key: 'balance_kg', label: 'Saldo', align: 'right', value: (b) => num(b.balance_kg), render: (b) => `<b>${fmtKg(b.balance_kg)}</b>` },
      { key: 'bar', label: 'Uso', sortable: false, export: false, render: (b) => bar(num(b.total_kg) - num(b.balance_kg), num(b.total_kg)), hideSm: true },
    ],
    onRowClick: (b) => { location.hash = `#/racao/lote/${b.id}`; },
  });
}

// RASTREABILIDADE — ficha do lote
export function batchPage(el, { params }) {
  const b = db.get('feed_batches', params.id);
  if (!b) { el.innerHTML = '<div class="card empty-state">Lote não encontrado. <a href="#/racao/lotes">Voltar</a></div>'; return; }
  const items = db.where('feed_batch_items', i => i.batch_id === b.id);
  const dist = db.where('feed_distribution', d => d.batch_id === b.id).sort((x, y) => x.date.localeCompare(y.date));
  const distributed = sum(dist, d => d.quantity_kg);
  const who = [...new Set(dist.map(d => S.employeeName(d.responsible_id)))];
  const where = [...new Set(dist.map(d => d.area).filter(Boolean))];
  el.innerHTML = `<div class="crumbs"><a href="#/racao/lotes">Lotes</a> › Lote #${esc(b.lot_number)}</div>
    <div class="page-head"><h1>Ficha do lote</h1><div class="page-actions">
      ${can('feed.edit') && num(b.balance_kg) > 0 ? `<button class="btn btn-primary" data-a="dist">${icon('truck', 18)} Distribuir deste lote</button>` : ''}
      ${can('records.delete') && !dist.length ? `<button class="btn btn-danger-ghost" data-a="cancel">${icon('trash', 16)} Cancelar lote</button>` : ''}
      <button class="btn btn-ghost" onclick="window.print()">${icon('printer', 18)} Imprimir</button></div></div>
    <div class="grid g2">
      <div class="lot-card"><div class="muted small">LOTE RAÇÃO</div><div class="lot-no">#${esc(b.lot_number)}</div>
        <dl class="kv" style="margin-top:10px"><div><dt>Data</dt><dd>${fmtDate(b.date)} ${esc(b.time || '')}</dd></div><div><dt>Categoria</dt><dd>${esc(b.feed_type)}</dd></div>
        <div><dt>Quantidade</dt><dd>${fmtKg(b.total_kg)}</dd></div><div><dt>Fabricado por</dt><dd>${empLink(b.operator_id)}</dd></div>
        ${can('inventory.cost') ? `<div><dt>Custo</dt><dd>${fmtMoney(b.cost_total)} <span class="muted small">(${fmtMoney(b.cost_per_kg)}/kg)</span></dd></div>` : ''}</dl>
        <div class="section-title">Ingredientes</div>
        <ul class="list-plain">${items.map(i => { const p = db.get('inventory', i.product_id); return `<li><span>${p ? `<a href="#/produto/${p.id}">${esc(p.name)}</a>` : '?'}</span><span><b>${fmtKg(i.kg)}</b> <span class="muted small">(${fmtNum(i.quantity)} ${esc(p?.unit || '')})</span></span></li>`; }).join('')}</ul>
        ${b.notes ? `<p class="muted">${esc(b.notes)}</p>` : ''}</div>
      <div class="card"><h3 style="margin-bottom:10px">Distribuição</h3>
        <dl class="kv"><div><dt>Distribuído por</dt><dd>${esc(who.join(', ') || '—')}</dd></div><div><dt>Onde foi distribuído</dt><dd>${esc(where.join(', ') || '—')}</dd></div>
        <div><dt>Quantidade distribuída</dt><dd>${fmtKg(distributed)}</dd></div><div><dt>Saldo restante</dt><dd style="color:var(--green-700)">${fmtKg(b.balance_kg)}</dd></div></dl>
        <div style="margin:12px 0">${bar(distributed, num(b.total_kg))}</div><div id="d-table"></div></div>
    </div>`;
  mountTable($('#d-table', el), {
    id: 'lot-dist-' + b.id, rows: dist, empty: 'Ainda não distribuído.',
    columns: [{ key: 'date', label: 'Data', render: (d) => fmtDate(d.date) }, { key: 'r', label: 'Responsável', render: (d) => empLink(d.responsible_id) }, { key: 'area', label: 'Local' }, { key: 'herd_category', label: 'Categoria', hideSm: true },
      { key: 'quantity_kg', label: 'Kg', align: 'right', render: (d) => fmtNum(d.quantity_kg) }, { key: 'animals_count', label: 'Animais', align: 'right' }, { key: 'kg_per_animal', label: 'Kg/animal', align: 'right', render: (d) => d.kg_per_animal ? fmtNum(d.kg_per_animal, 2) : '—' }],
    onRowClick: can('feed.edit') ? (d) => F.distributionForm(d.id) : null,
  });
  $('[data-a=dist]', el) && ($('[data-a=dist]', el).onclick = () => F.distributionForm(null, { batch_id: b.id }));
  $('[data-a=cancel]', el) && ($('[data-a=cancel]', el).onclick = async () => {
    const { confirmDialog, toast } = await import('../ui.js');
    const r = await confirmDialog('Cancelar este lote? Os ingredientes voltam para o estoque. O registro fica na auditoria.', { title: 'Cancelar lote', ok: 'Cancelar lote', danger: true, input: 'Motivo' });
    if (!r) return;
    try { S.cancelBatch(b.id, r.value); toast('Lote cancelado e ingredientes estornados.'); location.hash = '#/racao/lotes'; } catch (e) { toast(e.message, 'err'); }
  });
}

export function distribution(el) {
  listPage(el, {
    id: 'feed-dist', title: 'Distribuição de ração', sub: 'Controle de distribuição. O kg por animal é calculado e o saldo do lote é baixado automaticamente.',
    actions: can('feed.edit') ? `<button class="btn btn-primary" data-act="new">${icon('truck', 18)} Nova distribuição</button>` : '',
    bindActions: (root) => { const b = $('[data-act=new]', root); if (b) b.onclick = () => F.distributionForm(); },
    defaultPeriod: '7d',
    filters: [{ type: 'period' }, { type: 'search', key: 'q', text: (d) => `${S.employeeName(d.responsible_id)} ${db.get('feed_batches', d.batch_id)?.lot_number} ${d.area} ${d.feed_type}` },
      { type: 'select', key: 'area', label: 'Local', options: () => list('areas'), match: (d, v) => d.area === v }],
    rows: (st) => db.where('feed_distribution', d => inRange(d.date, rangeOf(st))),
    defaultSort: { key: 'date', dir: 'desc' },
    columns: [
      { key: 'date', label: 'Data', text: (d) => fmtDate(d.date), render: (d) => fmtDate(d.date) },
      { key: 'resp', label: 'Responsável', text: (d) => S.employeeName(d.responsible_id), render: (d) => empLink(d.responsible_id) },
      { key: 'lot', label: 'Lote', text: (d) => db.get('feed_batches', d.batch_id)?.lot_number, render: (d) => batchLink(d.batch_id) },
      { key: 'feed_type', label: 'Ração' },
      { key: 'quantity_kg', label: 'Quantidade (kg)', align: 'right', value: (d) => num(d.quantity_kg), render: (d) => `<b>${fmtNum(d.quantity_kg)}</b>` },
      { key: 'animals_count', label: 'Nº de animais', align: 'right', value: (d) => num(d.animals_count) },
      { key: 'kg_per_animal', label: 'Kg/animal', align: 'right', value: (d) => num(d.kg_per_animal), render: (d) => d.kg_per_animal ? fmtNum(d.kg_per_animal, 2) : '—' },
      { key: 'area', label: 'Local', hideSm: true }, { key: 'herd_category', label: 'Categoria do rebanho', hideSm: true },
    ],
    summary: (rows) => sumBox([['Distribuído', fmtKg(sum(rows, d => d.quantity_kg))], ['Tratos', fmtNum(rows.length, 0)], ['Média kg/animal', fmtNum(sum(rows.filter(d => d.animals_count), d => d.quantity_kg) / (sum(rows, d => d.animals_count) || 1), 2)]]),
    onRowClick: can('feed.edit') ? (d) => F.distributionForm(d.id) : null,
  });
}

export function stock(el) {
  const lots = S.feedStock().sort((a, b) => a.date.localeCompare(b.date));
  const byType = [...groupBy(lots, b => b.feed_type)].map(([t, bs]) => ({ t, kg: sum(bs, b => b.balance_kg), n: bs.length }));
  const perDay = sum(db.where('feed_distribution', d => d.date >= addDays(today(), -13)), d => d.quantity_kg) / 14;
  el.innerHTML = `${pageHead('Estoque de ração', 'Ração pronta disponível (saldo dos lotes). Entra na fabricação e sai na distribuição.', can('feed.edit') ? `<button class="btn btn-ghost" data-a="fab">${icon('factory', 18)} Nova batida</button><button class="btn btn-primary" data-a="dist">${icon('truck', 18)} Distribuir</button>` : '')}
    <div class="stats">${statCard({ label: 'Total disponível', value: fmtKg(sum(lots, b => b.balance_kg)), sub: `${lots.length} lote(s) com saldo`, icon: 'layers', tone: 'gold' })}
      ${statCard({ label: 'Consumo médio', value: `${fmtNum(perDay, 0)} kg/dia`, sub: 'últimos 14 dias', icon: 'truck', tone: 'brown' })}
      ${statCard({ label: 'Dura aproximadamente', value: perDay ? `${fmtNum(sum(lots, b => b.balance_kg) / perDay, 1)} dias` : '—', icon: 'calendar', tone: 'green' })}
      ${byType.map(x => statCard({ label: x.t, value: fmtKg(x.kg), sub: `${x.n} lote(s)`, icon: 'wheat', tone: 'gold' })).join('')}</div>
    <div class="card"><div class="card-head"><h3>Lotes com saldo (use primeiro os mais antigos)</h3></div><div id="s-t"></div></div>`;
  $('[data-a=fab]', el) && ($('[data-a=fab]', el).onclick = () => F.fabricationForm());
  $('[data-a=dist]', el) && ($('[data-a=dist]', el).onclick = () => F.distributionForm());
  mountTable($('#s-t', el), { id: 'feed-stock', rows: lots, empty: 'Sem ração pronta em estoque.',
    columns: [{ key: 'lot_number', label: 'Lote', render: (b) => batchLink(b.id) }, { key: 'date', label: 'Fabricação', render: (b) => fmtDate(b.date) }, { key: 'feed_type', label: 'Categoria' }, { key: 'balance_kg', label: 'Saldo', align: 'right', render: (b) => `<b>${fmtKg(b.balance_kg)}</b>` }, { key: 'u', label: 'Uso', render: (b) => bar(num(b.total_kg) - num(b.balance_kg), num(b.total_kg)) }],
    onRowClick: (b) => { location.hash = `#/racao/lote/${b.id}`; } });
}

export function consumption(el) {
  const st = pageState('feed-cons', { period: '30d', by: 'herd_category' });
  el.innerHTML = `${pageHead('Consumo de ração', 'Quanto cada grupo consumiu e a média por animal.')}
    <div class="filters">${periodSelect(st)}<select class="input" id="by"><option value="herd_category">Por categoria do rebanho</option><option value="area">Por local</option><option value="feed_type">Por tipo de ração</option></select></div>
    <div id="c-sum"></div><div class="grid g2"><div class="card"><h3>Consumo por dia (kg)</h3><div class="chart-box"><canvas id="c-day"></canvas></div></div><div class="card"><h3 id="c-by-title">Consumo por grupo</h3><div class="chart-box"><canvas id="c-by"></canvas></div></div></div>
    <div class="card" style="margin-top:16px"><div id="c-table"></div></div>`;
  $('#by', el).value = st.by;
  const draw = () => {
    const r = rangeOf(st);
    const rows = St.distributionsIn(r);
    const g = [...groupBy(rows, d => d[st.by] || 'Não informado')].map(([k, ds]) => ({ k, kg: sum(ds, d => d.quantity_kg), animals: sum(ds, d => d.animals_count), n: ds.length }))
      .map(x => ({ ...x, kpa: x.animals ? x.kg / x.animals : null })).sort((a, b) => b.kg - a.kg);
    $('#c-sum', el).innerHTML = sumBox([['Consumo total', fmtKg(sum(rows, d => d.quantity_kg))], ['Média por animal (por trato)', `${fmtNum(St.feedPerAnimal(r), 2)} kg`], ['Tratos', fmtNum(rows.length, 0)], ['Período', periodLabel(r)]]);
    const days = St.feedByDay(r, 'dist');
    chart($('#c-day', el), { type: 'bar', data: { labels: days.map(x => fmtDate(x.date).slice(0, 5)), datasets: [{ label: 'kg', data: days.map(x => x.kg), backgroundColor: COLORS.brown, borderRadius: 3 }] } });
    chart($('#c-by', el), { type: 'doughnut', data: { labels: g.map(x => x.k), datasets: [{ data: g.map(x => x.kg), backgroundColor: SERIES }] } });
    mountTable($('#c-table', el), { id: 'feed-cons-t', rows: g, columns: [{ key: 'k', label: 'Grupo' }, { key: 'kg', label: 'Consumo (kg)', align: 'right', render: (x) => fmtNum(x.kg) }, { key: 'n', label: 'Tratos', align: 'right' }, { key: 'animals', label: 'Animais tratados (soma)', align: 'right', render: (x) => fmtNum(x.animals, 0) }, { key: 'kpa', label: 'Kg/animal', align: 'right', render: (x) => x.kpa ? fmtNum(x.kpa, 2) : '—' }] });
  };
  $('#by', el).onchange = (e) => { st.by = e.target.value; draw(); };
  bindPeriod(el, st, draw);
  draw();
}
