// ESTOQUE — produtos, entradas, saídas, inventário (contagem) e estoque mínimo.
import * as db from '../db.js';
import * as S from '../services.js';
import * as F from '../forms.js';
import { can, currentUser } from '../auth.js';
import { icon, $, $$, badge, mountTable, pageHead, statCard, toast, confirmDialog } from '../ui.js';
import { esc, fmtDate, fmtNum, fmtMoney, today, inRange, sum, num } from '../util.js';
import { list } from '../config.js';
import { listPage, pageState, sumBox, cellMain, rangeOf } from './common.js';

const pLink = (id) => { const p = db.get('inventory', id); return p ? `<a href="#/produto/${p.id}">${esc(p.name)}</a>` : '—'; };
const lowBadge = (p) => num(p.min_qty) > 0 && num(p.quantity) <= num(p.min_qty) ? badge(num(p.quantity) <= 0 ? 'SEM ESTOQUE' : 'ESTOQUE BAIXO', 'rose') : num(p.max_qty) > 0 && num(p.quantity) > num(p.max_qty) ? badge('acima do máximo', 'gold') : badge('ok', 'green');
const btns = () => can('inventory.edit') ? `<button class="btn btn-ghost" data-act="out">${icon('arrowOut', 18)} Saída</button><button class="btn btn-ghost" data-act="in">${icon('arrowIn', 18)} Entrada</button><button class="btn btn-primary" data-act="new">${icon('plus', 18)} Novo produto</button>` : '';
const bindBtns = (root) => { const on = (k, fn) => { const b = $(`[data-act=${k}]`, root); if (b) b.onclick = fn; }; on('new', () => F.productForm()); on('in', () => F.stockInForm()); on('out', () => F.stockOutForm()); };

export function products(el, { query }) {
  if (query.id) { location.replace(`#/produto/${query.id}`); return; }
  const cost = can('inventory.cost');
  listPage(el, {
    id: 'products', title: 'Produtos', sub: 'Estoque centralizado. Fabricação de ração, saúde, manutenção e combustível dão baixa automaticamente.',
    actions: btns(), bindActions: bindBtns,
    filters: [{ type: 'search', key: 'q', placeholder: 'Nome, código, fornecedor…', text: (p) => `${p.name} ${p.code} ${p.supplier} ${p.location}` },
      { type: 'select', key: 'cat', label: 'Categoria', options: () => list('product_categories'), match: (p, v) => p.category === v },
      { type: 'select', key: 'act', label: 'Situação', options: [['1', 'Ativos'], ['0', 'Inativos'], ['low', 'Abaixo do mínimo']], match: (p, v) => v === 'low' ? num(p.min_qty) > 0 && num(p.quantity) <= num(p.min_qty) : v === '1' ? p.active !== false : p.active === false }],
    defaults: { act: '1' },
    rows: () => db.all('inventory'), defaultSort: { key: 'name', dir: 'asc' },
    columns: [
      { key: 'name', label: 'Produto', render: (p) => cellMain(esc(p.name), `${esc(p.code || '')} · ${esc(p.category)}`) },
      { key: 'category', label: 'Categoria', hideSm: true },
      { key: 'quantity', label: 'Quantidade', align: 'right', value: (p) => num(p.quantity), render: (p) => `<b>${fmtNum(p.quantity, 2)}</b> ${esc(p.unit)}` },
      { key: 'min_qty', label: 'Mínimo', align: 'right', render: (p) => num(p.min_qty) ? fmtNum(p.min_qty, 2) : '—', hideSm: true },
      { key: 'st', label: 'Situação', sortable: false, text: (p) => num(p.min_qty) > 0 && num(p.quantity) <= num(p.min_qty) ? 'Estoque baixo' : 'OK', render: lowBadge },
      ...(cost ? [{ key: 'unit_cost', label: 'Valor unit.', align: 'right', value: (p) => num(p.unit_cost), render: (p) => fmtMoney(p.unit_cost), hideSm: true },
        { key: 'value', label: 'Valor em estoque', align: 'right', value: (p) => Math.max(0, num(p.quantity)) * num(p.unit_cost), render: (p) => fmtMoney(Math.max(0, num(p.quantity)) * num(p.unit_cost)) }] : []),
      { key: 'location', label: 'Localização', hideSm: true }, { key: 'supplier', label: 'Fornecedor', hideSm: true },
    ],
    summary: (rows) => sumBox([['Produtos', fmtNum(rows.length, 0)], ['Abaixo do mínimo', fmtNum(rows.filter(p => num(p.min_qty) > 0 && num(p.quantity) <= num(p.min_qty)).length, 0)], ...(cost ? [['Valor do estoque', fmtMoney(sum(rows, p => Math.max(0, num(p.quantity)) * num(p.unit_cost)))]] : [])]),
    onRowClick: (p) => { location.hash = `#/produto/${p.id}`; },
  });
}

