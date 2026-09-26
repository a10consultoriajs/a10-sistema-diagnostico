// PRODUÇÃO DE LEITE — registro, histórico, produção por animal e painel da fazenda.
import * as db from '../db.js';
import * as S from '../services.js';
import * as F from '../forms.js';
import * as St from '../stats.js';
import { can } from '../auth.js';
import { icon, $, $$, badge, mountTable, chart, COLORS, pageHead, statCard } from '../ui.js';
import { esc, fmtDate, fmtNum, today, addDays, inRange, sum, groupBy, num, periodRange, previousRange, periodLabel, PERIODS, fmtMonthShort, diffDays, monthKey, toISODate } from '../util.js';
import { shiftLabel } from '../config.js';
import { animalLink } from './herd.js';
import { listPage, pageState, periodSelect, bindPeriod, rangeOf, sumBox } from './common.js';

export function register(el) {
  const t = today();
  const rows = db.where('milk_production', m => m.date === t);
  const producing = db.count('animals', a => a.status === 'Em produção');
  const by = groupBy(rows, m => m.shift);
  el.innerHTML = `${pageHead('Registrar produção', 'Escolha a forma mais rápida para o seu dia. O total diário (manhã + tarde) é calculado automaticamente.')}
    <div class="qgrid" style="margin-bottom:18px">
      ${can('milk.edit') ? `<button class="qtile" data-go="sheet"><span class="qi">${icon('list', 26)}</span><b>Ordenha do turno</b><span>Todas as vacas em produção numa lista</span></button>
      <button class="qtile" data-go="one"><span class="qi">${icon('droplet', 26)}</span><b>Um animal</b><span>Selecionar animal → litros → salvar</span></button>` : ''}
    </div>
    <div class="stats">${statCard({ label: 'Hoje — manhã', value: `${fmtNum(sum(by.get('manha') || [], m => m.liters))} L`, sub: `${(by.get('manha') || []).length} de ${producing} vacas`, icon: 'milk', tone: 'blue' })}
      ${statCard({ label: 'Hoje — tarde', value: `${fmtNum(sum(by.get('tarde') || [], m => m.liters))} L`, sub: `${(by.get('tarde') || []).length} de ${producing} vacas`, icon: 'milk', tone: 'blue' })}
      ${statCard({ label: 'Total do dia', value: `${fmtNum(sum(rows, m => m.liters))} L`, sub: `ontem ${fmtNum(St.milkTotal({ from: addDays(t, -1), to: addDays(t, -1) }))} L`, icon: 'droplet', tone: 'green' })}</div>
    <div class="card"><div class="card-head"><h3>Lançamentos de hoje</h3></div><div id="today-t"></div></div>`;
  $('[data-go=sheet]', el) && ($('[data-go=sheet]', el).onclick = () => { location.hash = '#/rapido?modo=ordenha'; });
  $('[data-go=one]', el) && ($('[data-go=one]', el).onclick = () => F.milkForm());
  const daily = [...groupBy(rows, m => m.animal_id)].map(([id, rs]) => ({ id, manha: sum(rs.filter(r => r.shift === 'manha'), r => r.liters), tarde: sum(rs.filter(r => r.shift === 'tarde'), r => r.liters), rs }));
  mountTable($('#today-t', el), {
    id: 'milk-today', rows: daily, empty: 'Nenhum lançamento hoje.',
    columns: [{ key: 'a', label: 'Animal', value: (r) => S.animalName(db.get('animals', r.id)), render: (r) => animalLink(r.id) },
      { key: 'manha', label: 'Manhã', align: 'right', render: (r) => r.manha ? fmtNum(r.manha) : '—' }, { key: 'tarde', label: 'Tarde', align: 'right', render: (r) => r.tarde ? fmtNum(r.tarde) : '—' },
      { key: 't', label: 'Total', align: 'right', value: (r) => r.manha + r.tarde, render: (r) => `<b>${fmtNum(r.manha + r.tarde)} L</b>` }],
    onRowClick: (r) => { location.hash = `#/animal/${r.id}?tab=producao`; },
  });
}

