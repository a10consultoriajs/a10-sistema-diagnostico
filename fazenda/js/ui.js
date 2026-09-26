// Componentes de interface: ícones, avisos, modais, formulários inteligentes, tabelas e gráficos.
import { esc, normalize, num, fmtDate } from './util.js';

// ---------- Ícones (SVG em linha) ----------
const P = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  cow: '<path d="M4.5 5.5C3 5.5 2 4.5 2 3M19.5 5.5C21 5.5 22 4.5 22 3"/><path d="M7 6h10a2 2 0 0 1 2 2v4.5a6 6 0 0 1-3 5.2V20a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.3a6 6 0 0 1-3-5.2V8a2 2 0 0 1 2-2z"/><path d="M9.5 10.5h.01M14.5 10.5h.01"/><path d="M10 17.5h.01M14 17.5h.01"/>',
  milk: '<path d="M8 2h8"/><path d="M9 2v2.789a4 4 0 0 1-.672 2.219l-.656.984A4 4 0 0 0 7 10.212V20a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-9.789a4 4 0 0 0-.672-2.219l-.656-.984A4 4 0 0 1 15 4.788V2"/><path d="M7 15a6.47 6.47 0 0 1 5 0 6.47 6.47 0 0 0 5 0"/>',
  wheat: '<path d="M2 22 16 8"/><path d="M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M11.47 4.53 13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M20 2h2v2a4 4 0 0 1-4 4h-2V6a4 4 0 0 1 4-4Z"/>',
  tractor: '<path d="m10 11 11 .9a1 1 0 0 1 .8 1.1l-.665 4.158a1 1 0 0 1-.988.842H20"/><path d="M16 18h-5"/><path d="M18 5a1 1 0 0 0-1 1v5.573"/><path d="M3 4h8.129a1 1 0 0 1 .99.863L13 11.246"/><path d="M4 11V4"/><path d="M7 15h.01"/><path d="M8 10.1V4"/><circle cx="18" cy="18" r="2"/><circle cx="7" cy="15" r="5"/>',
  package: '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="m7.5 4.27 9 5.15"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  chart: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  settings: '<line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="2" x2="6" y1="14" y2="14"/><line x1="10" x2="14" y1="8" y2="8"/><line x1="18" x2="22" y1="16" y2="16"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  menu: '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
  down: '<path d="m6 9 6 6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>', left: '<path d="m15 18-6-6 6-6"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  wifi: '<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" x2="12.01" y1="20" y2="20"/>',
  wifiOff: '<path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" x2="12.01" y1="20" y2="20"/><path d="M1.42 9a16 16 0 0 1 4.7-2.88"/><path d="M10.66 5c4.01-.36 8.14.9 11.42 3.9"/><path d="M5 12.86a10 10 0 0 1 5.17-2.69"/><path d="M16.85 11.25a10 10 0 0 1 2.22 1.68"/><line x1="2" x2="22" y1="2" y2="22"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
  printer: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  sheet: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/>',
  edit: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  health: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  scale: '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
  star: '<path d="M12 3l1.9 5.8H20l-4.9 3.6 1.9 5.8-5-3.6-5 3.6 1.9-5.8L4 8.8h6.1z"/>',
  trendDown: '<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>',
  trendUp: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  fuel: '<line x1="3" x2="15" y1="22" y2="22"/><line x1="4" x2="14" y1="9" y2="9"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  money: '<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  arrowIn: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  arrowOut: '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>',
  tree: '<circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9"/><path d="M12 12v3"/>',
  droplet: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
  calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  factory: '<path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M17 18h1"/><path d="M12 18h1"/><path d="M7 18h1"/>',
  list: '<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
};
export const icon = (name, size = 20, cls = '') =>
  `<svg class="ico ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || P.list}</svg>`;