export function productPage(el, { params }) {
  const p = db.get('inventory', params.id);
  if (!p) { el.innerHTML = '<div class="card">Produto não encontrado.</div>'; return; }
  const mv = db.where('inventory_movements', m => m.product_id === p.id);
  const cost = can('inventory.cost');
  el.innerHTML = `<div class="crumbs"><a href="#/estoque/produtos">Produtos</a> › ${esc(p.name)}</div>
    ${pageHead(p.name, `${esc(p.code || '')} · ${esc(p.category)} · ${esc(p.location || '')}`, can('inventory.edit') ? `<button class="btn btn-ghost" data-a="edit">${icon('edit', 18)} Editar</button><button class="btn btn-ghost" data-a="out">${icon('arrowOut', 18)} Saída</button><button class="btn btn-primary" data-a="in">${icon('arrowIn', 18)} Entrada</button>` : '')}
    <div class="stats">${statCard({ label: 'Saldo atual', value: `${fmtNum(p.quantity, 2)} ${esc(p.unit)}`, sub: lowBadge(p), icon: 'package', tone: num(p.min_qty) && num(p.quantity) <= num(p.min_qty) ? 'rose' : 'green' })}
      ${statCard({ label: 'Estoque mínimo', value: `${fmtNum(p.min_qty, 2)} ${esc(p.unit)}`, sub: p.max_qty ? `máximo ${fmtNum(p.max_qty, 2)}` : '', icon: 'alert', tone: 'gold' })}
      ${cost ? statCard({ label: 'Valor unitário (médio)', value: fmtMoney(p.unit_cost), sub: `em estoque: ${fmtMoney(Math.max(0, num(p.quantity)) * num(p.unit_cost))}`, icon: 'money', tone: 'blue' }) : ''}
      ${statCard({ label: 'Fornecedor', value: `<span style="font-size:15px">${esc(p.supplier || '—')}</span>`, icon: 'truck', tone: 'brown' })}</div>
    <div class="card"><div class="card-head"><h3>Movimentações</h3></div><div id="mv"></div></div>`;
  const on = (k, fn) => { const b = $(`[data-a=${k}]`, el); if (b) b.onclick = fn; };
  on('edit', () => F.productForm(p.id)); on('in', () => F.stockInForm({ product_id: p.id })); on('out', () => F.stockOutForm({ product_id: p.id }));
  mountTable($('#mv', el), { id: 'mv-' + p.id, rows: mv, defaultSort: { key: 'date', dir: 'desc' }, empty: 'Sem movimentações.', columns: mvCols(false) });
}

