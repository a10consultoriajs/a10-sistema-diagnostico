// Peças comuns das telas: estado persistente, filtros, seletor de período e lista padrão.
import { $, $$, icon, mountTable, pageHead } from '../ui.js';
import { esc, PERIODS, periodRange, normalize, debounce, periodLabel } from '../util.js';
import { exportTable } from '../export.js';

const states = new Map();
export function pageState(key, defaults) {
  if (!states.has(key)) states.set(key, { ...defaults });
  return states.get(key);
}

export function periodSelect(st, key = 'period') {
  return `<span class="period"><select class="input" data-period="${key}">${PERIODS.map(([k, l]) => `<option value="${k}" ${st[key] === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <span data-custom="${key}" ${st[key] === 'custom' ? '' : 'hidden'} class="period"><input class="input" type="date" data-from value="${st.from || ''}"><span class="muted">até</span><input class="input" type="date" data-to value="${st.to || ''}"></span></span>`;
}
export function bindPeriod(root, st, onChange, key = 'period') {
  const sel = $(`[data-period="${key}"]`, root); if (!sel) return;
  const custom = $(`[data-custom="${key}"]`, root);
  sel.onchange = () => {
    st[key] = sel.value; custom.hidden = sel.value !== 'custom';
    if (sel.value === 'custom' && !st.from) { const r = periodRange('30d'); st.from = r.from; st.to = r.to; $('[data-from]', custom).value = st.from; $('[data-to]', custom).value = st.to; }
    onChange();
  };
  $('[data-from]', custom).onchange = (e) => { st.from = e.target.value; onChange(); };
  $('[data-to]', custom).onchange = (e) => { st.to = e.target.value; onChange(); };
}
export const rangeOf = (st, key = 'period') => periodRange(st[key], { from: st.from, to: st.to });

// Lista padrão com barra de filtros
// cfg: { id, title, sub, actions (html), bindActions(root), filters:[{type:'search'|'select'|'period', key, label, options, placeholder}],
//        rows(st) -> array, columns, onRowClick, summary(rows, st) -> html, exportName }
export function listPage(el, cfg) {
  const st = pageState(cfg.id, { q: '', period: cfg.defaultPeriod || '30d', ...(cfg.defaults || {}) });
  const filters = cfg.filters || [{ type: 'search', key: 'q' }];
  el.innerHTML = `${cfg.crumbs ? `<div class="crumbs">${cfg.crumbs}</div>` : ''}${pageHead(cfg.title, cfg.sub || '', (cfg.actions || '') + (cfg.noExport ? '' : `<button class="btn btn-ghost" data-exp="xlsx">${icon('sheet', 18)} Excel</button><button class="btn btn-ghost" data-exp="pdf">${icon('file', 18)} PDF</button>`))}
    ${cfg.top ? `<div class="top-extra">${typeof cfg.top === 'function' ? cfg.top(st) : cfg.top}</div>` : ''}
    <div class="filters">${filters.map(f => {
      if (f.type === 'search') return `<input class="input search-inline" type="search" data-q="${f.key}" placeholder="${esc(f.placeholder || 'Filtrar…')}" value="${esc(st[f.key] || '')}">`;
      if (f.type === 'select') { const o = typeof f.options === 'function' ? f.options() : f.options; return `<select class="input" data-s="${f.key}"><option value="">${esc(f.label)}: todos</option>${o.map(x => { const [v, l] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(v)}" ${st[f.key] === v ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select>`; }
      if (f.type === 'period') return periodSelect(st, f.key || 'period');
      return '';
    }).join('')}</div>
    <div class="summary-host"></div><div class="table-host"></div>`;
  const draw = () => {
    let rows = cfg.rows(st);
    for (const f of filters) {
      if (f.type === 'search' && st[f.key]) { const q = normalize(st[f.key]); rows = rows.filter(r => normalize(f.text ? f.text(r) : Object.values(r).filter(v => typeof v !== 'object').join(' ')).includes(q)); }
      if (f.type === 'select' && st[f.key] && f.match) rows = rows.filter(r => f.match(r, st[f.key]));
    }
    const sum = $('.summary-host', el);
    sum.innerHTML = cfg.summary ? cfg.summary(rows, st) : '';
    cfg.afterSummary && cfg.afterSummary(sum, rows, st);
    mountTable($('.table-host', el), { id: cfg.id, columns: cfg.columns, rows, onRowClick: cfg.onRowClick, defaultSort: cfg.defaultSort, empty: cfg.empty, footer: cfg.footer ? cfg.footer(rows) : '' });
    el._rows = rows;
  };
  $$('[data-q]', el).forEach(i => i.addEventListener('input', debounce(() => { st[i.dataset.q] = i.value; draw(); }, 150)));
  $$('[data-s]', el).forEach(s => s.onchange = () => { st[s.dataset.s] = s.value; draw(); });
  filters.filter(f => f.type === 'period').forEach(f => bindPeriod(el, st, draw, f.key || 'period'));
  $$('[data-exp]', el).forEach(b => b.onclick = () => {
    const cols = cfg.columns.filter(c => c.export !== false);
    const hasPeriod = filters.find(f => f.type === 'period');
    exportTable(b.dataset.exp, {
      title: cfg.exportName || cfg.title, subtitle: hasPeriod ? `Período: ${periodLabel(rangeOf(st, hasPeriod.key || 'period'))}` : '',
      columns: cols.map(c => c.label), rows: (el._rows || []).map(r => cols.map(c => c.text ? c.text(r) : c.value ? c.value(r) : r[c.key])),
    });
  });
  cfg.bindActions && cfg.bindActions(el, st, draw);
  draw();
  return { st, draw };
}

export const cellMain = (main, sub = '') => `<div class="cell-main">${main}</div>${sub ? `<div class="cell-sub">${sub}</div>` : ''}`;
export const sumBox = (items) => `<div class="summary-row">${items.map(([l, v]) => `<div class="sum"><span class="muted small">${esc(l)}</span><b>${v}</b></div>`).join('')}</div>`;
