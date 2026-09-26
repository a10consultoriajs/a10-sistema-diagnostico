// Autenticação local (senhas com PBKDF2-SHA256 + sal), sessão e permissões.
import * as db from './db.js';
import { nowISO } from './util.js';

// Catálogo de permissões. Os perfis (roles) guardam a lista de chaves permitidas.
export const PERMISSIONS = [
  ['dashboard.view', 'Painel', 'Ver painel e visão geral'],
  ['herd.view', 'Rebanho', 'Ver animais e fichas'],
  ['herd.edit', 'Rebanho', 'Cadastrar/editar animais'],
  ['births.edit', 'Rebanho', 'Registrar nascimentos'],
  ['deaths.edit', 'Rebanho', 'Registrar mortalidade'],
  ['repro.edit', 'Rebanho', 'Registrar reprodução'],
  ['weights.edit', 'Rebanho', 'Registrar pesagens'],
  ['health.edit', 'Rebanho', 'Registrar saúde / tratamentos'],
  ['milk.view', 'Leite', 'Ver produção de leite'],
  ['milk.edit', 'Leite', 'Registrar produção de leite'],
  ['feed.view', 'Ração', 'Ver ração'],
  ['feed.edit', 'Ração', 'Fabricar e distribuir ração'],
  ['machines.view', 'Máquinas', 'Ver máquinas e serviços'],
  ['machines.edit', 'Máquinas', 'Registrar serviços, manutenção e combustível'],
  ['inventory.view', 'Estoque', 'Ver estoque'],
  ['inventory.edit', 'Estoque', 'Registrar entradas e saídas'],
  ['inventory.cost', 'Estoque', 'Ver valores do estoque'],
  ['employees.view', 'Funcionários', 'Ver cadastro de funcionários (dados pessoais)'],
  ['employees.edit', 'Funcionários', 'Cadastrar/editar funcionários'],
  ['payroll.view', 'Funcionários', 'Ver salários, vales e pagamentos'],
  ['payroll.edit', 'Funcionários', 'Lançar salários, vales e descontos'],
  ['reports.view', 'Relatórios', 'Acessar relatórios operacionais'],
  ['alerts.view', 'Alertas', 'Ver central de alertas'],
  ['records.delete', 'Sistema', 'Excluir registros'],
  ['settings.edit', 'Sistema', 'Alterar configurações'],
  ['users.manage', 'Sistema', 'Gerenciar usuários e permissões'],
  ['audit.view', 'Sistema', 'Ver auditoria'],
  ['backup.manage', 'Sistema', 'Backup e restauração'],
];
const ALL = PERMISSIONS.map(p => p[0]);

export const DEFAULT_ROLES = [
  { id: 'role-admin', name: 'Administrador', system: true, description: 'Acesso completo', permissions: ALL },
  { id: 'role-gerente', name: 'Gerente', system: true, description: 'Principais módulos e relatórios',
    permissions: ALL.filter(p => !['users.manage', 'backup.manage', 'settings.edit'].includes(p)) },
  { id: 'role-funcionario', name: 'Funcionário', system: true, description: 'Somente lançamentos do dia a dia',
    permissions: ['herd.view', 'milk.view', 'milk.edit', 'feed.view', 'feed.edit', 'machines.view', 'machines.edit', 'inventory.view', 'inventory.edit', 'alerts.view'] },
  { id: 'role-ordenha', name: 'Ordenha', system: false, description: 'Registra produção de leite',
    permissions: ['herd.view', 'milk.view', 'milk.edit'] },
  { id: 'role-estoque', name: 'Estoque', system: false, description: 'Entradas e saídas de estoque',
    permissions: ['inventory.view', 'inventory.edit', 'feed.view'] },
];

// ---------- Senha ----------
const enc = new TextEncoder();
const toHex = (buf) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const ITER = 150000;
export async function hashPassword(password, saltHex) {
  const salt = saltHex || toHex(crypto.getRandomValues(new Uint8Array(16)));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: ITER }, key, 256);
  return { hash: toHex(bits), salt };
}
export function passwordProblem(p) {
  if (!p || p.length < 6) return 'A senha deve ter pelo menos 6 caracteres.';
  if (!/[0-9]/.test(p) || !/[a-zA-Z]/.test(p)) return 'Use letras e números na senha.';
  return null;
}

// ---------- Sessão ----------
const SESSION_KEY = 'fmr_session';
let user = null, role = null;
export const currentUser = () => user;
export const currentRole = () => role;
export const can = (perm) => !!role && (role.permissions || []).includes(perm);
export const canAny = (...perms) => perms.some(can);

function loadRole() { role = user ? db.get('roles', user.role_id) : null; }

export function restoreSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if (!s || s.exp < Date.now()) return null;
    const u = db.get('users', s.uid);
    if (!u || !u.active) return null;
    user = u; loadRole(); db.setAuditUser(u);
    touch();
    return u;
  } catch { return null; }
}
export function touch() {
  if (!user) return;
  const hours = +db.setting('session_hours', 12) || 12;
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ uid: user.id, exp: Date.now() + hours * 3600e3 })); } catch { }
}

const FAIL_KEY = 'fmr_login_fail';
export async function login(username, password) {
  const f = JSON.parse(localStorage.getItem(FAIL_KEY) || '{"n":0,"t":0}');
  if (f.n >= 5 && Date.now() - f.t < 60000) throw new Error('Muitas tentativas. Aguarde 1 minuto e tente novamente.');
  const u = db.find('users', x => x.username.toLowerCase() === String(username).trim().toLowerCase());
  const ok = u && u.active && (await hashPassword(password, u.password_salt)).hash === u.password_hash;
  if (!ok) {
    localStorage.setItem(FAIL_KEY, JSON.stringify({ n: (f.n >= 5 ? 0 : f.n) + 1, t: Date.now() }));
    throw new Error('Usuário ou senha incorretos.');
  }
  localStorage.removeItem(FAIL_KEY);
  user = u; loadRole(); db.setAuditUser(u);
  db.update('users', u.id, { last_login: nowISO() }, { audit: false });
  user = db.get('users', u.id);
  touch();
  return user;
}
export function logout() { user = null; role = null; db.setAuditUser(null); localStorage.removeItem(SESSION_KEY); }
export function refresh() { if (user) { user = db.get('users', user.id); loadRole(); db.setAuditUser(user); } }

export async function createUser({ name, username, password, role_id, employee_id = null, is_demo = false }) {
  if (db.find('users', x => x.username.toLowerCase() === username.toLowerCase())) throw new Error('Este nome de usuário já existe.');
  const { hash, salt } = await hashPassword(password);
  return db.insert('users', { name, username, password_hash: hash, password_salt: salt, role_id, employee_id, active: true, is_demo },
    { description: `${db.getAuditUser()?.name || 'Sistema'} criou o usuário ${username}` });
}
export async function setPassword(userId, password) {
  const { hash, salt } = await hashPassword(password);
  db.update('users', userId, { password_hash: hash, password_salt: salt, must_change_password: false },
    { description: `${db.getAuditUser()?.name || 'Sistema'} alterou a senha do usuário ${db.get('users', userId)?.username}` });
}