const typeBadge = (m) => m.type === 'entrada' ? badge('Entrada', 'green') : m.type === 'saida' ? badge('Saída', 'rose') : badge('Ajuste', 'gold');
const origin = (m) => m.ref_table === 'feed_batches' ? `Fabricação — lote <a href="#/racao/lote/${m.ref_id}">${esc(db.get('feed_batches', m.ref_id)?.lot_number || '')}</a>` : m.ref_table === 'animal_health' ? 'Saúde animal' : m.ref_table === 'fuel_records' ? 'Abastecimento' : m.ref_table === 'machine_maintenance' ? 'Manutenção' : 'Manual';
const mvCols = (withProduct = true) => [
  { key: 'date', label: 'Data', text: (m) => fmtDate(m.date), render: (m) => fmtDate(m.date) },
  ...(withProduct ? [{ key: 'product', label: 'Produto', text: (m) => S.productName(m.product_id), render: (m) => pLink(m.product_id) }] : []),
  { key: 'type', label: 'Tipo', render: typeBadge },
  { key: 'quantity', label: 'Quantidade', align: 'right', value: (m) => num(m.quantity), render: (m) => `<b>${m.type === 'saida' ? '−' : m.type === 'ajuste' && num(m.quantity) < 0 ? '' : '+'}${fmtNum(m.quantity, 2)}</b> ${esc(db.get('inventory', m.product_id)?.unit || '')}` },
  ...(can('inventory.cost') ? [{ key: 'total', label: 'Valor', align: 'right', value: (m) => num(m.total), render: (m) => fmtMoney(m.total) }] : []),
  { key: 'who', label: 'Fornecedor / destino', text: (m) => m.supplier || m.destination || '', render: (m) => esc(m.supplier || m.destination || '—'), hideSm: true },
  { key: 'invoice', label: 'NF', hideSm: true },
  { key: 'reason', label: 'Motivo / origem', text: (m) => m.reason || '', render: (m) => `${esc(m.reason || '')}<div class="cell-sub">${origin(m)}</div>`, hideSm: true },
  { key: 'responsible', label: 'Responsável', hideSm: true },
];

function movementsPage(el, type) {
  const isIn = type === 'entrada';
  listPage(el, {
    id: 'mv-' + type, title: isIn ? 'Entradas' : 'Saídas', sub: isIn ? 'Compras e recebimentos. O custo médio do produto é recalculado automaticamente.' : 'Retiradas do estoque (manuais e automáticas).',
    actions: can('inventory.edit') ? `<button class="btn btn-primary" data-act="n">${icon(isIn ? 'arrowIn' : 'arrowOut', 18)} ${isIn ? 'Nova entrada' : 'Nova saída'}</button>` : '',
    bindActions: (root) => { const b = $('[data-act=n]', root); if (b) b.onclick = () => isIn ? F.stockInForm() : F.stockOutForm(); },
    defaultPeriod: '30d',
    filters: [{ type: 'period' }, { type: 'search', key: 'q', text: (m) => `${S.productName(m.product_id)} ${m.supplier} ${m.destination} ${m.reason} ${m.invoice} ${m.responsible}` },
      { type: 'select', key: 'cat', label: 'Categoria', options: () => list('product_categories'), match: (m, v) => db.get('inventory', m.product_id)?.category === v }],
    rows: (st) => db.where('inventory_movements', m => m.type === type && inRange(m.date, rangeOf(st))),
    defaultSort: { key: 'date', dir: 'desc' }, columns: mvCols(true),
    summary: (rows) => sumBox([['Lançamentos', fmtNum(rows.length, 0)], ...(can('inventory.cost') ? [['Valor total', fmtMoney(sum(rows, m => m.total))]] : [])]),
    onRowClick: async (m) => {
      if (!can('records.delete') || m.ref_table) { location.hash = `#/produto/${m.product_id}`; return; }
      const r = await confirmDialog(`Estornar esta ${isIn ? 'entrada' : 'saída'} de ${fmtNum(m.quantity, 2)} ${esc(db.get('inventory', m.product_id)?.unit || '')} de <b>${esc(S.productName(m.product_id))}</b>? O saldo será corrigido e o registro fica na auditoria.`, { title: 'Estornar movimentação', ok: 'Estornar', danger: true, input: 'Motivo' });
      if (r) { S.cancelMovement(m.id, r.value); toast('Movimentação estornada.'); }
    },
  });
}
export const entries = (el) => movementsPage(el, 'entrada');
export const exits = (el) => movementsPage(el, 'saida');

