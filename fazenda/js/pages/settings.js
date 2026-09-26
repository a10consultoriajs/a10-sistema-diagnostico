// CONFIGURAÇÕES — fazenda, listas, regras, usuários, perfis, auditoria, backup e sincronização.
import * as db from '../db.js';
import * as auth from '../auth.js';
import * as sync from '../sync.js';
import { can, currentUser, PERMISSIONS } from '../auth.js';
import { icon, $, $$, tabs, pageHead, openForm, toast, confirmDialog, mountTable, badge, resizeImage } from '../ui.js';
import { esc, fmtDateTime, fmtDate, normalize, nowISO } from '../util.js';
import { DEFAULT_SETTINGS, LIST_LABELS, farm, alertsCfg, payrollCfg } from '../config.js';
import { TABLE_LABELS } from '../db.js';
import { downloadJSON } from '../export.js';
import { pageState, listPage, rangeOf } from './common.js';

const TABS = [
  ['geral', 'Fazenda', 'settings.edit'], ['listas', 'Listas e categorias', 'settings.edit'], ['regras', 'Regras e alertas', 'settings.edit'],
  ['usuarios', 'Usuários', 'users.manage'], ['perfis', 'Perfis e permissões', 'users.manage'], ['auditoria', 'Auditoria', 'audit.view'],
  ['backup', 'Backup', 'backup.manage'], ['sincronizacao', 'Sincronização', 'settings.edit'], ['dados', 'Dados', 'settings.edit'],
];

export function render(el, { params }) {
  const avail = TABS.filter(t => can(t[2]));
  const tab = avail.find(t => t[0] === params.tab) ? params.tab : avail[0]?.[0];
  el.innerHTML = `${pageHead('Configurações', 'Informações que o administrador pode ajustar sem mexer no sistema.')}${tabs(avail.map(t => [t[0], t[1]]), tab)}<div id="cfg"></div>`;
  $$('[data-tab]', el).forEach(b => b.onclick = () => { location.hash = `#/config/${b.dataset.tab}`; });
  const body = $('#cfg', el);
  ({ geral, listas, regras, usuarios, perfis, auditoria, backup, sincronizacao, dados }[tab] || (() => { }))(body);
}

function geral(el) {
  const f = farm();
  el.innerHTML = `<div class="card setup" style="max-width:720px"><div class="form-grid">
    ${[['name', 'Nome da fazenda'], ['city', 'Município / UF'], ['address', 'Endereço'], ['phone', 'Telefone'], ['owner', 'Proprietário'], ['document', 'CPF/CNPJ / Inscrição'], ['since', 'Desde (ano)']].map(([k, l]) => `<label class="field ${k === 'address' ? 'full' : ''}"><span class="lbl">${l}</span><input class="input" data-k="${k}" value="${esc(f[k] || '')}"></label>`).join('')}
    <div class="field full"><span class="lbl">Logotipo</span><div class="photo-field"><div class="photo-prev" style="width:200px;height:auto;min-height:80px;background:#161414"><img src="${esc(f.logo || 'assets/logo.png')}" alt="" style="object-fit:contain"></div>
      <label class="btn btn-ghost">${icon('upload', 18)} Trocar logo<input type="file" accept="image/*" id="logo" hidden></label>${f.logo ? '<button class="btn btn-ghost" id="logo-rm">Usar logo padrão</button>' : ''}</div></div>
  </div><div style="margin-top:16px;text-align:right"><button class="btn btn-primary btn-lg" id="save">${icon('check', 18)} Salvar</button></div></div>`;
  $('#logo', el).onchange = async (e) => { const file = e.target.files[0]; if (!file) return; db.setSetting('farm', { ...farm(), logo: await resizeImage(file, 600) }); toast('Logotipo atualizado.'); location.reload(); };
  $('#logo-rm', el) && ($('#logo-rm', el).onclick = () => { db.setSetting('farm', { ...farm(), logo: '' }); location.reload(); });
  $('#save', el).onclick = () => { const v = { ...farm() }; $$('[data-k]', el).forEach(i => v[i.dataset.k] = i.value.trim()); db.setSetting('farm', v); auditSetting('dados da fazenda'); toast('Dados da fazenda salvos.'); };
}
const auditSetting = (what) => db.insert('audit_logs', { ts: nowISO(), user_id: currentUser().id, user_name: currentUser().name, action: 'update', table_name: 'settings', description: `${currentUser().name} alterou as configurações: ${what}.` }, { audit: false });

