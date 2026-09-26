// Banco de dados local (IndexedDB) com cópia em memória.
// - Cada tabela é um object store com chave "id".
// - Todas as alterações passam por insert/update/remove: registram auditoria,
//   atualizam updated_at e entram na fila de sincronização (outbox).
// - Exclusões são lógicas (deleted_at), preservando o histórico.

import { uuid, nowISO } from './util.js';

const DB_NAME = 'fazenda_mar_de_rosas';
const DB_VERSION = 1;

export const TABLES = [
  'settings', 'roles', 'users',
  'animals', 'animal_births', 'animal_deaths', 'animal_weights', 'animal_health', 'animal_reproduction',
  'milk_production',
  'feed_batches', 'feed_batch_items', 'feed_distribution',
  'inventory', 'inventory_movements',
  'machines', 'machine_services', 'machine_maintenance', 'fuel_records',
  'employees', 'employee_payments', 'employee_advances', 'employee_discounts',
  'alerts', 'audit_logs',
];
// Tabelas que não entram na auditoria detalhada
const NO_AUDIT = new Set(['audit_logs', 'alerts', 'settings']);

export const TABLE_LABELS = {
  roles: 'Perfil', users: 'Usuário', animals: 'Animal', animal_births: 'Nascimento', animal_deaths: 'Mortalidade',
  animal_weights: 'Pesagem', animal_health: 'Registro de saúde', animal_reproduction: 'Reprodução',
  milk_production: 'Produção de leite', feed_batches: 'Lote de ração', feed_batch_items: 'Ingrediente do lote',
  feed_distribution: 'Distribuição de ração', inventory: 'Produto', inventory_movements: 'Movimentação de estoque',
  machines: 'Máquina', machine_services: 'Serviço de máquina', machine_maintenance: 'Manutenção',
  fuel_records: 'Abastecimento', employees: 'Funcionário', employee_payments: 'Pagamento',
  employee_advances: 'Vale/adiantamento', employee_discounts: 'Desconto', settings: 'Configuração',
};

export const FIELD_LABELS = {
  name: 'nome', tag: 'brinco', sex: 'sexo', breed: 'raça', species: 'espécie', status: 'situação', category: 'categoria',
  birth_date: 'nascimento', birth_weight: 'peso ao nascer', current_weight: 'peso atual', sire_id: 'pai', dam_id: 'mãe',
  liters: 'litros', shift: 'ordenha', date: 'data', quantity: 'quantidade', weight: 'peso', notes: 'observação',
  salary: 'salário', amount: 'valor', net: 'salário líquido', hours: 'horas', hourmeter: 'horímetro',
  min_qty: 'estoque mínimo', unit_cost: 'valor unitário', quantity_kg: 'quantidade (kg)', animals_count: 'nº de animais',
  pregnancy_status: 'gestação', expected_calving: 'previsão de parto', actual_calving: 'parto', cause: 'causa',
  base_salary: 'salário base', additions: 'adicionais', discounts_value: 'descontos', payment_date: 'data de pagamento',
  balance_kg: 'saldo (kg)', active: 'ativo', role_id: 'perfil', permissions: 'permissões', bull_id: 'touro', bull_name: 'touro',
  confirmation_date: 'data do diagnóstico', type: 'tipo', description: 'descrição', product_id: 'produto', employee_id: 'funcionário',
  operator_id: 'operador', responsible_id: 'responsável', responsible: 'responsável', machine_id: 'máquina', batch_id: 'lote',
  exit_date: 'data de saída', entry_date: 'data de entrada', origin: 'origem', code: 'código', unit: 'unidade', supplier: 'fornecedor',
  location: 'localização', max_qty: 'estoque máximo', overtime_value: 'horas extras (R$)', overtime_hours: 'horas extras', vales_value: 'vales',
  advances_value: 'adiantamentos', others: 'outros', month: 'mês', installments: 'parcelas', installment_value: 'valor da parcela',
  start_time: 'início', end_time: 'fim', hourmeter_start: 'horímetro inicial', hourmeter_end: 'horímetro final', fuel_liters: 'combustível (L)',
  activity: 'atividade', area: 'área', service_type: 'tipo de serviço', next_date: 'próxima data', next_done: 'realizado', next_hourmeter: 'próximo horímetro',
  cost: 'custo', total_value: 'valor total', position: 'cargo', phone: 'telefone', cpf: 'CPF', address: 'endereço', admission_date: 'admissão',
  contract_type: 'contratação', bank: 'banco', pix: 'Pix', username: 'usuário', must_change_password: 'trocar senha',
};

