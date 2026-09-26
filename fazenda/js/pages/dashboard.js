// DASHBOARD — primeira tela após o login. Todos os números vêm dos registros reais.
import * as db from '../db.js';
import * as St from '../stats.js';
import { can } from '../auth.js';
import { icon, $, statCard, chart, COLORS, SERIES } from '../ui.js';
import { esc, fmtNum, fmtMoney, fmtHours, today, addDays, diffDays, previousRange, periodLabel, fmtDate, fmtMonthShort, monthsOf, num } from '../util.js';
import { stockValue, lowStock } from '../services.js';
import { computeAlerts, openAlerts } from '../alerts.js';
import { quickButtons, bindQuick } from './quick.js';
import { pageState, periodSelect, bindPeriod, rangeOf } from './common.js';

const pct = (a, b) => b ? ((a - b) / b) * 100 : null;
const delta = (a, b, unit = '') => { const p = pct(a, b); return p == null ? '' : `<span class="${p >= 0 ? 'delta-up' : 'delta-down'}">${p >= 0 ? '▲' : '▼'} ${fmtNum(Math.abs(p), 0)}%</span> vs período anterior`; };

export function render(el) {
  const st = pageState('dash', { period: '30d' });
  el.innerHTML = `<div class="page-head"><div><h1>Dashboard</h1><p class="muted" id="d-range"></p></div><div class="page-actions">${periodSelect(st)}</div></div>
    ${quickButtons()}<div id="d-body"></div>`;
  bindQuick(el);
  bindPeriod(el, st, () => draw(el, st));
  draw(el, st);
}

