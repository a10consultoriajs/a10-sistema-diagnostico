// FUNCIONÁRIOS — cadastro, salários (controle mensal), vales, descontos e pagamentos.
import * as db from '../db.js';
import * as S from '../services.js';
import * as F from '../forms.js';
import { can } from '../auth.js';
import { icon, $, $$, badge, mountTable, pageHead, statCard, toast, confirmDialog } from '../ui.js';
import { esc, fmtDate, fmtNum, fmtMoney, today, inRange, sum, num, monthKey, addMonthKey, fmtMonth, fmtAge, fmtHours } from '../util.js';
import { list as listOf, EMPLOYEE_STATUS, payrollCfg } from '../config.js';
import { listPage, pageState, sumBox, cellMain, rangeOf } from './common.js';

const eTone = { Ativo: 'green', Afastado: 'gold', 'Férias': 'blue', Desligado: 'neutral' };
const eLink = (id) => { const e = db.get('employees', id); return e ? (can('employees.view') ? `<a href="#/funcionario/${e.id}">${esc(e.name)}</a>` : esc(e.name)) : '—'; };
const disclaimer = () => `<div class="disclaimer">${icon('alert', 16)} ${esc(payrollCfg().note)} As regras (horas extras, vales, descontos) podem ser ajustadas em Configurações › Regras.</div>`;

export function list(el) { return employeesList(el); }
function employeesList(el) {
  const pay = can('payroll.view');
  listPage(el, {
    id: 'emps', title: 'Funcionários', sub: 'Dados pessoais e financeiros têm acesso restrito por perfil.',
    actions: can('employees.edit') ? `<button class="btn btn-primary" data-act="new">${icon('plus', 18)} Novo funcionário</button>` : '',
    bindActions: (root) => { const b = $('[data-act=new]', root); if (b) b.onclick = () => F.employeeForm(); },
    defaults: { st: 'Ativo' },
    filters: [{ type: 'search', key: 'q', text: (e) => `${e.name} ${e.cpf} ${e.position} ${e.phone}` }, { type: 'select', key: 'st', label: 'Situação', options: EMPLOYEE_STATUS, match: (e, v) => e.status === v },
      { type: 'select', key: 'pos', label: 'Cargo', options: () => listOf('positions'), match: (e, v) => e.position === v }],
    rows: () => db.all('employees'), defaultSort: { key: 'name', dir: 'asc' },
    columns: [
      { key: 'name', label: 'Nome', render: (e) => cellMain(esc(e.name), esc(e.phone || '')) },
      { key: 'position', label: 'Cargo' }, { key: 'cpf', label: 'CPF', hideSm: true },
      { key: 'admission_date', label: 'Admissão', text: (e) => fmtDate(e.admission_date), render: (e) => `${fmtDate(e.admission_date)}<div class="cell-sub">${fmtAge(e.admission_date)} de casa</div>`, hideSm: true },
      { key: 'contract_type', label: 'Contratação', hideSm: true },
      ...(pay ? [{ key: 'salary', label: 'Salário', align: 'right', value: (e) => num(e.salary), render: (e) => fmtMoney(e.salary) }] : []),
      { key: 'status', label: 'Situação', render: (e) => badge(e.status, eTone[e.status]) },
    ],
    summary: (rows) => sumBox([['Funcionários', fmtNum(rows.length, 0)], ...(pay ? [['Soma dos salários', fmtMoney(sum(rows, e => e.salary))]] : [])]),
    onRowClick: (e) => { location.hash = `#/funcionario/${e.id}`; },
  });
}

