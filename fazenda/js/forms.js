// Formulários compartilhados. Toda tela e botão de ação rápida abre estes formulários,
// que sempre preenchem automaticamente o que o sistema já sabe (data, usuário, dados do animal…).
import * as db from './db.js';
import * as S from './services.js';
import { openForm, toast, confirmDialog, icon } from './ui.js';
import { can, currentUser } from './auth.js';
import { list, ANIMAL_STATUS, INACTIVE_STATUS, MACHINE_STATUS, EMPLOYEE_STATUS, gestationDays, payrollCfg, shiftLabel } from './config.js';
import { today, nowTime, addDays, fmtDate, fmtNum, fmtMoney, fmtHours, fmtAge, num, round, sum, pad, monthKey, addMonthKey, fmtMonth, esc, diffDays } from './util.js';
import { milkTotal } from './stats.js';

const me = () => currentUser()?.name || '';
const opts = (k) => list(k);
const person = (name = 'responsible', label = 'Responsável') => ({ name, label, type: 'ref', source: 'person', allowFree: true, default: me(), hint: 'Preenchido com o usuário atual. Pode trocar.' });
const notes = { name: 'notes', label: 'Observação', type: 'textarea' };
const dateF = (label = 'Data', name = 'date') => ({ name, label, type: 'date', required: true, default: today() });

// Botão "Excluir" com confirmação e motivo (exclusão lógica + auditoria)
function danger(table, id) {
  if (!id || !can('records.delete')) return undefined;
  return {
    label: 'Excluir', onClick: async () => {
      const block = S.deleteBlocker(table, id);
      if (block) { toast(block, 'warn', 6000); return false; }
      const r = await confirmDialog('O registro será retirado das telas, mas continuará guardado no histórico e na auditoria.', { title: 'Excluir registro?', ok: 'Excluir', danger: true, input: 'Motivo da exclusão' });
      if (!r) return false;
      try { S.deleteRecord(table, id, r.value); toast('Registro excluído.'); return true; }
      catch (e) { toast(e.message, 'err', 6000); return false; }
    },
  };
}
const animalInfo = (id) => {
  const a = db.get('animals', id);
  if (!a) return '<span class="muted">Selecione o animal para ver os dados.</span>';
  return `<div class="kv small"><div><dt>ID</dt><dd>#${S.animalCode(a)}</dd></div><div><dt>Brinco</dt><dd>${esc(a.tag || '—')}</dd></div><div><dt>Sexo</dt><dd>${S.sexLabel(a.sex)}</dd></div><div><dt>Raça</dt><dd>${esc(a.breed || '—')}</dd></div><div><dt>Nascimento</dt><dd>${fmtDate(a.birth_date)} (${fmtAge(a.birth_date)})</dd></div><div><dt>Situação</dt><dd>${esc(a.status)}</dd></div></div>`;
};
const infoBox = (fn) => ({ type: 'html', full: true, name: '_info' + Math.random().toString(36).slice(2, 6), html: fn });

// ======================= REBANHO =======================
export function animalForm(id = null, preset = {}) {
  const a = id ? db.get('animals', id) : null;
  openForm({
    title: a ? `Editar ${S.animalName(a)}` : 'Novo animal', size: 'lg',
    subtitle: a ? `ID #${S.animalCode(a)} — o ID é permanente e nunca é reutilizado` : `ID que será gerado: #${pad(Math.max(db.setting('counters', {}).animal || 0, S.maxAnimalCode()) + 1)}`,
    values: a || { species: 'Bovino', status: 'Ativo', origin: 'Nascido na fazenda', entry_date: today(), ...preset },
    fields: [
      { type: 'section', label: 'Identificação' },
      { name: 'name', label: 'Nome', placeholder: 'Ex.: Mimosa', autofocus: !a },
      { name: 'tag', label: 'Número do brinco', placeholder: 'Ex.: 458' },
      { name: 'sex', label: 'Sexo', type: 'choice', required: true, options: [['F', 'Fêmea'], ['M', 'Macho']] },
      { name: 'species', label: 'Espécie', type: 'select', options: opts('species'), required: true },
      { name: 'breed', label: 'Raça', type: 'select', options: opts('breeds') },
      { name: 'category', label: 'Categoria', type: 'select', options: opts('herd_categories') },
      { name: 'birth_date', label: 'Data de nascimento', type: 'date' },
      { name: 'birth_weight', label: 'Peso ao nascimento', type: 'number', suffix: 'kg', min: 0 },
      ...(a ? [] : [{ name: 'current_weight', label: 'Peso atual', type: 'number', suffix: 'kg', min: 0, hint: 'Depois, o peso atual é atualizado pelas pesagens.' }]),
      { type: 'section', label: 'Genealogia' },
      { name: 'sire_id', label: 'Pai (cadastrado)', type: 'ref', source: 'animal', filter: (x) => x.sex === 'M' && x.id !== id, placeholder: 'Buscar touro…' },
      { name: 'sire_name', label: 'Nome do pai (se não cadastrado / sêmen)', show: (v) => !v.sire_id },
      { name: 'dam_id', label: 'Mãe (cadastrada)', type: 'ref', source: 'animal', filter: (x) => x.sex === 'F' && x.id !== id, placeholder: 'Buscar vaca…' },
      { name: 'dam_name', label: 'Nome da mãe (se não cadastrada)', show: (v) => !v.dam_id },
      { type: 'section', label: 'Entrada e situação' },
      { name: 'entry_date', label: 'Data de entrada na fazenda', type: 'date' },
      { name: 'origin', label: 'Origem', type: 'select', options: opts('origins') },
      { name: 'status', label: 'Situação', type: 'select', options: ANIMAL_STATUS, required: true, hint: a ? 'Para registrar morte use o módulo Mortalidade (guarda a causa).' : '' },
      { name: 'exit_date', label: 'Data de saída', type: 'date', show: (v) => INACTIVE_STATUS.includes(v.status) },
      { name: 'photo', label: 'Foto', type: 'photo' },
      notes,
    ],
    danger: danger('animals', id),
    onSubmit: (v) => {
      if (!a && v.status === 'Morto') throw new Error('Para registrar um animal morto, cadastre-o e depois use Mortalidade.');
      const r = S.saveAnimal(v, id);
      toast(a ? 'Animal atualizado.' : `Animal cadastrado com ID #${S.animalCode(r)}.`);
      if (!a) location.hash = `#/animal/${r.id}`;
    },
  });
}

