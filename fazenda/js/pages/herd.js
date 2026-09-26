// REBANHO — animais, nascimentos, mortalidade, reprodução, pesagens e saúde.
import * as db from '../db.js';
import * as S from '../services.js';
import * as F from '../forms.js';
import * as St from '../stats.js';
import { can } from '../auth.js';
import { icon, $, badge } from '../ui.js';
import { esc, fmtDate, fmtNum, fmtAge, today, diffDays, inRange, sum, groupBy, num, fmtKg } from '../util.js';
import { ANIMAL_STATUS, list } from '../config.js';
import { listPage, cellMain, sumBox, rangeOf } from './common.js';

export const statusTone = { 'Ativo': 'green', 'Em produção': 'blue', 'Seco': 'neutral', 'Gestante': 'rose', 'Vendido': 'gold', 'Morto': 'dark', 'Transferido': 'gold', 'Outro': 'neutral' };
export const statusBadge = (s) => badge(s, statusTone[s] || 'neutral');
export const animalLink = (id, extraName) => { const a = db.get('animals', id); return a ? `<a href="#/animal/${a.id}">${esc(S.animalName(a))}</a> <span class="muted small">#${S.animalCode(a)}</span>` : (extraName ? esc(extraName) + ' <span class="muted small">(não cadastrado)</span>' : '<span class="muted">—</span>'); };
const animalText = (id, name) => { const a = db.get('animals', id); return a ? S.animalLabel(a) : (name || ''); };
const btn = (perm, id, label, ic = 'plus', cls = 'btn-primary') => can(perm) ? `<button class="btn ${cls}" data-act="${id}">${icon(ic, 18)} ${esc(label)}</button>` : '';

