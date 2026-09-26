// Inicialização, login, layout (menu lateral + barra superior), rotas e pesquisa global.
import * as db from './db.js';
import * as auth from './auth.js';
import { ensureDefaults, farm } from './config.js';
import { icon, $, $$, toast, confirmDialog } from './ui.js';
import { esc, normalize, debounce, fmtDateTime, pad, fmtDate } from './util.js';
import { animalLabel, isActive } from './services.js';
import { computeAlerts, openAlerts } from './alerts.js';
import * as sync from './sync.js';

import * as dashboard from './pages/dashboard.js';
import * as overview from './pages/overview.js';
import * as herd from './pages/herd.js';
import * as animal from './pages/animal.js';
import * as milk from './pages/milk.js';
import * as feed from './pages/feed.js';
import * as machines from './pages/machines.js';
import * as inventory from './pages/inventory.js';
import * as employees from './pages/employees.js';
import * as reports from './pages/reports.js';
import * as alertsPage from './pages/alerts.js';
import * as settings from './pages/settings.js';
import * as quick from './pages/quick.js';

const root = document.getElementById('root');

// ---------- Menu ----------
const MENU = [
  { href: '#/dashboard', label: 'Dashboard', icon: 'dashboard', perm: 'dashboard.view' },
  { href: '#/visao-geral', label: 'Visão geral da fazenda', icon: 'eye', perm: 'dashboard.view' },
  { href: '#/rapido', label: 'Lançamento rápido', icon: 'zap' },
  { label: 'Rebanho', icon: 'cow', perm: 'herd.view', key: 'rebanho', items: [
    ['#/rebanho/animais', 'Animais'], ['#/rebanho/nascimentos', 'Nascimentos'], ['#/rebanho/mortalidade', 'Mortalidade'],
    ['#/rebanho/reproducao', 'Reprodução'], ['#/rebanho/pesagens', 'Pesagens'], ['#/rebanho/saude', 'Saúde / Tratamentos']] },
  { label: 'Produção de leite', icon: 'milk', perm: 'milk.view', key: 'leite', items: [
    ['#/leite/registrar', 'Registrar produção'], ['#/leite/historico', 'Histórico'], ['#/leite/por-animal', 'Produção por animal'], ['#/leite/painel', 'Painel e comparativos']] },
  { label: 'Ração', icon: 'wheat', perm: 'feed.view', key: 'racao', items: [
    ['#/racao/ingredientes', 'Ingredientes'], ['#/racao/fabricacao', 'Fabricação'], ['#/racao/lotes', 'Lotes'],
    ['#/racao/distribuicao', 'Distribuição'], ['#/racao/estoque', 'Estoque de ração'], ['#/racao/consumo', 'Consumo']] },
  { label: 'Máquinas e serviços', icon: 'tractor', perm: 'machines.view', key: 'maquinas', items: [
    ['#/maquinas/lista', 'Máquinas'], ['#/maquinas/servicos', 'Serviços'], ['#/maquinas/operadores', 'Operadores'],
    ['#/maquinas/horas', 'Horas trabalhadas'], ['#/maquinas/combustivel', 'Combustível'], ['#/maquinas/manutencao', 'Manutenção']] },
  { label: 'Estoque', icon: 'package', perm: 'inventory.view', key: 'estoque', items: [
    ['#/estoque/produtos', 'Produtos'], ['#/estoque/entradas', 'Entradas'], ['#/estoque/saidas', 'Saídas'],
    ['#/estoque/inventario', 'Inventário'], ['#/estoque/minimo', 'Estoque mínimo']] },
  { label: 'Funcionários', icon: 'users', perm: ['employees.view', 'payroll.view'], key: 'funcionarios', items: [
    ['#/funcionarios/cadastro', 'Funcionários', 'employees.view'], ['#/funcionarios/salarios', 'Salários', 'payroll.view'], ['#/funcionarios/vales', 'Vales', 'payroll.view'],
    ['#/funcionarios/descontos', 'Descontos', 'payroll.view'], ['#/funcionarios/pagamentos', 'Pagamentos', 'payroll.view']] },
  { href: '#/relatorios', label: 'Relatórios', icon: 'chart', perm: 'reports.view' },
  { href: '#/alertas', label: 'Alertas', icon: 'bell', perm: 'alerts.view', badge: true },
  { href: '#/config', label: 'Configurações', icon: 'settings', perm: ['settings.edit', 'users.manage', 'audit.view', 'backup.manage'] },
];
const allowed = (perm) => !perm || [].concat(perm).some(auth.can);

