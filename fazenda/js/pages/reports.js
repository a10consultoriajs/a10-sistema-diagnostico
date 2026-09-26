// Tela da central de relatórios.
import { can } from '../auth.js';
import { icon, $, $$, mountTable, chart, SERIES, COLORS, pageHead } from '../ui.js';
import { esc, periodLabel, fmtNum } from '../util.js';
import { REPORTS, CATEGORIES, reportById, FMT } from '../reports.js';
import { exportTable } from '../export.js';
import { farm } from '../config.js';
import { pageState, periodSelect, bindPeriod, rangeOf } from './common.js';

const allowed = (r) => { const cat = CATEGORIES.find(c => c[0] === r.cat); return can(cat[3]) && (!r.perm || can(r.perm)); };

export function index(el) {
  el.innerHTML = `${pageHead('Relatórios', 'Todos os relatórios permitem filtrar, visualizar, imprimir e exportar em PDF ou Excel.')}
    <div class="report-cats">${CATEGORIES.filter(c => can(c[3])).map(([k, l, ic]) => {
      const rs = REPORTS.filter(r => r.cat === k && allowed(r));
      return rs.length ? `<div class="card report-cat"><h3>${icon(ic, 20)} ${esc(l)}</h3>${rs.map(r => `<a href="#/relatorios/${r.id}">${esc(r.title)} ${icon('right', 16)}</a>`).join('')}</div>` : '';
    }).join('')}</div>`;
}

const fmtCell = (c, v) => v == null || v === '' ? '' : FMT[c.type] ? FMT[c.type](v) : String(v);

export function view(el, { params }) {
  const rep = reportById(params.id);
  if (!rep || !allowed(rep)) { el.innerHTML = '<div class="card">Relatório não encontrado ou sem permissão. <a href="#/relatorios">Voltar</a></div>'; return; }
  const defaults = { period: rep.defaultPeriod || '30d' };
  (rep.extra || []).forEach(x => { defaults[x.key] = typeof x.default === 'function' ? x.default() : x.default ?? ''; });
  const st = pageState('rep:' + rep.id, defaults);
  const cat = CATEGORIES.find(c => c[0] === rep.cat);
  el.innerHTML = `<div class="crumbs"><a href="#/relatorios">Relatórios</a> › ${esc(cat[1])}</div>
    ${pageHead(rep.title, '', `<button class="btn btn-ghost" id="r-print">${icon('printer', 18)} Imprimir</button><button class="btn btn-ghost" id="r-pdf">${icon('file', 18)} PDF</button><button class="btn btn-primary" id="r-xlsx">${icon('sheet', 18)} Excel</button>`)}
    <div class="filters">${rep.period === false ? '' : periodSelect(st)}${(rep.extra || []).map(x => x.type === 'month'
      ? `<label class="row-flex"><span class="muted small">${esc(x.label)}</span><input class="input" type="month" data-x="${x.key}" value="${esc(st[x.key])}"></label>`
      : `<label class="row-flex"><span class="muted small">${esc(x.label)}</span><select class="input" data-x="${x.key}">${(typeof x.options === 'function' ? x.options() : x.options).map(([v, l]) => `<option value="${esc(v)}" ${st[x.key] === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`).join('')}</div>
    <div class="card"><div class="print-head"><div><b>${esc(farm().name)}</b> — <span id="r-title-p"></span></div><div class="small" id="r-range-p"></div></div><div id="r-body"></div></div>`;
  let out = null;
  const draw = () => {
    const f = { ...st, range: rangeOf(st) };
    out = rep.build(f, can);
    const title = out.title || rep.title;
    $('#r-title-p', el).textContent = title; $('#r-range-p', el).textContent = rep.period === false ? '' : `Período: ${periodLabel(f.range)}`;
    const body = $('#r-body', el);
    if (out.message) { body.innerHTML = `<div class="empty-state">${esc(out.message)}</div>`; return; }
    body.innerHTML = `${rep.period === false ? '' : `<p class="muted small no-print" style="margin-top:0">Período: ${periodLabel(f.range)}</p>`}
      ${out.note ? `<div class="disclaimer">${esc(out.note)}</div>` : ''}
      ${out.summary?.length ? `<div class="summary-row">${out.summary.map(([l, v]) => `<div class="sum"><span class="muted small">${esc(l)}</span><b>${typeof v === 'number' ? fmtNum(v, 0) : esc(v)}</b></div>`).join('')}</div>` : ''}
      ${out.chart && out.chart.data.length ? `<div class="chart-box" style="margin-bottom:16px"><canvas id="r-chart"></canvas></div>` : ''}
      ${out.groupTable ? '<div id="r-group" style="margin-bottom:16px"></div>' : ''}<div id="r-table"></div>`;
    if (out.chart && out.chart.data.length) {
      const c = out.chart, round = c.type === 'doughnut';
      chart($('#r-chart', el), { type: c.type, data: { labels: c.labels, datasets: [{ label: c.label || '', data: c.data, backgroundColor: round ? SERIES : c.type === 'line' ? 'rgba(46,107,63,.12)' : COLORS.green, borderColor: c.type === 'line' ? COLORS.green : undefined, fill: c.type === 'line', tension: .25, borderRadius: c.type === 'bar' ? 4 : 0 }] } });
    }
    const toCols = (cols) => cols.map(c => ({ key: c.key, label: c.label, align: ['text', 'date', 'month'].includes(c.type) ? 'left' : 'right', value: (r) => r[c.key], render: (r) => esc(fmtCell(c, r[c.key])) }));
    if (out.groupTable) mountTable($('#r-group', el), { id: 'rg-' + rep.id, columns: toCols(out.groupTable.columns), rows: out.groupTable.rows, pageSize: 500 });
    const tot = out.totals ? `<tr>${out.columns.map(c => `<td class="${['text', 'date', 'month'].includes(c.type) ? '' : 'r'}">${out.totals[c.key] != null ? esc(typeof out.totals[c.key] === 'string' ? out.totals[c.key] : fmtCell(c, out.totals[c.key])) : ''}</td>`).join('')}</tr>` : '';
    mountTable($('#r-table', el), { id: 'rt-' + rep.id, columns: toCols(out.columns), rows: out.rows, pageSize: 200, footer: tot, empty: 'Nenhum dado para os filtros escolhidos.' });
  };
  bindPeriod(el, st, draw);
  $$('[data-x]', el).forEach(i => i.onchange = () => { st[i.dataset.x] = i.value; draw(); });
  const exp = (kind) => {
    if (!out || out.message) return;
    const f = { range: rangeOf(st) };
    const withTot = out.totals ? [...out.rows, out.totals] : out.rows;
    exportTable(kind, {
      title: out.title || rep.title, subtitle: rep.period === false ? '' : `Período: ${periodLabel(f.range)}`,
      summary: (out.summary || []).map(([l, v]) => [l, typeof v === 'number' ? fmtNum(v, 0) : v]),
      columns: out.columns.map(c => c.label),
      rows: withTot.map(r => out.columns.map(c => kind === 'xlsx' ? (['date', 'month', 'h'].includes(c.type) ? fmtCell(c, r[c.key]) : r[c.key] ?? '') : fmtCell(c, r[c.key]))),
    });
  };
  $('#r-print', el).onclick = () => window.print();
  $('#r-pdf', el).onclick = () => exp('pdf');
  $('#r-xlsx', el).onclick = () => exp('xlsx');
  draw();
}
