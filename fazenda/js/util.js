// Utilidades gerais: datas, formatação, escape, ids.

export const uuid = () =>
  (crypto.randomUUID ? crypto.randomUUID() :
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 15);
      return (c === 'x' ? r : (r & 3) | 8).toString(16);
    }));

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const nowISO = () => new Date().toISOString();

// Datas locais no formato YYYY-MM-DD (sem fuso)
export const toISODate = (d) => {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
export const today = () => toISODate(new Date());
export const parseDate = (s) => {
  if (!s) return null;
  if (s instanceof Date) return s;
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
export const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return toISODate(d); };
export const addMonths = (s, n) => { const d = parseDate(s); d.setMonth(d.getMonth() + n); return toISODate(d); };
export const diffDays = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);
export const monthKey = (s) => String(s).slice(0, 7);
export const addMonthKey = (mk, n) => { const [y, m] = mk.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
export const nowTime = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

export const fmtDate = (s) => { if (!s) return '—'; const [y, m, d] = String(s).slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
export const fmtDateTime = (s) => { if (!s) return '—'; const d = new Date(s); return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); };
export const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const fmtMonth = (mk) => { if (!mk) return '—'; const [y, m] = mk.split('-'); return `${MONTHS[+m - 1]}/${y}`; };
export const fmtMonthShort = (mk) => { const [y, m] = mk.split('-'); return `${MONTHS[+m - 1].slice(0, 3)}/${y.slice(2)}`; };

const nf = (min, max) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: min, maximumFractionDigits: max });
const NF0 = nf(0, 0), NF1 = nf(0, 1), NF2 = nf(0, 2), NF2F = nf(2, 2);
export const fmtNum = (v, dec = 1) => (v == null || v === '' || isNaN(v)) ? '—' : (dec === 0 ? NF0 : dec === 1 ? NF1 : NF2).format(+v);
export const fmtMoney = (v) => (v == null || v === '' || isNaN(v)) ? '—' : 'R$ ' + NF2F.format(+v);
export const fmtL = (v) => fmtNum(v, 1) + ' L';
export const fmtKg = (v) => fmtNum(v, 1) + ' kg';
export const num = (v) => { if (v === '' || v == null) return 0; const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.')); return isNaN(n) ? 0 : n; };
export const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
export const sum = (arr, f = x => x) => arr.reduce((a, x) => a + num(f(x)), 0);
export const groupBy = (arr, f) => { const m = new Map(); for (const x of arr) { const k = f(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; };

// Horas: "07:00" e "12:30" -> 5.5
export const timeToMin = (t) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
export const hoursBetween = (a, b) => {
  const s = timeToMin(a), e = timeToMin(b);
  if (s == null || e == null) return 0;
  let d = e - s; if (d < 0) d += 1440; // atravessou a meia-noite
  return round(d / 60, 4);
};
export const fmtHours = (h) => {
  if (h == null || isNaN(h)) return '—';
  const t = Math.round(h * 60); const hh = Math.floor(t / 60), mm = t % 60;
  return `${hh}h${String(mm).padStart(2, '0')}min`;
};

export const ageDays = (birth, ref = today()) => birth ? diffDays(birth, ref) : null;
export const fmtAge = (birth, ref = today()) => {
  if (!birth) return '—';
  const d = diffDays(birth, ref); if (d < 0) return '—';
  if (d < 60) return `${d} dia${d === 1 ? '' : 's'}`;
  const b = parseDate(birth), r = parseDate(ref);
  let m = (r.getFullYear() - b.getFullYear()) * 12 + (r.getMonth() - b.getMonth());
  if (r.getDate() < b.getDate()) m--;
  if (m < 24) return `${m} meses`;
  const y = Math.floor(m / 12), mm = m % 12;
  return `${y} ano${y > 1 ? 's' : ''}${mm ? ` e ${mm} m` : ''}`;
};

export const normalize = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export const pad = (n, w = 5) => String(n).padStart(w, '0');
export const debounce = (fn, ms = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// ---------- Períodos ----------
export const PERIODS = [
  ['today', 'Hoje'], ['yesterday', 'Ontem'], ['7d', 'Últimos 7 dias'], ['30d', 'Últimos 30 dias'],
  ['month', 'Este mês'], ['lastmonth', 'Mês anterior'], ['3m', 'Últimos 3 meses'],
  ['semester', 'Semestre'], ['year', 'Ano'], ['custom', 'Período personalizado'],
];
export function periodRange(key, custom = {}) {
  const t = today(), d = new Date();
  const y = d.getFullYear(), m = d.getMonth();
  switch (key) {
    case 'today': return { from: t, to: t };
    case 'yesterday': { const x = addDays(t, -1); return { from: x, to: x }; }
    case '7d': return { from: addDays(t, -6), to: t };
    case '30d': return { from: addDays(t, -29), to: t };
    case 'month': return { from: toISODate(new Date(y, m, 1)), to: t };
    case 'lastmonth': return { from: toISODate(new Date(y, m - 1, 1)), to: toISODate(new Date(y, m, 0)) };
    case '3m': return { from: toISODate(new Date(y, m - 2, 1)), to: t };
    case 'semester': return { from: toISODate(new Date(y, m < 6 ? 0 : 6, 1)), to: t };
    case 'year': return { from: toISODate(new Date(y, 0, 1)), to: t };
    case 'custom': return { from: custom.from || addDays(t, -29), to: custom.to || t };
    default: return { from: addDays(t, -29), to: t };
  }
}
// Período anterior de mesmo tamanho (para comparação)
export function previousRange({ from, to }) {
  const len = diffDays(from, to) + 1;
  return { from: addDays(from, -len), to: addDays(from, -1) };
}
export const inRange = (date, r) => !!date && date.slice(0, 10) >= r.from && date.slice(0, 10) <= r.to;
export const daysOf = (r) => { const out = []; let x = r.from; while (x <= r.to) { out.push(x); x = addDays(x, 1); } return out; };
export const monthsOf = (r) => { const out = []; let x = monthKey(r.from); const end = monthKey(r.to); while (x <= end) { out.push(x); x = addMonthKey(x, 1); } return out; };
export const periodLabel = (r) => r.from === r.to ? fmtDate(r.from) : `${fmtDate(r.from)} a ${fmtDate(r.to)}`;