// ---------- Rotas ----------
const ROUTES = [
  ['dashboard', dashboard.render, 'dashboard.view'],
  ['visao-geral', overview.render, 'dashboard.view'],
  ['rapido', quick.render],
  ['rebanho/animais', herd.animals, 'herd.view'], ['rebanho/nascimentos', herd.births, 'herd.view'], ['rebanho/mortalidade', herd.deaths, 'herd.view'],
  ['rebanho/reproducao', herd.repro, 'herd.view'], ['rebanho/pesagens', herd.weights, 'herd.view'], ['rebanho/saude', herd.health, 'herd.view'],
  ['rebanho/arvore/:id', animal.treePage, 'herd.view'],
  ['animal/:id', animal.render, 'herd.view'],
  ['leite/registrar', milk.register, 'milk.view'], ['leite/historico', milk.history, 'milk.view'], ['leite/por-animal', milk.byAnimal, 'milk.view'], ['leite/painel', milk.panel, 'milk.view'],
  ['racao/ingredientes', feed.ingredients, 'feed.view'], ['racao/fabricacao', feed.fabrication, 'feed.view'], ['racao/lotes', feed.batches, 'feed.view'],
  ['racao/lote/:id', feed.batchPage, 'feed.view'], ['racao/distribuicao', feed.distribution, 'feed.view'], ['racao/estoque', feed.stock, 'feed.view'], ['racao/consumo', feed.consumption, 'feed.view'],
  ['maquinas/lista', machines.list, 'machines.view'], ['maquina/:id', machines.machinePage, 'machines.view'], ['maquinas/servicos', machines.services, 'machines.view'],
  ['maquinas/operadores', machines.operators, 'machines.view'], ['maquinas/horas', machines.hours, 'machines.view'], ['maquinas/combustivel', machines.fuel, 'machines.view'], ['maquinas/manutencao', machines.maintenance, 'machines.view'],
  ['estoque/produtos', inventory.products, 'inventory.view'], ['estoque/entradas', inventory.entries, 'inventory.view'], ['estoque/saidas', inventory.exits, 'inventory.view'],
  ['estoque/inventario', inventory.count, 'inventory.view'], ['estoque/minimo', inventory.minimum, 'inventory.view'], ['produto/:id', inventory.productPage, 'inventory.view'],
  ['funcionarios/cadastro', employees.list, 'employees.view'], ['funcionario/:id', employees.employeePage, 'employees.view'],
  ['funcionarios/salarios', employees.salaries, 'payroll.view'], ['funcionarios/vales', employees.advances, 'payroll.view'],
  ['funcionarios/descontos', employees.discounts, 'payroll.view'], ['funcionarios/pagamentos', employees.payments, 'payroll.view'],
  ['relatorios', reports.index, 'reports.view'], ['relatorios/:id', reports.view, 'reports.view'],
  ['alertas', alertsPage.render, 'alerts.view'],
  ['config', settings.render, ['settings.edit', 'users.manage', 'audit.view', 'backup.manage']], ['config/:tab', settings.render, ['settings.edit', 'users.manage', 'audit.view', 'backup.manage']],
];
function matchRoute(path) {
  for (const [pattern, fn, perm] of ROUTES) {
    const pp = pattern.split('/'), xp = path.split('/');
    if (pp.length !== xp.length) continue;
    const params = {};
    if (pp.every((p, i) => p.startsWith(':') ? (params[p.slice(1)] = decodeURIComponent(xp[i]), true) : p === xp[i])) return { fn, perm, params };
  }
  return null;
}
const parseHash = () => {
  const h = location.hash.replace(/^#\/?/, '') || '';
  const [path, qs] = h.split('?');
  return { path: path || '', query: Object.fromEntries(new URLSearchParams(qs || '')) };
};
const homeRoute = () => auth.can('dashboard.view') ? '#/dashboard' : '#/rapido';

// ---------- Layout ----------
function shell() {
  const u = auth.currentUser(); const f = farm();
  root.innerHTML = `<div class="app">
    <aside class="sidebar" id="sidebar">
      <div class="side-brand"><a href="${homeRoute()}"><img src="${esc(f.logo || 'assets/logo.png')}" alt="${esc(f.name)}"></a></div>
      <nav class="side-nav" id="side-nav"></nav>
      <div class="side-foot">${esc(f.name)} · ${esc(f.city)}<br>Perfil: ${esc(auth.currentRole()?.name || '')}</div>
    </aside>
    <div class="backdrop" id="backdrop"></div>
    <div class="main">
      <header class="topbar">
        <button class="icon-btn menu-btn" id="menu-btn" aria-label="Menu">${icon('menu', 22)}</button>
        <div class="search">${icon('search', 18)}<input id="gsearch" type="search" placeholder="Pesquisar animal, ID, brinco, funcionário, produto, máquina, lote…" autocomplete="off"><div class="search-results" id="gresults" hidden></div></div>
        <div class="top-right">
          <span id="net" class="net"></span>
          <a class="icon-btn" href="#/alertas" aria-label="Alertas" style="position:relative" ${auth.can('alerts.view') ? '' : 'hidden'}>${icon('bell', 20)}<span id="bell-count" class="nav-count" style="position:absolute;top:0;right:-2px" hidden></span></a>
          <button class="user-chip" id="user-chip"><span class="avatar">${esc((u.name || '?').split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase())}</span><span class="uname small"><b>${esc(u.name)}</b></span></button>
        </div>
      </header>
      <main class="content" id="page"></main>
    </div>
  </div>`;
  drawNav();
  $('#menu-btn').onclick = () => toggleSide(true);
  $('#backdrop').onclick = () => toggleSide(false);
  $('#user-chip').onclick = userMenu;
  bindSearch();
  updateNet();
}
const toggleSide = (open) => { $('#sidebar').classList.toggle('open', open); $('#backdrop').classList.toggle('show', open); };

function drawNav() {
  const cur = location.hash.split('?')[0];
  const nav = $('#side-nav'); if (!nav) return;
  const alertCount = auth.can('alerts.view') ? openAlerts(computeAlerts().filter(a => !a.perm || auth.can(a.perm))).filter(a => a.state === 'novo').length : 0;
  nav.innerHTML = MENU.filter(m => allowed(m.perm)).map(m => {
    if (!m.items) {
      const on = cur === m.href || (m.href !== '#/dashboard' && cur.startsWith(m.href + '/'));
      return `<a class="nav-item ${on ? 'on' : ''}" href="${m.href}">${icon(m.icon)}<span>${esc(m.label)}</span>${m.badge && alertCount ? `<span class="nav-count">${alertCount}</span>` : ''}</a>`;
    }
    const items = m.items.filter(i => allowed(i[2]));
    const open = items.some(i => cur.startsWith(i[0])) || cur.startsWith(`#/${m.key}`) || (m.key === 'rebanho' && cur.startsWith('#/animal/')) || (m.key === 'maquinas' && cur.startsWith('#/maquina/')) || (m.key === 'estoque' && cur.startsWith('#/produto/')) || (m.key === 'funcionarios' && cur.startsWith('#/funcionario/'));
    return `<details class="nav-group" ${open ? 'open' : ''}><summary>${icon(m.icon)}<span>${esc(m.label)}</span>${icon('down', 16, 'chev')}</summary>
      <div class="nav-sub">${items.map(i => `<a href="${i[0]}" class="${cur.startsWith(i[0]) ? 'on' : ''}">${esc(i[1])}</a>`).join('')}</div></details>`;
  }).join('');
  const bell = $('#bell-count'); if (bell) { bell.hidden = !alertCount; bell.textContent = alertCount; }
  $$('a', nav).forEach(a => a.addEventListener('click', () => toggleSide(false)));
}

function userMenu(e) {
  e.stopPropagation();
  const old = $('.user-menu'); if (old) { old.remove(); return; }
  const m = document.createElement('div'); m.className = 'user-menu';
  const u = auth.currentUser();
  m.innerHTML = `<div style="padding:8px 12px"><b>${esc(u.name)}</b><div class="muted small">${esc(u.username)} · ${esc(auth.currentRole()?.name || '')}</div></div>
    <button data-a="pw">${icon('shield', 18)} Alterar minha senha</button>
    ${auth.can('backup.manage') ? `<a href="#/config/backup">${icon('database', 18)} Backup</a>` : ''}
    <button data-a="out">${icon('logout', 18)} Sair</button>`;
  document.body.appendChild(m);
  const close = () => { m.remove(); document.removeEventListener('click', close); };
  setTimeout(() => document.addEventListener('click', close), 0);
  m.querySelector('[data-a=out]').onclick = () => { auth.logout(); history.replaceState(null, '', location.pathname); boot(); };
  m.querySelector('[data-a=pw]').onclick = () => settings.changeOwnPassword();
}

// ---------- Pesquisa global ----------
function searchAll(q) {
  const n = normalize(q); if (n.length < 1) return [];
  const has = (...xs) => xs.some(x => normalize(x).includes(n));
  const out = [];
  if (auth.can('herd.view')) db.all('animals').filter(a => has(a.name, a.tag, pad(a.code), String(a.code), a.breed)).slice(0, 8)
    .forEach(a => out.push({ g: 'Animais', icon: 'cow', label: animalLabel(a), sub: [a.tag && `Brinco ${a.tag}`, a.breed, a.status].filter(Boolean).join(' · '), href: `#/animal/${a.id}`, rank: normalize(a.name) === n || a.tag === q || String(a.code) === q.replace(/^0+/, '') ? 0 : 1 }));
  if (auth.can('employees.view')) db.all('employees').filter(e => has(e.name, e.cpf, e.position, e.phone)).slice(0, 5)
    .forEach(e => out.push({ g: 'Funcionários', icon: 'user', label: e.name, sub: `${e.position || ''} · ${e.status}`, href: `#/funcionario/${e.id}` }));
  if (auth.can('inventory.view')) db.all('inventory').filter(p => has(p.name, p.code, p.category, p.supplier)).slice(0, 5)
    .forEach(p => out.push({ g: 'Produtos', icon: 'package', label: p.name, sub: `${p.code || ''} · ${p.category} · saldo ${p.quantity} ${p.unit}`, href: `#/produto/${p.id}` }));
  if (auth.can('machines.view')) db.all('machines').filter(m => has(m.name, m.identification, m.brand, m.model)).slice(0, 5)
    .forEach(m => out.push({ g: 'Máquinas', icon: 'tractor', label: m.name, sub: [m.type, m.brand, m.model, m.status].filter(Boolean).join(' · '), href: `#/maquina/${m.id}` }));
  if (auth.can('feed.view')) db.all('feed_batches').filter(b => has(b.lot_number, '#' + b.lot_number, 'lote ' + b.lot_number)).slice(0, 5)
    .forEach(b => out.push({ g: 'Lotes de ração', icon: 'layers', label: `Lote #${b.lot_number}`, sub: `${b.feed_type} · ${fmtDate(b.date)}`, href: `#/racao/lote/${b.id}` }));
  return out.sort((a, b) => (a.rank ?? 1) - (b.rank ?? 1));
}
function bindSearch() {
  const input = $('#gsearch'), box = $('#gresults');
  let items = [], hi = 0;
  const draw = () => {
    items = searchAll(input.value);
    if (!input.value.trim()) { box.hidden = true; return; }
    let g = '';
    box.innerHTML = items.length ? items.map((it, i) => `${it.g !== g ? `<div class="sr-group">${esc(g = it.g)}</div>` : ''}<a class="sr-item ${i === hi ? 'hi' : ''}" href="${it.href}" data-i="${i}">${icon(it.icon, 18)}<div><div><b>${esc(it.label)}</b></div><div class="muted small">${esc(it.sub)}</div></div></a>`).join('')
      : `<div class="combo-empty">Nada encontrado para "${esc(input.value)}".</div>`;
    box.hidden = false;
  };
  input.addEventListener('input', debounce(() => { hi = 0; draw(); }, 120));
  input.addEventListener('focus', draw);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { hi = Math.min(items.length - 1, hi + 1); draw(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { hi = Math.max(0, hi - 1); draw(); e.preventDefault(); }
    if (e.key === 'Enter' && items[hi]) { location.hash = items[hi].href; box.hidden = true; input.blur(); }
    if (e.key === 'Escape') { box.hidden = true; input.blur(); }
  });
  box.addEventListener('click', (e) => { if (e.target.closest('.sr-item')) { box.hidden = true; input.value = ''; } });
  document.addEventListener('click', (e) => { if (!e.target.closest('.search')) box.hidden = true; });
}

// ---------- Status de conexão ----------
let pendingCount = 0;
export async function updateNet() {
  const el = $('#net'); if (!el) return;
  try { pendingCount = sync.enabled() ? await db.outboxCount() : 0; } catch { }
  const on = navigator.onLine;
  const st = sync.state();
  if (!on) { el.className = 'net net-off'; el.innerHTML = `${icon('wifiOff', 16)}<span class="txt">OFFLINE — ${sync.enabled() ? `aguardando sincronização${pendingCount ? ` (${pendingCount})` : ''}` : 'dados salvos no aparelho'}</span>`; el.title = 'Sem internet. Tudo que for lançado fica salvo neste aparelho.'; }
  else if (st.syncing || (sync.enabled() && pendingCount)) { el.className = 'net net-sync'; el.innerHTML = `${icon('refresh', 16)}<span class="txt">Sincronizando${pendingCount ? ` (${pendingCount})` : ''}</span>`; }
  else { el.className = 'net net-on'; el.innerHTML = `${icon('wifi', 16)}<span class="txt">ONLINE</span>`; el.title = sync.enabled() ? `Sincronizado${st.last ? ' em ' + fmtDateTime(st.last) : ''}` : 'Dados salvos neste aparelho. Configure a sincronização em Configurações para usar em vários aparelhos.'; }
}
window.addEventListener('online', () => { updateNet(); sync.syncNow(); });
window.addEventListener('offline', updateNet);

// ---------- Renderização da página ----------
let lastPath = null;
export function render() {
  if (!auth.currentUser()) return;
  const { path, query } = parseHash();
  if (!path) { location.replace(homeRoute()); return; }
  const r = matchRoute(path);
  const page = $('#page'); if (!page) return;
  const samePage = lastPath === path;
  const y = window.scrollY;
  if (!r) { page.innerHTML = `<div class="empty-state"><h2>Página não encontrada</h2><p><a href="${homeRoute()}">Voltar ao início</a></p></div>`; return; }
  if (r.perm && !allowed(r.perm)) { page.innerHTML = `<div class="card empty-state">${icon('shield', 36)}<h2>Acesso restrito</h2><p>Seu perfil (${esc(auth.currentRole()?.name)}) não tem permissão para esta área.</p><a class="btn btn-primary" href="${homeRoute()}">Voltar</a></div>`; drawNav(); return; }
  try {
    page.innerHTML = demoBanner();
    const holder = document.createElement('div'); page.appendChild(holder);
    r.fn(holder, { params: r.params, query });
    bindDemoBanner();
  } catch (e) { console.error(e); page.innerHTML = `<div class="card"><h2>Erro ao abrir a página</h2><p class="muted">${esc(e.message)}</p></div>`; }
  drawNav();
  if (samePage) window.scrollTo(0, y); else window.scrollTo(0, 0);
  lastPath = path;
  auth.touch();
}
const isDemo = () => db.all('animals').some(a => a.is_demo) || db.all('employees').some(e => e.is_demo);
function demoBanner() {
  if (!isDemo()) return '';
  return `<div class="demo-banner no-print">${icon('alert', 18)}<span><b>DADOS DE DEMONSTRAÇÃO</b> — os registros atuais são fictícios, apenas para conhecer o sistema.</span>${auth.can('settings.edit') ? '<button class="btn btn-sm btn-ghost" id="rm-demo">Remover dados de demonstração</button>' : ''}</div>`;
}
function bindDemoBanner() {
  const b = $('#rm-demo'); if (!b) return;
  b.onclick = async () => {
    if (!await confirmDialog('Remover <b>todos</b> os dados de demonstração? Os registros que você lançou continuam.', { ok: 'Remover', danger: true })) return;
    const { removeDemo } = await import('./seed.js'); await removeDemo(); toast('Dados de demonstração removidos.'); render();
  };
}

window.addEventListener('hashchange', () => { $('.user-menu')?.remove(); render(); });
// Re-renderiza a página quando os dados mudam, exceto se houver edição em linha não salva (data-hold.dirty)
const rerender = debounce(() => { if (!document.querySelector('#page [data-hold].dirty')) render(); updateNet(); }, 120);

// ---------- Login e primeira configuração ----------
function loginScreen(msg = '') {
  const f = farm();
  root.innerHTML = `<div class="login-page"><div class="login-card">
    <div class="brand"><img src="${esc(f.logo || 'assets/logo.png')}" alt="${esc(f.name)}"></div>
    <form id="login-form" autocomplete="on">
      <div><h2>Entrar no sistema</h2><div class="muted small">${esc(f.name)} · Gestão integrada</div></div>
      <label class="field"><span class="lbl">Usuário</span><input class="input" name="u" autocomplete="username" autocapitalize="none" required></label>
      <label class="field"><span class="lbl">Senha</span><input class="input" name="p" type="password" autocomplete="current-password" required></label>
      <div class="form-error" id="login-err" ${msg ? '' : 'hidden'}>${esc(msg)}</div>
      <button class="btn btn-primary btn-lg">Entrar</button>
      <div class="muted small" style="text-align:center">${navigator.onLine ? '' : 'Sem internet: o login funciona offline neste aparelho.'}</div>
    </form></div></div>`;
  const form = $('#login-form');
  form.u.focus();
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = $('button', form); btn.disabled = true; btn.textContent = 'Verificando…';
    try { await auth.login(form.u.value, form.p.value); history.replaceState(null, '', homeRoute()); start(); }
    catch (err) { $('#login-err').hidden = false; $('#login-err').textContent = err.message; btn.disabled = false; btn.textContent = 'Entrar'; }
  };
}