// ---------- Helpers de DOM ----------
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export function html(strings, ...vals) {
  // template tag: interpola escapando, exceto valores marcados com raw()
  return strings.reduce((out, s, i) => out + s + (i < vals.length ? renderVal(vals[i]) : ''), '');
}
const RAW = Symbol('raw');
export const raw = (s) => ({ [RAW]: true, s: String(s ?? '') });
function renderVal(v) {
  if (v == null || v === false) return '';
  if (Array.isArray(v)) return v.map(renderVal).join('');
  if (typeof v === 'object' && v[RAW]) return v.s;
  return esc(v);
}

// ---------- Avisos (toast) ----------
export function toast(msg, type = 'ok', ms = 3200) {
  let box = $('#toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `${icon(type === 'err' ? 'alert' : type === 'warn' ? 'alert' : 'check', 18)}<span>${esc(msg)}</span>`;
  box.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, ms);
}

// ---------- Modal ----------
let modalStack = [];
export function modal({ title, subtitle = '', body = '', footer = '', size = 'md', onClose } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal modal-${size}" role="dialog" aria-modal="true">
    <div class="modal-head"><div><h2>${esc(title)}</h2>${subtitle ? `<div class="muted small">${subtitle}</div>` : ''}</div>
    <button class="icon-btn" data-close aria-label="Fechar">${icon('x')}</button></div>
    <div class="modal-body">${body}</div>${footer ? `<div class="modal-foot">${footer}</div>` : ''}</div>`;
  document.body.appendChild(wrap);
  document.body.classList.add('no-scroll');
  const close = () => {
    wrap.remove(); modalStack = modalStack.filter(m => m !== api);
    if (!modalStack.length) document.body.classList.remove('no-scroll');
    onClose && onClose();
  };
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) wrap.dataset.down = '1'; });
  wrap.addEventListener('click', (e) => { if (e.target === wrap && wrap.dataset.down) close(); delete wrap.dataset.down; });
  $$('[data-close]', wrap).forEach(b => b.addEventListener('click', close));
  const api = { el: wrap, body: $('.modal-body', wrap), foot: $('.modal-foot', wrap), close };
  modalStack.push(api);
  return api;
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modalStack.length && !document.querySelector('.combo-list:not([hidden])')) modalStack[modalStack.length - 1].close(); });

export function confirmDialog(message, { title = 'Confirmar', ok = 'Confirmar', cancel = 'Cancelar', danger = false, input = null } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const m = modal({
      title, size: 'sm',
      body: `<p class="confirm-msg">${message}</p>${input ? `<label class="field"><span class="lbl">${esc(input)}</span><input class="input" id="confirm-input"></label>` : ''}`,
      footer: `<button class="btn btn-ghost" data-act="no">${esc(cancel)}</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-act="yes">${esc(ok)}</button>`,
      onClose: () => { if (!done) resolve(false); },
    });
    $('[data-act=no]', m.el).onclick = () => m.close();
    $('[data-act=yes]', m.el).onclick = () => { done = true; const v = input ? ($('#confirm-input', m.el).value || '') : true; m.close(); resolve(input ? { value: v } : true); };
    setTimeout(() => ($('#confirm-input', m.el) || $('[data-act=yes]', m.el)).focus(), 30);
  });
}

// ---------- Fontes de dados para autocomplete ----------
const SOURCES = {};
export const registerSource = (name, fn) => { SOURCES[name] = fn; };
const getOptions = (f, vals) => {
  if (f.source) return (SOURCES[f.source] || (() => []))(f, vals);
  const o = typeof f.options === 'function' ? f.options(vals) : (f.options || []);
  return o.map(x => Array.isArray(x) ? { value: x[0], label: x[1] } : (typeof x === 'object' ? x : { value: x, label: x }));
};

// ---------- Combobox (seleção com busca) ----------
export function mountCombo(root, { options, value, placeholder = 'Toque para buscar…', onSelect, allowFree = false }) {
  root.classList.add('combo');
  root.innerHTML = `<input class="input combo-input" autocomplete="off" placeholder="${esc(placeholder)}"><button type="button" class="combo-clear" tabindex="-1" aria-label="Limpar">${icon('x', 16)}</button><div class="combo-list" hidden></div>`;
  const input = $('input', root), list = $('.combo-list', root), clear = $('.combo-clear', root);
  let cur = value ?? null, items = [], hi = 0;
  const opts = () => (typeof options === 'function' ? options() : options);
  const labelOf = (v) => opts().find(o => o.value === v)?.label ?? (allowFree && v ? v : '');
  const setShown = () => { input.value = labelOf(cur); root.classList.toggle('has-value', !!cur); };
  const renderList = () => {
    const q = normalize(input.value);
    const all = opts();
    items = (q && input.value !== labelOf(cur) ? all.filter(o => normalize(`${o.label} ${o.sub || ''} ${o.search || ''}`).includes(q)) : all).slice(0, 60);
    hi = 0;
    list.innerHTML = items.length ? items.map((o, i) => `<div class="combo-item ${i === hi ? 'hi' : ''} ${o.value === cur ? 'sel' : ''}" data-i="${i}"><div>${esc(o.label)}</div>${o.sub ? `<div class="muted small">${esc(o.sub)}</div>` : ''}</div>`).join('')
      : `<div class="combo-empty">Nada encontrado${allowFree && input.value ? ` — será usado "${esc(input.value)}"` : ''}</div>`;
    list.hidden = false;
  };
  const choose = (o) => { cur = o ? o.value : null; setShown(); list.hidden = true; onSelect && onSelect(cur, o); };
  input.addEventListener('focus', () => { input.select(); renderList(); });
  input.addEventListener('input', renderList);
  input.addEventListener('keydown', (e) => {
    if (list.hidden) return;
    if (e.key === 'ArrowDown') { hi = Math.min(items.length - 1, hi + 1); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { hi = Math.max(0, hi - 1); e.preventDefault(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (items[hi]) choose(items[hi]); return; }
    else if (e.key === 'Escape') { list.hidden = true; setShown(); e.stopPropagation(); return; }
    else return;
    $$('.combo-item', list).forEach((el, i) => el.classList.toggle('hi', i === hi));
    $$('.combo-item', list)[hi]?.scrollIntoView({ block: 'nearest' });
  });
  list.addEventListener('pointerdown', (e) => {
    const it = e.target.closest('.combo-item'); if (!it) return;
    e.preventDefault(); choose(items[+it.dataset.i]);
  });
  input.addEventListener('blur', () => setTimeout(() => {
    list.hidden = true;
    if (!input.value.trim()) { if (cur) choose(null); return; }
    if (allowFree && input.value !== labelOf(cur)) { cur = input.value.trim(); root.classList.add('has-value'); onSelect && onSelect(cur, null); return; }
    setShown();
  }, 120));
  clear.addEventListener('click', () => { choose(null); input.focus(); });
  setShown();
  return { set: (v) => { cur = v; setShown(); }, get: () => cur, refresh: setShown };
}

// ---------- Formulário inteligente ----------
// fields: [{name,label,type,required,options,source,filter,default,hint,full,show(v),compute(v),min,step,placeholder,readonly}]
// tipos: text,number,money,date,time,month,textarea,select,choice,ref,checkbox,photo,computed,section,html,items,password
export function openForm(cfg) {
  const vals = {};
  for (const f of cfg.fields) {
    if (!f.name) continue;
    const init = cfg.values?.[f.name];
    vals[f.name] = init !== undefined ? init : (typeof f.default === 'function' ? f.default(vals) : f.default ?? (f.type === 'items' ? [] : f.type === 'checkbox' ? false : ''));
  }
  const m = modal({
    title: cfg.title, subtitle: cfg.subtitle, size: cfg.size || 'md',
    body: `<form class="form" novalidate>${cfg.intro ? `<div class="form-intro">${cfg.intro}</div>` : ''}<div class="form-grid"></div><div class="form-error" hidden></div></form>`,
    footer: `${cfg.danger ? `<button type="button" class="btn btn-danger-ghost" data-act="danger">${icon('trash', 16)} ${esc(cfg.danger.label)}</button>` : ''}<span class="grow"></span>
      <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
      ${cfg.againLabel ? `<button type="button" class="btn btn-ghost btn-lg" data-act="again">${esc(cfg.againLabel)}</button>` : ''}
      <button type="button" class="btn btn-primary btn-lg" data-act="save">${icon('check', 18)} ${esc(cfg.submitLabel || 'Salvar')}</button>`,
  });
  const form = $('form', m.el), grid = $('.form-grid', m.el), errBox = $('.form-error', m.el);
  const combos = {};
  const api = {
    values: vals,
    set(name, v) { vals[name] = v; const f = cfg.fields.find(x => x.name === name); if (f) writeField(f); refreshDynamic(); },
    get: (n) => vals[n], close: () => m.close(), el: m.el,
  };

  const optHTML = (f) => {
    const opts = getOptions(f, vals);
    return `<option value="">${esc(f.placeholder || 'Selecione…')}</option>` + opts.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('');
  };

  function fieldHTML(f) {
    const id = `f_${f.name || Math.random().toString(36).slice(2)}`;
    const req = f.required ? '<b class="req">*</b>' : '';
    const lbl = f.label ? `<span class="lbl">${esc(f.label)} ${req}</span>` : '';
    const hint = f.hint ? `<span class="hint">${f.hint}</span>` : '';
    const cls = `field ${f.full || ['textarea', 'items', 'section', 'html', 'photo'].includes(f.type) ? 'full' : ''} field-${f.type || 'text'}`;
    const ro = f.readonly ? 'readonly' : '';
    switch (f.type) {
      case 'section': return `<div class="field full form-section" data-f="${f.name || ''}"><h3>${esc(f.label)}</h3>${hint}</div>`;
      case 'html': return `<div class="${cls}" data-f="${f.name || ''}">${typeof f.html === 'function' ? f.html(vals) : f.html}</div>`;
      case 'textarea': return `<label class="${cls}" data-f="${f.name}">${lbl}<textarea class="input" id="${id}" name="${f.name}" rows="${f.rows || 2}" placeholder="${esc(f.placeholder || '')}" ${ro}></textarea>${hint}</label>`;
      case 'select': return `<label class="${cls}" data-f="${f.name}">${lbl}<select class="input" id="${id}" name="${f.name}">${optHTML(f)}</select>${hint}</label>`;
      case 'choice': return `<div class="${cls}" data-f="${f.name}">${lbl}<div class="choice">${getOptions(f, vals).map(o => `<button type="button" class="choice-btn" data-v="${esc(o.value)}">${o.icon ? icon(o.icon, 18) : ''}${esc(o.label)}</button>`).join('')}</div>${hint}</div>`;
      case 'ref': return `<div class="${cls}" data-f="${f.name}">${lbl}<div class="combo-host"></div>${hint}</div>`;
      case 'checkbox': return `<label class="${cls} check" data-f="${f.name}"><input type="checkbox" name="${f.name}"> <span>${esc(f.label)}</span>${hint}</label>`;
      case 'computed': return `<div class="${cls}" data-f="${f.name}">${lbl}<div class="computed" aria-live="polite"></div>${hint}</div>`;
      case 'photo': return `<div class="${cls}" data-f="${f.name}">${lbl}<div class="photo-field"><div class="photo-prev"></div><label class="btn btn-ghost">${icon('camera', 18)} Escolher foto<input type="file" accept="image/*" capture="environment" hidden></label><button type="button" class="btn btn-ghost photo-rm">Remover</button></div>${hint}</div>`;
      case 'items': return `<div class="${cls}" data-f="${f.name}">${lbl}<div class="items"></div><button type="button" class="btn btn-ghost btn-sm items-add">${icon('plus', 16)} ${esc(f.addLabel || 'Adicionar linha')}</button>${hint}</div>`;
      default: {
        const t = f.type === 'number' || f.type === 'money' ? 'text' : (f.type || 'text');
        const mode = f.type === 'number' || f.type === 'money' ? `inputmode="decimal"` : '';
        const pre = f.type === 'money' ? '<span class="prefix">R$</span>' : '';
        const suf = f.suffix ? `<span class="suffix">${esc(f.suffix)}</span>` : '';
        return `<label class="${cls}" data-f="${f.name}">${lbl}<span class="input-wrap ${pre ? 'has-pre' : ''} ${suf ? 'has-suf' : ''}">${pre}<input class="input ${f.big ? 'input-big' : ''}" id="${id}" type="${t}" ${mode} name="${f.name}" placeholder="${esc(f.placeholder || '')}" ${f.autofocus ? 'autofocus' : ''} ${ro} ${t === 'password' ? 'autocomplete="new-password"' : ''}>${suf}</span>${hint}</label>`;
      }
    }
  }

  grid.innerHTML = cfg.fields.map(fieldHTML).join('');

  const fieldEl = (f) => grid.querySelector(`[data-f="${f.name}"]`);
  function writeField(f) {
    const el = fieldEl(f); if (!el || !f.name) return;
    const v = vals[f.name];
    switch (f.type) {
      case 'choice': $$('.choice-btn', el).forEach(b => b.classList.toggle('on', b.dataset.v === String(v))); break;
      case 'ref': combos[f.name]?.set(v || null); break;
      case 'checkbox': $('input', el).checked = !!v; break;
      case 'computed': break;
      case 'photo': $('.photo-prev', el).innerHTML = v ? `<img src="${v}" alt="">` : `<span class="muted small">Sem foto</span>`; $('.photo-rm', el).hidden = !v; break;
      case 'items': renderItems(f); break;
      case 'select': { const s = $('select', el); s.value = v ?? ''; break; }
      case 'section': case 'html': break;
      default: { const i = $('input,textarea', el); if (i) i.value = v == null ? '' : ((f.type === 'number' || f.type === 'money') && typeof v === 'number' ? String(v).replace('.', ',') : v); }
    }
  }

  function renderItems(f) {
    const el = fieldEl(f), box = $('.items', el);
    const rows = vals[f.name] || [];
    box.innerHTML = rows.length ? rows.map((r, i) => `<div class="item-row" data-i="${i}">${f.columns.map(c => `<div class="item-cell" style="flex:${c.flex || 1}" data-c="${c.name}">${c.label ? `<span class="lbl small">${esc(c.label)}</span>` : ''}${c.type === 'ref' ? '<div class="combo-host"></div>' : c.type === 'computed' ? `<div class="computed small">${c.compute(r, vals)}</div>` : `<input class="input" inputmode="decimal" value="${esc(r[c.name] ?? '')}">`}</div>`).join('')}<button type="button" class="icon-btn item-rm" aria-label="Remover">${icon('trash', 16)}</button></div>`).join('')
      : `<div class="muted small">Nenhuma linha adicionada.</div>`;
    $$('.item-row', box).forEach(rowEl => {
      const i = +rowEl.dataset.i, r = rows[i];
      f.columns.forEach(c => {
        const cell = rowEl.querySelector(`[data-c="${c.name}"]`);
        if (c.type === 'ref') {
          mountCombo($('.combo-host', cell), { options: () => getOptions(c, vals), value: r[c.name], onSelect: (v) => { r[c.name] = v; changed(f, true); } });
        } else if (c.type !== 'computed') {
          $('input', cell).addEventListener('input', (e) => { r[c.name] = e.target.value; changed(f, false); refreshItemComputed(f); });
        }
      });
      $('.item-rm', rowEl).onclick = () => { rows.splice(i, 1); changed(f, true); };
    });
  }
  function refreshItemComputed(f) {
    const el = fieldEl(f);
    $$('.item-row', el).forEach(rowEl => {
      const r = vals[f.name][+rowEl.dataset.i];
      f.columns.filter(c => c.type === 'computed').forEach(c => { rowEl.querySelector(`[data-c="${c.name}"] .computed`).innerHTML = c.compute(r, vals); });
    });
  }

  function changed(f, rerenderItems) {
    cfg.onChange && cfg.onChange(vals, api, f.name);
    if (f.type === 'items' && rerenderItems) renderItems(f);
    refreshDynamic();
  }

  function refreshDynamic() {
    for (const f of cfg.fields) {
      const el = f.name ? fieldEl(f) : null;
      if (!el) continue;
      if (f.show) el.hidden = !f.show(vals);
      if (f.type === 'computed') $('.computed', el).innerHTML = f.compute(vals) ?? '—';
      if (f.type === 'html' && typeof f.html === 'function') el.innerHTML = f.html(vals);
      if (f.type === 'items') refreshItemComputed(f);
      if (f.type === 'select' && f.dynamic) { const s = $('select', el); const cur = vals[f.name]; s.innerHTML = optHTML(f); s.value = cur ?? ''; }
    }
  }

  // Ligações
  for (const f of cfg.fields) {
    if (!f.name) continue;
    const el = fieldEl(f); if (!el) continue;
    switch (f.type) {
      case 'choice': el.addEventListener('click', (e) => { const b = e.target.closest('.choice-btn'); if (!b) return; vals[f.name] = b.dataset.v; writeField(f); changed(f); }); break;
      case 'ref': combos[f.name] = mountCombo($('.combo-host', el), { options: () => getOptions(f, vals), value: vals[f.name], placeholder: f.placeholder, allowFree: f.allowFree, onSelect: (v) => { vals[f.name] = v; changed(f); } }); break;
      case 'checkbox': $('input', el).addEventListener('change', (e) => { vals[f.name] = e.target.checked; changed(f); }); break;
      case 'photo': {
        $('input[type=file]', el).addEventListener('change', async (e) => {
          const file = e.target.files[0]; if (!file) return;
          vals[f.name] = await resizeImage(file, 480); writeField(f); changed(f);
        });
        $('.photo-rm', el).onclick = () => { vals[f.name] = ''; writeField(f); changed(f); };
        break;
      }
      case 'items': $('.items-add', el).onclick = () => { vals[f.name].push({ ...(f.newRow ? f.newRow(vals) : {}) }); changed(f, true); }; break;
      case 'computed': case 'section': case 'html': break;
      default: {
        const i = $('input,textarea,select', el);
        i && i.addEventListener(f.type === 'select' ? 'change' : 'input', (e) => { vals[f.name] = e.target.value; el.classList.remove('invalid'); changed(f); });
      }
    }
    writeField(f);
  }
  refreshDynamic();
  cfg.onChange && (cfg.onChange(vals, api, null), refreshDynamic());

  const validate = () => {
    let first = null;
    for (const f of cfg.fields) {
      if (!f.name) continue;
      const el = fieldEl(f); if (!el || el.hidden) continue;
      const v = vals[f.name];
      let bad = f.required && (v == null || v === '' || (Array.isArray(v) && !v.length));
      if (!bad && (f.type === 'number' || f.type === 'money') && v !== '' && v != null) {
        const n = num(v);
        if (isNaN(parseFloat(String(v).replace(',', '.')))) bad = true;
        if (f.min != null && n < f.min) bad = true;
      }
      if (!bad && f.validate) { const msg = f.validate(v, vals); if (msg) { bad = true; el.dataset.err = msg; } }
      el.classList.toggle('invalid', !!bad);
      if (bad && !first) first = { el, f };
    }
    if (first) {
      errBox.hidden = false;
      errBox.textContent = first.el.dataset.err || `Preencha corretamente: ${first.f.label}`;
      first.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return false;
    }
    errBox.hidden = true; return true;
  };

  const saveBtn = $('[data-act=save]', m.el);
  const submit = async (again = false) => {
    if (!validate()) return;
    const out = {};
    for (const f of cfg.fields) {
      if (!f.name || f.type === 'computed' || f.type === 'section' || f.type === 'html') continue;
      const el = fieldEl(f); if (el && el.hidden && !f.keepHidden) { out[f.name] = f.type === 'items' ? [] : null; continue; }
      let v = vals[f.name];
      if (f.type === 'number' || f.type === 'money') v = v === '' || v == null ? null : num(v);
      if (typeof v === 'string') v = v.trim();
      out[f.name] = v === '' ? null : v;
    }
    saveBtn.disabled = true;
    try {
      api.again = again;
      const r = await cfg.onSubmit(out, api);
      if (r !== false) { m.close(); if (again && cfg.onAgain) cfg.onAgain(out, r); }
    } catch (e) {
      console.error(e);
      errBox.hidden = false; errBox.textContent = e.message || String(e);
    } finally { saveBtn.disabled = false; }
  };
  saveBtn.onclick = () => submit(false);
  const againBtn = $('[data-act=again]', m.el); if (againBtn) againBtn.onclick = () => submit(true);
  form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
  form.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && !e.target.classList.contains('combo-input')) { e.preventDefault(); submit(!!cfg.againLabel && !!cfg.enterAgain); } });
  if (cfg.danger) $('[data-act=danger]', m.el).onclick = async () => { if (await cfg.danger.onClick(api) !== false) m.close(); };
  setTimeout(() => { const a = $('[autofocus]', m.el) || (cfg.focus && $(`[data-f="${cfg.focus}"] input`, m.el)); a && a.focus(); }, 60);
  return api;
}

export function resizeImage(file, max = 480) {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = img.width * s; c.height = img.height * s;
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = rej; img.src = url;
  });
}

// ---------- Tabela ----------
// columns: [{key,label,render(row),value(row),align,sortable(default true),cls,hideSm}]
const tableState = new Map();
export function mountTable(container, { id, columns, rows, onRowClick, empty = 'Nenhum registro encontrado.', pageSize = 50, defaultSort, footer }) {
  const st = tableState.get(id) || { sort: defaultSort || null, shown: pageSize };
  tableState.set(id, st);
  const valOf = (c, r) => c.value ? c.value(r) : r[c.key];
  const draw = () => {
    let data = rows.slice();
    if (st.sort) {
      const c = columns.find(x => x.key === st.sort.key);
      if (c) data.sort((a, b) => {
        const x = valOf(c, a), y = valOf(c, b);
        const r = (x == null || x === '') ? 1 : (y == null || y === '') ? -1 : (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR', { numeric: true }));
        return st.sort.dir === 'desc' ? -r : r;
      });
    }
    const shown = data.slice(0, st.shown);
    container.innerHTML = `<div class="table-wrap"><table class="table">
      <thead><tr>${columns.map(c => `<th class="${c.align === 'right' ? 'r' : ''} ${c.hideSm ? 'hide-sm' : ''} ${c.sortable === false ? '' : 'sortable'}" data-k="${c.key}">${esc(c.label)}${st.sort?.key === c.key ? (st.sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr></thead>
      <tbody>${shown.length ? shown.map((r, i) => `<tr data-i="${i}" class="${onRowClick ? 'clickable' : ''}">${columns.map(c => `<td class="${c.align === 'right' ? 'r' : ''} ${c.hideSm ? 'hide-sm' : ''} ${c.cls || ''}" data-label="${esc(c.label)}">${c.render ? c.render(r) : esc(r[c.key] ?? '')}</td>`).join('')}</tr>`).join('')
        : `<tr><td colspan="${columns.length}" class="empty">${esc(empty)}</td></tr>`}</tbody>
      ${footer ? `<tfoot>${footer}</tfoot>` : ''}</table></div>
      ${data.length > st.shown ? `<div class="table-more"><button class="btn btn-ghost" data-more>Mostrar mais (${data.length - st.shown} restantes)</button></div>` : ''}
      <div class="table-count muted small">${data.length} registro${data.length === 1 ? '' : 's'}</div>`;
    $$('th.sortable', container).forEach(th => th.onclick = () => {
      const k = th.dataset.k;
      st.sort = st.sort?.key === k ? { key: k, dir: st.sort.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'asc' };
      draw();
    });
    const more = $('[data-more]', container); if (more) more.onclick = () => { st.shown += pageSize * 2; draw(); };
    if (onRowClick) $$('tbody tr[data-i]', container).forEach(tr => tr.onclick = (e) => { if (e.target.closest('button,a')) return; onRowClick(shown[+tr.dataset.i]); });
  };
  draw();
}

// ---------- Gráficos (Chart.js) ----------
const charts = new Map();
const isObj = (o) => o && typeof o === 'object' && !Array.isArray(o);
function deepMerge(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = isObj(v) && isObj(a[k]) ? deepMerge(a[k], v) : v;
  return out;
}
export const COLORS = { green: '#2E6B3F', greenL: '#7FB38C', rose: '#C0544F', roseL: '#E8A9A5', brown: '#7A4A2E', gold: '#C99A2E', blue: '#3E6FA6', gray: '#8A8F87', teal: '#2F8A87', purple: '#7B5EA7' };
export const SERIES = [COLORS.green, COLORS.rose, COLORS.gold, COLORS.blue, COLORS.brown, COLORS.teal, COLORS.purple, COLORS.greenL, COLORS.roseL, COLORS.gray];
export function chart(canvas, config) {
  if (!canvas || !window.Chart) return null;
  const old = charts.get(canvas.id); if (old) old.destroy();
  const round = config.type === 'doughnut' || config.type === 'pie';
  const base = {
    responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { display: (config.data.datasets || []).length > 1 || round, position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } } },
  };
  if (!round) base.scales = {
    x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } },
    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.06)' } },
  };
  const c = new window.Chart(canvas, { ...config, options: deepMerge(base, config.options || {}) });
  charts.set(canvas.id, c);
  return c;
}

