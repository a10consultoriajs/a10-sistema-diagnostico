// FICHA DIGITAL DO ANIMAL — resumo, produção, reprodução, saúde, pesagens, filhos/genealogia e linha do tempo.
import * as db from '../db.js';
import * as S from '../services.js';
import * as F from '../forms.js';
import * as St from '../stats.js';
import { can } from '../auth.js';
import { icon, $, $$, badge, tabs, mountTable, chart, COLORS } from '../ui.js';
import { esc, fmtDate, fmtNum, fmtAge, fmtKg, today, addDays, diffDays, num, sum, fmtDateTime } from '../util.js';
import { shiftLabel } from '../config.js';
import { statusBadge, animalLink } from './herd.js';
import { pageState, periodSelect, bindPeriod, rangeOf, sumBox } from './common.js';
import { TABLE_LABELS } from '../db.js';

const TABS = [['resumo', 'Resumo'], ['producao', 'Produção'], ['reproducao', 'Reprodução'], ['saude', 'Saúde'], ['pesagens', 'Pesagens'], ['filhos', 'Filhos e genealogia'], ['historico', 'Histórico']];

export function render(el, { params, query }) {
  const a = db.get('animals', params.id);
  if (!a || a.deleted_at) { el.innerHTML = '<div class="card empty-state"><h2>Animal não encontrado</h2><a href="#/rebanho/animais">Voltar para Animais</a></div>'; return; }
  const st = pageState('animal:' + a.id, { tab: query.tab || 'resumo', period: '30d' });
  if (query.tab) st.tab = query.tab;
  const ms = St.animalMilkSummary(a.id);
  const preg = S.pregnancyOpen(a.id);
  el.innerHTML = `<div class="crumbs"><a href="#/rebanho/animais">Animais</a> › ${esc(S.animalName(a))}</div>
    <div class="card" style="margin-bottom:16px">
      <div class="animal-hero">
        <div class="animal-photo">${a.photo ? `<img src="${a.photo}" alt="">` : icon('cow', 52)}</div>
        <div style="flex:1;min-width:220px">
          <div class="animal-id">ID: ${S.animalCode(a)}${a.tag ? ` · BRINCO ${esc(a.tag)}` : ''}</div>
          <h1 style="font-size:28px;margin:2px 0 6px">${esc(S.animalName(a))}</h1>
          <div class="chip-list">${statusBadge(a.status)} ${preg && a.status !== 'Gestante' ? badge('Gestante', 'rose') : ''} ${badge(S.sexLabel(a.sex), a.sex === 'F' ? 'rose' : 'blue')} ${a.breed ? badge(a.breed, 'neutral') : ''} ${a.category ? badge(a.category, 'neutral') : ''}</div>
        </div>
        <div class="page-actions no-print">
          ${can('milk.edit') && a.sex === 'F' && S.isActive(a) ? `<button class="btn btn-primary" data-a="milk">${icon('milk', 18)} Produção</button>` : ''}
          ${can('herd.edit') ? `<button class="btn btn-ghost" data-a="edit">${icon('edit', 18)} Editar</button>` : ''}
          <button class="btn btn-ghost" onclick="window.print()">${icon('printer', 18)}</button>
        </div>
      </div>
      <div class="stats" style="margin:16px 0 0">
        ${a.sex === 'F' ? `<div class="stat stat-blue"><div class="stat-ico">${icon('droplet', 20)}</div><div><div class="stat-label">Produção hoje</div><div class="stat-value">${fmtNum(ms.today)} L</div></div></div>
        <div class="stat stat-blue"><div class="stat-ico">${icon('milk', 20)}</div><div><div class="stat-label">Média 30 dias</div><div class="stat-value">${fmtNum(ms.avg30)} L</div><div class="stat-sub">por dia ordenhado</div></div></div>
        <div class="stat stat-blue"><div class="stat-ico">${icon('chart', 20)}</div><div><div class="stat-label">Produção acumulada</div><div class="stat-value">${fmtNum(ms.total, 0)} L</div><div class="stat-sub">${ms.first ? 'desde ' + fmtDate(ms.first) : 'sem registros'}</div></div></div>` : ''}
        <div class="stat stat-green"><div class="stat-ico">${icon('calendar', 20)}</div><div><div class="stat-label">Nascimento</div><div class="stat-value" style="font-size:17px">${fmtDate(a.birth_date)}</div><div class="stat-sub">${fmtAge(a.birth_date)}</div></div></div>
        <div class="stat stat-brown"><div class="stat-ico">${icon('scale', 20)}</div><div><div class="stat-label">Peso atual</div><div class="stat-value">${a.current_weight ? fmtKg(a.current_weight) : '—'}</div></div></div>
      </div>
      <dl class="kv" style="margin-top:14px">
        <div><dt>Pai</dt><dd>${animalLink(a.sire_id, a.sire_name)}</dd></div>
        <div><dt>Mãe</dt><dd>${animalLink(a.dam_id, a.dam_name)}</dd></div>
        <div><dt>Espécie</dt><dd>${esc(a.species || '—')}</dd></div>
        <div><dt>Origem</dt><dd>${esc(a.origin || '—')}</dd></div>
        <div><dt>Entrada na fazenda</dt><dd>${fmtDate(a.entry_date)}</dd></div>
        <div><dt>Peso ao nascer</dt><dd>${a.birth_weight ? fmtKg(a.birth_weight) : '—'}</dd></div>
        ${a.exit_date ? `<div><dt>Saída</dt><dd>${fmtDate(a.exit_date)}</dd></div>` : ''}
        ${preg ? `<div><dt>Parto previsto</dt><dd>${fmtDate(preg.expected_calving)}</dd></div>` : ''}
      </dl>
      ${a.notes ? `<p class="muted" style="margin:12px 0 0">${esc(a.notes)}</p>` : ''}
    </div>
    ${tabs(TABS.filter(([k]) => k !== 'producao' || a.sex === 'F'), st.tab)}
    <div id="tab-body"></div>`;
  $('[data-a=edit]', el) && ($('[data-a=edit]', el).onclick = () => F.animalForm(a.id));
  $('[data-a=milk]', el) && ($('[data-a=milk]', el).onclick = () => F.milkForm(null, { animal_id: a.id }));
  $$('[data-tab]', el).forEach(b => b.onclick = () => { st.tab = b.dataset.tab; history.replaceState(null, '', `#/animal/${a.id}?tab=${st.tab}`); render(el, { params, query: {} }); });
  const body = $('#tab-body', el);
  ({ resumo: tabSummary, producao: tabMilk, reproducao: tabRepro, saude: tabHealth, pesagens: tabWeights, filhos: tabFamily, historico: tabTimeline }[st.tab] || tabSummary)(body, a, st, () => render(el, { params, query: {} }));
}