function setupScreen() {
  root.innerHTML = `<div class="login-page"><div class="login-card setup">
    <div class="brand"><img src="assets/logo.png" alt="Fazenda Mar de Rosas"></div>
    <form id="setup-form">
      <div><h2>Primeira configuração</h2><div class="muted small">Crie o usuário administrador. Ele terá acesso completo e poderá cadastrar os demais usuários.</div></div>
      <label class="field"><span class="lbl">Nome da fazenda</span><input class="input" name="farm" value="Fazenda Mar de Rosas" required></label>
      <label class="field"><span class="lbl">Seu nome</span><input class="input" name="name" required placeholder="Ex.: José Santiago"></label>
      <label class="field"><span class="lbl">Usuário (login)</span><input class="input" name="u" required autocapitalize="none" placeholder="Ex.: jose"></label>
      <label class="field"><span class="lbl">Senha</span><input class="input" name="p" type="password" required autocomplete="new-password"><span class="hint">Mínimo 6 caracteres, com letras e números.</span></label>
      <label class="field"><span class="lbl">Repita a senha</span><input class="input" name="p2" type="password" required autocomplete="new-password"></label>
      <label class="field check"><input type="checkbox" name="demo" checked> <span>Carregar dados de demonstração (fictícios, podem ser removidos depois)</span></label>
      <div class="form-error" id="setup-err" hidden></div>
      <button class="btn btn-primary btn-lg">Criar e entrar</button>
      <button type="button" class="btn btn-ghost" id="setup-sync">${icon('refresh', 18)} Já uso o sistema em outro aparelho</button>
    </form></div></div>`;
  const form = $('#setup-form');
  $('#setup-sync').onclick = connectScreen;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const err = (m) => { $('#setup-err').hidden = false; $('#setup-err').textContent = m; };
    const prob = auth.passwordProblem(form.p.value);
    if (prob) return err(prob);
    if (form.p.value !== form.p2.value) return err('As senhas não conferem.');
    if (!/^[a-z0-9._-]{3,}$/i.test(form.u.value.trim())) return err('Usuário: use pelo menos 3 letras/números, sem espaços.');
    const btn = $('button', form); btn.disabled = true; btn.textContent = 'Criando…';
    db.setSetting('farm', { ...farm(), name: form.farm.value.trim() });
    const u = await auth.createUser({ name: form.name.value.trim(), username: form.u.value.trim(), password: form.p.value, role_id: 'role-admin' });
    await auth.login(u.username, form.p.value);
    if (form.demo.checked) {
      try { const { loadDemo } = await import('./seed.js'); await loadDemo(); }
      catch (e2) { console.error(e2); toast('Não foi possível carregar todos os dados de demonstração: ' + e2.message, 'err', 6000); }
    }
    start();
  };
}

