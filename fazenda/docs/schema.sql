-- =====================================================================
-- FAZENDA MAR DE ROSAS — Banco de dados do servidor de sincronização
-- PostgreSQL 14+ / Supabase. Gerado por tools/gen-schema.mjs a partir de js/schema.js
-- NÃO edite à mão: altere js/schema.js e gere novamente.
--
-- Como usar no Supabase: SQL Editor → cole este arquivo → Run.
-- Depois crie, em Authentication → Users, o usuário (e-mail/senha) de sincronização.
--
-- Observações de projeto:
--  * Chaves primárias são UUID em texto, geradas no aparelho (funciona offline).
--  * Relacionamentos (colunas *_id) são documentados com COMMENT e indexados. A integridade
--    é garantida pelo aplicativo: aparelhos offline podem enviar registros relacionados em
--    ordens diferentes, então o servidor não bloqueia por chave estrangeira.
--  * Nada é apagado: exclusões são lógicas (deleted_at). A política RLS não permite DELETE.
--  * "extra" guarda campos futuros sem precisar alterar o banco.
--  * Conflitos: vence a versão com updated_at mais recente (gatilho fmr_before_write).
-- =====================================================================

create or replace function fmr_before_write() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.updated_at is not null and old.updated_at is not null and new.updated_at < old.updated_at then
    return null; -- mantém a versão mais recente já gravada
  end if;
  new.synced_at := clock_timestamp();
  return new;
end $$;

-- Configurações (chave/valor)
create table if not exists settings (
  id                     text primary key,
  value                  jsonb,
  created_at             timestamptz,
  updated_at             timestamptz,
  extra                  jsonb,
  synced_at              timestamptz not null default clock_timestamp()
);
comment on table settings is 'Configurações (chave/valor)';
create index if not exists settings_synced_at_idx on settings (synced_at);
drop trigger if exists settings_before_write on settings;
create trigger settings_before_write before insert or update on settings for each row execute function fmr_before_write();
alter table settings enable row level security;
drop policy if exists settings_read on settings;
drop policy if exists settings_insert on settings;
drop policy if exists settings_update on settings;
create policy settings_read on settings for select to authenticated using (true);
create policy settings_insert on settings for insert to authenticated with check (true);
create policy settings_update on settings for update to authenticated using (true) with check (true);

-- Perfis de acesso
create table if not exists roles (
  id                     text primary key,
  created_at             timestamptz,
  updated_at             timestamptz,
  created_by             text,
  deleted_at             timestamptz,
  deleted_by             text,
  delete_reason          text,
  is_demo                boolean default false,
  name                   text,
  description            text,
  system                 boolean,
  permissions            jsonb,
  extra                  jsonb,
  synced_at              timestamptz not null default clock_timestamp()
);
comment on table roles is 'Perfis de acesso';
create index if not exists roles_synced_at_idx on roles (synced_at);
drop trigger if exists roles_before_write on roles;
create trigger roles_before_write before insert or update on roles for each row execute function fmr_before_write();
alter table roles enable row level security;
drop policy if exists roles_read on roles;
drop policy if exists roles_insert on roles;
drop policy if exists roles_update on roles;
create policy roles_read on roles for select to authenticated using (true);
create policy roles_insert on roles for insert to authenticated with check (true);
create policy roles_update on roles for update to authenticated using (true) with check (true);

-- Usuários do sistema
create table if not exists users (
  id                     text primary key,
  created_at             timestamptz,
  updated_at             timestamptz,
  created_by             text,
  deleted_at             timestamptz,
  deleted_by             text,
  delete_reason          text,
  is_demo                boolean default false,
  name                   text,
  username               text,
  password_hash          text,
  password_salt          text,
  role_id                text,
  employee_id            text,
  active                 boolean,
  last_login             timestamptz,
  must_change_password   boolean,
  extra                  jsonb,
  synced_at              timestamptz not null default clock_timestamp()
);
comment on table users is 'Usuários do sistema';
create index if not exists users_synced_at_idx on users (synced_at);
create unique index if not exists users_username_idx on users (username) where deleted_at is null;
drop trigger if exists users_before_write on users;
create trigger users_before_write before insert or update on users for each row execute function fmr_before_write();
alter table users enable row level security;
drop policy if exists users_read on users;
drop policy if exists users_insert on users;
drop policy if exists users_update on users;
create policy users_read on users for select to authenticated using (true);
create policy users_insert on users for insert to authenticated with check (true);
create policy users_update on users for update to authenticated using (true) with check (true);