export function employeePage(el, { params }) {
  const e = db.get('employees', params.id);
  if (!e) { el.innerHTML = '<div class="card">Funcionário não encontrado.</div>'; return; }
  const pay = can('payroll.view');
  const st = pageState('emp:' + e.id, { tab: pay ? 'pag' : 'svc' });
  const svc = db.where('machine_services', s => s.operator_id === e.id);
  const user = db.find('users', u => u.employee_id === e.id);
  el.innerHTML = `<div class="crumbs"><a href="#/funcionarios/cadastro">Funcionários</a> › ${esc(e.name)}</div>
    ${pageHead(e.name, `${esc(e.position || '')} · ${badge(e.status, eTone[e.status])}`, (can('employees.edit') ? `<button class="btn btn-ghost" data-a="edit">${icon('edit', 18)} Editar</button>` : '') + (can('payroll.edit') ? `<button class="btn btn-ghost" data-a="vale">${icon('money', 18)} Vale</button><button class="btn btn-primary" data-a="pay">${icon('money', 18)} Salário do mês</button>` : ''))}
    <div class="card" style="margin-bottom:16px"><dl class="kv">
      <div><dt>CPF</dt><dd>${esc(e.cpf || '—')}</dd></div><div><dt>Telefone</dt><dd>${esc(e.phone || '—')}</dd></div>
      <div><dt>Nascimento</dt><dd>${fmtDate(e.birth_date)}</dd></div><div><dt>Endereço</dt><dd>${esc(e.address || '—')}</dd></div>
      <div><dt>Admissão</dt><dd>${fmtDate(e.admission_date)}</dd></div><div><dt>Contratação</dt><dd>${esc(e.contract_type || '—')}</dd></div>
      ${pay ? `<div><dt>Salário</dt><dd>${fmtMoney(e.salary)}</dd></div><div><dt>Banco</dt><dd>${esc(e.bank || '—')}</dd></div><div><dt>Pix</dt><dd>${esc(e.pix || '—')}</dd></div>` : ''}
      <div><dt>Acesso ao sistema</dt><dd>${user ? `usuário <b>${esc(user.username)}</b>` : 'sem usuário'}</dd></div>
    </dl>${e.notes ? `<p class="muted">${esc(e.notes)}</p>` : ''}</div>
    <div class="tabs">${[...(pay ? [['pag', 'Salários'], ['vales', 'Vales'], ['desc', 'Descontos']] : []), ['svc', `Serviços de máquina (${svc.length})`]].map(([k, l]) => `<button class="tab ${st.tab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
    <div class="card" id="e-body"></div>`;
  const on = (k, fn) => { const b = $(`[data-a=${k}]`, el); if (b) b.onclick = fn; };
  on('edit', () => F.employeeForm(e.id)); on('vale', () => F.advanceForm(null, { employee_id: e.id })); on('pay', () => { const p = db.find('employee_payments', x => x.employee_id === e.id && x.month === monthKey(today())); F.paymentForm(p?.id || null, { employee_id: e.id }); });
  $$('[data-tab]', el).forEach(b => b.onclick = () => { st.tab = b.dataset.tab; employeePage(el, { params }); });
  const body = $('#e-body', el);
  if (st.tab === 'pag') mountTable(body, { id: 'ep-' + e.id, rows: db.where('employee_payments', p => p.employee_id === e.id), defaultSort: { key: 'month', dir: 'desc' }, columns: payCols().filter(c => c.key !== 'emp'), onRowClick: can('payroll.edit') ? (p) => F.paymentForm(p.id) : null });
  if (st.tab === 'vales') mountTable(body, { id: 'ev-' + e.id, rows: db.where('employee_advances', a => a.employee_id === e.id), defaultSort: { key: 'date', dir: 'desc' }, columns: advCols().filter(c => c.key !== 'emp'), onRowClick: can('payroll.edit') ? (a) => F.advanceForm(a.id) : null });
  if (st.tab === 'desc') mountTable(body, { id: 'ed-' + e.id, rows: db.where('employee_discounts', d => d.employee_id === e.id), defaultSort: { key: 'date', dir: 'desc' }, columns: discCols().filter(c => c.key !== 'emp'), onRowClick: can('payroll.edit') ? (d) => F.discountForm(d.id) : null });
  if (st.tab === 'svc') mountTable(body, { id: 'es-' + e.id, rows: svc, defaultSort: { key: 'date', dir: 'desc' }, empty: 'Nenhum serviço de máquina.', columns: [{ key: 'date', label: 'Data', render: (s) => fmtDate(s.date) }, { key: 'm', label: 'Máquina', render: (s) => esc(db.get('machines', s.machine_id)?.name || '') }, { key: 'activity', label: 'Atividade' }, { key: 'area', label: 'Área' }, { key: 'hours', label: 'Horas', align: 'right', render: (s) => fmtHours(s.hours) }] });
}

const statusPay = (p) => p.status === 'Pago' ? badge('Pago', 'green') : badge('Pendente', 'gold');
const payCols = () => [
  { key: 'month', label: 'Mês', text: (p) => fmtMonth(p.month), render: (p) => fmtMonth(p.month) },
  { key: 'emp', label: 'Funcionário', text: (p) => S.employeeName(p.employee_id), render: (p) => eLink(p.employee_id) },
  { key: 'base_salary', label: 'Salário base', align: 'right', value: (p) => num(p.base_salary), render: (p) => fmtMoney(p.base_salary) },
  { key: 'additions', label: 'Adicionais', align: 'right', value: (p) => num(p.additions), render: (p) => fmtMoney(p.additions), hideSm: true },
  { key: 'overtime_value', label: 'Horas extras', align: 'right', value: (p) => num(p.overtime_value), render: (p) => `${fmtMoney(p.overtime_value)}${num(p.overtime_hours) ? `<div class="cell-sub">${fmtNum(p.overtime_hours)} h</div>` : ''}`, hideSm: true },
  { key: 'vales_value', label: 'Vales', align: 'right', value: (p) => num(p.vales_value), render: (p) => fmtMoney(p.vales_value), hideSm: true },
  { key: 'advances_value', label: 'Adiantamentos', align: 'right', value: (p) => num(p.advances_value), render: (p) => fmtMoney(p.advances_value), hideSm: true },
  { key: 'discounts_value', label: 'Descontos', align: 'right', value: (p) => num(p.discounts_value), render: (p) => fmtMoney(p.discounts_value), hideSm: true },
  { key: 'others', label: 'Outros', align: 'right', value: (p) => num(p.others), render: (p) => fmtMoney(p.others), hideSm: true },
  { key: 'net', label: 'Líquido', align: 'right', value: (p) => num(p.net), render: (p) => `<b>${fmtMoney(p.net)}</b>` },
  { key: 'payment_date', label: 'Pagamento', text: (p) => fmtDate(p.payment_date), render: (p) => p.payment_date ? fmtDate(p.payment_date) : '—', hideSm: true },
  { key: 'status', label: 'Situação', render: statusPay },
];

export function salaries(el) {
  const st = pageState('salaries', { month: monthKey(today()) });
  const rows = db.where('employee_payments', p => p.month === st.month);
  const active = db.where('employees', e => e.status !== 'Desligado');
  el.innerHTML = `${pageHead('Salários', 'Controle mensal: salário base + adicionais + horas extras − vales − descontos − adiantamentos.', can('payroll.edit') ? `<button class="btn btn-ghost" data-a="new">${icon('plus', 18)} Lançar individual</button><button class="btn btn-primary" data-a="gen">${icon('refresh', 18)} Gerar / atualizar folha do mês</button>` : '')}
    ${disclaimer()}
    <div class="filters"><button class="btn btn-ghost" data-m="-1">${icon('left', 18)}</button><input class="input" type="month" id="month" value="${st.month}"><button class="btn btn-ghost" data-m="1">${icon('right', 18)}</button><span class="muted">${fmtMonth(st.month)}</span></div>
    <div class="stats">${statCard({ label: 'Folha líquida do mês', value: fmtMoney(sum(rows, p => p.net)), sub: `${rows.length} de ${active.length} funcionários lançados`, icon: 'money' })}
      ${statCard({ label: 'Pago', value: fmtMoney(sum(rows.filter(p => p.status === 'Pago'), p => p.net)), sub: `${rows.filter(p => p.status === 'Pago').length} pagamentos`, icon: 'check', tone: 'green' })}
      ${statCard({ label: 'Pendente', value: fmtMoney(sum(rows.filter(p => p.status !== 'Pago'), p => p.net)), sub: `${rows.filter(p => p.status !== 'Pago').length} a pagar`, icon: 'clock', tone: 'gold' })}
      ${statCard({ label: 'Vales + adiant. + descontos', value: fmtMoney(sum(rows, p => num(p.vales_value) + num(p.advances_value) + num(p.discounts_value))), icon: 'trendDown', tone: 'rose' })}</div>
    <div class="card"><div id="t"></div>${can('payroll.edit') && rows.some(p => p.status !== 'Pago') ? `<div style="margin-top:12px;text-align:right"><button class="btn btn-primary" data-a="payall">${icon('check', 18)} Marcar pendentes como pagos</button></div>` : ''}</div>`;
  const setMonth = (m) => { st.month = m; salaries(el); };
  $('#month', el).onchange = (e) => setMonth(e.target.value);
  $$('[data-m]', el).forEach(b => b.onclick = () => setMonth(addMonthKey(st.month, +b.dataset.m)));
  const on = (k, fn) => { const b = $(`[data-a=${k}]`, el); if (b) b.onclick = fn; };
  on('new', () => F.paymentForm(null, { month: st.month }));
  on('gen', () => { const r = S.generatePayroll(st.month); toast(`Folha de ${fmtMonth(st.month)}: ${r.created} criado(s), ${r.updated} atualizado(s) com vales e descontos.`); });
  on('payall', async () => {
    const pend = rows.filter(p => p.status !== 'Pago');
    if (!await confirmDialog(`Marcar ${pend.length} pagamento(s) como pagos hoje (${fmtDate(today())}), total ${fmtMoney(sum(pend, p => p.net))}?`)) return;
    pend.forEach(p => S.savePayment({ ...p, status: 'Pago', payment_date: today() }, p.id)); toast('Pagamentos registrados.');
  });
  mountTable($('#t', el), { id: 'sal', rows, columns: payCols(), defaultSort: { key: 'emp', dir: 'asc' }, empty: 'Nenhum lançamento neste mês. Use "Gerar folha do mês".',
    footer: rows.length ? `<tr><td colspan="${payCols().length - 3}">Total</td><td class="r">${fmtMoney(sum(rows, p => p.net))}</td><td colspan="2"></td></tr>` : '',
    onRowClick: can('payroll.edit') ? (p) => F.paymentForm(p.id) : null });
}

const advCols = () => [
  { key: 'date', label: 'Data', text: (a) => fmtDate(a.date), render: (a) => fmtDate(a.date) },
  { key: 'emp', label: 'Funcionário', text: (a) => S.employeeName(a.employee_id), render: (a) => eLink(a.employee_id) },
  { key: 'type', label: 'Tipo' }, { key: 'amount', label: 'Valor', align: 'right', value: (a) => num(a.amount), render: (a) => `<b>${fmtMoney(a.amount)}</b>` },
  { key: 'inst', label: 'Parcelas', text: (a) => `${a.installments}x ${a.installment_value}`, render: (a) => `${a.installments}× ${fmtMoney(a.installment_value)}<div class="cell-sub">a partir de ${fmtMonth(a.first_month)}</div>` },
  { key: 'reason', label: 'Motivo', hideSm: true }, { key: 'payment_method', label: 'Forma', hideSm: true },
  { key: 'status', label: 'Situação', render: (a) => badge(a.status, a.status === 'Quitado' ? 'green' : a.status === 'Cancelado' ? 'neutral' : 'gold') },
];
export function advances(el) {
  listPage(el, {
    id: 'advs', title: 'Vales e adiantamentos', sub: 'Vinculados automaticamente ao controle mensal de salário (parcela por mês).',
    actions: can('payroll.edit') ? `<button class="btn btn-primary" data-act="new">${icon('plus', 18)} Novo vale</button>` : '',
    bindActions: (root) => { const b = $('[data-act=new]', root); if (b) b.onclick = () => F.advanceForm(); },
    defaultPeriod: 'year',
    filters: [{ type: 'period' }, { type: 'search', key: 'q', text: (a) => `${S.employeeName(a.employee_id)} ${a.reason} ${a.type}` }, { type: 'select', key: 'st', label: 'Situação', options: ['Aberto', 'Quitado', 'Cancelado'], match: (a, v) => a.status === v }],
    rows: (st) => db.where('employee_advances', a => inRange(a.date, rangeOf(st))), defaultSort: { key: 'date', dir: 'desc' }, columns: advCols(),
    summary: (rows) => sumBox([['Lançamentos', fmtNum(rows.length, 0)], ['Total', fmtMoney(sum(rows, a => a.amount))], ['Em aberto', fmtMoney(sum(rows.filter(a => a.status === 'Aberto'), a => a.amount))]]),
    onRowClick: can('payroll.edit') ? (a) => F.advanceForm(a.id) : null,
  });
}

const discCols = () => [
  { key: 'date', label: 'Data', text: (d) => fmtDate(d.date), render: (d) => fmtDate(d.date) },
  { key: 'emp', label: 'Funcionário', text: (d) => S.employeeName(d.employee_id), render: (d) => eLink(d.employee_id) },
  { key: 'month', label: 'Mês ref.', text: (d) => fmtMonth(d.month), render: (d) => fmtMonth(d.month) },
  { key: 'description', label: 'Descrição' }, { key: 'amount', label: 'Valor', align: 'right', value: (d) => num(d.amount), render: (d) => `<b>${fmtMoney(d.amount)}</b>` },
];
export function discounts(el) {
  listPage(el, {
    id: 'discs', title: 'Descontos', sub: 'Descontos entram automaticamente no salário do mês de referência.',
    actions: can('payroll.edit') ? `<button class="btn btn-primary" data-act="new">${icon('plus', 18)} Novo desconto</button>` : '',
    bindActions: (root) => { const b = $('[data-act=new]', root); if (b) b.onclick = () => F.discountForm(); },
    defaultPeriod: 'year',
    filters: [{ type: 'period' }, { type: 'search', key: 'q', text: (d) => `${S.employeeName(d.employee_id)} ${d.description}` }],
    rows: (st) => db.where('employee_discounts', d => inRange(d.date, rangeOf(st))), defaultSort: { key: 'date', dir: 'desc' }, columns: discCols(),
    summary: (rows) => sumBox([['Lançamentos', fmtNum(rows.length, 0)], ['Total', fmtMoney(sum(rows, d => d.amount))]]),
    onRowClick: can('payroll.edit') ? (d) => F.discountForm(d.id) : null,
  });
}

export function payments(el) {
  listPage(el, {
    id: 'pays', title: 'Pagamentos', sub: 'Histórico de salários pagos.', defaultPeriod: 'year',
    filters: [{ type: 'period' }, { type: 'search', key: 'q', text: (p) => S.employeeName(p.employee_id) }, { type: 'select', key: 'st', label: 'Situação', options: ['Pago', 'Pendente'], match: (p, v) => p.status === v }],
    rows: (st) => { const r = rangeOf(st); return db.where('employee_payments', p => (p.payment_date && inRange(p.payment_date, r)) || (!p.payment_date && p.month >= r.from.slice(0, 7) && p.month <= r.to.slice(0, 7))); },
    defaultSort: { key: 'month', dir: 'desc' }, columns: payCols(),
    summary: (rows) => sumBox([['Pagamentos', fmtNum(rows.length, 0)], ['Total pago', fmtMoney(sum(rows.filter(p => p.status === 'Pago'), p => p.net))], ['Pendente', fmtMoney(sum(rows.filter(p => p.status !== 'Pago'), p => p.net))]]),
    onRowClick: can('payroll.edit') ? (p) => F.paymentForm(p.id) : null,
  });
}
