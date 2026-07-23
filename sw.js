// Minimal service worker for the Recipe Book PWA.
// - HTML navigations: network-first (always get the latest app), fall back to
//   cache when offline. This avoids serving a stale index.html after updates.
// - Other assets (vendor, icons, title): cache-first with network fallback.
// Bump CACHE whenever the precached asset list changes to force a refresh.
const CACHE = 'recipe-book-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './title.png',
  './public/icon-192.png',
  './public/icon-512.png',
  './vendor/react.production.min.js',
  './vendor/react-dom.production.min.js',
  './vendor/dc-runtime.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return; // let the AI proxy POST, etc. hit the network

  // App HTML: network-first so updates land immediately; cache is the offline
  // fallback (and gets refreshed on every successful load).
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match('./index.html')))
    );
    return;
  }

  // Everything else: cache-first, fall back to network.
  e.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).catch(() => cached))
  );
});