export function history(el) {
  listPage(el, {
    id: 'milk-hist', title: 'Histórico de produção', sub: 'Todos os lançamentos. Toque em uma linha para corrigir (a alteração fica registrada na auditoria).',
    actions: can('milk.edit') ? `<button class="btn btn-primary" data-act="new">${icon('plus', 18)} Registrar</button>` : '',
    bindActions: (root) => { const b = $('[data-act=new]', root); if (b) b.onclick = () => F.milkForm(); },
    defaultPeriod: '7d',
    filters: [{ type: 'period' }, { type: 'search', key: 'q', placeholder: 'Animal, brinco, responsável…', text: (m) => { const a = db.get('animals', m.animal_id); return `${a?.name} ${a?.tag} ${S.animalCode(a)} ${m.responsible}`; } },
      { type: 'select', key: 'shift', label: 'Ordenha', options: [['manha', 'Manhã'], ['tarde', 'Tarde']], match: (m, v) => m.shift === v }],
    rows: (st) => db.where('milk_production', m => inRange(m.date, rangeOf(st))),
    defaultSort: { key: 'date', dir: 'desc' },
    columns: [
      { key: 'date', label: 'Data', text: (m) => fmtDate(m.date), render: (m) => fmtDate(m.date) },
      { key: 'animal', label: 'Animal', value: (m) => S.animalName(db.get('animals', m.animal_id)), text: (m) => S.animalLabel(db.get('animals', m.animal_id)), render: (m) => animalLink(m.animal_id) },
      { key: 'shift', label: 'Ordenha', text: (m) => shiftLabel(m.shift), render: (m) => badge(shiftLabel(m.shift), m.shift === 'manha' ? 'gold' : 'blue') },
      { key: 'liters', label: 'Litros', align: 'right', value: (m) => num(m.liters), render: (m) => `<b>${fmtNum(m.liters)}</b>` },
      { key: 'responsible', label: 'Responsável', hideSm: true }, { key: 'notes', label: 'Observação', hideSm: true },
    ],
    summary: (rows) => { const days = new Set(rows.map(r => r.date)).size; const tot = sum(rows, r => r.liters); return sumBox([['Total', `${fmtNum(tot)} L`], ['Dias', fmtNum(days, 0)], ['Média por dia', `${fmtNum(days ? tot / days : 0)} L`], ['Lançamentos', fmtNum(rows.length, 0)]]); },
    onRowClick: can('milk.edit') ? (m) => F.milkForm(m.id) : (m) => { location.hash = `#/animal/${m.animal_id}?tab=producao`; },
  });
}

export function byAnimal(el) {
  listPage(el, {
    id: 'milk-animal', title: 'Produção por animal', sub: 'Total, dias ordenhados e média diária de cada vaca no período.',
    defaultPeriod: '30d',
    filters: [{ type: 'period' }, { type: 'search', key: 'q', text: (r) => `${r.animal?.name} ${r.animal?.tag} ${S.animalCode(r.animal)}` }],
    rows: (st) => {
      const r = rangeOf(st), prev = previousRange(r);
      const pm = new Map(St.milkByAnimal(prev).map(x => [x.animal_id, x]));
      return St.milkByAnimal(r).map(x => ({ ...x, prevAvg: pm.get(x.animal_id)?.avg || 0 }));
    },
    defaultSort: { key: 'total', dir: 'desc' },
    columns: [
      { key: 'rank', label: '#', sortable: false, render: (r) => '', export: false },
      { key: 'animal', label: 'Animal', value: (r) => S.animalName(r.animal), text: (r) => S.animalLabel(r.animal), render: (r) => animalLink(r.animal_id) },
      { key: 'status', label: 'Situação', value: (r) => r.animal?.status, hideSm: true },
      { key: 'total', label: 'Total', align: 'right', value: (r) => r.total, render: (r) => `<b>${fmtNum(r.total)} L</b>` },
      { key: 'days', label: 'Dias', align: 'right', value: (r) => r.days },
      { key: 'avg', label: 'Média/dia', align: 'right', value: (r) => r.avg, render: (r) => `${fmtNum(r.avg)} L` },
      { key: 'var', label: 'vs período anterior', align: 'right', value: (r) => r.prevAvg ? (r.avg - r.prevAvg) / r.prevAvg * 100 : null, render: (r) => r.prevAvg ? `<span class="${r.avg >= r.prevAvg ? 'delta-up' : 'delta-down'}">${r.avg >= r.prevAvg ? '▲' : '▼'} ${fmtNum(Math.abs((r.avg - r.prevAvg) / r.prevAvg * 100), 0)}%</span>` : '—', hideSm: true },
    ],
    summary: (rows) => sumBox([['Animais', fmtNum(rows.length, 0)], ['Total', `${fmtNum(sum(rows, r => r.total))} L`], ['Média geral', `${fmtNum(rows.length ? sum(rows, r => r.avg) / rows.length : 0)} L/dia`], ['Maior produção', rows[0] ? `${esc(S.animalName(rows.slice().sort((a, b) => b.avg - a.avg)[0].animal))}` : '—']]),
    onRowClick: (r) => { location.hash = `#/animal/${r.animal_id}?tab=producao`; },
  });
  // numeração do ranking após renderizar
  const obs = () => $$('tbody tr', el).forEach((tr, i) => { const td = tr.querySelector('td'); if (td && !td.classList.contains('empty')) td.textContent = i + 1; });
  obs(); new MutationObserver(obs).observe($('.table-host', el), { childList: true });
}