-- Rebanho — identidade digital de cada animal
create table if not exists animals (
  id                     text primary key,
  created_at             timestamptz,
  updated_at             timestamptz,
  created_by             text,
  deleted_at             timestamptz,
  deleted_by             text,
  delete_reason          text,
  is_demo                boolean default false,
  code                   integer,
  tag                    text,
  name                   text,
  sex                    text,
  species                text,
  breed                  text,
  category               text,
  birth_date             date,
  birth_weight           numeric,
  current_weight         numeric,
  sire_id                text,
  dam_id                 text,
  sire_name              text,
  dam_name               text,
  entry_date             date,
  origin                 text,
  status                 text,
  exit_date              date,
  photo                  text,
  notes                  text,
  extra                  jsonb,
  synced_at              timestamptz not null default clock_timestamp()
);
comment on table animals is 'Rebanho — identidade digital de cada animal';
create index if not exists animals_synced_at_idx on animals (synced_at);
create index if not exists animals_code_idx on animals (code);
drop trigger if exists animals_before_write on animals;
create trigger animals_before_write before insert or update on animals for each row execute function fmr_before_write();
alter table animals enable row level security;
drop policy if exists animals_read on animals;
drop policy if exists animals_insert on animals;
drop policy if exists animals_update on animals;
create policy animals_read on animals for select to authenticated using (true);
create policy animals_insert on animals for insert to authenticated with check (true);
create policy animals_update on animals for update to authenticated using (true) with check (true);

-- Nascimentos (cria → animal)
create table if not exists animal_births (
  id                     text primary key,
  created_at             timestamptz,
  updated_at             timestamptz,
  created_by             text,
  deleted_at             timestamptz,
  deleted_by             text,
  delete_reason          text,
  is_demo                boolean default false,
  number                 integer,
  animal_id              text,
  birth_date             date,
  sire_id                text,
  dam_id                 text,
  sire_name              text,
  dam_name               text,
  weight                 numeric,
  responsible            text,
  reproduction_id        text,
  notes                  text,
  extra                  jsonb,
  synced_at              timestamptz not null default clock_timestamp()
);
comment on table animal_births is 'Nascimentos (cria → animal)';
create index if not exists animal_births_synced_at_idx on animal_births (synced_at);
drop trigger if exists animal_births_before_write on animal_births;
create trigger animal_births_before_write before insert or update on animal_births for each row execute function fmr_before_write();
alter table animal_births enable row level security;
drop policy if exists animal_births_read on animal_births;
drop policy if exists animal_births_insert on animal_births;
drop policy if exists animal_births_update on animal_births;
create policy animal_births_read on animal_births for select to authenticated using (true);
create policy animal_births_insert on animal_births for insert to authenticated with check (true);
create policy animal_births_update on animal_births for update to authenticated using (true) with check (true);

-- Mortalidade
create table if not exists animal_deaths (
  id                     text primary key,
  created_at             timestamptz,
  updated_at             timestamptz,
  created_by             text,
  deleted_at             timestamptz,
  deleted_by             text,
  delete_reason          text,
  is_demo                boolean default false,
  animal_id              text,
  date                   date,
  age_days               integer,
  cause                  text,
  responsible            text,
  notes                  text,
  extra                  jsonb,
  synced_at              timestamptz not null default clock_timestamp()
);
comment on table animal_deaths is 'Mortalidade';
create index if not exists animal_deaths_synced_at_idx on animal_deaths (synced_at);
create index if not exists animal_deaths_date_idx on animal_deaths (date);
drop trigger if exists animal_deaths_before_write on animal_deaths;
create trigger animal_deaths_before_write before insert or update on animal_deaths for each row execute function fmr_before_write();
alter table animal_deaths enable row level security;
drop policy if exists animal_deaths_read on animal_deaths;
drop policy if exists animal_deaths_insert on animal_deaths;
drop policy if exists animal_deaths_update on animal_deaths;
create policy animal_deaths_read on animal_deaths for select to authenticated using (true);
create policy animal_deaths_insert on animal_deaths for insert to authenticated with check (true);
create policy animal_deaths_update on animal_deaths for update to authenticated using (true) with check (true);

-- Pesagens
create table if not exists animal_weights (
  id                     text primary key,
  created_at             timestamptz,
  updated_at             timestamptz,
  created_by             text,
  deleted_at             timestamptz,
  deleted_by             text,
  delete_reason          text,
  is_demo                boolean default false,
  animal_id              text,
  date                   date,
  weight                 numeric,
  age_days               integer,
  responsible            text,
  notes                  text,
  extra                  jsonb,
  synced_at              timestamptz not null default clock_timestamp()
);
comment on table animal_weights is 'Pesagens';
create index if not exists animal_weights_synced_at_idx on animal_weights (synced_at);
create index if not exists animal_weights_date_idx on animal_weights (date);
drop trigger if exists animal_weights_before_write on animal_weights;
create trigger animal_weights_before_write before insert or update on animal_weights for each row execute function fmr_before_write();
alter table animal_weights enable row level security;
drop policy if exists animal_weights_read on animal_weights;
drop policy if exists animal_weights_insert on animal_weights;
drop policy if exists animal_weights_update on animal_weights;
create policy animal_weights_read on animal_weights for select to authenticated using (true);
create policy animal_weights_insert on animal_weights for insert to authenticated with check (true);
create policy animal_weights_update on animal_weights for update to authenticated using (true) with check (true);

