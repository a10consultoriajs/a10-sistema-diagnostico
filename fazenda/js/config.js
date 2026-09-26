// Valores padrão das configurações. Tudo aqui pode ser alterado pelo administrador
// em Configurações; o código lê sempre do banco (db.setting), nunca direto destas constantes.
import * as db from './db.js';

export const ANIMAL_STATUS = ['Ativo', 'Em produção', 'Seco', 'Gestante', 'Vendido', 'Morto', 'Transferido', 'Outro'];
export const INACTIVE_STATUS = ['Vendido', 'Morto', 'Transferido'];
export const MACHINE_STATUS = ['Disponível', 'Em uso', 'Manutenção', 'Parada', 'Vendida'];
export const EMPLOYEE_STATUS = ['Ativo', 'Afastado', 'Férias', 'Desligado'];
export const SHIFTS = [['manha', 'Manhã'], ['tarde', 'Tarde']];
export const shiftLabel = (s) => (SHIFTS.find(x => x[0] === s) || [s, s])[1];

export const DEFAULT_SETTINGS = {
  farm: { name: 'Fazenda Mar de Rosas', city: 'Piçarra – PA', address: 'Zona Rural, Piçarra – PA', phone: '', owner: '', document: '', since: '2003', logo: '' },
  lists: {
    species: ['Bovino', 'Bubalino', 'Equino', 'Ovino', 'Caprino', 'Suíno'],
    breeds: ['Girolando', 'Gir Leiteiro', 'Holandês', 'Jersey', 'Nelore', 'Guzerá', 'Sindi', 'Mestiço', 'Outra'],
    herd_categories: ['Bezerro(a)', 'Novilha', 'Vaca em lactação', 'Vaca seca', 'Garrote', 'Touro', 'Boi', 'Recria', 'Engorda'],
    origins: ['Nascido na fazenda', 'Compra', 'Doação', 'Transferência', 'Outra'],
    death_causes: ['Doença', 'Complicação no parto', 'Acidente', 'Picada de cobra', 'Tristeza parasitária', 'Pneumonia', 'Diarreia', 'Desconhecida', 'Outra'],
    health_types: ['Vacinação', 'Medicamento', 'Tratamento', 'Doença', 'Consulta', 'Exame', 'Observação'],
    repro_types: ['Monta natural', 'Inseminação artificial (IA)', 'IATF', 'Transferência de embrião (TE)'],
    feed_types: ['Lactação', 'Pré-parto', 'Bezerras', 'Recria', 'Engorda', 'Touros', 'Mineral'],
    service_types: ['Gradagem', 'Aração', 'Plantio', 'Roçagem', 'Pulverização', 'Adubação', 'Colheita', 'Silagem', 'Transporte', 'Manutenção de pasto', 'Cerca/estrada', 'Outro'],
    machine_types: ['Trator', 'Colheitadeira', 'Caminhão', 'Caminhonete', 'Moto', 'Roçadeira', 'Grade', 'Plantadeira', 'Pulverizador', 'Vagão forrageiro', 'Gerador', 'Outro'],
    maintenance_types: ['Preventiva', 'Corretiva', 'Troca de óleo', 'Revisão', 'Pneus', 'Elétrica', 'Outro'],
    fuel_types: ['Diesel S10', 'Diesel S500', 'Gasolina', 'Etanol', 'Arla 32'],
    positions: ['Gerente', 'Vaqueiro', 'Ordenhador', 'Tratorista', 'Operador de fábrica', 'Serviços gerais', 'Cozinheira', 'Administrativo'],
    contract_types: ['CLT', 'Diarista', 'Temporário', 'Autônomo', 'Parceria'],
    product_categories: ['Ingredientes', 'Ração', 'Medicamentos', 'Vacinas', 'Materiais', 'Combustíveis', 'Peças', 'Ferramentas', 'Outros'],
    units: ['kg', 'saco', 'L', 'un', 'dose', 'frasco', 'caixa', 'm', 't'],
    areas: ['Curral', 'Estábulo', 'Bezerreiro', 'Piquete 1', 'Piquete 2', 'Piquete 3', 'Pasto do Rio', 'Lavoura', 'Sede'],
    advance_types: ['Vale', 'Adiantamento', 'Empréstimo'],
    payment_methods: ['Dinheiro', 'Pix', 'Transferência', 'Desconto em folha'],
  },
  gestation_days: { Bovino: 283, Bubalino: 310, Equino: 340, Ovino: 150, Caprino: 150, 'Suíno': 114 },
  alerts_cfg: {
    vaccine_days: 7, calving_days: 15, maintenance_days: 7, maintenance_hours: 20,
    no_milk_days: 2, milk_drop_pct: 20, repro_check_days: 45, payday: 5, payday_days: 3, feed_days_left: 3,
  },
  payroll: {
    hours_month: 220, overtime_rate: 1.5, include_vales: true, include_discounts: true, include_advances: true,
    note: 'Cálculo de controle administrativo interno da fazenda. Não substitui a folha de pagamento oficial, encargos trabalhistas ou orientação contábil.',
  },
  session_hours: 12,
  backup_auto: true,
};

export const LIST_LABELS = {
  species: 'Espécies', breeds: 'Raças', herd_categories: 'Categorias do rebanho', origins: 'Origens dos animais',
  death_causes: 'Causas de morte', health_types: 'Tipos de registro de saúde', repro_types: 'Tipos de reprodução',
  feed_types: 'Tipos de ração', service_types: 'Tipos de serviço', machine_types: 'Tipos de máquina',
  maintenance_types: 'Tipos de manutenção', fuel_types: 'Combustíveis', positions: 'Cargos',
  contract_types: 'Tipos de contratação', product_categories: 'Categorias de estoque', units: 'Unidades',
  areas: 'Áreas / locais', advance_types: 'Tipos de vale', payment_methods: 'Formas de pagamento',
};

export function ensureDefaults() {
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    const cur = db.setting(k);
    if (cur == null) db.setSetting(k, v, { ts: db.DEFAULT_TS });
    else if (v && typeof v === 'object' && !Array.isArray(v)) {
      // adiciona chaves novas sem sobrescrever as existentes (mantém a data original)
      const merged = { ...v, ...cur };
      if (JSON.stringify(merged) !== JSON.stringify(cur)) db.setSetting(k, merged, { ts: db.get('settings', k)?.updated_at });
    }
  }
}
export const list = (k) => db.setting('lists', {})[k] || DEFAULT_SETTINGS.lists[k] || [];
export const farm = () => db.setting('farm', DEFAULT_SETTINGS.farm);
export const alertsCfg = () => ({ ...DEFAULT_SETTINGS.alerts_cfg, ...db.setting('alerts_cfg', {}) });
export const payrollCfg = () => ({ ...DEFAULT_SETTINGS.payroll, ...db.setting('payroll', {}) });
export const gestationDays = (species) => (db.setting('gestation_days', DEFAULT_SETTINGS.gestation_days)[species || 'Bovino']) || 283;