const listeners = new Set();
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
let emitTimer = null; let emitTables = new Set();
function emit(table) {
  emitTables.add(table);
  clearTimeout(emitTimer);
  emitTimer = setTimeout(() => { const t = emitTables; emitTables = new Set(); listeners.forEach(fn => fn(t)); }, 30);
}

let idb = null;
const mem = {};            // table -> Map(id -> row)
let currentUser = null;    // para auditoria
let labeler = () => '';    // função (table,row) -> rótulo legível (definida pelos serviços)

export const setAuditUser = (u) => { currentUser = u; };
export const setLabeler = (fn) => { labeler = fn; };
export const getAuditUser = () => currentUser;

function reqP(req) { return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }

export async function open() {
  idb = await new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const d = r.result;
      for (const t of TABLES) if (!d.objectStoreNames.contains(t)) d.createObjectStore(t, { keyPath: 'id' });
      if (!d.objectStoreNames.contains('_outbox')) d.createObjectStore('_outbox', { keyPath: 'k' });
      if (!d.objectStoreNames.contains('_meta')) d.createObjectStore('_meta', { keyPath: 'k' });
      if (!d.objectStoreNames.contains('_snapshots')) d.createObjectStore('_snapshots', { keyPath: 'id' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const tx = idb.transaction(TABLES, 'readonly');
  await Promise.all(TABLES.map(async t => {
    const rows = await reqP(tx.objectStore(t).getAll());
    mem[t] = new Map(rows.map(r => [r.id, r]));
  }));
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
}

// ---------- Persistência em lote ----------
let pending = new Map();   // "table:id" -> {table,row}
let pendingOutbox = new Map();
let flushTimer = null;
let flushing = Promise.resolve();
function schedule() { clearTimeout(flushTimer); flushTimer = setTimeout(flush, 40); }
export function flush() {
  if (!pending.size && !pendingOutbox.size) return flushing;
  const p = pending, o = pendingOutbox; pending = new Map(); pendingOutbox = new Map();
  flushing = flushing.then(() => new Promise((res) => {
    const tx = idb.transaction([...new Set([...p.values()].map(x => x.table)), '_outbox'], 'readwrite');
    for (const { table, row } of p.values()) tx.objectStore(table).put(row);
    for (const [k, v] of o) tx.objectStore('_outbox').put({ k, ...v });
    tx.oncomplete = () => res();
    tx.onerror = () => { console.error('Erro ao gravar', tx.error); res(); };
  }));
  return flushing;
}
function persist(table, row, { sync = true } = {}) {
  pending.set(table + ':' + row.id, { table, row });
  if (sync && table !== 'alerts_local') pendingOutbox.set(table + ':' + row.id, { table, id: row.id, ts: Date.now() });
  schedule();
  emit(table);
}

// ---------- Consulta ----------
export const all = (table, { withDeleted = false } = {}) => {
  const rows = [...(mem[table]?.values() || [])];
  return withDeleted ? rows : rows.filter(r => !r.deleted_at);
};
export const get = (table, id) => (id ? mem[table]?.get(id) : null) || null;
export const DEFAULT_TS = '2000-01-01T00:00:00.000Z';
export const find = (table, pred) => all(table).find(pred) || null;
export const where = (table, pred) => all(table).filter(pred);
export const count = (table, pred = () => true) => all(table).filter(pred).length;

// ---------- Escrita ----------
function auditLog(action, table, row, description, changes) {
  if (NO_AUDIT.has(table)) return;
  const log = {
    id: uuid(), ts: nowISO(), user_id: currentUser?.id || null, user_name: currentUser?.name || 'Sistema',
    action, table_name: table, record_id: row.id, description, changes: changes || null,
    created_at: nowISO(), updated_at: nowISO(),
  };
  mem.audit_logs.set(log.id, log);
  persist('audit_logs', log);
}
// Campos que apontam para outras tabelas: mostrados pelo nome na auditoria
const REF_FIELDS = { sire_id: 'animals', dam_id: 'animals', bull_id: 'animals', animal_id: 'animals', product_id: 'inventory', employee_id: 'employees', operator_id: 'employees', responsible_id: 'employees', machine_id: 'machines', batch_id: 'feed_batches', role_id: 'roles' };
const HIDDEN_FIELDS = new Set(['photo', 'password_hash', 'password_salt', 'birth_id', 'reproduction_id', 'service_id', 'ref_id', 'updated_at', 'created_at', 'last_login']);
function fmtVal(v, k) {
  if (v == null || v === '') return 'vazio';
  if (REF_FIELDS[k]) { const r = mem[REF_FIELDS[k]]?.get(v); return r ? labeler(REF_FIELDS[k], r) : String(v); }
  if (typeof v === 'boolean') return v ? 'sim' : 'não';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) { const [y, m, d] = v.split('-'); return `${d}/${m}/${y}`; }
  if (typeof v === 'number') return String(v).replace('.', ',');
  if (typeof v === 'object') return Array.isArray(v) ? `${v.length} item(ns)` : JSON.stringify(v);
  return String(v);
}

export function insert(table, data, { audit = true, description } = {}) {
  const ts = nowISO();
  const row = { id: data.id || uuid(), ...data, created_at: data.created_at || ts, updated_at: ts, created_by: data.created_by || currentUser?.id || null };
  mem[table].set(row.id, row);
  persist(table, row);
  if (audit) auditLog('create', table, row, description || `${currentUser?.name || 'Sistema'} cadastrou ${TABLE_LABELS[table] || table}: ${labeler(table, row)}`);
  return row;
}

export function update(table, id, patch, { audit = true, description } = {}) {
  const old = mem[table].get(id);
  if (!old) throw new Error(`Registro não encontrado (${table}/${id})`);
  const changes = {};
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'updated_at') continue;
    const a = old[k], b = v;
    if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) changes[k] = [a ?? null, b ?? null];
  }
  if (!Object.keys(changes).length) return old;
  const row = { ...old, ...patch, updated_at: nowISO() };
  mem[table].set(id, row);
  persist(table, row);
  if (audit) {
    const parts = Object.entries(changes).filter(([k]) => !HIDDEN_FIELDS.has(k))
      .map(([k, [a, b]]) => k === 'photo' ? 'foto' : `${FIELD_LABELS[k] || k.replace(/_/g, ' ')} de ${fmtVal(a, k)} para ${fmtVal(b, k)}`);
    if (changes.photo) parts.push('foto alterada');
    auditLog('update', table, row, description || `${currentUser?.name || 'Sistema'} alterou ${TABLE_LABELS[table] || table} "${labeler(table, row)}"${parts.length ? ': ' + parts.join('; ') : ''}.`, changes);
  }
  return row;
}