const addBtn = (perm, label, id) => can(perm) ? `<button class="btn btn-primary btn-sm" data-add="${id}">${icon('plus', 16)} ${esc(label)}</button>` : '';

function tabSummary(el, a) {
  const tl = timeline(a).slice(-6).reverse();
  const ch = S.children(a.id);
  el.innerHTML = `<div class="grid g2">
    <div class="card"><div class="card-head"><h3>${icon('history', 18)} Últimos acontecimentos</h3></div>${tl.length ? `<ul class="timeline">${tl.map(tlItem).join('')}</ul>` : '<p class="muted">Sem registros.</p>'}</div>
    <div class="card"><div class="card-head"><h3>${icon('tree', 18)} Família</h3></div>${familyMini(a, ch)}</div>
    ${a.sex === 'F' ? `<div class="card" style="grid-column:1/-1"><div class="card-head"><h3>${icon('milk', 18)} Produção — últimos 30 dias</h3></div><div class="chart-box sm"><canvas id="a-milk30"></canvas></div></div>` : ''}
  </div>`;
  if (a.sex === 'F') {
    const r = { from: addDays(today(), -29), to: today() };
    const d = St.milkByDay(r, a.id);
    chart($('#a-milk30', el), { type: 'bar', data: { labels: d.map(x => fmtDate(x.date).slice(0, 5)), datasets: [{ label: 'Litros', data: d.map(x => x.liters), backgroundColor: COLORS.blue, borderRadius: 3 }] } });
  }
}
function familyMini(a, ch) {
  const sib = S.siblings(a);
  const chip = (x) => `<a class="chip" href="#/animal/${x.id}">${x.sex === 'F' ? '♀' : '♂'} ${esc(S.animalName(x))} <span class="muted small">#${S.animalCode(x)}</span></a>`;
  return `<dl class="kv"><div><dt>Pai</dt><dd>${animalLink(a.sire_id, a.sire_name)}</dd></div><div><dt>Mãe</dt><dd>${animalLink(a.dam_id, a.dam_name)}</dd></div></dl>
    <div class="section-title">Filhos (${ch.length})</div><div class="chip-list">${ch.map(chip).join('') || '<span class="muted">Nenhum</span>'}</div>
    <div class="section-title">Irmãos (${sib.length})</div><div class="chip-list">${sib.slice(0, 12).map(chip).join('') || '<span class="muted">Nenhum</span>'}</div>`;
}

