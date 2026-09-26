// Gera docs/schema.sql (PostgreSQL / Supabase) a partir de js/schema.js.
// Uso: node tools/gen-schema.mjs
import { SCHEMA, columnsOf } from '../js/schema.js';
import { writeFileSync } from 'fs';

const TYPES = { text: 'text', int: 'integer', num: 'numeric', date: 'date', time: 'time', ts: 'timestamptz', bool: 'boolean', json: 'jsonb' };
const out = [];
const w = (s = '') => out.push(s);

w('-- =====================================================================');
w('-- FAZENDA MAR DE ROSAS — Banco de dados do servidor de sincronização');
w('-- PostgreSQL 14+ / Supabase. Gerado por tools/gen-schema.mjs a partir de js/schema.js');
w('-- NÃO edite à mão: altere js/schema.js e gere novamente.');
w('--');
w('-- Como usar no Supabase: SQL Editor → cole este arquivo → Run.');
w('-- Depois crie, em Authentication → Users, o usuário (e-mail/senha) de sincronização.');
w('--');
w('-- Observações de projeto:');
w('--  * Chaves primárias são UUID em texto, geradas no aparelho (funciona offline).');
w('--  * Relacionamentos (colunas *_id) são documentados com COMMENT e indexados. A integridade');
w('--    é garantida pelo aplicativo: aparelhos offline podem enviar registros relacionados em');
w('--    ordens diferentes, então o servidor não bloqueia por chave estrangeira.');
w('--  * Nada é apagado: exclusões são lógicas (deleted_at). A política RLS não permite DELETE.');
w('--  * "extra" guarda campos futuros sem precisar alterar o banco.');
w('--  * Conflitos: vence a versão com updated_at mais recente (gatilho fmr_before_write).');
w('-- =====================================================================');
w();
w(`create or replace function fmr_before_write() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.updated_at is not null and old.updated_at is not null and new.updated_at < old.updated_at then
    return null; -- mantém a versão mais recente já gravada
  end if;
  new.synced_at := clock_timestamp();
  return new;
end $$;`);
w();

const refs = [];
for (const [t, def] of Object.entries(SCHEMA)) {
  w(`-- ${def._doc}`);
  w(`create table if not exists ${t} (`);
  const lines = [];
  for (const c of columnsOf(t)) {
    const [type, mod] = def[c].split(' ');
    let sql = `  ${c.padEnd(22)} ${TYPES[type] || 'text'}`;
    if (mod === 'pk') sql += ' primary key';
    if (type === 'ref') refs.push([t, c, mod]);
    if (c === 'is_demo') sql += ' default false';
    lines.push(sql);
  }
  lines.push(`  ${'extra'.padEnd(22)} jsonb`);
  lines.push(`  ${'synced_at'.padEnd(22)} timestamptz not null default clock_timestamp()`);
  w(lines.join(',\n'));
  w(');');
  w(`comment on table ${t} is '${def._doc.replace(/'/g, "''")}';`);
  w(`create index if not exists ${t}_synced_at_idx on ${t} (synced_at);`);
  for (const c of columnsOf(t)) {
    const [type, mod] = def[c].split(' ');
    if (mod === 'unique') w(`create ${c === 'username' ? 'unique ' : ''}index if not exists ${t}_${c}_idx on ${t} (${c})${c === 'username' ? ' where deleted_at is null' : ''};`);
  }
  if (columnsOf(t).includes('date')) w(`create index if not exists ${t}_date_idx on ${t} (date);`);
  w(`drop trigger if exists ${t}_before_write on ${t};`);
  w(`create trigger ${t}_before_write before insert or update on ${t} for each row execute function fmr_before_write();`);
  w(`alter table ${t} enable row level security;`);
  w(`drop policy if exists ${t}_read on ${t};`);
  w(`drop policy if exists ${t}_insert on ${t};`);
  w(`drop policy if exists ${t}_update on ${t};`);
  w(`create policy ${t}_read on ${t} for select to authenticated using (true);`);
  w(`create policy ${t}_insert on ${t} for insert to authenticated with check (true);`);
  w(`create policy ${t}_update on ${t} for update to authenticated using (true) with check (true);`);
  w();
}
w('-- ---------------------------------------------------------------------');
w('-- Relacionamentos (chaves estrangeiras lógicas)');
w('-- ---------------------------------------------------------------------');
for (const [t, c, target] of refs) {
  w(`comment on column ${t}.${c} is 'FK → ${target}.id';`);
  w(`create index if not exists ${t}_${c}_idx on ${t} (${c});`);
}
w();
w('-- Leitura/escrita apenas para usuários autenticados (a chave anon sozinha não acessa nada).');
w(`grant select, insert, update on all tables in schema public to authenticated;`);
w(`revoke all on all tables in schema public from anon;`);
writeFileSync(new URL('../docs/schema.sql', import.meta.url), out.join('\n') + '\n');
console.log('docs/schema.sql gerado:', Object.keys(SCHEMA).length, 'tabelas,', refs.length, 'relacionamentos');