// Aparelho novo: conecta à sincronização e baixa os dados (inclusive usuários) antes do login
function connectScreen() {
  root.innerHTML = `<div class="login-page"><div class="login-card"><div class="brand"><img src="assets/logo.png" alt=""></div>
    <form id="conn-form"><div><h2>Conectar a este aparelho</h2><div class="muted small">Use os dados de sincronização informados pelo administrador (Configurações › Sincronização).</div></div>
      <label class="field"><span class="lbl">URL do servidor</span><input class="input" name="url" required placeholder="https://xxxx.supabase.co"></label>
      <label class="field"><span class="lbl">Chave pública</span><input class="input" name="key" required></label>
      <label class="field"><span class="lbl">E-mail de sincronização</span><input class="input" name="email" type="email" required></label>
      <label class="field"><span class="lbl">Senha de sincronização</span><input class="input" name="pw" type="password" required></label>
      <div class="form-error" id="conn-err" hidden></div>
      <button class="btn btn-primary btn-lg">Conectar e baixar dados</button><button type="button" class="btn btn-ghost" id="conn-back">Voltar</button></form></div></div>`;
  $('#conn-back').onclick = setupScreen;
  const form = $('#conn-form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = $('button', form); btn.disabled = true; btn.textContent = 'Baixando dados…';
    try {
      await sync.connect({ url: form.url.value.trim(), key: form.key.value.trim(), email: form.email.value.trim(), password: form.pw.value });
      if (sync.state().error) throw new Error(sync.state().error);
      await db.flush();
      if (!db.all('users').length) throw new Error('Conectado, mas nenhum usuário foi encontrado no servidor.');
      loginScreen();
    } catch (err) { $('#conn-err').hidden = false; $('#conn-err').textContent = err.message; btn.disabled = false; btn.textContent = 'Conectar e baixar dados'; }
  };
}