export function animals(el) {
  const today_ = today();
  const milkToday = groupBy(db.where('milk_production', m => m.date === today_), m => m.animal_id);
  listPage(el, {
    id: 'animals', title: 'Animais', sub: 'Cada animal tem uma identidade digital única. O ID nunca é reutilizado.',
    actions: btn('births.edit', 'birth', 'Nascimento', 'star', 'btn-ghost') + btn('herd.edit', 'new', 'Novo animal'),
    bindActions: (root) => { $('[data-act=new]', root) && ($('[data-act=new]', root).onclick = () => F.animalForm()); $('[data-act=birth]', root) && ($('[data-act=birth]', root).onclick = () => F.birthForm()); },
    defaults: { status: 'ativos' },
    filters: [
      { type: 'search', key: 'q', placeholder: 'Nome, brinco ou ID…', text: (a) => `${a.name} ${a.tag} ${S.animalCode(a)} ${a.code}` },
      { type: 'select', key: 'status', label: 'Situação', options: [['ativos', 'Somente ativos'], ...ANIMAL_STATUS.map(s => [s, s])], match: (a, v) => v === 'ativos' ? S.isActive(a) : a.status === v },
      { type: 'select', key: 'sex', label: 'Sexo', options: [['F', 'Fêmeas'], ['M', 'Machos']], match: (a, v) => a.sex === v },
      { type: 'select', key: 'breed', label: 'Raça', options: () => list('breeds'), match: (a, v) => a.breed === v },
      { type: 'select', key: 'category', label: 'Categoria', options: () => list('herd_categories'), match: (a, v) => a.category === v },
    ],
    rows: () => db.all('animals'),
    defaultSort: { key: 'name', dir: 'asc' },
    columns: [
      { key: 'name', label: 'Animal', value: (a) => S.animalName(a), text: (a) => S.animalName(a), render: (a) => `<div class="row-flex">${a.photo ? `<img class="thumb" src="${a.photo}" alt="">` : `<span class="thumb">${icon('cow', 18)}</span>`}${cellMain(esc(S.animalName(a)), `ID #${S.animalCode(a)}`)}</div>` },
      { key: 'code', label: 'ID', value: (a) => a.code, render: (a) => `#${S.animalCode(a)}`, hideSm: true },
      { key: 'tag', label: 'Brinco', render: (a) => esc(a.tag || '—') },
      { key: 'sex', label: 'Sexo', text: (a) => S.sexLabel(a.sex), render: (a) => S.sexLabel(a.sex), hideSm: true },
      { key: 'breed', label: 'Raça', hideSm: true },
      { key: 'birth_date', label: 'Idade', text: (a) => fmtAge(a.birth_date), render: (a) => fmtAge(a.birth_date), hideSm: true },
      { key: 'category', label: 'Categoria', hideSm: true },
      { key: 'status', label: 'Situação', render: (a) => statusBadge(a.status) + (a.status !== 'Gestante' && S.isPregnant(a) ? ' ' + badge('Gestante', 'rose') : '') },
      { key: 'current_weight', label: 'Peso', align: 'right', value: (a) => num(a.current_weight) || null, render: (a) => a.current_weight ? fmtKg(a.current_weight) : '—', hideSm: true },
      { key: 'milk', label: 'Leite hoje', align: 'right', value: (a) => sum(milkToday.get(a.id) || [], m => m.liters) || null, render: (a) => milkToday.get(a.id) ? `${fmtNum(sum(milkToday.get(a.id), m => m.liters))} L` : '', hideSm: true },
    ],
    summary: (rows) => sumBox([['Animais listados', fmtNum(rows.length, 0)], ['Fêmeas', fmtNum(rows.filter(a => a.sex === 'F').length, 0)], ['Machos', fmtNum(rows.filter(a => a.sex === 'M').length, 0)], ['Em produção', fmtNum(rows.filter(a => a.status === 'Em produção').length, 0)]]),
    onRowClick: (a) => { location.hash = `#/animal/${a.id}`; },
  });
}

export function births(el) {
  listPage(el, {
    id: 'births', title: 'Nascimentos', sub: 'Ao registrar um nascimento, o animal é criado e vinculado ao pai e à mãe automaticamente.',
    actions: btn('births.edit', 'new', 'Registrar nascimento', 'star'),
    bindActions: (root) => { const b = $('[data-act=new]', root); if (b) b.onclick = () => F.birthForm(); },
    defaultPeriod: 'year',
    filters: [{ type: 'period' }, { type: 'search', key: 'q', placeholder: 'Cria, pai, mãe…', text: (b) => `${animalText(b.animal_id)} ${animalText(b.sire_id, b.sire_name)} ${animalText(b.dam_id, b.dam_name)}` },
      { type: 'select', key: 'sex', label: 'Sexo', options: [['F', 'Fêmeas'], ['M', 'Machos']], match: (b, v) => db.get('animals', b.animal_id)?.sex === v }],
    rows: (st) => db.where('animal_births', b => inRange(b.birth_date, rangeOf(st))),
    defaultSort: { key: 'number', dir: 'desc' },
    columns: [
      { key: 'number', label: 'Nº', value: (b) => b.number },
      { key: 'animal', label: 'Nome da cria', text: (b) => S.animalName(db.get('animals', b.animal_id)), value: (b) => S.animalName(db.get('animals', b.animal_id)), render: (b) => animalLink(b.animal_id) },
      { key: 'tag', label: 'Brinco', value: (b) => db.get('animals', b.animal_id)?.tag, hideSm: true },
      { key: 'birth_date', label: 'Nascimento', text: (b) => fmtDate(b.birth_date), render: (b) => fmtDate(b.birth_date) },
      { key: 'sex', label: 'Sexo', text: (b) => S.sexLabel(db.get('animals', b.animal_id)?.sex), render: (b) => S.sexLabel(db.get('animals', b.animal_id)?.sex) },
      { key: 'breed', label: 'Raça', value: (b) => db.get('animals', b.animal_id)?.breed, hideSm: true },
      { key: 'sire', label: 'Pai', text: (b) => animalText(b.sire_id, b.sire_name), render: (b) => animalLink(b.sire_id, b.sire_name) },
      { key: 'dam', label: 'Mãe', text: (b) => animalText(b.dam_id, b.dam_name), render: (b) => animalLink(b.dam_id, b.dam_name) },
      { key: 'weight', label: 'Peso ao nascer', align: 'right', render: (b) => b.weight ? fmtKg(b.weight) : '—' },
      { key: 'responsible', label: 'Responsável', hideSm: true },
      { key: 'notes', label: 'Observação', hideSm: true },
    ],
    summary: (rows) => { const an = rows.map(b => db.get('animals', b.animal_id)).filter(Boolean); const w = rows.filter(b => b.weight); return sumBox([['Nascimentos', fmtNum(rows.length, 0)], ['Fêmeas', fmtNum(an.filter(a => a.sex === 'F').length, 0)], ['Machos', fmtNum(an.filter(a => a.sex === 'M').length, 0)], ['Peso médio', w.length ? fmtKg(sum(w, b => b.weight) / w.length) : '—']]); },
    onRowClick: (b) => { location.hash = `#/animal/${b.animal_id}`; },
  });
}

export function deaths(el) {
  listPage(el, {
    id: 'deaths', title: 'Mortalidade', sub: 'O animal muda para "Morto" automaticamente e seu histórico é preservado.',
    actions: btn('deaths.edit', 'new', 'Registrar mortalidade', 'plus', 'btn-rose'),
    bindActions: (root) => { const b = $('[data-act=new]', root); if (b) b.onclick = () => F.deathForm(); },
    defaultPeriod: 'year',
    filters: [{ type: 'period' }, { type: 'search', key: 'q', text: (d) => `${animalText(d.animal_id)} ${d.cause} ${d.notes}` },
      { type: 'select', key: 'cause', label: 'Causa', options: () => list('death_causes'), match: (d, v) => d.cause === v },
      { type: 'select', key: 'sex', label: 'Sexo', options: [['F', 'Fêmeas'], ['M', 'Machos']], match: (d, v) => db.get('animals', d.animal_id)?.sex === v }],
    rows: (st) => db.where('animal_deaths', d => inRange(d.date, rangeOf(st))),
    defaultSort: { key: 'date', dir: 'desc' },
    columns: [
      { key: 'animal', label: 'Animal', text: (d) => animalText(d.animal_id), value: (d) => animalText(d.animal_id), render: (d) => animalLink(d.animal_id) },
      { key: 'date', label: 'Data da morte', text: (d) => fmtDate(d.date), render: (d) => fmtDate(d.date) },
      { key: 'age', label: 'Idade', value: (d) => d.age_days, text: (d) => fmtAge(db.get('animals', d.animal_id)?.birth_date, d.date), render: (d) => fmtAge(db.get('animals', d.animal_id)?.birth_date, d.date) },
      { key: 'sex', label: 'Sexo', text: (d) => S.sexLabel(db.get('animals', d.animal_id)?.sex), render: (d) => S.sexLabel(db.get('animals', d.animal_id)?.sex), hideSm: true },
      { key: 'breed', label: 'Raça', value: (d) => db.get('animals', d.animal_id)?.breed, hideSm: true },
      { key: 'cause', label: 'Causa' }, { key: 'responsible', label: 'Responsável', hideSm: true }, { key: 'notes', label: 'Observações', hideSm: true },
    ],
    summary: (rows) => { const c = [...groupBy(rows, d => d.cause || 'Não informada')].sort((a, b) => b[1].length - a[1].length); const h = St.herdCounts(); return sumBox([['Mortes', fmtNum(rows.length, 0)], ['Taxa sobre o rebanho', h.active ? fmtNum(rows.length / (h.active + rows.length) * 100, 1) + '%' : '—'], ...c.slice(0, 3).map(([k, v]) => [k, fmtNum(v.length, 0)])]); },
    onRowClick: (d) => { location.hash = `#/animal/${d.animal_id}`; },
  });
}

const pregTone = { Aguardando: 'gold', Confirmada: 'rose', Negativa: 'neutral' };
export function repro(el) {
  const t = today();
  listPage(el, {
    id: 'repro', title: 'Reprodução', sub: 'A data prevista do parto é calculada automaticamente pelo tempo de gestação configurado.',
    actions: btn('repro.edit', 'new', 'Nova cobertura / IA', 'heart'),
    bindActions: (root) => { const b = $('[data-act=new]', root); if (b) b.onclick = () => F.reproForm(); },
    defaults: { st: 'abertas' },
    filters: [{ type: 'search', key: 'q', text: (r) => `${animalText(r.animal_id)} ${animalText(r.bull_id, r.bull_name)} ${r.type} ${r.responsible}` },
      { type: 'select', key: 'st', label: 'Situação', options: [['abertas', 'Em andamento'], ['Aguardando', 'Aguardando diagnóstico'], ['Confirmada', 'Gestação confirmada'], ['Negativa', 'Negativa'], ['parida', 'Parto realizado']],
        match: (r, v) => v === 'abertas' ? !r.actual_calving && r.pregnancy_status !== 'Negativa' : v === 'parida' ? !!r.actual_calving : r.pregnancy_status === v && !r.actual_calving }],
    rows: () => db.all('animal_reproduction'),
    defaultSort: { key: 'expected_calving', dir: 'asc' },
    columns: [
      { key: 'animal', label: 'Fêmea', text: (r) => animalText(r.animal_id), value: (r) => animalText(r.animal_id), render: (r) => animalLink(r.animal_id) },
      { key: 'date', label: 'Cobertura', text: (r) => fmtDate(r.date), render: (r) => fmtDate(r.date) },
      { key: 'type', label: 'Tipo', hideSm: true },
      { key: 'bull', label: 'Touro / pai', text: (r) => animalText(r.bull_id, r.bull_name), render: (r) => animalLink(r.bull_id, r.bull_name), hideSm: true },
      { key: 'responsible', label: 'Responsável', hideSm: true },
      { key: 'pregnancy_status', label: 'Gestação', render: (r) => r.actual_calving ? badge('Parida', 'green') : badge(r.pregnancy_status || 'Aguardando', pregTone[r.pregnancy_status] || 'gold') },
      { key: 'expected_calving', label: 'Previsão do parto', text: (r) => fmtDate(r.expected_calving), render: (r) => { if (!r.expected_calving || r.pregnancy_status === 'Negativa') return '—'; const d = diffDays(t, r.expected_calving); return `${fmtDate(r.expected_calving)}${r.actual_calving ? '' : ` <span class="small ${d < 0 ? 'delta-down' : 'muted'}">${d < 0 ? `(${-d} d atraso)` : `(em ${d} d)`}</span>`}`; } },
      { key: 'actual_calving', label: 'Parto real', text: (r) => fmtDate(r.actual_calving), render: (r) => r.actual_calving ? fmtDate(r.actual_calving) : '—' },
    ],
    summary: () => { const all = db.all('animal_reproduction').filter(r => !r.actual_calving); return sumBox([['Gestantes', fmtNum(all.filter(r => r.pregnancy_status === 'Confirmada').length, 0)], ['Aguardando diagnóstico', fmtNum(all.filter(r => (r.pregnancy_status || 'Aguardando') === 'Aguardando').length, 0)], ['Partos nos próximos 30 dias', fmtNum(all.filter(r => r.pregnancy_status === 'Confirmada' && r.expected_calving && diffDays(t, r.expected_calving) <= 30 && diffDays(t, r.expected_calving) >= 0).length, 0)], ['Partos atrasados', fmtNum(all.filter(r => r.pregnancy_status === 'Confirmada' && r.expected_calving < t).length, 0)]]); },
    onRowClick: (r) => can('repro.edit') ? F.reproForm(r.id) : (location.hash = `#/animal/${r.animal_id}`),
  });
}

export function weights(el) {
  listPage(el, {
    id: 'weights', title: 'Pesagens', sub: 'O peso atual do animal é atualizado automaticamente pela pesagem mais recente.',
    actions: btn('weights.edit', 'new', 'Registrar pesagem', 'scale'),
    bindActions: (root) => { const b = $('[data-act=new]', root); if (b) b.onclick = () => F.weightForm(); },
    defaultPeriod: '3m',
    filters: [{ type: 'period' }, { type: 'search', key: 'q', text: (w) => animalText(w.animal_id) }],
    rows: (st) => db.where('animal_weights', w => inRange(w.date, rangeOf(st))),
    defaultSort: { key: 'date', dir: 'desc' },
    columns: [
      { key: 'animal', label: 'Animal', text: (w) => animalText(w.animal_id), value: (w) => animalText(w.animal_id), render: (w) => animalLink(w.animal_id) },
      { key: 'date', label: 'Data', text: (w) => fmtDate(w.date), render: (w) => fmtDate(w.date) },
      { key: 'weight', label: 'Peso', align: 'right', value: (w) => num(w.weight), render: (w) => fmtKg(w.weight) },
      { key: 'age', label: 'Idade', value: (w) => w.age_days, text: (w) => fmtAge(db.get('animals', w.animal_id)?.birth_date, w.date), render: (w) => fmtAge(db.get('animals', w.animal_id)?.birth_date, w.date) },
      { key: 'gmd', label: 'Ganho diário', align: 'right', value: (w) => gmd(w), render: (w) => gmd(w) == null ? '—' : `${fmtNum(gmd(w), 0)} g/dia` },
      { key: 'responsible', label: 'Responsável', hideSm: true }, { key: 'notes', label: 'Observação', hideSm: true },
    ],
    onRowClick: (w) => can('weights.edit') ? F.weightForm(w.id) : (location.hash = `#/animal/${w.animal_id}`),
  });
}
function gmd(w) {
  const prev = db.where('animal_weights', x => x.animal_id === w.animal_id && x.date < w.date).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!prev) return null; const d = diffDays(prev.date, w.date); return d > 0 ? (num(w.weight) - num(prev.weight)) / d * 1000 : null;
}