function tabMilk(el, a, st, rerender) {
  el.innerHTML = `<div class="card">
    <div class="card-head"><h3>${icon('milk', 18)} Histórico de produção</h3><div class="period">${periodSelect(st)} ${addBtn('milk.edit', 'Registrar', 'milk')}</div></div>
    <div id="m-sum"></div><div class="chart-box sm" style="margin-bottom:14px"><canvas id="a-milk"></canvas></div><div id="m-table"></div></div>`;
  bindPeriod(el, st, rerender);
  $('[data-add=milk]', el) && ($('[data-add=milk]', el).onclick = () => F.milkForm(null, { animal_id: a.id }));
  const r = rangeOf(st);
  const rows = St.animalDaily(a.id, r);
  const t = today();
  const P = (from) => St.periodStat(a.id, { from, to: t });
  const week = P(addDays(t, -6)), month = P(addDays(t, -29)), sem = P(addDays(t, -181)), year = P(addDays(t, -364)), per = St.periodStat(a.id, r);
  $('#m-sum', el).innerHTML = `<div class="table-wrap" style="margin-bottom:14px"><table class="table"><thead><tr><th>Período</th><th class="r">Total</th><th class="r">Média diária</th><th class="r">Dias ordenhados</th></tr></thead><tbody>
    ${[['Hoje', P(t)], ['Últimos 7 dias (semana)', week], ['Últimos 30 dias (mês)', month], ['Últimos 6 meses (semestre)', sem], ['Últimos 12 meses (ano)', year], [`Período selecionado`, per]].map(([l, s]) => `<tr><td>${l}</td><td class="r">${fmtNum(s.total)} L</td><td class="r">${fmtNum(s.avg)} L</td><td class="r">${s.days}</td></tr>`).join('')}
    </tbody></table></div>`;
  const d = St.milkByDay(r, a.id);
  chart($('#a-milk', el), { type: 'line', data: { labels: d.map(x => fmtDate(x.date).slice(0, 5)), datasets: [{ label: 'Litros/dia', data: d.map(x => x.liters || null), borderColor: COLORS.blue, backgroundColor: 'rgba(62,111,166,.12)', fill: true, tension: .25, pointRadius: 2, spanGaps: true }] } });
  mountTable($('#m-table', el), {
    id: 'amilk-' + a.id, rows, defaultSort: { key: 'date', dir: 'desc' },
    columns: [{ key: 'date', label: 'Data', render: (x) => fmtDate(x.date) }, { key: 'manha', label: 'Manhã', align: 'right', render: (x) => x.manha ? fmtNum(x.manha) : '—' }, { key: 'tarde', label: 'Tarde', align: 'right', render: (x) => x.tarde ? fmtNum(x.tarde) : '—' }, { key: 'total', label: 'Total', align: 'right', render: (x) => `<b>${fmtNum(x.total)} L</b>` }],
    footer: `<tr><td>Total</td><td class="r">${fmtNum(sum(rows, x => x.manha))}</td><td class="r">${fmtNum(sum(rows, x => x.tarde))}</td><td class="r">${fmtNum(sum(rows, x => x.total))} L</td></tr>`,
    onRowClick: can('milk.edit') ? (x) => { const m = x.rows[0]; F.milkForm(m.id); } : null,
  });
}