-- Saúde: vacinações, medicamentos, tratamentos, doenças, consultas (campo type)
create table if not exists animal_health (
  id                     text primary key,
  created_at             timestamptz,
  updated_at             timestamptz,
  created_by             text,
  deleted_at             timestamptz,
  deleted_by             text,
  delete_reason          text,
  is_demo                boolean default false,
  animal_id              text,
  type                   text,
  date                   date,
  description            text,
  product_id             text,
  quantity               numeric,
  cost                   numeric,
  responsible            text,
  next_date              date,
  next_done              boolean,
  notes                  text,
  extra                  jsonb,
  synced_at              timestamptz not null default clock_timestamp()
);
comment on table animal_health is 'Saúde: vacinações, medicamentos, tratamentos, doenças, consultas (campo type)';
create index if not exists animal_health_synced_at_idx on animal_health (synced_at);
create index if not exists animal_health_date_idx on animal_health (date);
drop trigger if exists animal_health_before_write on animal_health;
create trigger animal_health_before_write before insert or update on animal_health for each row execute function fmr_before_write();
alter table animal_health enable row level security;
drop policy if exists animal_health_read on animal_health;
drop policy if exists animal_health_insert on animal_health;
drop policy if exists animal_health_update on animal_health;
create policy animal_health_read on animal_health for select to authenticated using (true);
create policy animal_health_insert on animal_health for insert to authenticated with check (true);
create policy animal_health_update on animal_health for update to authenticated using (true) with check (true);

-- Reprodução: coberturas, inseminações, gestação e parto
create table if not exists animal_reproduction (
  id                     text primary key,
  created_at             timestamptz,
  updated_at             timestamptz,
  created_by             text,
  deleted_at             timestamptz,
  deleted_by             text,
  delete_reason          text,
  is_demo                boolean default false,
  animal_id              text,
  date                   date,
  type                   text,
  bull_id                text,
  bull_name              text,
  responsible            text,
  pregnancy_status       text,
  confirmation_date      date,
  expected_calving       date,
  actual_calving         date,
  birth_id               text,
  notes                  text,
  extra                  jsonb,
  synced_at              timestamptz not null default clock_timestamp()
);
comment on table animal_reproduction is 'Reprodução: coberturas, inseminações, gestação e parto';
create index if not exists animal_reproduction_synced_at_idx on animal_reproduction (synced_at);
create index if not exists animal_reproduction_date_idx on animal_reproduction (date);
drop trigger if exists animal_reproduction_before_write on animal_reproduction;
create trigger animal_reproduction_before_write before insert or update on animal_reproduction for each row execute function fmr_before_write();
alter table animal_reproduction enable row level security;
drop policy if exists animal_reproduction_read on animal_reproduction;
drop policy if exists animal_reproduction_insert on animal_reproduction;
drop policy if exists animal_reproduction_update on animal_reproduction;
create policy animal_reproduction_read on animal_reproduction for select to authenticated using (true);
create policy animal_reproduction_insert on animal_reproduction for insert to authenticated with check (true);
create policy animal_reproduction_update on animal_reproduction for update to authenticated using (true) with check (true);

-- Produção de leite — 1 linha por animal/data/ordenha
create table if not exists milk_production (
  id                     text primary key,
  created_at             timestamptz,
  updated_at             timestamptz,
  created_by             text,
  deleted_at             timestamptz,
  deleted_by             text,
  delete_reason          text,
  is_demo                boolean default false,
  date                   date,
  animal_id              text,
  shift                  text,
  liters                 numeric,
  responsible            text,
  notes                  text,
  extra                  jsonb,
  synced_at              timestamptz not null default clock_timestamp()
);
comment on table milk_production is 'Produção de leite — 1 linha por animal/data/ordenha';
create index if not exists milk_production_synced_at_idx on milk_production (synced_at);
create index if not exists milk_production_date_idx on milk_production (date);
drop trigger if exists milk_production_before_write on milk_production;
create trigger milk_production_before_write before insert or update on milk_production for each row execute function fmr_before_write();
alter table milk_production enable row level security;
drop policy if exists milk_production_read on milk_production;
drop policy if exists milk_production_insert on milk_production;
drop policy if exists milk_production_update on milk_production;
create policy milk_production_read on milk_production for select to authenticated using (true);
create policy milk_production_insert on milk_production for insert to authenticated with check (true);
create policy milk_production_update on milk_production for update to authenticated using (true) with check (true);

-- Produtos do estoque (inclui ingredientes de ração)
create table if not exists inventory (
  id                     text primary key,
  created_at             timestamptz,
  updated_at             timestamptz,
  created_by             text,
  deleted_at             timestamptz,
  deleted_by             text,
  delete_reason          text,
  is_demo                boolean default false,
  code                   text,
  name                   text,
  category               text,
  unit                   text,
  unit_weight_kg         numeric,
  quantity               numeric,
  min_qty                numeric,
  max_qty                numeric,
  unit_cost              numeric,
  supplier               text,
  location               text,
  active                 boolean,
  notes                  text,
  extra                  jsonb,
  synced_at              timestamptz not null default clock_timestamp()
);
comment on table inventory is 'Produtos do estoque (inclui ingredientes de ração)';
create index if not exists inventory_synced_at_idx on inventory (synced_at);
drop trigger if exists inventory_before_write on inventory;
create trigger inventory_before_write before insert or update on inventory for each row execute function fmr_before_write();
alter table inventory enable row level security;
drop policy if exists inventory_read on inventory;
drop policy if exists inventory_insert on inventory;
drop policy if exists inventory_update on inventory;
create policy inventory_read on inventory for select to authenticated using (true);
create policy inventory_insert on inventory for insert to authenticated with check (true);
create policy inventory_update on inventory for update to authenticated using (true) with check (true);