// ---------- Boot ----------
function start() {
  shell();
  if (!location.hash || location.hash === '#/' || location.hash === '#') location.replace(homeRoute());
  render();
  sync.init(() => { updateNet(); });
  autoBackup();
}
async function autoBackup() {
  if (!db.setting('backup_auto', true) || !auth.can('backup.manage') && !auth.can('dashboard.view')) return;
  const last = db.setting('last_backup');
  if (!last || Date.now() - new Date(last.at).getTime() > 24 * 3600e3) {
    try { await db.saveSnapshot('auto'); } catch (e) { console.warn('backup automático falhou', e); }
  }
}

let started = false;
export async function boot() {
  if (!window.isSecureContext || !crypto.subtle) {
    root.innerHTML = `<div class="login-page"><div class="login-card"><form><h2>Acesso seguro necessário</h2><p>Abra o sistema por um endereço <b>https://</b> (ou localhost). Isso protege as senhas e permite funcionar offline.</p></form></div></div>`;
    return;
  }
  if (!started) {
    await db.open();
    ensureDefaults();
    for (const r of auth.DEFAULT_ROLES) if (!db.get('roles', r.id)) db.putRaw('roles', { ...r, created_at: db.DEFAULT_TS, updated_at: db.DEFAULT_TS }, { sync: true });
    db.onChange(() => { if (auth.currentUser()) { auth.refresh(); rerender(); } });
    started = true;
  }
  if (!db.all('users').length) return setupScreen();
  if (auth.restoreSession()) return start();
  loginScreen();
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW', e)));
}
if (navigator.storage?.persist) navigator.storage.persist().catch(() => { });
window.addEventListener('error', (e) => console.error(e.error || e.message));
boot().catch(e => { console.error(e); root.innerHTML = `<div class="login-page"><div class="login-card"><form><h2>Erro ao iniciar</h2><p>${esc(e.message)}</p></form></div></div>`; });