// ---------- Pequenos componentes ----------
export const badge = (text, tone = 'neutral') => `<span class="badge badge-${tone}">${esc(text)}</span>`;
export const statCard = ({ label, value, sub = '', icon: ic = 'chart', tone = 'green', href = '' }) =>
  `<${href ? `a href="${href}"` : 'div'} class="stat stat-${tone}"><div class="stat-ico">${icon(ic, 22)}</div><div class="stat-body"><div class="stat-label">${esc(label)}</div><div class="stat-value">${value}</div>${sub ? `<div class="stat-sub">${sub}</div>` : ''}</div></${href ? 'a' : 'div'}>`;
export const emptyState = (msg, action = '') => `<div class="empty-state">${icon('list', 36)}<p>${esc(msg)}</p>${action}</div>`;
export const pageHead = (title, sub = '', actions = '') => `<div class="page-head"><div><h1>${esc(title)}</h1>${sub ? `<p class="muted">${sub}</p>` : ''}</div><div class="page-actions">${actions}</div></div>`;
export const tabs = (list, active, attr = 'data-tab') => `<div class="tabs" role="tablist">${list.map(([k, l]) => `<button class="tab ${k === active ? 'on' : ''}" ${attr}="${k}" role="tab">${esc(l)}</button>`).join('')}</div>`;
export const dateCell = (d) => esc(fmtDate(d));