export function birthForm(preset = {}) {
  const nextId = pad(Math.max(db.setting('counters', {}).animal || 0, S.maxAnimalCode()) + 1);
  const nextNo = Math.max(db.setting('counters', {}).birth || 0, ...db.all('animal_births').map(b => b.number || 0), 0) + 1;
  openForm({
    title: 'Registrar nascimento', size: 'lg',
    intro: `${icon('star', 16)} Ao salvar, o sistema cria o animal (ID <b>#${nextId}</b>), registra o nascimento <b>Nº ${nextNo}</b>, o peso, vincula pai e mãe na genealogia, encerra a gestação da mãe e atualiza o rebanho.`,
    values: { birth_date: today(), ...preset },
    fields: [
      { type: 'section', label: 'Mãe e pai' },
      { name: 'dam_id', label: 'Mãe', type: 'ref', source: 'animal', filter: (x) => x.sex === 'F', placeholder: 'Buscar a mãe…', hint: 'Raça e pai são sugeridos a partir da mãe e da última cobertura.' },
      { name: 'dam_name', label: 'Nome da mãe (se não cadastrada)', show: (v) => !v.dam_id },
      { name: 'sire_id', label: 'Pai', type: 'ref', source: 'animal', filter: (x) => x.sex === 'M', placeholder: 'Buscar o pai…' },
      { name: 'sire_name', label: 'Nome do pai (se não cadastrado / sêmen)', show: (v) => !v.sire_id },
      { type: 'section', label: 'Cria' },
      { name: 'name', label: 'Nome da cria', placeholder: 'Opcional' },
      { name: 'tag', label: 'Brinco da cria' },
      { name: 'birth_date', label: 'Data de nascimento', type: 'date', required: true },
      { name: 'sex', label: 'Sexo', type: 'choice', required: true, options: [['F', 'Fêmea'], ['M', 'Macho']] },
      { name: 'breed', label: 'Raça', type: 'select', options: opts('breeds') },
      { name: 'weight', label: 'Peso ao nascer', type: 'number', suffix: 'kg', min: 0 },
      person(), notes,
    ],
    onChange: (v, api, changed) => {
      if (changed === 'dam_id' && v.dam_id) {
        const dam = db.get('animals', v.dam_id);
        if (dam?.breed && !v.breed) api.set('breed', dam.breed);
        const rep = db.where('animal_reproduction', r => r.animal_id === v.dam_id && !r.actual_calving && r.pregnancy_status !== 'Negativa').sort((a, b) => b.date.localeCompare(a.date))[0];
        if (rep && !v.sire_id && rep.bull_id) api.set('sire_id', rep.bull_id);
        else if (rep && !v.sire_id && rep.bull_name && !v.sire_name) api.set('sire_name', rep.bull_name);
      }
    },
    againLabel: 'Salvar e registrar outro',
    onSubmit: (v) => {
      if (!v.name && !v.tag) v.name = `Cria de ${S.animalName(db.get('animals', v.dam_id)) || v.dam_name || 'mãe não informada'} ${fmtDate(v.birth_date)}`;
      const { animal, birth } = S.registerBirth(v);
      toast(`Nascimento Nº ${birth.number} registrado. Animal #${S.animalCode(animal)} criado.`);
    },
    onAgain: () => birthForm(),
  });
}

export function deathForm(preset = {}) {
  openForm({
    title: 'Registrar mortalidade', values: { date: today(), ...preset },
    intro: 'O animal passa para a situação <b>Morto</b>, sai dos animais ativos e o histórico é mantido.',
    fields: [
      { name: 'animal_id', label: 'Animal', type: 'ref', source: 'animal', required: true },
      infoBox((v) => animalInfo(v.animal_id)),
      dateF('Data da morte'),
      { name: 'cause', label: 'Causa', type: 'select', options: opts('death_causes'), required: true },
      person(), notes,
    ],
    onSubmit: async (v) => {
      const a = db.get('animals', v.animal_id);
      if (!await confirmDialog(`Confirmar a morte de <b>${esc(S.animalLabel(a))}</b>?`, { ok: 'Confirmar', danger: true })) return false;
      S.registerDeath(v); toast('Mortalidade registrada.');
    },
  });
}