export function health(el) {
  const t = today();
  listPage(el, {
    id: 'health', title: 'Saúde / Tratamentos', sub: 'Vacinações, medicamentos, tratamentos, doenças e consultas. Produtos usados saem do estoque automaticamente.',
    actions: btn('health.edit', 'new', 'Novo registro', 'health'),
    bindActions: (root) => { const b = $('[data-act=new]', root); if (b) b.onclick = () => F.healthForm(); },
    defaultPeriod: 'year',
    filters: [{ type: 'period' }, { type: 'search', key: 'q', text: (h) => `${animalText(h.animal_id)} ${h.description} ${h.type} ${h.responsible}` },
      { type: 'select', key: 'type', label: 'Tipo', options: () => list('health_types'), match: (h, v) => h.type === v },
      { type: 'select', key: 'next', label: 'Próximos', options: [['pend', 'Com procedimento futuro pendente']], match: (h) => h.next_date && !h.next_done }],
    rows: (st) => db.where('animal_health', h => inRange(h.date, rangeOf(st)) || (st.next && h.next_date && !h.next_done)),
    defaultSort: { key: 'date', dir: 'desc' },
    columns: [
      { key: 'animal', label: 'Animal', text: (h) => animalText(h.animal_id), value: (h) => animalText(h.animal_id), render: (h) => animalLink(h.animal_id) },
      { key: 'type', label: 'Tipo', render: (h) => badge(h.type, h.type === 'Vacinação' ? 'green' : h.type === 'Doença' ? 'rose' : 'blue') },
      { key: 'date', label: 'Data', text: (h) => fmtDate(h.date), render: (h) => fmtDate(h.date) },
      { key: 'description', label: 'Descrição' },
      { key: 'product', label: 'Produto', text: (h) => h.product_id ? S.productName(h.product_id) : '', render: (h) => h.product_id ? `${esc(S.productName(h.product_id))} <span class="muted small">(${fmtNum(h.quantity, 2)})</span>` : '—', hideSm: true },
      { key: 'next_date', label: 'Próxima', text: (h) => fmtDate(h.next_date), render: (h) => h.next_date ? (h.next_done ? `<s class="muted">${fmtDate(h.next_date)}</s>` : `${fmtDate(h.next_date)} ${h.next_date < t ? badge('atrasada', 'rose') : diffDays(t, h.next_date) <= 7 ? badge('próxima', 'gold') : ''}`) : '—' },
      { key: 'responsible', label: 'Responsável', hideSm: true },
    ],
    onRowClick: (h) => can('health.edit') ? F.healthForm(h.id) : (location.hash = `#/animal/${h.animal_id}`),
  });
}