function tabRepro(el, a) {
  const rows = db.where('animal_reproduction', r => r.animal_id === a.id);
  const t = today();
  el.innerHTML = `<div class="card"><div class="card-head"><h3>${icon('heart', 18)} Reprodução</h3>${a.sex === 'F' ? addBtn('repro.edit', 'Nova cobertura / IA', 'repro') : ''}</div><div id="r-table"></div></div>`;
  $('[data-add=repro]', el) && ($('[data-add=repro]', el).onclick = () => F.reproForm(null, { animal_id: a.id }));
  if (a.sex === 'M') {
    const covers = db.where('animal_reproduction', r => r.bull_id === a.id);
    mountTable($('#r-table', el), { id: 'rep-bull', rows: covers, defaultSort: { key: 'date', dir: 'desc' }, empty: 'Nenhuma cobertura registrada com este touro.',
      columns: [{ key: 'date', label: 'Data', render: (r) => fmtDate(r.date) }, { key: 'f', label: 'Fêmea', render: (r) => animalLink(r.animal_id) }, { key: 'type', label: 'Tipo' }, { key: 'pregnancy_status', label: 'Resultado', render: (r) => r.actual_calving ? badge('Parida', 'green') : badge(r.pregnancy_status || 'Aguardando', 'neutral') }] });
    return;
  }
  mountTable($('#r-table', el), {
    id: 'rep-' + a.id, rows, defaultSort: { key: 'date', dir: 'desc' }, empty: 'Nenhuma cobertura registrada.',
    columns: [
      { key: 'date', label: 'Cobertura', render: (r) => fmtDate(r.date) }, { key: 'type', label: 'Tipo' },
      { key: 'bull', label: 'Touro', render: (r) => animalLink(r.bull_id, r.bull_name) },
      { key: 'pregnancy_status', label: 'Gestação', render: (r) => r.actual_calving ? badge('Parida', 'green') : badge(r.pregnancy_status || 'Aguardando', r.pregnancy_status === 'Confirmada' ? 'rose' : 'gold') },
      { key: 'expected_calving', label: 'Previsão', render: (r) => r.expected_calving && r.pregnancy_status !== 'Negativa' ? `${fmtDate(r.expected_calving)}${!r.actual_calving ? ` <span class="muted small">(${diffDays(t, r.expected_calving)} d)</span>` : ''}` : '—' },
      { key: 'actual_calving', label: 'Parto', render: (r) => r.actual_calving ? fmtDate(r.actual_calving) : (r.pregnancy_status === 'Confirmada' && can('births.edit') ? `<button class="btn btn-sm btn-ghost" data-birth="${r.id}">${icon('star', 14)} Registrar parto</button>` : '—') },
    ],
    onRowClick: can('repro.edit') ? (r) => F.reproForm(r.id) : null,
  });
  $$('[data-birth]', el).forEach(b => b.onclick = (e) => { e.stopPropagation(); const r = db.get('animal_reproduction', b.dataset.birth); F.birthForm({ dam_id: a.id, sire_id: r.bull_id, sire_name: r.bull_name, breed: a.breed }); });
}