function listas(el) {
  const lists = { ...DEFAULT_SETTINGS.lists, ...db.setting('lists', {}) };
  el.innerHTML = `<p class="muted">Uma opção por linha. As opções aparecem nos formulários. Remover uma opção não altera os registros antigos.</p>
    <div class="grid g3">${Object.keys(LIST_LABELS).map(k => `<label class="card field"><span class="lbl">${esc(LIST_LABELS[k])}</span><textarea class="input" rows="7" data-l="${k}">${esc((lists[k] || []).join('\n'))}</textarea></label>`).join('')}</div>
    <div class="sticky-save"><button class="btn btn-primary btn-lg" id="save">${icon('check', 18)} Salvar listas</button></div>`;
  $('#save', el).onclick = () => {
    const v = { ...lists };
    $$('[data-l]', el).forEach(t => { v[t.dataset.l] = [...new Set(t.value.split('\n').map(x => x.trim()).filter(Boolean))]; });
    db.setSetting('lists', v); auditSetting('listas e categorias'); toast('Listas salvas.');
  };
}

function regras(el) {
  const g = { ...DEFAULT_SETTINGS.gestation_days, ...db.setting('gestation_days', {}) }, a = alertsCfg(), p = payrollCfg();
  const num = (k, v, l, h = '') => `<label class="field"><span class="lbl">${l}</span><input class="input" inputmode="decimal" data-n="${k}" value="${esc(v)}">${h ? `<span class="hint">${h}</span>` : ''}</label>`;
  el.innerHTML = `<div class="grid g2">
    <div class="card"><h3 style="margin-bottom:12px">Tempo de gestação (dias) — previsão de parto</h3><div class="form-grid">${Object.entries(g).map(([sp, d]) => num('g.' + sp, d, sp)).join('')}</div></div>
    <div class="card"><h3 style="margin-bottom:12px">Alertas</h3><div class="form-grid">
      ${num('a.vaccine_days', a.vaccine_days, 'Avisar vacinação com antecedência (dias)')}${num('a.calving_days', a.calving_days, 'Avisar parto com antecedência (dias)')}
      ${num('a.repro_check_days', a.repro_check_days, 'Cobertura sem diagnóstico após (dias)')}${num('a.maintenance_days', a.maintenance_days, 'Avisar manutenção (dias antes)')}
      ${num('a.maintenance_hours', a.maintenance_hours, 'Avisar manutenção (horas de horímetro antes)')}${num('a.no_milk_days', a.no_milk_days, 'Sem produção registrada após (dias)')}
      ${num('a.milk_drop_pct', a.milk_drop_pct, 'Queda de produção a partir de (%)', 'Média 7 dias vs. 30 dias anteriores')}${num('a.feed_days_left', a.feed_days_left, 'Ração pronta acabando em (dias)')}
      ${num('a.payday', a.payday, 'Dia do pagamento dos funcionários')}${num('a.payday_days', a.payday_days, 'Avisar pagamento (dias antes)')}</div></div>
    <div class="card"><h3 style="margin-bottom:6px">Regras do controle de salários</h3><p class="muted small">${esc(p.note)}</p><div class="form-grid">
      ${num('p.hours_month', p.hours_month, 'Horas por mês (divisor da hora)')}${num('p.overtime_rate', p.overtime_rate, 'Multiplicador da hora extra', 'Ex.: 1,5 = 50% a mais')}
      <label class="field check"><input type="checkbox" data-c="p.include_vales" ${p.include_vales ? 'checked' : ''}> <span>Descontar vales automaticamente</span></label>
      <label class="field check"><input type="checkbox" data-c="p.include_advances" ${p.include_advances ? 'checked' : ''}> <span>Descontar adiantamentos/empréstimos</span></label>
      <label class="field check"><input type="checkbox" data-c="p.include_discounts" ${p.include_discounts ? 'checked' : ''}> <span>Descontar descontos lançados</span></label>
      <label class="field full"><span class="lbl">Aviso exibido no controle de salários</span><textarea class="input" data-t="p.note" rows="3">${esc(p.note)}</textarea></label></div></div>
    <div class="card"><h3 style="margin-bottom:12px">Sessão e segurança</h3><div class="form-grid">${num('s.session_hours', db.setting('session_hours', 12), 'Sessão expira após (horas sem uso)')}</div></div>
  </div><div class="sticky-save"><button class="btn btn-primary btn-lg" id="save">${icon('check', 18)} Salvar regras</button></div>`;
  $('#save', el).onclick = () => {
    const toN = (v) => parseFloat(String(v).replace(',', '.'));
    const G = { ...g }, A = { ...a }, Pp = { ...p };
    for (const i of $$('[data-n]', el)) {
      const [grp, k] = i.dataset.n.split(/\.(.+)/); const v = toN(i.value);
      if (isNaN(v) || v < 0) { toast(`Valor inválido: ${i.closest('label').querySelector('.lbl').textContent}`, 'err'); return; }
      if (grp === 'g') G[k] = v; else if (grp === 'a') A[k] = v; else if (grp === 'p') Pp[k] = v; else if (grp === 's') db.setSetting('session_hours', v);
    }
    $$('[data-c]', el).forEach(c => { Pp[c.dataset.c.slice(2)] = c.checked; });
    Pp.note = $('[data-t]', el).value.trim() || DEFAULT_SETTINGS.payroll.note;
    db.setSetting('gestation_days', G); db.setSetting('alerts_cfg', A); db.setSetting('payroll', Pp);
    auditSetting('regras, alertas e salários'); toast('Regras salvas.');
  };
}