-- Entradas, saídas e ajustes de estoque (ref_table/ref_id = origem automática)
create table if not exists inventory_movements (
  id                     text primary key,
  created_at             timestamptz,
  updated_at             timestamptz,
  created_by             text,
  deleted_at             timestamptz,
  deleted_by             text,
  delete_reason          text,
  is_demo                boolean default false,
  product_id             text,
  date                   date,
  type                   text,
  quantity               numeric,
  unit_cost              numeric,
  total                  numeric,
  supplier               text,
  invoice                text,
  destination            text,
  reason                 text,
  responsible            text,
  ref_table              text,
  ref_id                 text,
  notes                  text,
  extra                  jsonb,
  synced_at              timestamptz not null default clock_timestamp()
);
comment on table inventory_movements is 'Entradas, saídas e ajustes de estoque (ref_table/ref_id = origem automática)';
create index if not exists inventory_movements_synced_at_idx on inventory_movements (synced_at);
create index if not exists inventory_movements_date_idx on inventory_movements (date);
drop trigger if exists inventory_movements_before_write on inventory_movements;
create trigger inventory_movements_before_write before insert or update on inventory_movements for each row execute function fmr_before_write();
alter table inventory_movements enable row level security;
drop policy if exists inventory_movements_read on inventory_movements;
drop policy if exists inventory_movements_insert on inventory_movements;
drop policy if exists inventory_movements_update on inventory_movements;
create policy inventory_movements_read on inventory_movements for select to authenticated using (true);
create policy inventory_movements_insert on inventory_movements for insert to authenticated with check (true);
create policy inventory_movements_update on inventory_movements for update to authenticated using (true) with check (true);

-- Lotes de ração (batidas da fábrica)
create table if not exists feed_batches (
  id                     text primary key,
  created_at             timestamptz,
  updated_at             timestamptz,
  created_by             text,
  deleted_at             timestamptz,
  deleted_by             text,
  delete_reason          text,
  is_demo                boolean default false,
  lot_number             text,
  date                   date,
  time                   time,
  operator_id            text,
  feed_type              text,
  total_kg               numeric,
  balance_kg             numeric,
  cost_total             numeric,
  cost_per_kg            numeric,
  notes                  text,
  extra                  jsonb,
  synced_at              timestamptz not null default clock_timestamp()
);
comment on table feed_batches is 'Lotes de ração (batidas da fábrica)';
create index if not exists feed_batches_synced_at_idx on feed_batches (synced_at);
create index if not exists feed_batches_lot_number_idx on feed_batches (lot_number);
create index if not exists feed_batches_date_idx on feed_batches (date);
drop trigger if exists feed_batches_before_write on feed_batches;
create trigger feed_batches_before_write before insert or update on feed_batches for each row execute function fmr_before_write();
alter table feed_batches enable row level security;
drop policy if exists feed_batches_read on feed_batches;
drop policy if exists feed_batches_insert on feed_batches;
drop policy if exists feed_batches_update on feed_batches;
create policy feed_batches_read on feed_batches for select to authenticated using (true);
create policy feed_batches_insert on feed_batches for insert to authenticated with check (true);
create policy feed_batches_update on feed_batches for update to authenticated using (true) with check (true);

-- Composição de cada lote
create table if not exists feed_batch_items (
  id                     text primary key,
  created_at             timestamptz,
  updated_at             timestamptz,
  created_by             text,
  deleted_at             timestamptz,
  deleted_by             text,
  delete_reason          text,
  is_demo                boolean default false,
  batch_id               text,
  product_id             text,
  quantity               numeric,
  kg                     numeric,
  unit_cost              numeric,
  extra                  jsonb,
  synced_at              timestamptz not null default clock_timestamp()
);
comment on table feed_batch_items is 'Composição de cada lote';
create index if not exists feed_batch_items_synced_at_idx on feed_batch_items (synced_at);
drop trigger if exists feed_batch_items_before_write on feed_batch_items;
create trigger feed_batch_items_before_write before insert or update on feed_batch_items for each row execute function fmr_before_write();
alter table feed_batch_items enable row level security;
drop policy if exists feed_batch_items_read on feed_batch_items;
drop policy if exists feed_batch_items_insert on feed_batch_items;
drop policy if exists feed_batch_items_update on feed_batch_items;
create policy feed_batch_items_read on feed_batch_items for select to authenticated using (true);
create policy feed_batch_items_insert on feed_batch_items for insert to authenticated with check (true);
create policy feed_batch_items_update on feed_batch_items for update to authenticated using (true) with check (true);