function tabHealth(el, a) {
  const rows = db.where('animal_health', h => h.animal_id === a.id);
  el.innerHTML = `<div class="card"><div class="card-head"><h3>${icon('health', 18)} Histórico de saúde</h3>${addBtn('health.edit', 'Novo registro', 'h')}</div><div id="h-table"></div></div>`;
  $('[data-add=h]', el) && ($('[data-add=h]', el).onclick = () => F.healthForm(null, { animal_id: a.id }));
  mountTable($('#h-table', el), {
    id: 'hl-' + a.id, rows, defaultSort: { key: 'date', dir: 'desc' }, empty: 'Nenhum registro de saúde.',
    columns: [{ key: 'date', label: 'Data', render: (h) => fmtDate(h.date) }, { key: 'type', label: 'Tipo', render: (h) => badge(h.type, h.type === 'Vacinação' ? 'green' : 'blue') }, { key: 'description', label: 'Descrição' },
      { key: 'product', label: 'Produto', render: (h) => h.product_id ? esc(S.productName(h.product_id)) : '—' }, { key: 'responsible', label: 'Responsável' },
      { key: 'next_date', label: 'Próxima', render: (h) => h.next_date ? (h.next_done ? `<s>${fmtDate(h.next_date)}</s>` : fmtDate(h.next_date)) : '—' }],
    onRowClick: can('health.edit') ? (h) => F.healthForm(h.id) : null,
  });
}

function tabWeights(el, a) {
  const rows = db.where('animal_weights', w => w.animal_id === a.id).sort((x, y) => x.date.localeCompare(y.date));
  el.innerHTML = `<div class="card"><div class="card-head"><h3>${icon('scale', 18)} Evolução de peso</h3>${addBtn('weights.edit', 'Registrar pesagem', 'w')}</div>
    ${rows.length > 1 ? `<div class="chart-box sm" style="margin-bottom:14px"><canvas id="a-w"></canvas></div>` : ''}<div id="w-table"></div></div>`;
  $('[data-add=w]', el) && ($('[data-add=w]', el).onclick = () => F.weightForm(null, { animal_id: a.id }));
  if (rows.length > 1) chart($('#a-w', el), { type: 'line', data: { labels: rows.map(w => fmtDate(w.date)), datasets: [{ label: 'kg', data: rows.map(w => num(w.weight)), borderColor: COLORS.brown, backgroundColor: 'rgba(122,74,46,.12)', fill: true, tension: .25 }] }, options: { scales: { y: { beginAtZero: false } } } });
  mountTable($('#w-table', el), {
    id: 'wt-' + a.id, rows, defaultSort: { key: 'date', dir: 'desc' }, empty: 'Nenhuma pesagem registrada.',
    columns: [{ key: 'date', label: 'Data', render: (w) => fmtDate(w.date) }, { key: 'weight', label: 'Peso', align: 'right', render: (w) => fmtKg(w.weight) }, { key: 'age_days', label: 'Idade', render: (w) => fmtAge(a.birth_date, w.date) }, { key: 'responsible', label: 'Responsável' }, { key: 'notes', label: 'Observação' }],
    onRowClick: can('weights.edit') ? (w) => F.weightForm(w.id) : null,
  });
}

function tabFamily(el, a) {
  const ch = S.children(a.id);
  el.innerHTML = `<div class="card" style="margin-bottom:16px"><div class="card-head"><h3>${icon('tree', 18)} Árvore genealógica</h3><a class="btn btn-ghost btn-sm" href="#/rebanho/arvore/${a.id}">Tela cheia</a></div>${treeHTML(a)}</div>
    <div class="card"><div class="card-head"><h3>Filhos (${ch.length})</h3>${a.sex === 'F' && can('births.edit') ? `<button class="btn btn-primary btn-sm" data-add="b">${icon('star', 16)} Registrar nascimento</button>` : ''}</div><div id="c-table"></div>
    <div class="section-title">Irmãos (${S.siblings(a).length})</div><div class="chip-list">${S.siblings(a).map(x => `<a class="chip" href="#/animal/${x.id}">${x.sex === 'F' ? '♀' : '♂'} ${esc(S.animalName(x))} <span class="muted small">#${S.animalCode(x)} · ${x.dam_id === a.dam_id && a.dam_id ? (x.sire_id === a.sire_id && a.sire_id ? 'mesmo pai e mãe' : 'mesma mãe') : 'mesmo pai'}</span></a>`).join('') || '<span class="muted">Nenhum</span>'}</div></div>`;
  $('[data-add=b]', el) && ($('[data-add=b]', el).onclick = () => F.birthForm({ dam_id: a.id, breed: a.breed }));
  mountTable($('#c-table', el), {
    id: 'ch-' + a.id, rows: ch, empty: 'Nenhum filho registrado.',
    columns: [{ key: 'name', label: 'Animal', render: (x) => animalLink(x.id) }, { key: 'sex', label: 'Sexo', render: (x) => S.sexLabel(x.sex) }, { key: 'birth_date', label: 'Nascimento', render: (x) => fmtDate(x.birth_date) },
      { key: 'other', label: a.sex === 'F' ? 'Pai' : 'Mãe', render: (x) => a.sex === 'F' ? animalLink(x.sire_id, x.sire_name) : animalLink(x.dam_id, x.dam_name) }, { key: 'status', label: 'Situação', render: (x) => statusBadge(x.status) }],
    onRowClick: (x) => { location.hash = `#/animal/${x.id}`; },
  });
}