function userForm(u = null) {
  openForm({
    title: u ? `Usuário ${u.username}` : 'Novo usuário', values: u ? { ...u, password: '' } : { active: true, role_id: 'role-funcionario' },
    fields: [
      { name: 'name', label: 'Nome', required: true }, { name: 'username', label: 'Usuário (login)', required: true, readonly: !!u },
      { name: 'role_id', label: 'Perfil', type: 'select', required: true, options: () => db.all('roles').map(r => [r.id, r.name]) },
      { name: 'employee_id', label: 'Funcionário vinculado', type: 'ref', source: 'employee', hint: 'Preenche automaticamente o responsável nos lançamentos.' },
      { name: 'password', label: u ? 'Nova senha (deixe em branco para manter)' : 'Senha', type: 'password', required: !u, hint: 'Mínimo 6 caracteres, com letras e números.' },
      ...(u ? [{ name: 'active', label: 'Usuário ativo (pode entrar no sistema)', type: 'checkbox' }] : []),
    ],
    onSubmit: async (v) => {
      if (v.password && auth.passwordProblem(v.password)) throw new Error(auth.passwordProblem(v.password));
      if (u) {
        if (u.id === currentUser().id && (v.active === false || v.role_id !== u.role_id) && u.role_id === 'role-admin') {
          const admins = db.where('users', x => x.active && x.role_id === 'role-admin');
          if (admins.length <= 1) throw new Error('Você é o único administrador ativo. Crie outro administrador antes.');
        }
        db.update('users', u.id, { name: v.name, role_id: v.role_id, employee_id: v.employee_id, active: v.active !== false });
        if (v.password) await auth.setPassword(u.id, v.password);
      } else {
        if (!/^[a-z0-9._-]{3,}$/i.test(v.username)) throw new Error('Usuário: pelo menos 3 letras/números, sem espaços.');
        await auth.createUser({ name: v.name, username: v.username, password: v.password, role_id: v.role_id, employee_id: v.employee_id });
      }
      toast('Usuário salvo.');
    },
  });
}
function usuarios(el) {
  el.innerHTML = `<div class="card"><div class="card-head"><h3>Usuários</h3><button class="btn btn-primary" id="new">${icon('plus', 18)} Novo usuário</button></div><div id="t"></div>
    <p class="muted small">Usuários não são excluídos: desative para bloquear o acesso e manter o histórico.${db.all('users').some(u => u.is_demo) ? ' Usuários de demonstração: <b>ordenha / ordenha123</b> e <b>gerente / gerente123</b>.' : ''}</p></div>`;
  $('#new', el).onclick = () => userForm();
  mountTable($('#t', el), { id: 'users', rows: db.all('users'), defaultSort: { key: 'name', dir: 'asc' },
    columns: [{ key: 'name', label: 'Nome' }, { key: 'username', label: 'Usuário' }, { key: 'role', label: 'Perfil', value: (u) => db.get('roles', u.role_id)?.name, render: (u) => esc(db.get('roles', u.role_id)?.name || '—') },
      { key: 'emp', label: 'Funcionário', render: (u) => esc(db.get('employees', u.employee_id)?.name || '—'), hideSm: true }, { key: 'last_login', label: 'Último acesso', render: (u) => u.last_login ? fmtDateTime(u.last_login) : '—', hideSm: true },
      { key: 'active', label: 'Situação', render: (u) => u.active ? badge('Ativo', 'green') : badge('Inativo', 'neutral') }],
    onRowClick: (u) => userForm(u) });
}

