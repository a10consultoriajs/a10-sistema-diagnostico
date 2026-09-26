// Modelo relacional do sistema (fonte única). Usado pela sincronização com o servidor
// e para gerar docs/schema.sql (node tools/gen-schema.mjs).
// Tipos: text, int, num, date, time, ts, bool, json. "ref" indica chave estrangeira.

const base = { id: 'text pk', created_at: 'ts', updated_at: 'ts', created_by: 'text', deleted_at: 'ts', deleted_by: 'text', delete_reason: 'text', is_demo: 'bool' };

export const SCHEMA = {
  settings: { _doc: 'Configurações (chave/valor)', id: 'text pk', value: 'json', created_at: 'ts', updated_at: 'ts' },
  roles: { _doc: 'Perfis de acesso', ...base, name: 'text', description: 'text', system: 'bool', permissions: 'json' },
  users: { _doc: 'Usuários do sistema', ...base, name: 'text', username: 'text unique', password_hash: 'text', password_salt: 'text', role_id: 'ref roles', employee_id: 'ref employees', active: 'bool', last_login: 'ts', must_change_password: 'bool' },

  animals: { _doc: 'Rebanho — identidade digital de cada animal', ...base, code: 'int unique', tag: 'text', name: 'text', sex: 'text', species: 'text', breed: 'text', category: 'text', birth_date: 'date', birth_weight: 'num', current_weight: 'num', sire_id: 'ref animals', dam_id: 'ref animals', sire_name: 'text', dam_name: 'text', entry_date: 'date', origin: 'text', status: 'text', exit_date: 'date', photo: 'text', notes: 'text' },
  animal_births: { _doc: 'Nascimentos (cria → animal)', ...base, number: 'int', animal_id: 'ref animals', birth_date: 'date', sire_id: 'ref animals', dam_id: 'ref animals', sire_name: 'text', dam_name: 'text', weight: 'num', responsible: 'text', reproduction_id: 'ref animal_reproduction', notes: 'text' },
  animal_deaths: { _doc: 'Mortalidade', ...base, animal_id: 'ref animals', date: 'date', age_days: 'int', cause: 'text', responsible: 'text', notes: 'text' },
  animal_weights: { _doc: 'Pesagens', ...base, animal_id: 'ref animals', date: 'date', weight: 'num', age_days: 'int', responsible: 'text', notes: 'text' },
  animal_health: { _doc: 'Saúde: vacinações, medicamentos, tratamentos, doenças, consultas (campo type)', ...base, animal_id: 'ref animals', type: 'text', date: 'date', description: 'text', product_id: 'ref inventory', quantity: 'num', cost: 'num', responsible: 'text', next_date: 'date', next_done: 'bool', notes: 'text' },
  animal_reproduction: { _doc: 'Reprodução: coberturas, inseminações, gestação e parto', ...base, animal_id: 'ref animals', date: 'date', type: 'text', bull_id: 'ref animals', bull_name: 'text', responsible: 'text', pregnancy_status: 'text', confirmation_date: 'date', expected_calving: 'date', actual_calving: 'date', birth_id: 'ref animal_births', notes: 'text' },

  milk_production: { _doc: 'Produção de leite — 1 linha por animal/data/ordenha', ...base, date: 'date', animal_id: 'ref animals', shift: 'text', liters: 'num', responsible: 'text', notes: 'text' },

  inventory: { _doc: 'Produtos do estoque (inclui ingredientes de ração)', ...base, code: 'text', name: 'text', category: 'text', unit: 'text', unit_weight_kg: 'num', quantity: 'num', min_qty: 'num', max_qty: 'num', unit_cost: 'num', supplier: 'text', location: 'text', active: 'bool', notes: 'text' },
  inventory_movements: { _doc: 'Entradas, saídas e ajustes de estoque (ref_table/ref_id = origem automática)', ...base, product_id: 'ref inventory', date: 'date', type: 'text', quantity: 'num', unit_cost: 'num', total: 'num', supplier: 'text', invoice: 'text', destination: 'text', reason: 'text', responsible: 'text', ref_table: 'text', ref_id: 'text', notes: 'text' },

  feed_batches: { _doc: 'Lotes de ração (batidas da fábrica)', ...base, lot_number: 'text unique', date: 'date', time: 'time', operator_id: 'ref employees', feed_type: 'text', total_kg: 'num', balance_kg: 'num', cost_total: 'num', cost_per_kg: 'num', notes: 'text' },
  feed_batch_items: { _doc: 'Composição de cada lote', ...base, batch_id: 'ref feed_batches', product_id: 'ref inventory', quantity: 'num', kg: 'num', unit_cost: 'num' },
  feed_distribution: { _doc: 'Distribuição de ração ao rebanho', ...base, date: 'date', responsible_id: 'ref employees', batch_id: 'ref feed_batches', feed_type: 'text', quantity_kg: 'num', animals_count: 'int', kg_per_animal: 'num', area: 'text', herd_category: 'text', notes: 'text' },

  machines: { _doc: 'Máquinas', ...base, name: 'text', type: 'text', brand: 'text', model: 'text', year: 'int', identification: 'text', hourmeter: 'num', fuel_type: 'text', status: 'text', responsible_id: 'ref employees', notes: 'text' },
  machine_services: { _doc: 'Serviços de máquina (controle do tratorista)', ...base, date: 'date', machine_id: 'ref machines', operator_id: 'ref employees', service_type: 'text', activity: 'text', area: 'text', start_time: 'time', end_time: 'time', hours: 'num', hourmeter_start: 'num', hourmeter_end: 'num', fuel_liters: 'num', notes: 'text' },
  machine_maintenance: { _doc: 'Manutenções', ...base, machine_id: 'ref machines', date: 'date', type: 'text', description: 'text', parts: 'text', product_id: 'ref inventory', product_qty: 'num', cost: 'num', hourmeter: 'num', responsible: 'text', next_date: 'date', next_hourmeter: 'num', notes: 'text' },
  fuel_records: { _doc: 'Abastecimentos', ...base, date: 'date', machine_id: 'ref machines', fuel_type: 'text', liters: 'num', total_value: 'num', responsible: 'text', hourmeter: 'num', product_id: 'ref inventory', service_id: 'ref machine_services', notes: 'text' },

  employees: { _doc: 'Funcionários (dados pessoais — acesso restrito)', ...base, name: 'text', cpf: 'text', phone: 'text', address: 'text', birth_date: 'date', position: 'text', admission_date: 'date', salary: 'num', contract_type: 'text', bank: 'text', pix: 'text', status: 'text', notes: 'text' },
  employee_payments: { _doc: 'Controle mensal de salário', ...base, employee_id: 'ref employees', month: 'text', base_salary: 'num', additions: 'num', overtime_hours: 'num', overtime_value: 'num', vales_value: 'num', advances_value: 'num', discounts_value: 'num', others: 'num', net: 'num', payment_date: 'date', status: 'text', notes: 'text' },
  employee_advances: { _doc: 'Vales e adiantamentos (parcelados)', ...base, employee_id: 'ref employees', date: 'date', amount: 'num', type: 'text', reason: 'text', payment_method: 'text', installments: 'int', installment_value: 'num', first_month: 'text', status: 'text', notes: 'text' },
  employee_discounts: { _doc: 'Descontos', ...base, employee_id: 'ref employees', date: 'date', month: 'text', description: 'text', amount: 'num', notes: 'text' },

  alerts: { _doc: 'Estado dos alertas (lido/resolvido/ignorado) por chave', ...base, status: 'text', by: 'text' },
  audit_logs: { _doc: 'Auditoria de todas as alterações', ...base, ts: 'ts', user_id: 'text', user_name: 'text', action: 'text', table_name: 'text', record_id: 'text', description: 'text', changes: 'json' },
};

export const columnsOf = (table) => Object.keys(SCHEMA[table] || {}).filter(k => k !== '_doc');