export function reproForm(id = null, preset = {}) {
  const r = id ? db.get('animal_reproduction', id) : null;
  openForm({
    title: r ? 'Editar reprodução' : 'Registrar cobertura / inseminação', size: 'lg',
    values: r || { date: today(), pregnancy_status: 'Aguardando', type: opts('repro_types')[0], responsible: me(), ...preset },
    fields: [
      { name: 'animal_id', label: 'Fêmea', type: 'ref', source: 'animal', filter: 'female', required: true },
      dateF('Data da cobertura'),
      { name: 'type', label: 'Tipo de reprodução', type: 'select', options: opts('repro_types'), required: true },
      { name: 'bull_id', label: 'Touro / pai (cadastrado)', type: 'ref', source: 'animal', filter: 'male' },
      { name: 'bull_name', label: 'Touro / sêmen (se não cadastrado)', show: (v) => !v.bull_id },
      { name: 'responsible', label: 'Inseminador / responsável', type: 'ref', source: 'person', allowFree: true },
      { name: 'pregnancy_status', label: 'Confirmação de gestação', type: 'choice', options: ['Aguardando', 'Confirmada', 'Negativa'] },
      { name: 'confirmation_date', label: 'Data do diagnóstico', type: 'date', show: (v) => v.pregnancy_status !== 'Aguardando' },
      { name: '_exp', label: 'Data prevista do parto', type: 'computed', compute: (v) => { const a = db.get('animals', v.animal_id); return v.date ? `${fmtDate(addDays(v.date, gestationDays(a?.species)))} <span class="muted small">&nbsp;(${gestationDays(a?.species)} dias — ajustável em Configurações)</span>` : '—'; } },
      { name: 'actual_calving', label: 'Data real do parto', type: 'date', show: () => !!r, hint: 'Preenchida automaticamente ao registrar o nascimento.' },
      notes,
    ],
    danger: danger('animal_reproduction', id),
    onSubmit: (v) => {
      const a = db.get('animals', v.animal_id);
      v.expected_calving = addDays(v.date, gestationDays(a?.species));
      if (v.pregnancy_status !== 'Aguardando' && !v.confirmation_date) v.confirmation_date = today();
      S.saveRepro(v, id); toast('Reprodução registrada.');
    },
  });
}

export function weightForm(id = null, preset = {}) {
  const w = id ? db.get('animal_weights', id) : null;
  openForm({
    title: w ? 'Editar pesagem' : 'Registrar pesagem', values: w || { date: today(), ...preset },
    fields: [
      { name: 'animal_id', label: 'Animal', type: 'ref', source: 'animal', required: true },
      dateF(), { name: 'weight', label: 'Peso', type: 'number', suffix: 'kg', required: true, min: 0.1, big: true },
      { name: '_gain', label: 'Evolução', type: 'computed', compute: (v) => {
        const a = db.get('animals', v.animal_id); if (!a) return '—';
        const last = db.where('animal_weights', x => x.animal_id === a.id && x.id !== id && x.date < v.date).sort((x, y) => y.date.localeCompare(x.date))[0];
        const age = a.birth_date ? `Idade: ${fmtAge(a.birth_date, v.date)}` : '';
        if (!last || !num(v.weight)) return age || '—';
        const d = diffDays(last.date, v.date), g = num(v.weight) - num(last.weight);
        return `${age} · Última: ${fmtNum(last.weight)} kg em ${fmtDate(last.date)} · ${g >= 0 ? '+' : ''}${fmtNum(g)} kg${d > 0 ? ` (${fmtNum(g / d * 1000, 0)} g/dia)` : ''}`;
      } },
      person(), notes,
    ],
    danger: danger('animal_weights', id), againLabel: w ? null : 'Salvar e pesar outro',
    onSubmit: (v) => { S.saveWeight(v, id); toast('Pesagem registrada.'); },
    onAgain: (v) => weightForm(null, { date: v.date }),
  });
}

export function healthForm(id = null, preset = {}) {
  const h = id ? db.get('animal_health', id) : null;
  openForm({
    title: h ? 'Editar registro de saúde' : 'Registrar saúde / tratamento', size: 'lg',
    values: h || { date: today(), type: 'Vacinação', ...preset },
    fields: [
      { name: 'animal_id', label: 'Animal', type: 'ref', source: 'animal', required: true },
      { name: 'type', label: 'Tipo', type: 'select', options: opts('health_types'), required: true },
      dateF(),
      { name: 'description', label: 'Descrição', placeholder: 'Ex.: Vacina contra aftosa, mastite, consulta veterinária…', required: true },
      { name: 'product_id', label: 'Produto usado (baixa automática no estoque)', type: 'ref', source: 'product', category: ['Medicamentos', 'Vacinas'] },
      { name: 'quantity', label: 'Quantidade usada', type: 'number', min: 0, show: (v) => !!v.product_id, hint: 'Na unidade do produto (dose, mL, frasco…).' },
      { name: 'cost', label: 'Custo', type: 'money' },
      { name: 'responsible', label: 'Responsável / veterinário', type: 'ref', source: 'person', allowFree: true, default: me() },
      { name: 'next_date', label: 'Próxima aplicação / retorno', type: 'date', hint: 'Gera alerta de vacinação/procedimento futuro.' },
      { name: 'next_done', label: 'Procedimento futuro já realizado', type: 'checkbox', show: (v) => !!v.next_date && !!h },
      notes,
    ],
    danger: danger('animal_health', id), againLabel: h ? null : 'Salvar e registrar outro animal',
    onSubmit: (v) => { S.saveHealth(v, id); toast('Registro de saúde salvo.'); },
    onAgain: (v) => healthForm(null, { type: v.type, date: v.date, description: v.description, product_id: v.product_id, quantity: v.quantity, next_date: v.next_date }),
  });
}