-- Distribuição de ração ao rebanho
create table if not exists feed_distribution (
  id                     text primary key,
  created_at             timestamptz,
  updated_at             timestamptz,
  created_by             text,
  deleted_at             timestamptz,
  deleted_by             text,
  delete_reason          text,
  is_demo                boolean default false,
  date                   date,
  responsible_id         text,
  batch_id               text,
  feed_type              text,
  quantity_kg            numeric,
  animals_count          integer,
  kg_per_animal          numeric,
  area                   text,
  herd_category          text,
  notes                  text,
  extra                  jsonb,
  synced_at              timestamptz not null default clock_timestamp()
);
comment on table feed_distribution is 'Distribuição de ração ao rebanho';
create index if not exists feed_distribution_synced_at_idx on feed_distribution (synced_at);
create index if not exists feed_distribution_date_idx on feed_distribution (date);
drop trigger if exists feed_distribution_before_write on feed_distribution;
create trigger feed_distribution_before_write before insert or update on feed_distribution for each row execute function fmr_before_write();
alter table feed_distribution enable row level security;
drop policy if exists feed_distribution_read on feed_distribution;
drop policy if exists feed_distribution_insert on feed_distribution;
drop policy if exists feed_distribution_update on feed_distribution;
create policy feed_distribution_read on feed_distribution for select to authenticated using (true);
create policy feed_distribution_insert on feed_distribution for insert to authenticated with check (true);
create policy feed_distribution_update on feed_distribution for update to authenticated using (true) with check (true);

-- Máquinas
create table if not exists machines (
  id                     text primary key,
  created_at             timestamptz,
  updated_at             timestamptz,
  created_by             text,
  deleted_at             timestamptz,
  deleted_by             text,
  delete_reason          text,
  is_demo                boolean default false,
  name                   text,
  type                   text,
  brand                  text,
  model                  text,
  year                   integer,
  identification         text,
  hourmeter              numeric,
  fuel_type              text,
  status                 text,
  responsible_id         text,
  notes                  text,
  extra                  jsonb,
  synced_at              timestamptz not null default clock_timestamp()
);
comment on table machines is 'Máquinas';
create index if not exists machines_synced_at_idx on machines (synced_at);
drop trigger if exists machines_before_write on machines;
create trigger machines_before_write before insert or update on machines for each row execute function fmr_before_write();
alter table machines enable row level security;
drop policy if exists machines_read on machines;
drop policy if exists machines_insert on machines;
drop policy if exists machines_update on machines;
create policy machines_read on machines for select to authenticated using (true);
create policy machines_insert on machines for insert to authenticated with check (true);
create policy machines_update on machines for update to authenticated using (true) with check (true);

-- Serviços de máquina (controle do tratorista)
create table if not exists machine_services (
  id                     text primary key,
  created_at             timestamptz,
  updated_at             timestamptz,
  created_by             text,
  deleted_at             timestamptz,
  deleted_by             text,
  delete_reason          text,
  is_demo                boolean default false,
  date                   date,
  machine_id             text,
  operator_id            text,
  service_type           text,
  activity               text,
  area                   text,
  start_time             time,
  end_time               time,
  hours                  numeric,
  hourmeter_start        numeric,
  hourmeter_end          numeric,
  fuel_liters            numeric,
  notes                  text,
  extra                  jsonb,
  synced_at              timestamptz not null default clock_timestamp()
);
comment on table machine_services is 'Serviços de máquina (controle do tratorista)';
create index if not exists machine_services_synced_at_idx on machine_services (synced_at);
create index if not exists machine_services_date_idx on machine_services (date);
drop trigger if exists machine_services_before_write on machine_services;
create trigger machine_services_before_write before insert or update on machine_services for each row execute function fmr_before_write();
alter table machine_services enable row level security;
drop policy if exists machine_services_read on machine_services;
drop policy if exists machine_services_insert on machine_services;
drop policy if exists machine_services_update on machine_services;
create policy machine_services_read on machine_services for select to authenticated using (true);
create policy machine_services_insert on machine_services for insert to authenticated with check (true);
create policy machine_services_update on machine_services for update to authenticated using (true) with check (true);