// Árvore: animal → pais → avós → bisavós
export function treeHTML(a, depth = 3) {
  const node = (x, name, sex, me = false) => x
    ? `<div class="tree-node ${x.sex === 'F' ? 'f' : 'm'} ${me ? 'me' : ''}"><a href="#/animal/${x.id}">${esc(S.animalName(x))}</a><div class="muted small">#${S.animalCode(x)} · ${esc(x.breed || '')}${x.birth_date ? ' · ' + x.birth_date.slice(0, 4) : ''}</div></div>`
    : `<div class="tree-node unknown ${sex}">${name ? esc(name) : 'Não informado'}<div class="small">${sex === 'm' ? 'pai' : 'mãe'}${name ? ' (fora do sistema)' : ''}</div></div>`;
  const cols = [[{ x: a, me: true }]];
  for (let g = 1; g <= depth; g++) {
    const prev = cols[g - 1], next = [];
    for (const it of prev) {
      const x = it.x;
      next.push({ x: x ? db.get('animals', x.sire_id) : null, name: x?.sire_name, sex: 'm' }, { x: x ? db.get('animals', x.dam_id) : null, name: x?.dam_name, sex: 'f' });
    }
    if (next.every(n => !n.x && !n.name) && g > 1) break;
    cols.push(next);
  }
  const titles = ['Animal', 'Pais', 'Avós', 'Bisavós'];
  return `<div class="tree">${cols.map((c, i) => `<div class="tree-col"><div class="muted small" style="font-weight:700">${titles[i]}</div>${c.map(n => node(n.x, n.name, n.sex || (n.x?.sex === 'F' ? 'f' : 'm'), n.me)).join('')}</div>`).join('')}</div>`;
}
export function treePage(el, { params }) {
  const a = db.get('animals', params.id);
  if (!a) { el.innerHTML = '<div class="card">Animal não encontrado.</div>'; return; }
  const ch = S.children(a.id);
  el.innerHTML = `<div class="crumbs"><a href="#/rebanho/animais">Animais</a> › <a href="#/animal/${a.id}">${esc(S.animalName(a))}</a> › Genealogia</div>
    <div class="page-head"><h1>Genealogia — ${esc(S.animalName(a))}</h1><div class="page-actions"><button class="btn btn-ghost" onclick="window.print()">${icon('printer', 18)} Imprimir</button></div></div>
    <div class="card">${treeHTML(a, 3)}<div class="section-title">Filhos (${ch.length})</div><div class="chip-list">${ch.map(x => `<a class="chip" href="#/rebanho/arvore/${x.id}">${x.sex === 'F' ? '♀' : '♂'} ${esc(S.animalName(x))}</a>`).join('') || '<span class="muted">Nenhum</span>'}</div>
    <div class="section-title">Netos</div><div class="chip-list">${ch.flatMap(c => S.children(c.id)).map(x => `<a class="chip" href="#/rebanho/arvore/${x.id}">${esc(S.animalName(x))}</a>`).join('') || '<span class="muted">Nenhum</span>'}</div></div>`;
}