// ======================= LEITE =======================
export const defaultShift = () => new Date().getHours() < 12 ? 'manha' : 'tarde';
export function milkForm(id = null, preset = {}) {
  const m = id ? db.get('milk_production', id) : null;
  openForm({
    title: m ? 'Editar produção' : 'Registrar produção de leite',
    values: m || { date: today(), shift: defaultShift(), responsible: me(), ...preset },
    fields: [
      dateF(),
      { name: 'shift', label: 'Ordenha', type: 'choice', options: [['manha', 'Manhã'], ['tarde', 'Tarde']], required: true },
      { name: 'animal_id', label: 'Animal', type: 'ref', source: 'animal', filter: 'producing', required: true, full: true, placeholder: 'Nome, brinco ou ID…' },
      { name: 'liters', label: 'Quantidade', type: 'number', suffix: 'litros', required: true, min: 0, big: true, full: true },
      { name: '_day', label: 'Produção do dia', type: 'computed', full: true, compute: (v) => {
        if (!v.animal_id) return '—';
        const rows = db.where('milk_production', x => x.animal_id === v.animal_id && x.date === v.date);
        const val = (s) => s === v.shift ? num(v.liters) : num(rows.find(x => x.shift === s)?.liters);
        const exist = rows.find(x => x.shift === v.shift && x.id !== id);
        return `Manhã ${fmtNum(val('manha'))} L + Tarde ${fmtNum(val('tarde'))} L = <b>&nbsp;${fmtNum(val('manha') + val('tarde'))} L</b>${exist ? `<span class="muted small">&nbsp;· já havia ${fmtNum(exist.liters)} L nesta ordenha (será substituído)</span>` : ''}`;
      } },
      person(), notes,
    ],
    danger: danger('milk_production', id),
    againLabel: m ? null : 'Salvar e próximo animal', enterAgain: true,
    onSubmit: (v) => { const r = S.saveMilk(v, id); toast(r.updated ? 'Produção atualizada.' : 'Produção registrada.'); },
    onAgain: (v) => milkForm(null, { date: v.date, shift: v.shift, responsible: v.responsible }),
  });
}

// ======================= ESTOQUE =======================
export function productForm(id = null, preset = {}) {
  const p = id ? db.get('inventory', id) : null;
  openForm({
    title: p ? `Editar ${p.name}` : 'Novo produto', size: 'lg',
    values: p || { unit: 'kg', category: 'Materiais', ...preset },
    fields: [
      { name: 'name', label: 'Nome', required: true, autofocus: !p },
      { name: 'code', label: 'Código', placeholder: 'Automático se vazio' },
      { name: 'category', label: 'Categoria', type: 'select', options: opts('product_categories'), required: true },
      { name: 'unit', label: 'Unidade', type: 'select', options: opts('units'), required: true },
      { name: 'unit_weight_kg', label: 'Peso por unidade (kg)', type: 'number', min: 0, show: (v) => !['kg', 't'].includes(v.unit) && ['Ingredientes', 'Ração'].includes(v.category), hint: 'Ex.: saco de milho de 60 kg. Usado para calcular o kg total da batida.' },
      ...(p ? [] : [{ name: 'quantity', label: 'Saldo inicial', type: 'number', min: 0, hint: 'Gera uma entrada de estoque automaticamente.' }]),
      { name: 'min_qty', label: 'Estoque mínimo', type: 'number', min: 0, hint: 'Abaixo disso aparece o alerta ESTOQUE BAIXO.' },
      { name: 'max_qty', label: 'Estoque máximo', type: 'number', min: 0 },
      { name: 'unit_cost', label: 'Valor unitário', type: 'money', min: 0 },
      { name: 'supplier', label: 'Fornecedor' },
      { name: 'location', label: 'Localização', placeholder: 'Ex.: Galpão, prateleira 2' },
      ...(p ? [{ name: 'active', label: 'Produto ativo', type: 'checkbox' }] : []),
      notes,
    ],
    danger: danger('inventory', id),
    onSubmit: (v) => { if (p && v.active == null) v.active = true; S.saveProduct(v, id); toast(p ? 'Produto atualizado.' : 'Produto cadastrado.'); },
  });
}

export function stockInForm(preset = {}) {
  openForm({
    title: 'Entrada de estoque', values: { date: today(), responsible: me(), ...preset },
    fields: [
      { name: 'product_id', label: 'Produto', type: 'ref', source: 'product', required: true, full: true },
      dateF(),
      { name: 'quantity', label: 'Quantidade', type: 'number', required: true, min: 0.0001, big: true },
      { name: 'unit_cost', label: 'Valor unitário', type: 'money', min: 0 },
      { name: '_tot', label: 'Valor total', type: 'computed', compute: (v) => { const p = db.get('inventory', v.product_id); return p ? `${fmtNum(v.quantity, 2)} ${p.unit} × ${fmtMoney(v.unit_cost || 0)} = <b>&nbsp;${fmtMoney(num(v.quantity) * num(v.unit_cost))}</b>` : '—'; } },
      { name: 'supplier', label: 'Fornecedor' }, { name: 'invoice', label: 'Nota fiscal' },
      person(), notes,
    ],
    onChange: (v, api, ch) => { if (ch === 'product_id') { const p = db.get('inventory', v.product_id); if (p) { if (!v.unit_cost && p.unit_cost) api.set('unit_cost', p.unit_cost); if (!v.supplier && p.supplier) api.set('supplier', p.supplier); } } },
    againLabel: 'Salvar e lançar outra',
    onSubmit: (v) => { S.stockMove({ ...v, type: 'entrada' }); toast('Entrada registrada. Estoque atualizado.'); },
    onAgain: (v) => stockInForm({ date: v.date, supplier: v.supplier, invoice: v.invoice }),
  });
}

export function stockOutForm(preset = {}) {
  openForm({
    title: 'Saída de estoque', values: { date: today(), responsible: me(), ...preset },
    fields: [
      { name: 'product_id', label: 'Produto', type: 'ref', source: 'product', required: true, full: true },
      infoBox((v) => { const p = db.get('inventory', v.product_id); return p ? `<div class="muted">Saldo atual: <b>${fmtNum(p.quantity, 2)} ${esc(p.unit)}</b>${num(p.min_qty) ? ` · mínimo ${fmtNum(p.min_qty, 2)}` : ''}</div>` : ''; }),
      dateF(),
      { name: 'quantity', label: 'Quantidade', type: 'number', required: true, min: 0.0001, big: true },
      { name: 'destination', label: 'Destino', type: 'ref', options: () => opts('areas').map(x => ({ value: x, label: x })), allowFree: true },
      { name: 'reason', label: 'Motivo', placeholder: 'Ex.: uso no curral, manutenção de cerca…' },
      person(), notes,
    ],
    againLabel: 'Salvar e lançar outra',
    onSubmit: async (v) => {
      const p = db.get('inventory', v.product_id);
      if (num(v.quantity) > num(p.quantity) && !await confirmDialog(`A saída (${fmtNum(v.quantity, 2)} ${p.unit}) é maior que o saldo (${fmtNum(p.quantity, 2)} ${p.unit}). O estoque ficará negativo. Continuar?`, { ok: 'Registrar mesmo assim' })) return false;
      S.stockMove({ ...v, type: 'saida' }); toast('Saída registrada. Estoque atualizado.');
    },
    onAgain: (v) => stockOutForm({ date: v.date, destination: v.destination }),
  });
}