-- Manutenções
create table if not exists machine_maintenance (
  id                     text primary key,
  created_at             timestamptz,
  updated_at             timestamptz,
  created_by             text,
  deleted_at             timestamptz,
  deleted_by             text,
  delete_reason          text,
  is_demo                boolean default false,
  machine_id             text,
  date                   date,
  type                   text,
  description            text,
  parts                  text,
  product_id             text,
  product_qty            numeric,
  cost                   numeric,
  hourmeter              numeric,
  responsible            text,
  next_date              date,
  next_hourmeter         numeric,
  notes                  text,
  extra                  jsonb,
  synced_at              timestamptz not null default clock_timestamp()
);
comment on table machine_maintenance is 'Manutenções';
create index if not exists machine_maintenance_synced_at_idx on machine_maintenance (synced_at);
create index if not exists machine_maintenance_date_idx on machine_maintenance (date);
drop trigger if exists machine_maintenance_before_write on machine_maintenance;
create trigger machine_maintenance_before_write before insert or update on machine_maintenance for each row execute function fmr_before_write();
alter table machine_maintenance enable row level security;
drop policy if exists machine_maintenance_read on machine_maintenance;
drop policy if exists machine_maintenance_insert on machine_maintenance;
drop policy if exists machine_maintenance_update on machine_maintenance;
create policy machine_maintenance_read on machine_maintenance for select to authenticated using (true);
create policy machine_maintenance_insert on machine_maintenance for insert to authenticated with check (true);
create policy machine_maintenance_update on machine_maintenance for update to authenticated using (true) with check (true);

-- Abastecimentos
create table if not exists fuel_records (
  id                     text primary key,
  created_at             timestamptz,
  updated_at             timestamptz,
  created_by             text,
  deleted_at             timestamptz,
  deleted_by             text,
  delete_reason          text,
  is_demo                boolean default false,
  date                   date,
  machine_id             text,
  fuel_type              text,
  liters                 numeric,
  total_value            numeric,
  responsible            text,
  hourmeter              numeric,
  product_id             text,
  service_id             text,
  notes                  text,
  extra                  jsonb,
  synced_at              timestamptz not null default clock_timestamp()
);
comment on table fuel_records is 'Abastecimentos';
create index if not exists fuel_records_synced_at_idx on fuel_records (synced_at);
create index if not exists fuel_records_date_idx on fuel_records (date);
drop trigger if exists fuel_records_before_write on fuel_records;
create trigger fuel_records_before_write before insert or update on fuel_records for each row execute function fmr_before_write();
alter table fuel_records enable row level security;
drop policy if exists fuel_records_read on fuel_records;
drop policy if exists fuel_records_insert on fuel_records;
drop policy if exists fuel_records_update on fuel_records;
create policy fuel_records_read on fuel_records for select to authenticated using (true);
create policy fuel_records_insert on fuel_records for insert to authenticated with check (true);
create policy fuel_records_update on fuel_records for update to authenticated using (true) with check (true);

-- Funcionários (dados pessoais — acesso restrito)
create table if not exists employees (
  id                     text primary key,
  created_at             timestamptz,
  updated_at             timestamptz,
  created_by             text,
  deleted_at             timestamptz,
  deleted_by             text,
  delete_reason          text,
  is_demo                boolean default false,
  name                   text,
  cpf                    text,
  phone                  text,
  address                text,
  birth_date             date,
  position               text,
  admission_date         date,
  salary                 numeric,
  contract_type          text,
  bank                   text,
  pix                    text,
  status                 text,
  notes                  text,
  extra                  jsonb,
  synced_at              timestamptz not null default clock_timestamp()
);
comment on table employees is 'Funcionários (dados pessoais — acesso restrito)';
create index if not exists employees_synced_at_idx on employees (synced_at);
drop trigger if exists employees_before_write on employees;
create trigger employees_before_write before insert or update on employees for each row execute function fmr_before_write();
alter table employees enable row level security;
drop policy if exists employees_read on employees;
drop policy if exists employees_insert on employees;
drop policy if exists employees_update on employees;
create policy employees_read on employees for select to authenticated using (true);
create policy employees_insert on employees for insert to authenticated with check (true);
create policy employees_update on employees for update to authenticated using (true) with check (true);

-- Controle mensal de salário
create table if not exists employee_payments (
  id                     text primary key,
  created_at             timestamptz,
  updated_at             timestamptz,
  created_by             text,
  deleted_at             timestamptz,
  deleted_by             text,
  delete_reason          text,
  is_demo                boolean default false,
  employee_id            text,
  month                  text,
  base_salary            numeric,
  additions              numeric,
  overtime_hours         numeric,
  overtime_value         numeric,
  vales_value            numeric,
  advances_value         numeric,
  discounts_value        numeric,
  others                 numeric,
  net                    numeric,
  payment_date           date,
  status                 text,
  notes                  text,
  extra                  jsonb,
  synced_at              timestamptz not null default clock_timestamp()
);
comment on table employee_payments is 'Controle mensal de salário';
create index if not exists employee_payments_synced_at_idx on employee_payments (synced_at);
drop trigger if exists employee_payments_before_write on employee_payments;
create trigger employee_payments_before_write before insert or update on employee_payments for each row execute function fmr_before_write();
alter table employee_payments enable row level security;
drop policy if exists employee_payments_read on employee_payments;
drop policy if exists employee_payments_insert on employee_payments;
drop policy if exists employee_payments_update on employee_payments;
create policy employee_payments_read on employee_payments for select to authenticated using (true);
create policy employee_payments_insert on employee_payments for insert to authenticated with check (true);
create policy employee_payments_update on employee_payments for update to authenticated using (true) with check (true);

