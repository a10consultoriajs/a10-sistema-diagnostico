// LANÇAMENTO RÁPIDO — telas grandes e diretas para o campo.
import * as db from '../db.js';
import * as F from '../forms.js';
import * as S from '../services.js';
import { can, currentUser } from '../auth.js';
import { icon, $, $$, toast, pageHead, mountCombo } from '../ui.js';
import { esc, today, fmtNum, num, fmtDate, addDays } from '../util.js';
import { shiftLabel } from '../config.js';
import { pageState } from './common.js';

export const QUICK_ACTIONS = [
  { k: 'animal', label: 'Novo animal', icon: 'cow', perm: 'herd.edit', fn: () => F.animalForm() },
  { k: 'birth', label: 'Nascimento', icon: 'star', perm: 'births.edit', fn: () => F.birthForm() },
  { k: 'milk', label: 'Produção', icon: 'milk', perm: 'milk.edit', fn: () => F.milkForm() },
  { k: 'death', label: 'Mortalidade', icon: 'trendDown', perm: 'deaths.edit', fn: () => F.deathForm(), rose: true },
  { k: 'dist', label: 'Distribuição de ração', icon: 'truck', perm: 'feed.edit', fn: () => F.distributionForm() },
  { k: 'fab', label: 'Fabricar ração', icon: 'factory', perm: 'feed.edit', fn: () => F.fabricationForm() },
  { k: 'in', label: 'Entrada estoque', icon: 'arrowIn', perm: 'inventory.edit', fn: () => F.stockInForm() },
  { k: 'out', label: 'Saída estoque', icon: 'arrowOut', perm: 'inventory.edit', fn: () => F.stockOutForm() },
  { k: 'service', label: 'Serviço de máquina', icon: 'tractor', perm: 'machines.edit', fn: () => F.serviceForm() },
  { k: 'employee', label: 'Novo funcionário', icon: 'user', perm: 'employees.edit', fn: () => F.employeeForm() },
  { k: 'advance', label: 'Vale', icon: 'money', perm: 'payroll.edit', fn: () => F.advanceForm() },
];
export const quickButtons = () => `<div class="quick">${QUICK_ACTIONS.filter(a => can(a.perm)).map(a => `<button data-qa="${a.k}" class="${a.rose ? 'rose' : ''}"><span class="qi">${icon(a.icon, 18)}</span>+&nbsp;${esc(a.label.toUpperCase())}</button>`).join('')}</div>`;
export const bindQuick = (root) => $$('[data-qa]', root).forEach(b => b.onclick = () => QUICK_ACTIONS.find(a => a.k === b.dataset.qa).fn());

const TILES = [
  { k: 'ordenha', label: 'Ordenha do turno', sub: 'Lista de vacas: digite os litros e salve tudo', icon: 'milk', perm: 'milk.edit' },
  { k: 'milk', label: 'Produção de 1 animal', sub: 'Animal → litros → salvar', icon: 'droplet', perm: 'milk.edit' },
  { k: 'birth', label: 'Nascimento', sub: 'Cria já entra no rebanho', icon: 'star', perm: 'births.edit' },
  { k: 'dist', label: 'Distribuir ração', sub: 'Lote → kg → nº de animais', icon: 'truck', perm: 'feed.edit' },
  { k: 'fab', label: 'Batida de ração', sub: 'Gera lote e baixa ingredientes', icon: 'factory', perm: 'feed.edit' },
  { k: 'service', label: 'Serviço de trator', sub: 'Início e fim — horas automáticas', icon: 'tractor', perm: 'machines.edit' },
  { k: 'in', label: 'Entrada no estoque', sub: 'Chegou mercadoria', icon: 'arrowIn', perm: 'inventory.edit' },
  { k: 'out', label: 'Saída do estoque', sub: 'Retirou do almoxarifado', icon: 'arrowOut', perm: 'inventory.edit' },
  { k: 'weight', label: 'Pesagem', sub: 'Animal → peso', icon: 'scale', perm: 'weights.edit', fn: () => F.weightForm() },
  { k: 'health', label: 'Vacina / tratamento', sub: 'Baixa o produto do estoque', icon: 'health', perm: 'health.edit', fn: () => F.healthForm() },
  { k: 'death', label: 'Mortalidade', sub: 'Registrar morte', icon: 'trendDown', perm: 'deaths.edit' },
];

export function render(el, { query }) {
  if (query.modo === 'ordenha') return milkingSheet(el, query);
  const tiles = TILES.filter(t => can(t.perm));
  el.innerHTML = `${pageHead('Lançamento rápido', `Olá, ${esc(currentUser().name.split(' ')[0])}! Data, horário e usuário são registrados automaticamente.`)}
    ${tiles.length ? `<div class="qgrid">${tiles.map(t => `<button class="qtile" data-t="${t.k}"><span class="qi">${icon(t.icon, 26)}</span><b>${esc(t.label)}</b><span>${esc(t.sub)}</span></button>`).join('')}</div>` : '<div class="card empty-state">Seu perfil não possui lançamentos liberados. Fale com o administrador.</div>'}`;
  $$('[data-t]', el).forEach(b => b.onclick = () => {
    const t = TILES.find(x => x.k === b.dataset.t);
    if (t.k === 'ordenha') { location.hash = '#/rapido?modo=ordenha'; return; }
    (t.fn || QUICK_ACTIONS.find(a => a.k === t.k).fn)();
  });
}