// ---------- Linha do tempo ----------
function timeline(a) {
  const ev = [];
  const push = (date, title, sub = '', tone = '') => date && ev.push({ date, title, sub, tone });
  if (a.birth_date) push(a.birth_date, 'Nascimento', [a.birth_weight && `${fmtKg(a.birth_weight)}`, a.dam_id || a.dam_name ? `mãe: ${S.animalName(db.get('animals', a.dam_id)) !== '—' ? S.animalName(db.get('animals', a.dam_id)) : a.dam_name}` : ''].filter(Boolean).join(' · '), 'gold');
  if (a.entry_date && a.entry_date !== a.birth_date) push(a.entry_date, 'Entrada na fazenda', a.origin);
  db.where('animal_weights', w => w.animal_id === a.id && w.date !== a.birth_date).forEach(w => push(w.date, 'Pesagem', fmtKg(w.weight), 'blue'));
  db.where('animal_health', h => h.animal_id === a.id).forEach(h => push(h.date, h.type, h.description, h.type === 'Doença' || h.type === 'Tratamento' ? 'rose' : 'blue'));
  const milk = db.where('milk_production', m => m.animal_id === a.id).map(m => m.date).sort();
  if (milk.length) push(milk[0], 'Primeira produção de leite registrada', '', 'blue');
  db.where('animal_reproduction', r => r.animal_id === a.id).forEach(r => {
    push(r.date, r.type || 'Cobertura', `touro: ${r.bull_id ? S.animalName(db.get('animals', r.bull_id)) : r.bull_name || '—'}`, 'rose');
    if (r.pregnancy_status === 'Confirmada' && r.confirmation_date) push(r.confirmation_date, 'Gestação confirmada', `parto previsto ${fmtDate(r.expected_calving)}`, 'rose');
    if (r.pregnancy_status === 'Negativa' && r.confirmation_date) push(r.confirmation_date, 'Diagnóstico negativo', '');
  });
  S.children(a.id).forEach(c => push(c.birth_date, a.sex === 'F' ? 'Parto — novo nascimento' : 'Nascimento de filho(a)', `${S.animalName(c)} (#${S.animalCode(c)}, ${S.sexLabel(c.sex)})`, 'gold'));
  const death = db.find('animal_deaths', d => d.animal_id === a.id);
  if (death) push(death.date, 'Morte', death.cause, 'dark');
  else if (a.exit_date) push(a.exit_date, `Saída: ${a.status}`, '', 'dark');
  return ev.sort((x, y) => x.date.localeCompare(y.date));
}
const tlItem = (e) => `<li class="t-${e.tone}"><div class="tl-date">${fmtDate(e.date)}</div><div class="tl-title">${esc(e.title)}</div>${e.sub ? `<div class="muted small">${esc(e.sub)}</div>` : ''}</li>`;

function tabTimeline(el, a) {
  const ev = timeline(a);
  const audit = can('audit.view') ? db.where('audit_logs', l => l.record_id === a.id || (l.table_name !== 'animals' && l.description?.includes(`#${S.animalCode(a)}`))).sort((x, y) => y.ts.localeCompare(x.ts)).slice(0, 50) : [];
  el.innerHTML = `<div class="grid g2"><div class="card"><div class="card-head"><h3>${icon('history', 18)} Linha do tempo</h3></div>${ev.length ? `<ul class="timeline">${ev.map(tlItem).join('')}</ul>` : '<p class="muted">Sem acontecimentos.</p>'}</div>
    ${can('audit.view') ? `<div class="card"><div class="card-head"><h3>${icon('shield', 18)} Alterações registradas</h3></div>${audit.length ? `<ul class="list-plain">${audit.map(l => `<li><span>${esc(l.description)}</span><span class="muted small nowrap">${fmtDateTime(l.ts)}</span></li>`).join('')}</ul>` : '<p class="muted">Nenhuma alteração registrada.</p>'}</div>` : ''}</div>`;
}
