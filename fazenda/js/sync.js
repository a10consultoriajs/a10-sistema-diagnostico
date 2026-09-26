// Sincronização opcional com servidor (Supabase/PostgreSQL) — permite usar o sistema
// em vários aparelhos. O aparelho continua sendo a fonte principal: tudo é gravado
// primeiro localmente (funciona offline) e enviado quando houver internet.
// Conflitos: vence a alteração mais recente (updated_at).
import * as db from './db.js';
import { SCHEMA, columnsOf } from './schema.js';

const CFG_KEY = 'fmr_sync';
let st = { syncing: false, last: null, error: null };
let timer = null, onStatus = () => { };

export const config = () => { try { return JSON.parse(localStorage.getItem(CFG_KEY) || 'null'); } catch { return null; } };
export const enabled = () => !!config()?.url && !!config()?.refresh_token;
export const state = () => ({ ...st });
const saveCfg = (c) => localStorage.setItem(CFG_KEY, JSON.stringify(c));
export const disconnect = () => { localStorage.removeItem(CFG_KEY); st = { syncing: false, last: null, error: null }; onStatus(); };

async function authRequest(c, body, grant) {
  const r = await fetch(`${c.url}/auth/v1/token?grant_type=${grant}`, { method: 'POST', headers: { apikey: c.key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error_description || j.msg || j.message || `Falha na autenticação (${r.status})`);
  return { ...c, access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + (j.expires_in - 60) * 1000 };
}
// Conecta com e-mail/senha da conta de sincronização (a senha não é guardada; só o token)
export async function connect({ url, key, email, password }) {
  url = url.replace(/\/+$/, '');
  const c = await authRequest({ url, key, email }, { email, password }, 'password');
  saveCfg(c);
  await syncNow(true);
  return c;
}
async function token() {
  let c = config();
  if (!c) throw new Error('Sincronização não configurada');
  if (!c.access_token || Date.now() > c.expires_at) { c = await authRequest(c, { refresh_token: c.refresh_token }, 'refresh_token'); saveCfg(c); }
  return c;
}
async function api(path, opts = {}) {
  const c = await token();
  const r = await fetch(`${c.url}/rest/v1/${path}`, { ...opts, headers: { apikey: c.key, Authorization: `Bearer ${c.access_token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  if (!r.ok) { const t = await r.text(); throw new Error(`Servidor: ${r.status} ${t.slice(0, 200)}`); }
  return r.status === 204 ? null : r.json().catch(() => null);
}

// Linha local -> linha do servidor (colunas conhecidas + "extra" jsonb com o resto)
// Todas as linhas levam o mesmo conjunto de colunas (exigência do envio em lote do PostgREST).
function toRemote(table, row) {
  const cols = columnsOf(table), out = {}, extra = {};
  for (const c of cols) out[c] = row[c] === '' || row[c] === undefined ? null : row[c];
  for (const [k, v] of Object.entries(row)) if (!cols.includes(k) && v !== undefined) extra[k] = v;
  out.extra = Object.keys(extra).length ? extra : null;
  return out;
}
function fromRemote(row) {
  const { extra, synced_at, ...rest } = row;
  for (const k of Object.keys(rest)) if (rest[k] === null) delete rest[k];
  return { ...rest, ...(extra || {}) };
}

async function push() {
  const box = await db.outboxAll();
  if (!box.length) return 0;
  const order = Object.keys(SCHEMA);
  const byTable = new Map();
  for (const o of box) { if (!byTable.has(o.table)) byTable.set(o.table, []); byTable.get(o.table).push(o); }
  let sent = 0;
  for (const t of order) {
    const items = byTable.get(t); if (!items) continue;
    for (let i = 0; i < items.length; i += 200) {
      const chunk = items.slice(i, i + 200);
      const rows = chunk.map(o => db.get(t, o.id)).filter(Boolean).map(r => toRemote(t, r));
      if (rows.length) await api(`${t}?on_conflict=id`, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows) });
      await db.outboxDelete(chunk.map(o => o.k));
      sent += rows.length;
    }
  }
  return sent;
}

async function pull() {
  let got = 0;
  for (const t of Object.keys(SCHEMA)) {
    // volta 2 minutos para não perder registros gravados em transações concorrentes (reaplicar é inofensivo)
    const last = await db.metaGet('pull:' + t);
    let since = last ? new Date(new Date(last).getTime() - 120000).toISOString() : '1970-01-01T00:00:00Z';
    for (; ;) {
      const rows = await api(`${t}?synced_at=gt.${encodeURIComponent(since)}&order=synced_at.asc&limit=1000`);
      if (!rows?.length) break;
      for (const r of rows) {
        const remote = fromRemote(r);
        const local = db.get(t, remote.id);
        if (!local || (remote.updated_at || '') > (local.updated_at || '')) { db.putRaw(t, remote); got++; }
      }
      since = rows[rows.length - 1].synced_at;
      await db.metaSet('pull:' + t, since);
      if (rows.length < 1000) break;
    }
  }
  return got;
}

export async function syncNow(force = false) {
  if (!enabled() || st.syncing || (!navigator.onLine && !force)) return;
  st.syncing = true; onStatus();
  try {
    // baixa primeiro (um aparelho novo recebe as configurações reais antes de enviar as suas padrão);
    // o servidor também só aceita a versão mais recente de cada registro (gatilho em schema.sql)
    await pull();
    await push();
    st.last = new Date().toISOString(); st.error = null;
  } catch (e) { st.error = e.message; console.warn('sync', e); }
  finally { st.syncing = false; onStatus(); }
}

export function init(statusCb) {
  onStatus = statusCb || onStatus;
  clearInterval(timer);
  if (!enabled()) return;
  syncNow();
  timer = setInterval(syncNow, 60000);
  let deb;
  db.onChange(() => { clearTimeout(deb); deb = setTimeout(syncNow, 5000); });
}