// ======================= RAÇÃO =======================
const itemCols = [
  { name: 'product_id', label: 'Ingrediente', type: 'ref', source: 'product', category: 'Ingredientes', flex: 3 },
  { name: 'quantity', label: 'Qtd (sacos/kg)', flex: 1.3 },
  { name: '_kg', label: 'Kg', type: 'computed', flex: 1.4, compute: (r) => { const p = db.get('inventory', r.product_id); if (!p) return '—'; const kg = S.kgOf(p, r.quantity); const short = num(r.quantity) > num(p.quantity); return `${fmtNum(kg)} kg <span class="muted small">&nbsp;${esc(p.unit)}${short ? ' · <b style="color:#B3261E">saldo ' + fmtNum(p.quantity, 1) + '</b>' : ''}</span>`; } },
];
export function fabricationForm(preset = {}) {
  openForm({
    title: 'Fabricar ração — batida', size: 'lg',
    intro: 'Ao salvar: cria o lote, dá entrada da ração pronta, dá baixa nos ingredientes do estoque e guarda a composição para rastreabilidade.',
    values: { date: today(), time: nowTime(), items: [], ...preset },
    fields: [
      { name: 'lot_number', label: 'Número do lote', placeholder: `Automático: ${S.nextLotNumber()}` },
      { name: 'feed_type', label: 'Categoria da ração', type: 'select', options: opts('feed_types'), required: true },
      dateF(), { name: 'time', label: 'Horário', type: 'time' },
      { name: 'operator_id', label: 'Operador', type: 'ref', source: 'employee', required: true },
      { name: 'items', label: 'Ingredientes', type: 'items', columns: itemCols, addLabel: 'Adicionar ingrediente', required: true, newRow: () => ({ product_id: null, quantity: '' }), hint: 'Ao escolher a categoria, a última receita usada é carregada. Ajuste se precisar.' },
      { name: '_tot', label: 'Kg total calculado', type: 'computed', compute: (v) => {
        const lines = (v.items || []).map(i => ({ p: db.get('inventory', i.product_id), q: num(i.quantity) })).filter(x => x.p);
        const kg = sum(lines, x => S.kgOf(x.p, x.q)), cost = sum(lines, x => x.q * num(x.p.unit_cost));
        const sacos = sum(lines.filter(x => x.p.unit === 'saco'), x => x.q);
        return `${fmtNum(kg)} kg${sacos ? ` <span class="muted small">&nbsp;(${fmtNum(sacos)} sacos)</span>` : ''} · custo ${fmtMoney(cost)}${kg ? ` (${fmtMoney(cost / kg)}/kg)` : ''}`;
      } },
      { name: 'total_kg', label: 'Kg total pesado (opcional)', type: 'number', min: 0, hint: 'Preencha só se pesou a batida na balança; senão usa o calculado.' },
      notes,
    ],
    onChange: (v, api, ch) => {
      if (ch === 'feed_type' && v.feed_type && !(v.items || []).some(i => i.product_id)) {
        const last = db.where('feed_batches', b => b.feed_type === v.feed_type).sort((a, b) => b.date.localeCompare(a.date))[0];
        if (last) api.set('items', db.where('feed_batch_items', i => i.batch_id === last.id).map(i => ({ product_id: i.product_id, quantity: String(i.quantity).replace('.', ',') })));
        else if (!(v.items || []).length) api.set('items', [{ product_id: null, quantity: '' }]);
      }
    },
    onSubmit: async (v) => {
      const short = S.feedShortfalls(v.items);
      if (short.length && !await confirmDialog(`Saldo insuficiente de ingredientes:<br>• ${short.map(esc).join('<br>• ')}<br><br>O estoque ficará negativo. Registrar mesmo assim?`, { ok: 'Registrar mesmo assim' })) return false;
      const b = S.fabricateFeed(v); toast(`Lote ${b.lot_number} criado: ${fmtNum(b.total_kg)} kg.`);
      location.hash = `#/racao/lote/${b.id}`;
    },
  });
}

