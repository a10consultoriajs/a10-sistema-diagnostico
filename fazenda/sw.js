// Service worker: guarda o aplicativo no aparelho para funcionar sem internet.
// Estratégia "stale-while-revalidate": abre na hora a versão guardada e baixa a nova em segundo plano.
const CACHE = 'fmr-app-v1';
const FILES = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './assets/logo.png', './assets/logo-pdf.jpg', './assets/favicon.png', './assets/icon-192.png', './assets/icon-512.png',
  './vendor/chart.umd.js', './vendor/xlsx.full.min.js', './vendor/jspdf.umd.min.js', './vendor/jspdf.plugin.autotable.min.js',
  './js/app.js', './js/db.js', './js/util.js', './js/ui.js', './js/auth.js', './js/config.js', './js/services.js',
  './js/stats.js', './js/schema.js', './js/alerts.js', './js/forms.js', './js/reports.js', './js/export.js', './js/sync.js', './js/seed.js',
  './js/pages/common.js', './js/pages/dashboard.js', './js/pages/overview.js', './js/pages/herd.js', './js/pages/animal.js', './js/pages/milk.js',
  './js/pages/feed.js', './js/pages/machines.js', './js/pages/inventory.js', './js/pages/employees.js',
  './js/pages/reports.js', './js/pages/alerts.js', './js/pages/settings.js', './js/pages/quick.js',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const cached = await cache.match(req, { ignoreSearch: true });
    const net = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
    if (cached) { e.waitUntil(net); return cached; }
    const res = await net;
    return res || (req.mode === 'navigate' ? cache.match('./index.html') : new Response('', { status: 504 }));
  }));
});