function perfis(el) {
  const roles = db.all('roles');
  const groups = [...new Set(PERMISSIONS.map(p => p[1]))];
  el.innerHTML = `<div class="card"><div class="card-head"><h3>Perfis e permissões</h3><button class="btn btn-primary" id="new">${icon('plus', 18)} Novo perfil</button></div>
    <p class="muted small">Marque o que cada perfil pode fazer. Exemplo: "Ordenha" registra produção e não vê salários.</p>
    <div class="table-wrap" data-hold><table class="table"><thead><tr><th>Permissão</th>${roles.map(r => `<th style="text-align:center">${esc(r.name)}</th>`).join('')}</tr></thead><tbody>
    ${groups.map(g => `<tr><td colspan="${roles.length + 1}" style="background:var(--panel-2);font-weight:700">${esc(g)}</td></tr>${PERMISSIONS.filter(p => p[1] === g).map(([k, , l]) => `<tr><td>${esc(l)}</td>${roles.map(r => `<td style="text-align:center"><input type="checkbox" style="width:20px;height:20px;accent-color:var(--green-600)" data-r="${r.id}" data-p="${k}" ${r.permissions?.includes(k) ? 'checked' : ''} ${r.id === 'role-admin' ? 'disabled' : ''}></td>`).join('')}</tr>`).join('')}`).join('')}
    </tbody></table></div><div class="sticky-save"><button class="btn btn-primary btn-lg" id="save">${icon('check', 18)} Salvar permissões</button></div></div>`;
  $$('[data-p]', el).forEach(c => c.onchange = () => $('[data-hold]', el).classList.add('dirty'));
  $('#new', el).onclick = () => openForm({ title: 'Novo perfil', fields: [{ name: 'name', label: 'Nome do perfil', required: true }, { name: 'description', label: 'Descrição' }, { name: 'copy', label: 'Copiar permissões de', type: 'select', options: () => roles.map(r => [r.id, r.name]) }],
    onSubmit: (v) => { db.insert('roles', { name: v.name, description: v.description, permissions: v.copy ? [...(db.get('roles', v.copy).permissions || [])] : [] }); toast('Perfil criado.'); } });
  $('#save', el).onclick = () => {
    for (const r of roles) {
      if (r.id === 'role-admin') continue;
      const perms = $$(`[data-r="${r.id}"]`, el).filter(c => c.checked).map(c => c.dataset.p);
      db.update('roles', r.id, { permissions: perms });
    }
    $('[data-hold]', el).classList.remove('dirty'); auth.refresh(); toast('Permissões salvas.');
  };
}

function auditoria(el) {
  listPage(el, {
    id: 'audit', title: 'Auditoria', sub: 'Registro automático de quem fez o quê e quando. Não pode ser alterado.', defaultPeriod: '7d',
    filters: [{ type: 'period' }, { type: 'search', key: 'q', placeholder: 'Usuário, animal, produto…', text: (l) => `${l.user_name} ${l.description}` },
      { type: 'select', key: 'act', label: 'Ação', options: [['create', 'Cadastro'], ['update', 'Alteração'], ['delete', 'Exclusão']], match: (l, v) => l.action === v },
      { type: 'select', key: 'user', label: 'Usuário', options: () => db.all('users').map(u => [u.id, u.name]), match: (l, v) => l.user_id === v }],
    rows: (st) => { const r = rangeOf(st); return db.where('audit_logs', l => (l.ts || '').slice(0, 10) >= r.from && (l.ts || '').slice(0, 10) <= r.to); },
    defaultSort: { key: 'ts', dir: 'desc' },
    columns: [{ key: 'ts', label: 'Data e hora', text: (l) => fmtDateTime(l.ts), render: (l) => `<span class="nowrap">${fmtDateTime(l.ts)}</span>` }, { key: 'user_name', label: 'Usuário' },
      { key: 'action', label: 'Ação', text: (l) => ({ create: 'Cadastro', update: 'Alteração', delete: 'Exclusão' }[l.action] || l.action), render: (l) => badge({ create: 'Cadastro', update: 'Alteração', delete: 'Exclusão' }[l.action] || l.action, { create: 'green', update: 'blue', delete: 'rose' }[l.action]) },
      { key: 'table_name', label: 'Registro', text: (l) => TABLE_LABELS[l.table_name] || l.table_name, render: (l) => esc(TABLE_LABELS[l.table_name] || l.table_name), hideSm: true }, { key: 'description', label: 'Descrição' }],
  });
}

