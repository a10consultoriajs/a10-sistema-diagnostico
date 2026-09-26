// CENTRAL DE ALERTAS
import { can } from '../auth.js';
import { icon, $, $$, pageHead, tabs, badge, toast } from '../ui.js';
import { esc } from '../util.js';
import { computeAlerts, setAlertState, ALERT_TYPES } from '../alerts.js';
import { pageState } from './common.js';

const ICON = { stock: 'package', vaccine: 'health', calving: 'star', repro: 'heart', maintenance: 'wrench', milk_missing: 'milk', milk_drop: 'trendDown', payroll: 'money', pending: 'list', feed: 'wheat' };
const STATE = { novo: ['Novo', 'rose'], lido: ['Lido', 'blue'], resolvido: ['Resolvido', 'green'], ignorado: ['Ignorado', 'neutral'] };

export function render(el) {
  const st = pageState('alerts', { tab: 'abertos', type: '' });
  const all = computeAlerts().filter(a => !a.perm || can(a.perm));
  const pick = { abertos: (a) => a.state === 'novo' || a.state === 'lido', resolvidos: (a) => a.state === 'resolvido', ignorados: (a) => a.state === 'ignorado', todos: () => true };
  const rows = all.filter(pick[st.tab]).filter(a => !st.type || a.type === st.type);
  const cnt = (k) => all.filter(pick[k]).length;
  el.innerHTML = `${pageHead('Alertas', 'Gerados automaticamente a partir dos lançamentos: estoque, vacinação, partos, manutenção, produção, pagamentos e cadastros incompletos.', `<button class="btn btn-ghost" id="read-all">${icon('check', 18)} Marcar todos como lidos</button>`)}
    ${tabs([['abertos', `Abertos (${cnt('abertos')})`], ['resolvidos', `Resolvidos (${cnt('resolvidos')})`], ['ignorados', `Ignorados (${cnt('ignorados')})`], ['todos', 'Todos']], st.tab)}
    <div class="filters"><select class="input" id="type"><option value="">Todos os tipos</option>${Object.entries(ALERT_TYPES).map(([k, l]) => `<option value="${k}" ${st.type === k ? 'selected' : ''}>${esc(l)} (${all.filter(a => a.type === k && pick[st.tab](a)).length})</option>`).join('')}</select></div>
    <div>${rows.length ? rows.map(a => `<div class="alert-item alert-${a.severity} ${a.state === 'lido' ? 'read' : ''}" data-k="${esc(a.key)}">
        <div class="a-ico">${icon(ICON[a.type] || 'alert', 18)}</div>
        <div style="flex:1;min-width:0"><div class="row-flex" style="flex-wrap:wrap"><span class="a-title">${esc(a.title)}</span>${badge(ALERT_TYPES[a.type] || a.type, 'neutral')}${badge(...STATE[a.state])}</div>
          <div class="muted">${esc(a.message)}</div>
          <div class="alert-actions">${a.link ? `<a class="btn btn-sm btn-primary" href="${a.link}">Abrir</a>` : ''}
            ${a.state === 'novo' ? '<button class="btn btn-sm btn-ghost" data-s="lido">Marcar como lido</button>' : ''}
            ${a.state !== 'resolvido' ? '<button class="btn btn-sm btn-ghost" data-s="resolvido">Resolvido</button>' : ''}
            ${a.state !== 'ignorado' ? '<button class="btn btn-sm btn-ghost" data-s="ignorado">Ignorar</button>' : ''}
            ${a.state !== 'novo' ? '<button class="btn btn-sm btn-ghost" data-s="novo">Reabrir</button>' : ''}</div></div></div>`).join('')
      : `<div class="card empty-state">${icon('check', 36)}<p>Nenhum alerta ${st.tab === 'abertos' ? 'aberto' : 'nesta lista'}. Tudo em dia!</p></div>`}</div>`;
  $$('[data-tab]', el).forEach(b => b.onclick = () => { st.tab = b.dataset.tab; render(el); });
  $('#type', el).onchange = (e) => { st.type = e.target.value; render(el); };
  $$('[data-s]', el).forEach(b => b.onclick = () => { setAlertState(b.closest('[data-k]').dataset.k, b.dataset.s); toast('Alerta atualizado.'); });
  $('#read-all', el).onclick = () => { all.filter(a => a.state === 'novo').forEach(a => setAlertState(a.key, 'lido')); toast('Alertas marcados como lidos.'); };
}