// Exclusão lógica: o registro some das telas mas permanece no banco e na auditoria.
export function remove(table, id, { reason = '', audit = true } = {}) {
  const old = mem[table].get(id);
  if (!old) return;
  const row = { ...old, deleted_at: nowISO(), deleted_by: currentUser?.id || null, delete_reason: reason, updated_at: nowISO() };
  mem[table].set(id, row);
  persist(table, row);
  if (audit) auditLog('delete', table, row, `${currentUser?.name || 'Sistema'} excluiu ${TABLE_LABELS[table] || table} "${labeler(table, row)}"${reason ? ` (motivo: ${reason})` : ''}.`);
}

// Gravação vinda da sincronização (sem auditoria e sem nova entrada no outbox)
export function putRaw(table, row, { sync = false } = {}) {
  if (!mem[table]) return;
  mem[table].set(row.id, row);
  persist(table, row, { sync });
}

// Exclusão física (somente dados de demonstração / restauração)
export async function hardDelete(table, ids) {
  await flush();
  await new Promise((res) => {
    const tx = idb.transaction([table, '_outbox'], 'readwrite');
    for (const id of ids) { tx.objectStore(table).delete(id); tx.objectStore('_outbox').delete(table + ':' + id); mem[table].delete(id); }
    tx.oncomplete = res; tx.onerror = res;
  });
  emit(table);
}