async function backup(el) {
  const last = db.setting('last_backup');
  el.innerHTML = `<div class="grid g2">
    <div class="card"><h3>${icon('database', 18)} Backup</h3>
      <p>Último backup: <b>${last ? fmtDateTime(last.at) : 'nunca'}</b>${last ? ` <span class="muted small">(${last.kind === 'auto' ? 'automático' : 'manual'})</span>` : ''}</p>
      <label class="field check"><input type="checkbox" id="auto" ${db.setting('backup_auto', true) ? 'checked' : ''}> <span>Backup automático diário neste aparelho (guarda os 10 mais recentes)</span></label>
      <div class="page-actions" style="margin-top:12px"><button class="btn btn-primary" id="dl">${icon('download', 18)} Baixar backup agora</button><button class="btn btn-ghost" id="snap">${icon('database', 18)} Criar ponto de restauração</button></div>
      <p class="muted small">Guarde o arquivo baixado em local seguro (pendrive, Google Drive, e-mail). Ele contém todos os dados do sistema.</p></div>
    <div class="card"><h3>${icon('upload', 18)} Restaurar</h3><p class="muted">Substitui <b>todos</b> os dados deste aparelho pelos do arquivo. Somente administradores.</p>
      <label class="btn btn-ghost">${icon('upload', 18)} Escolher arquivo de backup (.json)<input type="file" accept=".json,application/json" id="file" hidden></label></div>
    <div class="card" style="grid-column:1/-1"><h3>Pontos de restauração neste aparelho</h3><div id="snaps" class="muted">Carregando…</div></div></div>`;
  $('#auto', el).onchange = (e) => db.setSetting('backup_auto', e.target.checked);
  $('#dl', el).onclick = async () => { await db.flush(); downloadJSON(db.exportData(), `backup-fazenda-mar-de-rosas-${nowISO().slice(0, 16).replace(/[:T]/g, '-')}.json`); db.setSetting('last_backup', { at: nowISO(), kind: 'manual' }); auditSetting('backup manual baixado'); toast('Backup baixado.'); };
  $('#snap', el).onclick = async () => { await db.saveSnapshot('manual'); toast('Ponto de restauração criado.'); backup(el); };
  const restore = async (dump, label) => {
    if (!await confirmDialog(`Restaurar os dados de <b>${esc(label)}</b>? Todos os dados atuais deste aparelho serão substituídos. Um ponto de restauração do estado atual será criado antes.`, { title: 'Restaurar backup', ok: 'Restaurar', danger: true })) return;
    try { await db.saveSnapshot('antes da restauração'); await db.importData(dump); toast('Dados restaurados. Recarregando…'); setTimeout(() => location.reload(), 800); }
    catch (e) { toast(e.message, 'err'); }
  };
  $('#file', el).onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { restore(JSON.parse(await f.text()), f.name); } catch { toast('Arquivo inválido.', 'err'); } };
  const snaps = await db.listSnapshots();
  $('#snaps', el).innerHTML = snaps.length ? `<ul class="list-plain">${snaps.map(s => `<li><span>${fmtDateTime(s.id)} <span class="muted small">(${esc(s.kind)} · ${(s.size / 1024).toFixed(0)} KB)</span></span><button class="btn btn-sm btn-ghost" data-snap="${esc(s.id)}">Restaurar</button></li>`).join('')}</ul>` : 'Nenhum ponto de restauração.';
  $$('[data-snap]', el).forEach(b => b.onclick = async () => { const s = await db.getSnapshot(b.dataset.snap); restore(s.dump, fmtDateTime(s.id)); });
}

