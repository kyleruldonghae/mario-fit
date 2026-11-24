// Offline cache for the app shell (cache-first, refreshed in the background).
const VERSION = 'mario-fit-v2';
const ASSETS = [
  './', './index.html', './styles.css', './manifest.webmanifest', './gallery.html',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png',
  './js/app.js', './js/util.js', './js/store.js', './js/logic.js', './js/figure.js', './js/musclemap.js', './js/charts.js', './js/ui.js',
  './js/data/exercises.js', './js/data/seed.js',
  './js/views/home.js', './js/views/workout.js', './js/views/library.js', './js/views/history.js', './js/views/progress.js', './js/views/cardio.js',
  './js/views/recovery.js', './js/views/nutrition.js', './js/views/supplements.js', './js/views/plan.js', './js/views/settings.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: true });
      const net = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
      if (hit) { e.waitUntil(net); return hit; }
      const res = await net;
      return res || (req.mode === 'navigate' ? cache.match('./index.html') : new Response('', { status: 504 }));
    }),
  );
});