export function distributionForm(id = null, preset = {}) {
  const d = id ? db.get('feed_distribution', id) : null;
  openForm({
    title: d ? 'Editar distribuição' : 'Distribuição de ração',
    values: d || { date: today(), ...preset, responsible_id: preset.responsible_id || currentUser()?.employee_id || null },
    fields: [
      dateF(),
      { name: 'responsible_id', label: 'Responsável', type: 'ref', source: 'employee', required: true },
      { name: 'batch_id', label: 'Lote de ração', type: 'ref', source: 'batch', required: true, full: true, hint: 'Somente lotes com saldo. O mais antigo aparece primeiro.' },
      infoBox((v) => { const b = db.get('feed_batches', v.batch_id); if (!b) return ''; const avail = num(b.balance_kg) + (d && d.batch_id === b.id ? num(d.quantity_kg) : 0); return `<div class="muted">Ração: <b>${esc(b.feed_type)}</b> · fabricada em ${fmtDate(b.date)} · saldo disponível <b>${fmtNum(avail)} kg</b></div>`; }),
      { name: 'quantity_kg', label: 'Quantidade', type: 'number', suffix: 'kg', required: true, min: 0.01, big: true },
      { name: 'animals_count', label: 'Nº de animais', type: 'number', min: 0, big: true },
      { name: '_kpa', label: 'Kg por animal', type: 'computed', compute: (v) => num(v.animals_count) > 0 && num(v.quantity_kg) > 0 ? `${fmtNum(v.quantity_kg)} kg ÷ ${fmtNum(v.animals_count, 0)} animais = <b>&nbsp;${fmtNum(num(v.quantity_kg) / num(v.animals_count), 2)} kg/animal</b>` : '—' },
      { name: 'area', label: 'Área / local', type: 'ref', options: () => opts('areas').map(x => ({ value: x, label: x })), allowFree: true },
      { name: 'herd_category', label: 'Categoria do rebanho', type: 'select', options: opts('herd_categories') },
      notes,
    ],
    danger: danger('feed_distribution', id), againLabel: d ? null : 'Salvar e distribuir outra',
    onSubmit: (v) => { S.distributeFeed(v, id); toast('Distribuição registrada. Estoque de ração atualizado.'); },
    onAgain: (v) => distributionForm(null, { date: v.date, responsible_id: v.responsible_id, batch_id: db.get('feed_batches', v.batch_id)?.balance_kg > 0 ? v.batch_id : null }),
  });
}

// ======================= MÁQUINAS =======================
export function machineForm(id = null) {
  const m = id ? db.get('machines', id) : null;
  openForm({
    title: m ? `Editar ${m.name}` : 'Nova máquina', size: 'lg', values: m || { status: 'Disponível', type: 'Trator', hourmeter: 0 },
    fields: [
      { name: 'name', label: 'Máquina (nome)', required: true, placeholder: 'Ex.: Trator MF 275' },
      { name: 'type', label: 'Tipo', type: 'select', options: opts('machine_types') },
      { name: 'brand', label: 'Marca' }, { name: 'model', label: 'Modelo' },
      { name: 'year', label: 'Ano', type: 'number' }, { name: 'identification', label: 'Nº de identificação / placa / chassi' },
      { name: 'hourmeter', label: 'Horímetro atual', type: 'number', suffix: 'h', min: 0, hint: 'Atualizado automaticamente pelos serviços, abastecimentos e manutenções.' },
      { name: 'fuel_type', label: 'Combustível', type: 'select', options: opts('fuel_types') },
      { name: 'status', label: 'Situação', type: 'select', options: MACHINE_STATUS, required: true },
      { name: 'responsible_id', label: 'Responsável', type: 'ref', source: 'employee' },
      notes,
    ],
    danger: danger('machines', id),
    onSubmit: (v) => { if (id) db.update('machines', id, v); else db.insert('machines', v); toast('Máquina salva.'); },
  });
}

export function serviceForm(id = null, preset = {}) {
  const s = id ? db.get('machine_services', id) : null;
  openForm({
    title: s ? 'Editar serviço' : 'Serviço de máquina', size: 'lg',
    subtitle: 'Controle de serviços — tratorista',
    values: s || { date: today(), start_time: '07:00', ...preset, operator_id: preset.operator_id || currentUser()?.employee_id || null },
    fields: [
      dateF(),
      { name: 'machine_id', label: 'Máquina', type: 'ref', source: 'machine', required: true },
      { name: 'operator_id', label: 'Operador', type: 'ref', source: 'employee', required: true },
      { name: 'service_type', label: 'Tipo de serviço', type: 'select', options: opts('service_types'), required: true },
      { name: 'activity', label: 'Atividade', placeholder: 'Ex.: Gradagem do pasto do rio', required: true },
      { name: 'area', label: 'Área', type: 'ref', options: () => opts('areas').map(x => ({ value: x, label: x })), allowFree: true },
      { name: 'start_time', label: 'Início', type: 'time' }, { name: 'end_time', label: 'Fim', type: 'time' },
      { name: 'hourmeter_start', label: 'Horímetro inicial', type: 'number', suffix: 'h', min: 0 },
      { name: 'hourmeter_end', label: 'Horímetro final', type: 'number', suffix: 'h', min: 0 },
      { name: '_h', label: 'Horas trabalhadas (automático)', type: 'computed', full: true, compute: (v) => {
        const h = S.serviceHours({ ...v, hourmeter_start: v.hourmeter_start === '' ? null : v.hourmeter_start, hourmeter_end: v.hourmeter_end === '' ? null : v.hourmeter_end });
        const byHm = v.hourmeter_start !== '' && v.hourmeter_end !== '' && v.hourmeter_start != null && v.hourmeter_end != null;
        return h > 0 ? `<b>${fmtHours(h)}</b>&nbsp;<span class="muted small">(${byHm ? 'horímetro final − inicial' : `${v.start_time} até ${v.end_time}`})</span>` : 'Informe início e fim ou os horímetros';
      } },
      { name: 'fuel_liters', label: 'Combustível utilizado', type: 'number', suffix: 'L', min: 0, hint: 'Gera um registro de abastecimento vinculado.' },
      { name: 'notes', label: 'Observações', type: 'textarea' },
    ],
    onChange: (v, api, ch) => { if (ch === 'machine_id' && v.machine_id && (v.hourmeter_start === '' || v.hourmeter_start == null)) { const m = db.get('machines', v.machine_id); if (m && num(m.hourmeter)) api.set('hourmeter_start', m.hourmeter); } },
    danger: danger('machine_services', id), againLabel: s ? null : 'Salvar e lançar outro',
    onSubmit: (v) => { const r = S.saveService(v, id); toast(`Serviço registrado: ${fmtHours(r.hours)}.`); },
    onAgain: (v) => serviceForm(null, { date: v.date, operator_id: v.operator_id, machine_id: v.machine_id, start_time: v.end_time, hourmeter_start: v.hourmeter_end }),
  });
}