function sincronizacao(el) {
  const c = sync.config(), st = sync.state();
  el.innerHTML = `<div class="card" style="max-width:760px"><h3>${icon('refresh', 18)} Sincronização entre aparelhos (opcional)</h3>
    <p class="muted">Sem sincronização, os dados ficam salvos <b>neste aparelho</b> (funciona 100% offline). Para usar em vários celulares e computadores, conecte a um banco de dados na nuvem (Supabase/PostgreSQL). Os lançamentos feitos sem internet ficam na fila e são enviados automaticamente quando a conexão voltar.</p>
    ${c?.refresh_token ? `<p>Conectado a <b>${esc(c.url)}</b> como <b>${esc(c.email)}</b>.<br>Última sincronização: <b>${st.last ? fmtDateTime(st.last) : '—'}</b>${st.error ? `<br><span class="delta-down">Erro: ${esc(st.error)}</span>` : ''}</p>
      <div class="page-actions"><button class="btn btn-primary" id="now">${icon('refresh', 18)} Sincronizar agora</button><button class="btn btn-ghost" id="off">Desconectar</button></div>`
    : `<div class="form-grid" style="margin-top:12px"><label class="field full"><span class="lbl">URL do projeto</span><input class="input" id="url" placeholder="https://xxxx.supabase.co"></label>
      <label class="field full"><span class="lbl">Chave pública (anon key)</span><input class="input" id="key"></label>
      <label class="field"><span class="lbl">E-mail da conta de sincronização</span><input class="input" id="email" type="email"></label><label class="field"><span class="lbl">Senha</span><input class="input" id="pw" type="password"></label></div>
      <div style="margin-top:12px"><button class="btn btn-primary" id="connect">Conectar</button></div>
      <p class="muted small">Instruções de instalação do banco: arquivo <code>fazenda/docs/schema.sql</code> e <code>fazenda/docs/ARQUITETURA.md</code>.</p>`}</div>`;
  const on = (id, fn) => { const b = $('#' + id, el); if (b) b.onclick = fn; };
  on('now', async () => { await sync.syncNow(true); toast(sync.state().error ? 'Erro: ' + sync.state().error : 'Sincronizado.', sync.state().error ? 'err' : 'ok'); sincronizacao(el); });
  on('off', async () => { if (await confirmDialog('Desconectar a sincronização? Os dados continuam neste aparelho.')) { sync.disconnect(); sincronizacao(el); } });
  on('connect', async () => {
    try { await sync.connect({ url: $('#url', el).value.trim(), key: $('#key', el).value.trim(), email: $('#email', el).value.trim(), password: $('#pw', el).value }); sync.init(); toast('Conectado e sincronizado.'); sincronizacao(el); }
    catch (e) { toast(e.message, 'err', 6000); }
  });
}

function dados(el) {
  const hasDemo = db.all('animals').some(a => a.is_demo);
  el.innerHTML = `<div class="grid g2"><div class="card"><h3>Dados de demonstração</h3>
    <p class="muted">Registros fictícios (animais, produção, ração, estoque, máquinas e funcionários) para conhecer o sistema. Ficam identificados com a faixa "DADOS DE DEMONSTRAÇÃO".</p>
    ${hasDemo ? `<button class="btn btn-danger" id="rm">Remover dados de demonstração</button>` : `<button class="btn btn-ghost" id="load">Carregar dados de demonstração</button>`}</div>
    <div class="card"><h3>Uso do armazenamento</h3><div id="usage" class="muted">Calculando…</div></div></div>`;
  const rm = $('#rm', el), load = $('#load', el);
  if (rm) rm.onclick = async () => { if (!await confirmDialog('Remover todos os dados de demonstração?', { danger: true, ok: 'Remover' })) return; const { removeDemo } = await import('../seed.js'); await removeDemo(); toast('Dados de demonstração removidos.'); };
  if (load) load.onclick = async () => { if (!await confirmDialog('Carregar dados de demonstração? Eles serão misturados aos dados atuais (e podem ser removidos depois).')) return; const { loadDemo } = await import('../seed.js'); await loadDemo(); toast('Dados de demonstração carregados.'); };
  navigator.storage?.estimate?.().then(e => { $('#usage', el).innerHTML = `Usado: <b>${(e.usage / 1048576).toFixed(1)} MB</b> de ${(e.quota / 1048576).toFixed(0)} MB disponíveis neste navegador.`; }).catch(() => { $('#usage', el).textContent = 'Indisponível.'; });
}

export function changeOwnPassword() {
  openForm({
    title: 'Alterar minha senha', size: 'sm',
    fields: [{ name: 'old', label: 'Senha atual', type: 'password', required: true }, { name: 'p1', label: 'Nova senha', type: 'password', required: true, hint: 'Mínimo 6 caracteres, com letras e números.' }, { name: 'p2', label: 'Repita a nova senha', type: 'password', required: true }],
    onSubmit: async (v) => {
      const u = currentUser();
      if ((await auth.hashPassword(v.old, u.password_salt)).hash !== u.password_hash) throw new Error('Senha atual incorreta.');
      if (auth.passwordProblem(v.p1)) throw new Error(auth.passwordProblem(v.p1));
      if (v.p1 !== v.p2) throw new Error('As senhas não conferem.');
      await auth.setPassword(u.id, v.p1); toast('Senha alterada.');
    },
  });
}