-- Vales e adiantamentos (parcelados)
create table if not exists employee_advances (
  id                     text primary key,
  created_at             timestamptz,
  updated_at             timestamptz,
  created_by             text,
  deleted_at             timestamptz,
  deleted_by             text,
  delete_reason          text,
  is_demo                boolean default false,
  employee_id            text,
  date                   date,
  amount                 numeric,
  type                   text,
  reason                 text,
  payment_method         text,
  installments           integer,
  installment_value      numeric,
  first_month            text,
  status                 text,
  notes                  text,
  extra                  jsonb,
  synced_at              timestamptz not null default clock_timestamp()
);
comment on table employee_advances is 'Vales e adiantamentos (parcelados)';
create index if not exists employee_advances_synced_at_idx on employee_advances (synced_at);
create index if not exists employee_advances_date_idx on employee_advances (date);
drop trigger if exists employee_advances_before_write on employee_advances;
create trigger employee_advances_before_write before insert or update on employee_advances for each row execute function fmr_before_write();
alter table employee_advances enable row level security;
drop policy if exists employee_advances_read on employee_advances;
drop policy if exists employee_advances_insert on employee_advances;
drop policy if exists employee_advances_update on employee_advances;
create policy employee_advances_read on employee_advances for select to authenticated using (true);
create policy employee_advances_insert on employee_advances for insert to authenticated with check (true);
create policy employee_advances_update on employee_advances for update to authenticated using (true) with check (true);

-- Descontos
create table if not exists employee_discounts (
  id                     text primary key,
  created_at             timestamptz,
  updated_at             timestamptz,
  created_by             text,
  deleted_at             timestamptz,
  deleted_by             text,
  delete_reason          text,
  is_demo                boolean default false,
  employee_id            text,
  date                   date,
  month                  text,
  description            text,
  amount                 numeric,
  notes                  text,
  extra                  jsonb,
  synced_at              timestamptz not null default clock_timestamp()
);
comment on table employee_discounts is 'Descontos';
create index if not exists employee_discounts_synced_at_idx on employee_discounts (synced_at);
create index if not exists employee_discounts_date_idx on employee_discounts (date);
drop trigger if exists employee_discounts_before_write on employee_discounts;
create trigger employee_discounts_before_write before insert or update on employee_discounts for each row execute function fmr_before_write();
alter table employee_discounts enable row level security;
drop policy if exists employee_discounts_read on employee_discounts;
drop policy if exists employee_discounts_insert on employee_discounts;
drop policy if exists employee_discounts_update on employee_discounts;
create policy employee_discounts_read on employee_discounts for select to authenticated using (true);
create policy employee_discounts_insert on employee_discounts for insert to authenticated with check (true);
create policy employee_discounts_update on employee_discounts for update to authenticated using (true) with check (true);

-- Estado dos alertas (lido/resolvido/ignorado) por chave
create table if not exists alerts (
  id                     text primary key,
  created_at             timestamptz,
  updated_at             timestamptz,
  created_by             text,
  deleted_at             timestamptz,
  deleted_by             text,
  delete_reason          text,
  is_demo                boolean default false,
  status                 text,
  by                     text,
  extra                  jsonb,
  synced_at              timestamptz not null default clock_timestamp()
);
comment on table alerts is 'Estado dos alertas (lido/resolvido/ignorado) por chave';
create index if not exists alerts_synced_at_idx on alerts (synced_at);
drop trigger if exists alerts_before_write on alerts;
create trigger alerts_before_write before insert or update on alerts for each row execute function fmr_before_write();
alter table alerts enable row level security;
drop policy if exists alerts_read on alerts;
drop policy if exists alerts_insert on alerts;
drop policy if exists alerts_update on alerts;
create policy alerts_read on alerts for select to authenticated using (true);
create policy alerts_insert on alerts for insert to authenticated with check (true);
create policy alerts_update on alerts for update to authenticated using (true) with check (true);