export function maintenanceForm(id = null, preset = {}) {
  const m = id ? db.get('machine_maintenance', id) : null;
  openForm({
    title: m ? 'Editar manutenção' : 'Registrar manutenção', size: 'lg', values: m || { date: today(), type: 'Preventiva', responsible: me(), ...preset },
    fields: [
      { name: 'machine_id', label: 'Máquina', type: 'ref', source: 'machine', required: true }, dateF(),
      { name: 'type', label: 'Tipo', type: 'select', options: opts('maintenance_types'), required: true },
      { name: 'hourmeter', label: 'Horímetro', type: 'number', suffix: 'h', min: 0 },
      { name: 'description', label: 'Serviço realizado', type: 'textarea', required: true },
      { name: 'parts', label: 'Peças utilizadas', full: true },
      { name: 'product_id', label: 'Peça/material do estoque (baixa automática)', type: 'ref', source: 'product', category: ['Peças', 'Materiais', 'Combustíveis', 'Ferramentas', 'Outros'] },
      { name: 'product_qty', label: 'Quantidade', type: 'number', min: 0, show: (v) => !!v.product_id },
      { name: 'cost', label: 'Custo total', type: 'money', min: 0 },
      person(),
      { name: 'next_date', label: 'Próxima manutenção (data)', type: 'date' },
      { name: 'next_hourmeter', label: 'Próxima manutenção (horímetro)', type: 'number', suffix: 'h', min: 0 },
      notes,
    ],
    onChange: (v, api, ch) => { if (ch === 'machine_id') { const mc = db.get('machines', v.machine_id); if (mc && !v.hourmeter) api.set('hourmeter', mc.hourmeter); } },
    danger: danger('machine_maintenance', id),
    onSubmit: (v) => { S.saveMaintenance(v, id); toast('Manutenção registrada.'); },
  });
}

export function fuelForm(id = null, preset = {}) {
  const f = id ? db.get('fuel_records', id) : null;
  openForm({
    title: f ? 'Editar abastecimento' : 'Registrar abastecimento', values: f || { date: today(), responsible: me(), ...preset },
    fields: [
      dateF(), { name: 'machine_id', label: 'Máquina', type: 'ref', source: 'machine', required: true },
      { name: 'fuel_type', label: 'Tipo de combustível', type: 'select', options: opts('fuel_types'), required: true },
      { name: 'liters', label: 'Quantidade', type: 'number', suffix: 'L', required: true, min: 0.01, big: true },
      { name: 'total_value', label: 'Valor total', type: 'money', min: 0 },
      { name: '_pl', label: 'Preço por litro', type: 'computed', compute: (v) => num(v.liters) > 0 && num(v.total_value) > 0 ? fmtMoney(num(v.total_value) / num(v.liters)) + '/L' : '—' },
      { name: 'product_id', label: 'Retirado do tanque/estoque da fazenda', type: 'ref', source: 'product', category: 'Combustíveis', hint: 'Se escolher, dá baixa no estoque de combustível.' },
      { name: 'hourmeter', label: 'Horímetro', type: 'number', suffix: 'h', min: 0 },
      person(), notes,
    ],
    onChange: (v, api, ch) => {
      if (ch === 'machine_id') { const m = db.get('machines', v.machine_id); if (m?.fuel_type && !v.fuel_type) api.set('fuel_type', m.fuel_type); if (m && !v.hourmeter) api.set('hourmeter', m.hourmeter); }
      if (ch === 'product_id' || ch === 'liters') { const p = db.get('inventory', v.product_id); if (p && num(p.unit_cost) && num(v.liters) && !v.total_value) api.set('total_value', round(num(p.unit_cost) * num(v.liters), 2)); }
    },
    danger: danger('fuel_records', id),
    onSubmit: (v) => { S.saveFuel(v, id); toast('Abastecimento registrado.'); },
  });
}