// INVENTÁRIO — contagem física
export function count(el) {
  const st = pageState('inv-count', { cat: '' });
  const rows = db.where('inventory', p => p.active !== false && (!st.cat || p.category === st.cat)).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  const last = db.where('inventory_movements', m => m.type === 'ajuste').sort((a, b) => b.date.localeCompare(a.date))[0];
  el.innerHTML = `${pageHead('Inventário', `Conte o estoque físico e informe a quantidade encontrada. O sistema ajusta a diferença e registra na auditoria.${last ? ` Último ajuste: ${fmtDate(last.date)}.` : ''}`)}
    <div class="filters"><select class="input" id="cat"><option value="">Todas as categorias</option>${list('product_categories').map(c => `<option ${st.cat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
    <div class="card" data-hold><div class="table-wrap"><table class="table"><thead><tr><th>Produto</th><th class="hide-sm">Categoria</th><th class="r">No sistema</th><th class="r">Contado</th><th class="r">Diferença</th></tr></thead>
    <tbody>${rows.map(p => `<tr data-id="${p.id}"><td>${esc(p.name)}<div class="cell-sub">${esc(p.location || '')}</div></td><td class="hide-sm">${esc(p.category)}</td><td class="r">${fmtNum(p.quantity, 2)} ${esc(p.unit)}</td>
      <td class="r"><input class="input" inputmode="decimal" style="width:110px;text-align:right" ${can('inventory.edit') ? '' : 'disabled'}></td><td class="r diff">—</td></tr>`).join('')}</tbody></table></div>
    ${can('inventory.edit') ? `<div class="sticky-save"><button class="btn btn-primary btn-lg" id="save">${icon('check', 18)} Aplicar ajustes</button></div>` : ''}</div>`;
  $('#cat', el).onchange = (e) => { st.cat = e.target.value; count(el); };
  const hold = $('[data-hold]', el);
  $$('tbody tr', el).forEach(tr => { const i = $('input', tr), p = db.get('inventory', tr.dataset.id); i.oninput = () => { hold.classList.add('dirty'); const d = i.value.trim() === '' ? null : num(i.value) - num(p.quantity); $('.diff', tr).innerHTML = d == null ? '—' : `<b class="${d < 0 ? 'delta-down' : d > 0 ? 'delta-up' : ''}">${d > 0 ? '+' : ''}${fmtNum(d, 2)}</b>`; }; });
  const save = $('#save', el);
  if (save) save.onclick = async () => {
    const changes = $$('tbody tr', el).map(tr => ({ id: tr.dataset.id, v: $('input', tr).value.trim() })).filter(x => x.v !== '');
    if (!changes.length) return toast('Nenhuma quantidade informada.', 'warn');
    if (!await confirmDialog(`Aplicar ajuste de inventário em ${changes.length} produto(s)?`)) return;
    let n = 0; for (const c of changes) if (S.inventoryCount(c.id, num(c.v), currentUser().name)) n++;
    hold.classList.remove('dirty'); toast(`${n} ajuste(s) registrado(s).`); count(el);
  };
}

export function minimum(el) {
  const rows = S.lowStock();
  el.innerHTML = `${pageHead('Estoque mínimo', 'Produtos que atingiram ou ficaram abaixo do estoque mínimo (alerta ESTOQUE BAIXO).', btns())}
    <div class="stats">${statCard({ label: 'Produtos abaixo do mínimo', value: fmtNum(rows.length, 0), icon: 'alert', tone: rows.length ? 'rose' : 'green' })}
    ${statCard({ label: 'Sem estoque', value: fmtNum(rows.filter(p => num(p.quantity) <= 0).length, 0), icon: 'package', tone: 'rose' })}</div>
    <div class="card"><div id="t"></div></div>`;
  bindBtns(el);
  mountTable($('#t', el), { id: 'min', rows, empty: 'Nenhum produto abaixo do mínimo. 👍',
    columns: [{ key: 'name', label: 'Produto', render: (p) => pLink(p.id) }, { key: 'category', label: 'Categoria' }, { key: 'quantity', label: 'Quantidade atual', align: 'right', render: (p) => `<b class="delta-down">${fmtNum(p.quantity, 2)}</b> ${esc(p.unit)}` },
      { key: 'min_qty', label: 'Estoque mínimo', align: 'right', render: (p) => `${fmtNum(p.min_qty, 2)} ${esc(p.unit)}` }, { key: 'buy', label: 'Sugestão de compra', align: 'right', render: (p) => `${fmtNum(Math.max(0, (num(p.max_qty) || num(p.min_qty) * 2) - num(p.quantity)), 2)} ${esc(p.unit)}` }, { key: 'supplier', label: 'Fornecedor' }],
    onRowClick: (p) => can('inventory.edit') ? F.stockInForm({ product_id: p.id }) : (location.hash = `#/produto/${p.id}`) });
}