// ---------- Configurações ----------
export const setting = (key, fallback = null) => { const r = mem.settings?.get(key); return r ? r.value : fallback; };
// ts: permite gravar valores padrão com data antiga, para que nunca sobrescrevam
// configurações feitas em outro aparelho durante a sincronização.
export function setSetting(key, value, { ts } = {}) {
  const row = { id: key, value, updated_at: ts || nowISO(), created_at: mem.settings.get(key)?.created_at || ts || nowISO() };
  mem.settings.set(key, row);
  persist('settings', row);
  return row;
}

// Contador sequencial que nunca retrocede (IDs de animais, lotes...)
export function nextCounter(key, minFrom = 0) {
  const counters = setting('counters', {});
  const n = Math.max((counters[key] || 0), minFrom) + 1;
  setSetting('counters', { ...counters, [key]: n });
  return n;
}

// ---------- Outbox / meta ----------
export async function outboxAll() {
  await flush();
  return reqP(idb.transaction('_outbox').objectStore('_outbox').getAll());
}
export async function outboxCount() { return (await outboxAll()).length; }
export async function outboxDelete(keys) {
  await new Promise((res) => { const tx = idb.transaction('_outbox', 'readwrite'); keys.forEach(k => tx.objectStore('_outbox').delete(k)); tx.oncomplete = res; tx.onerror = res; });
}
export async function metaGet(k) { const r = await reqP(idb.transaction('_meta').objectStore('_meta').get(k)); return r ? r.v : null; }
export async function metaSet(k, v) { await new Promise(res => { const tx = idb.transaction('_meta', 'readwrite'); tx.objectStore('_meta').put({ k, v }); tx.oncomplete = res; tx.onerror = res; }); }

// ---------- Backup ----------
export function exportData() {
  const data = {};
  for (const t of TABLES) data[t] = all(t, { withDeleted: true });
  return { app: 'fazenda-mar-de-rosas', version: 1, exported_at: nowISO(), data };
}

export async function importData(dump) {
  if (!dump || dump.app !== 'fazenda-mar-de-rosas' || !dump.data) throw new Error('Arquivo de backup inválido.');
  await flush();
  await new Promise((res, rej) => {
    const tx = idb.transaction([...TABLES, '_outbox'], 'readwrite');
    for (const t of TABLES) {
      const st = tx.objectStore(t); st.clear();
      mem[t] = new Map();
      for (const r of dump.data[t] || []) { st.put(r); mem[t].set(r.id, r); tx.objectStore('_outbox').put({ k: t + ':' + r.id, table: t, id: r.id, ts: Date.now() }); }
    }
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
  TABLES.forEach(emit);
}

export async function saveSnapshot(kind = 'auto') {
  await flush();
  const snap = { id: nowISO(), kind, dump: exportData() };
  const store = () => idb.transaction('_snapshots', 'readwrite').objectStore('_snapshots');
  await reqP(store().put(snap));
  // mantém somente os 10 mais recentes
  const keys = (await reqP(idb.transaction('_snapshots').objectStore('_snapshots').getAllKeys())).sort();
  const extra = keys.slice(0, Math.max(0, keys.length - 10));
  if (extra.length) await new Promise(res => { const tx = idb.transaction('_snapshots', 'readwrite'); extra.forEach(k => tx.objectStore('_snapshots').delete(k)); tx.oncomplete = res; });
  setSetting('last_backup', { at: snap.id, kind });
  return snap;
}
export async function listSnapshots() {
  const rows = await reqP(idb.transaction('_snapshots').objectStore('_snapshots').getAll());
  return rows.map(s => ({ id: s.id, kind: s.kind, size: JSON.stringify(s.dump).length })).sort((a, b) => b.id.localeCompare(a.id));
}
export async function getSnapshot(id) { return reqP(idb.transaction('_snapshots').objectStore('_snapshots').get(id)); }

export async function wipeAll() {
  await flush();
  await new Promise(res => {
    const tx = idb.transaction([...TABLES, '_outbox', '_meta'], 'readwrite');
    for (const t of [...TABLES, '_outbox', '_meta']) tx.objectStore(t).clear();
    tx.oncomplete = res;
  });
  for (const t of TABLES) mem[t] = new Map();
}