// ======================= FUNCIONÁRIOS =======================
export function employeeForm(id = null) {
  const e = id ? db.get('employees', id) : null;
  openForm({
    title: e ? `Editar ${e.name}` : 'Novo funcionário', size: 'lg', values: e || { status: 'Ativo', admission_date: today(), contract_type: 'CLT' },
    fields: [
      { type: 'section', label: 'Dados pessoais' },
      { name: 'name', label: 'Nome completo', required: true, autofocus: !e },
      { name: 'cpf', label: 'CPF', placeholder: '000.000.000-00' },
      { name: 'phone', label: 'Telefone', type: 'tel' }, { name: 'birth_date', label: 'Data de nascimento', type: 'date' },
      { name: 'address', label: 'Endereço', full: true },
      { type: 'section', label: 'Contrato' },
      { name: 'position', label: 'Cargo', type: 'select', options: opts('positions'), required: true },
      { name: 'admission_date', label: 'Data de admissão', type: 'date' },
      ...(can('payroll.view') ? [{ name: 'salary', label: 'Salário', type: 'money', min: 0 }] : []),
      { name: 'contract_type', label: 'Tipo de contratação', type: 'select', options: opts('contract_types') },
      { name: 'status', label: 'Situação', type: 'select', options: EMPLOYEE_STATUS },
      ...(can('payroll.view') ? [{ type: 'section', label: 'Pagamento' }, { name: 'bank', label: 'Banco / agência / conta' }, { name: 'pix', label: 'Chave Pix' }] : []),
      notes,
    ],
    danger: danger('employees', id),
    onSubmit: (v) => { if (v.cpf) v.cpf = v.cpf.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'); S.saveEmployee(v, id); toast('Funcionário salvo.'); },
  });
}

export function advanceForm(id = null, preset = {}) {
  const a = id ? db.get('employee_advances', id) : null;
  openForm({
    title: a ? 'Editar vale / adiantamento' : 'Novo vale / adiantamento',
    values: a || { date: today(), type: 'Vale', installments: 1, payment_method: 'Dinheiro', first_month: monthKey(today()), ...preset },
    intro: 'O valor (ou as parcelas) é descontado automaticamente no controle mensal de salário.',
    fields: [
      { name: 'employee_id', label: 'Funcionário', type: 'ref', source: 'employee', required: true, full: true }, dateF(),
      { name: 'type', label: 'Tipo', type: 'select', options: opts('advance_types'), required: true },
      { name: 'amount', label: 'Valor', type: 'money', required: true, min: 0.01, big: true },
      { name: 'installments', label: 'Nº de parcelas', type: 'number', min: 1 },
      { name: 'first_month', label: 'Descontar a partir de', type: 'month', required: true },
      { name: '_parc', label: 'Parcelas', type: 'computed', compute: (v) => { const n = Math.max(1, parseInt(v.installments) || 1); return `${n}× de <b>&nbsp;${fmtMoney(num(v.amount) / n)}</b>&nbsp;<span class="muted small">(${fmtMonth(v.first_month)}${n > 1 ? ' a ' + fmtMonth(addMonthKey(v.first_month || monthKey(today()), n - 1)) : ''})</span>`; } },
      { name: 'reason', label: 'Motivo' },
      { name: 'payment_method', label: 'Forma de pagamento', type: 'select', options: opts('payment_methods') },
      ...(a ? [{ name: 'status', label: 'Situação', type: 'select', options: ['Aberto', 'Quitado', 'Cancelado'] }] : []),
      notes,
    ],
    danger: danger('employee_advances', id),
    onSubmit: (v) => { S.saveAdvance(v, id); refreshPayroll(v.employee_id); toast('Vale registrado.'); },
  });
}
function refreshPayroll(empId) { db.where('employee_payments', p => p.employee_id === empId && p.status !== 'Pago').forEach(p => S.recalcPayment(p.id)); }

export function discountForm(id = null, preset = {}) {
  const d = id ? db.get('employee_discounts', id) : null;
  openForm({
    title: d ? 'Editar desconto' : 'Novo desconto', values: d || { date: today(), month: monthKey(today()), ...preset },
    fields: [
      { name: 'employee_id', label: 'Funcionário', type: 'ref', source: 'employee', required: true, full: true }, dateF(),
      { name: 'month', label: 'Mês de referência', type: 'month', required: true },
      { name: 'description', label: 'Descrição', required: true, placeholder: 'Ex.: falta, compra na fazenda…' },
      { name: 'amount', label: 'Valor', type: 'money', required: true, min: 0.01 },
      notes,
    ],
    danger: danger('employee_discounts', id),
    onSubmit: (v) => { if (id) db.update('employee_discounts', id, v); else db.insert('employee_discounts', v); refreshPayroll(v.employee_id); toast('Desconto registrado.'); },
  });
}

export function paymentForm(id = null, preset = {}) {
  const p = id ? db.get('employee_payments', id) : null;
  const cfg = payrollCfg();
  openForm({
    title: p ? `Salário — ${S.employeeName(p.employee_id)} — ${fmtMonth(p.month)}` : 'Lançar salário do mês', size: 'lg',
    intro: `<b>Atenção:</b> ${esc(cfg.note)}`,
    values: p || { month: monthKey(today()), status: 'Pendente', additions: 0, overtime_hours: 0, others: 0, ...preset },
    fields: [
      { name: 'employee_id', label: 'Funcionário', type: 'ref', source: 'employee', required: true },
      { name: 'month', label: 'Mês', type: 'month', required: true },
      { name: 'base_salary', label: 'Salário base', type: 'money', required: true, min: 0 },
      { name: 'additions', label: 'Adicionais', type: 'money', min: 0 },
      { name: 'overtime_hours', label: 'Horas extras (quantidade)', type: 'number', suffix: 'h', min: 0, hint: `Valor calculado: salário ÷ ${cfg.hours_month} h × ${cfg.overtime_rate}. Ajustável em Configurações.` },
      { name: 'overtime_value', label: 'Valor das horas extras', type: 'money', min: 0 },
      { name: 'vales_value', label: 'Vales (automático)', type: 'money', min: 0, hint: 'Parcelas de vales do mês.' },
      { name: 'advances_value', label: 'Adiantamentos (automático)', type: 'money', min: 0 },
      { name: 'discounts_value', label: 'Descontos (automático)', type: 'money', min: 0 },
      { name: 'others', label: 'Outros (+ ou −)', type: 'money', hint: 'Use valor negativo para descontar.' },
      { name: '_net', label: 'Salário líquido', type: 'computed', full: true, compute: (v) => `<span style="font-size:20px">${fmtMoney(S.netSalary(v))}</span>&nbsp;<span class="muted small">= base + adicionais + horas extras + outros − vales − descontos − adiantamentos</span>` },
      { name: 'status', label: 'Situação', type: 'choice', options: ['Pendente', 'Pago'] },
      { name: 'payment_date', label: 'Data de pagamento', type: 'date', show: (v) => v.status === 'Pago' },
      notes,
    ],
    onChange: (v, api, ch) => {
      if ((ch === 'employee_id' || ch === 'month' || ch === null) && v.employee_id && v.month && !p) {
        const e = db.get('employees', v.employee_id);
        if (ch !== null || !v.base_salary) api.set('base_salary', num(e?.salary));
        const parts = S.payrollParts(v.employee_id, v.month);
        Object.entries(parts).forEach(([k, x]) => api.set(k, x));
      }
      if (ch === 'overtime_hours' || ch === 'base_salary') api.set('overtime_value', S.overtimeValue(v.base_salary, v.overtime_hours));
    },
    danger: danger('employee_payments', id),
    onSubmit: (v) => { S.savePayment(v, id); toast('Salário salvo.'); },
  });
}