export function panel(el) {
  const st = pageState('milk-panel', { period: '30d', cmp: 'prev' });
  const t = today(), d = new Date();
  const P = (from, to) => St.milkTotal({ from, to });
  const monthStart = `${monthKey(t)}-01`;
  const lastM = { from: toISODate(new Date(d.getFullYear(), d.getMonth() - 1, 1)), to: toISODate(new Date(d.getFullYear(), d.getMonth(), 0)) };
  const sem = periodRange('semester'), year = periodRange('year');
  el.innerHTML = `${pageHead('Produção da fazenda', 'Painel geral e comparação de períodos.')}
    <div class="stats">
      ${statCard({ label: 'Hoje', value: `${fmtNum(P(t, t))} L`, icon: 'droplet', tone: 'blue' })}
      ${statCard({ label: 'Ontem', value: `${fmtNum(P(addDays(t, -1), addDays(t, -1)))} L`, icon: 'droplet', tone: 'blue' })}
      ${statCard({ label: 'Últimos 7 dias', value: `${fmtNum(P(addDays(t, -6), t))} L`, sub: `média ${fmtNum(P(addDays(t, -6), t) / 7)} L/dia`, icon: 'milk', tone: 'blue' })}
      ${statCard({ label: 'Mês atual', value: `${fmtNum(P(monthStart, t))} L`, sub: `${d.getDate()} dias`, icon: 'calendar', tone: 'green' })}
      ${statCard({ label: 'Mês anterior', value: `${fmtNum(P(lastM.from, lastM.to))} L`, icon: 'calendar', tone: 'green' })}
      ${statCard({ label: 'Semestre', value: `${fmtNum(P(sem.from, sem.to), 0)} L`, icon: 'chart', tone: 'gold' })}
      ${statCard({ label: 'Ano', value: `${fmtNum(P(year.from, year.to), 0)} L`, icon: 'chart', tone: 'gold' })}
    </div>
    <div class="card" style="margin-bottom:16px"><div class="card-head"><h3>${icon('chart', 18)} Comparar períodos</h3><div class="period">${periodSelect(st)} <span class="muted">comparar com</span> <select class="input" id="cmp"><option value="prev" ${st.cmp === 'prev' ? 'selected' : ''}>Período anterior</option><option value="year" ${st.cmp === 'year' ? 'selected' : ''}>Mesmo período do ano passado</option></select></div></div>
      <div id="cmp-sum"></div><div class="chart-box"><canvas id="c-cmp"></canvas></div></div>
    <div class="card"><div class="card-head"><h3>${icon('milk', 18)} Produção mensal — últimos 12 meses</h3></div><div class="chart-box"><canvas id="c-12"></canvas></div></div>`;
  const draw = () => {
    const r = rangeOf(st);
    const len = diffDays(r.from, r.to);
    const c = st.cmp === 'year' ? { from: addDays(r.from, -364), to: addDays(r.to, -364) } : previousRange(r);
    const a = St.milkByDay(r), b = St.milkByDay(c);
    const ta = sum(a, x => x.liters), tb = sum(b, x => x.liters);
    const pct = tb ? (ta - tb) / tb * 100 : null;
    $('#cmp-sum', el).innerHTML = sumBox([[`Atual (${periodLabel(r)})`, `${fmtNum(ta)} L`], [`Comparação (${periodLabel(c)})`, `${fmtNum(tb)} L`], ['Diferença', `${ta - tb >= 0 ? '+' : ''}${fmtNum(ta - tb)} L ${pct == null ? '' : `<span class="${pct >= 0 ? 'delta-up' : 'delta-down'}">(${pct >= 0 ? '▲' : '▼'} ${fmtNum(Math.abs(pct), 1)}%)</span>`}`], ['Média/dia atual', `${fmtNum(ta / (len + 1))} L`], ['Média/animal', `${fmtNum(St.milkAvgPerAnimal(r))} L`]]);
    chart($('#c-cmp', el), { type: 'line', data: { labels: a.map((x, i) => `Dia ${i + 1}`), datasets: [
      { label: 'Período atual', data: a.map(x => x.liters), borderColor: COLORS.blue, backgroundColor: 'rgba(62,111,166,.1)', fill: true, tension: .25, pointRadius: 1.5 },
      { label: 'Comparação', data: b.map(x => x.liters), borderColor: COLORS.gray, borderDash: [5, 4], tension: .25, pointRadius: 0 }] },
      options: { plugins: { tooltip: { callbacks: { title: (it) => `${fmtDate(a[it[0].dataIndex]?.date)} × ${fmtDate(b[it[0].dataIndex]?.date)}` } } } } });
  };
  bindPeriod(el, st, draw);
  $('#cmp', el).onchange = (e) => { st.cmp = e.target.value; draw(); };
  draw();
  const m12 = St.milkByMonth({ from: addDays(`${monthKey(t)}-01`, -334), to: t });
  chart($('#c-12', el), { type: 'bar', data: { labels: m12.map(x => fmtMonthShort(x.month)), datasets: [{ label: 'Litros', data: m12.map(x => x.liters), backgroundColor: COLORS.blue, borderRadius: 4 }] } });
}