function draw(el, st) {
  const r = rangeOf(st), prev = previousRange(r), t = today();
  $('#d-range', el).textContent = `Período: ${periodLabel(r)}`;
  const h = St.herdCounts();
  const births = St.birthsIn(r).length, deaths = St.deathsIn(r).length;
  const milkToday = St.milkTotal({ from: t, to: t }), milkYest = St.milkTotal({ from: addDays(t, -1), to: addDays(t, -1) });
  const milkP = St.milkTotal(r), milkPrev = St.milkTotal(prev);
  const avg = St.milkAvgPerAnimal(r);
  const fProd = St.feedProduced(r), fDist = St.feedDistributed(r);
  const hours = St.machineHours(r);
  const emps = db.count('employees', e => e.status !== 'Desligado');
  const low = lowStock().length;
  const cards = [];
  if (can('herd.view')) cards.push(
    statCard({ label: 'Total de animais', value: fmtNum(h.total, 0), sub: `${fmtNum(h.females, 0)} fêmeas · ${fmtNum(h.males, 0)} machos ativos`, icon: 'cow', href: '#/rebanho/animais' }),
    statCard({ label: 'Animais ativos', value: fmtNum(h.active, 0), sub: `${fmtNum(h.total - h.active, 0)} fora do rebanho`, icon: 'check', href: '#/rebanho/animais' }),
    statCard({ label: 'Em produção', value: fmtNum(h.producing, 0), sub: 'vacas em lactação', icon: 'milk', tone: 'blue', href: '#/leite/por-animal' }),
    statCard({ label: 'Gestantes', value: fmtNum(h.pregnant, 0), sub: 'gestação confirmada', icon: 'heart', tone: 'rose', href: '#/rebanho/reproducao' }),
    statCard({ label: 'Nascimentos', value: fmtNum(births, 0), sub: 'no período', icon: 'star', tone: 'gold', href: '#/rebanho/nascimentos' }),
    statCard({ label: 'Mortalidade', value: fmtNum(deaths, 0), sub: h.active ? `${fmtNum(deaths / (h.active + deaths) * 100, 1)}% do rebanho` : 'no período', icon: 'trendDown', tone: 'rose', href: '#/rebanho/mortalidade' }));
  if (can('milk.view')) cards.push(
    statCard({ label: 'Leite hoje', value: `${fmtNum(milkToday)} L`, sub: `ontem ${fmtNum(milkYest)} L`, icon: 'droplet', tone: 'blue', href: '#/leite/painel' }),
    statCard({ label: 'Média por animal', value: `${fmtNum(avg)} L/dia`, sub: `${fmtNum(milkP)} L no período · ${delta(milkP, milkPrev)}`, icon: 'milk', tone: 'blue', href: '#/leite/por-animal' }));
  if (can('feed.view')) cards.push(
    statCard({ label: 'Ração produzida', value: `${fmtNum(fProd, 0)} kg`, sub: `${St.batchesIn(r).length} lotes no período`, icon: 'factory', tone: 'gold', href: '#/racao/lotes' }),
    statCard({ label: 'Ração distribuída', value: `${fmtNum(fDist, 0)} kg`, sub: `${fmtNum(St.feedPerAnimal(r), 2)} kg/animal · saldo ${fmtNum(St.feedBalance(), 0)} kg`, icon: 'truck', tone: 'gold', href: '#/racao/distribuicao' }));
  if (can('inventory.view')) cards.push(statCard({ label: 'Estoque', value: can('inventory.cost') ? fmtMoney(stockValue()) : `${db.count('inventory', p => p.active !== false)} itens`, sub: low ? `<span class="delta-down">${low} abaixo do mínimo</span>` : 'nenhum item abaixo do mínimo', icon: 'package', tone: low ? 'rose' : 'brown', href: low ? '#/estoque/minimo' : '#/estoque/produtos' }));
  if (can('employees.view') || can('payroll.view')) cards.push(statCard({ label: 'Funcionários ativos', value: fmtNum(emps, 0), sub: 'cadastrados e ativos', icon: 'users', tone: 'brown', href: '#/funcionarios/cadastro' }));
  if (can('machines.view')) cards.push(statCard({ label: 'Horas de máquinas', value: fmtHours(hours), sub: `${St.servicesIn(r).length} serviços no período`, icon: 'tractor', tone: 'brown', href: '#/maquinas/horas' }));

  const alerts = can('alerts.view') ? openAlerts(computeAlerts()).filter(a => a.state === 'novo').slice(0, 5) : [];
  const long = diffDays(r.from, r.to) > 62;
  const body = $('#d-body', el);
  body.innerHTML = `<div class="stats">${cards.join('')}</div>
    ${alerts.length ? `<div class="card" style="margin-bottom:16px"><div class="card-head"><h3>${icon('bell', 18)} Alertas</h3><a href="#/alertas" class="small">Ver todos</a></div>${alerts.map(a => `<a class="alert-item alert-${a.severity}" href="${a.link || '#/alertas'}" style="color:inherit;text-decoration:none"><div class="a-ico">${icon('alert', 18)}</div><div><div class="a-title">${esc(a.title)}</div><div class="muted small">${esc(a.message)}</div></div></a>`).join('')}</div>` : ''}
    <div class="grid g2">
      ${can('milk.view') ? `<div class="card"><div class="card-head"><h3>${icon('milk', 18)} Produção de leite ${long ? 'por mês' : 'por dia'}</h3><span class="muted small">${fmtNum(milkP)} L</span></div><div class="chart-box"><canvas id="c-milk"></canvas></div></div>
      <div class="card"><div class="card-head"><h3>${icon('droplet', 18)} Produção média por animal</h3><span class="muted small">litros/animal/dia</span></div><div class="chart-box"><canvas id="c-avg"></canvas></div></div>` : ''}
      ${can('herd.view') ? `<div class="card"><div class="card-head"><h3>${icon('cow', 18)} Evolução do rebanho</h3><span class="muted small">últimos 12 meses</span></div><div class="chart-box"><canvas id="c-herd"></canvas></div></div>
      <div class="card"><div class="card-head"><h3>${icon('star', 18)} Nascimentos × mortalidade</h3><span class="muted small">por mês</span></div><div class="chart-box"><canvas id="c-bd"></canvas></div></div>` : ''}
      ${can('feed.view') ? `<div class="card"><div class="card-head"><h3>${icon('wheat', 18)} Ração: produção × consumo</h3><span class="muted small">kg</span></div><div class="chart-box"><canvas id="c-feed"></canvas></div></div>` : ''}
      ${can('machines.view') ? `<div class="card"><div class="card-head"><h3>${icon('tractor', 18)} Horas trabalhadas por máquina</h3><span class="muted small">no período</span></div><div class="chart-box"><canvas id="c-mach"></canvas></div></div>` : ''}
    </div>`;

  if (can('milk.view')) {
    if (long) { const m = St.milkByMonth(r); chart($('#c-milk', el), { type: 'bar', data: { labels: m.map(x => fmtMonthShort(x.month)), datasets: [{ label: 'Litros', data: m.map(x => x.liters), backgroundColor: COLORS.blue, borderRadius: 4 }] } }); }
    else { const m = St.milkByDay(r); chart($('#c-milk', el), { type: 'bar', data: { labels: m.map(x => fmtDate(x.date).slice(0, 5)), datasets: [{ label: 'Litros', data: m.map(x => x.liters), backgroundColor: COLORS.blue, borderRadius: 4 }] } }); }
    const days = long ? null : St.milkByDay(r).map(x => x.date);
    const avgData = long ? monthsOf(r).map(mk => ({ l: fmtMonthShort(mk), v: St.milkAvgPerAnimal({ from: `${mk}-01`, to: `${mk}-31` }) }))
      : days.map(d => ({ l: fmtDate(d).slice(0, 5), v: St.milkAvgPerAnimal({ from: d, to: d }) }));
    chart($('#c-avg', el), { type: 'line', data: { labels: avgData.map(x => x.l), datasets: [{ label: 'L/animal', data: avgData.map(x => x.v || null), borderColor: COLORS.green, backgroundColor: 'rgba(46,107,63,.12)', fill: true, tension: .3, pointRadius: 2 }] } });
  }
  if (can('herd.view')) {
    const ev = St.herdEvolution(12);
    chart($('#c-herd', el), { type: 'line', data: { labels: ev.map(x => fmtMonthShort(x.month)), datasets: [{ label: 'Animais', data: ev.map(x => x.count), borderColor: COLORS.green, backgroundColor: 'rgba(46,107,63,.12)', fill: true, tension: .3 }] }, options: { scales: { y: { beginAtZero: false, ticks: { precision: 0 } } } } });
    const bdRange = long ? r : { from: addDays(t, -364), to: t };
    const bd = St.birthsDeathsByMonth(bdRange);
    chart($('#c-bd', el), { type: 'bar', data: { labels: bd.map(x => fmtMonthShort(x.month)), datasets: [{ label: 'Nascimentos', data: bd.map(x => x.births), backgroundColor: COLORS.green, borderRadius: 4 }, { label: 'Mortes', data: bd.map(x => x.deaths), backgroundColor: COLORS.rose, borderRadius: 4 }] }, options: { scales: { y: { ticks: { precision: 0 } } } } });
  }
  if (can('feed.view')) {
    const p = St.feedByDay(r, 'prod'), dd = St.feedByDay(r, 'dist');
    chart($('#c-feed', el), { type: 'bar', data: { labels: p.map(x => fmtDate(x.date).slice(0, 5)), datasets: [{ label: 'Produzida', data: p.map(x => x.kg), backgroundColor: COLORS.gold, borderRadius: 3 }, { label: 'Distribuída', data: dd.map(x => x.kg), backgroundColor: COLORS.brown, borderRadius: 3 }] } });
  }
  if (can('machines.view')) {
    const hm = St.hoursByMachine(r);
    chart($('#c-mach', el), { type: 'bar', data: { labels: hm.map(x => x.machine?.name || '?'), datasets: [{ label: 'Horas', data: hm.map(x => x.hours), backgroundColor: SERIES.slice(0, hm.length), borderRadius: 4 }] }, options: { indexAxis: 'y', scales: { x: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.06)' } }, y: { grid: { display: false } } } } });
  }
}