// Planilha de ordenha: todas as vacas em produção numa lista, um campo por vaca
export function milkingSheet(el, query = {}) {
  const st = pageState('ordenha', { date: today(), shift: new Date().getHours() < 12 ? 'manha' : 'tarde' });
  if (!can('milk.edit')) { el.innerHTML = '<div class="card empty-state">Sem permissão para registrar produção.</div>'; return; }
  const cows = db.where('animals', a => a.status === 'Em produção' && a.sex === 'F').sort((a, b) => S.animalName(a).localeCompare(S.animalName(b), 'pt-BR'));
  const existing = (id) => db.find('milk_production', m => m.animal_id === id && m.date === st.date && m.shift === st.shift);
  const yesterday = (id) => db.find('milk_production', m => m.animal_id === id && m.date === addDays(st.date, -1) && m.shift === st.shift);
  el.innerHTML = `<div class="crumbs"><a href="#/rapido">Lançamento rápido</a> › Ordenha</div>
    ${pageHead('Ordenha do turno', 'Digite os litros de cada vaca. Os campos já lançados aparecem em verde. Salve no final.')}
    <div class="card" data-hold>
      <div class="filters"><input class="input" type="date" id="o-date" value="${st.date}" max="${today()}">
        <div class="choice" style="flex:1">${[['manha', 'Manhã'], ['tarde', 'Tarde']].map(([k, l]) => `<button class="choice-btn ${st.shift === k ? 'on' : ''}" data-shift="${k}">${l}</button>`).join('')}</div></div>
      <div class="milk-list">${cows.length ? cows.map(a => { const e = existing(a.id), y = yesterday(a.id); return `<div class="milk-row ${e ? 'done' : ''}" data-id="${a.id}">
          <div class="mr-name"><b>${esc(S.animalName(a))}</b><span class="muted small">#${S.animalCode(a)}${a.tag ? ' · brinco ' + esc(a.tag) : ''}${y ? ` · ontem ${fmtNum(y.liters)} L` : ''}</span></div>
          <input class="input" inputmode="decimal" placeholder="L" value="${e ? String(e.liters).replace('.', ',') : ''}" aria-label="Litros de ${esc(S.animalName(a))}"></div>`; }).join('') : '<div class="empty-state">Nenhuma vaca com situação "Em produção". Cadastre ou atualize a situação dos animais.</div>'}</div>
      <div class="muted small" style="margin-top:10px">Vaca que não está na lista? Use <a href="#" id="o-one">produção de 1 animal</a>.</div>
      <div class="sticky-save"><div class="grow" id="o-total"></div><button class="btn btn-primary btn-lg" id="o-save">${icon('check', 18)} Salvar ordenha</button></div>
    </div>`;
  const hold = $('[data-hold]', el);
  const total = () => { const t = $$('.milk-row input', el).reduce((s, i) => s + num(i.value), 0); const n = $$('.milk-row input', el).filter(i => i.value.trim()).length; $('#o-total').innerHTML = `<b>${fmtNum(t)} L</b> <span class="muted">em ${n} de ${cows.length} vacas · ${shiftLabel(st.shift)} de ${fmtDate(st.date)}</span>`; };
  $$('.milk-row input', el).forEach((i, idx, all) => {
    i.addEventListener('input', () => { hold.classList.add('dirty'); total(); });
    i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); (all[idx + 1] || $('#o-save')).focus(); } });
  });
  total();
  const reload = () => { hold.classList.remove('dirty'); milkingSheet(el, query); };
  $('#o-date').onchange = (e) => { st.date = e.target.value; reload(); };
  $$('[data-shift]', el).forEach(b => b.onclick = () => { st.shift = b.dataset.shift; reload(); });
  $('#o-one').onclick = (e) => { e.preventDefault(); F.milkForm(null, { date: st.date, shift: st.shift }); };
  $('#o-save').onclick = () => {
    let saved = 0, errors = [];
    for (const row of $$('.milk-row', el)) {
      const v = $('input', row).value.trim(); if (!v) continue;
      const e = existing(row.dataset.id);
      if (e && num(e.liters) === num(v)) continue;
      try { S.saveMilk({ animal_id: row.dataset.id, date: st.date, shift: st.shift, liters: num(v), responsible: currentUser().name }); saved++; }
      catch (err) { errors.push(`${S.animalName(db.get('animals', row.dataset.id))}: ${err.message}`); }
    }
    hold.classList.remove('dirty');
    if (errors.length) toast(errors.join(' · '), 'err', 6000);
    toast(saved ? `${saved} lançamento(s) salvo(s).` : 'Nada novo para salvar.');
    reload();
  };
}