-- Auditoria de todas as alterações
create table if not exists audit_logs (
  id                     text primary key,
  created_at             timestamptz,
  updated_at             timestamptz,
  created_by             text,
  deleted_at             timestamptz,
  deleted_by             text,
  delete_reason          text,
  is_demo                boolean default false,
  ts                     timestamptz,
  user_id                text,
  user_name              text,
  action                 text,
  table_name             text,
  record_id              text,
  description            text,
  changes                jsonb,
  extra                  jsonb,
  synced_at              timestamptz not null default clock_timestamp()
);
comment on table audit_logs is 'Auditoria de todas as alterações';
create index if not exists audit_logs_synced_at_idx on audit_logs (synced_at);
drop trigger if exists audit_logs_before_write on audit_logs;
create trigger audit_logs_before_write before insert or update on audit_logs for each row execute function fmr_before_write();
alter table audit_logs enable row level security;
drop policy if exists audit_logs_read on audit_logs;
drop policy if exists audit_logs_insert on audit_logs;
drop policy if exists audit_logs_update on audit_logs;
create policy audit_logs_read on audit_logs for select to authenticated using (true);
create policy audit_logs_insert on audit_logs for insert to authenticated with check (true);
create policy audit_logs_update on audit_logs for update to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- Relacionamentos (chaves estrangeiras lógicas)
-- ---------------------------------------------------------------------
comment on column users.role_id is 'FK → roles.id';
create index if not exists users_role_id_idx on users (role_id);
comment on column users.employee_id is 'FK → employees.id';
create index if not exists users_employee_id_idx on users (employee_id);
comment on column animals.sire_id is 'FK → animals.id';
create index if not exists animals_sire_id_idx on animals (sire_id);
comment on column animals.dam_id is 'FK → animals.id';
create index if not exists animals_dam_id_idx on animals (dam_id);
comment on column animal_births.animal_id is 'FK → animals.id';
create index if not exists animal_births_animal_id_idx on animal_births (animal_id);
comment on column animal_births.sire_id is 'FK → animals.id';
create index if not exists animal_births_sire_id_idx on animal_births (sire_id);
comment on column animal_births.dam_id is 'FK → animals.id';
create index if not exists animal_births_dam_id_idx on animal_births (dam_id);
comment on column animal_births.reproduction_id is 'FK → animal_reproduction.id';
create index if not exists animal_births_reproduction_id_idx on animal_births (reproduction_id);
comment on column animal_deaths.animal_id is 'FK → animals.id';
create index if not exists animal_deaths_animal_id_idx on animal_deaths (animal_id);
comment on column animal_weights.animal_id is 'FK → animals.id';
create index if not exists animal_weights_animal_id_idx on animal_weights (animal_id);
comment on column animal_health.animal_id is 'FK → animals.id';
create index if not exists animal_health_animal_id_idx on animal_health (animal_id);
comment on column animal_health.product_id is 'FK → inventory.id';
create index if not exists animal_health_product_id_idx on animal_health (product_id);
comment on column animal_reproduction.animal_id is 'FK → animals.id';
create index if not exists animal_reproduction_animal_id_idx on animal_reproduction (animal_id);
comment on column animal_reproduction.bull_id is 'FK → animals.id';
create index if not exists animal_reproduction_bull_id_idx on animal_reproduction (bull_id);
comment on column animal_reproduction.birth_id is 'FK → animal_births.id';
create index if not exists animal_reproduction_birth_id_idx on animal_reproduction (birth_id);
comment on column milk_production.animal_id is 'FK → animals.id';
create index if not exists milk_production_animal_id_idx on milk_production (animal_id);
comment on column inventory_movements.product_id is 'FK → inventory.id';
create index if not exists inventory_movements_product_id_idx on inventory_movements (product_id);
comment on column feed_batches.operator_id is 'FK → employees.id';
create index if not exists feed_batches_operator_id_idx on feed_batches (operator_id);
comment on column feed_batch_items.batch_id is 'FK → feed_batches.id';
create index if not exists feed_batch_items_batch_id_idx on feed_batch_items (batch_id);
comment on column feed_batch_items.product_id is 'FK → inventory.id';
create index if not exists feed_batch_items_product_id_idx on feed_batch_items (product_id);
comment on column feed_distribution.responsible_id is 'FK → employees.id';
create index if not exists feed_distribution_responsible_id_idx on feed_distribution (responsible_id);
comment on column feed_distribution.batch_id is 'FK → feed_batches.id';
create index if not exists feed_distribution_batch_id_idx on feed_distribution (batch_id);
comment on column machines.responsible_id is 'FK → employees.id';
create index if not exists machines_responsible_id_idx on machines (responsible_id);
comment on column machine_services.machine_id is 'FK → machines.id';
create index if not exists machine_services_machine_id_idx on machine_services (machine_id);
comment on column machine_services.operator_id is 'FK → employees.id';
create index if not exists machine_services_operator_id_idx on machine_services (operator_id);
comment on column machine_maintenance.machine_id is 'FK → machines.id';
create index if not exists machine_maintenance_machine_id_idx on machine_maintenance (machine_id);
comment on column machine_maintenance.product_id is 'FK → inventory.id';
create index if not exists machine_maintenance_product_id_idx on machine_maintenance (product_id);
comment on column fuel_records.machine_id is 'FK → machines.id';
create index if not exists fuel_records_machine_id_idx on fuel_records (machine_id);
comment on column fuel_records.product_id is 'FK → inventory.id';
create index if not exists fuel_records_product_id_idx on fuel_records (product_id);
comment on column fuel_records.service_id is 'FK → machine_services.id';
create index if not exists fuel_records_service_id_idx on fuel_records (service_id);
comment on column employee_payments.employee_id is 'FK → employees.id';
create index if not exists employee_payments_employee_id_idx on employee_payments (employee_id);
comment on column employee_advances.employee_id is 'FK → employees.id';
create index if not exists employee_advances_employee_id_idx on employee_advances (employee_id);
comment on column employee_discounts.employee_id is 'FK → employees.id';
create index if not exists employee_discounts_employee_id_idx on employee_discounts (employee_id);

-- Leitura/escrita apenas para usuários autenticados (a chave anon sozinha não acessa nada).
grant select, insert, update on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;
