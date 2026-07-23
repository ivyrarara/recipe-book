// Minimal service worker for the Recipe Book PWA.
// Precaches the app shell and serves it cache-first (offline-friendly);
// everything else (fonts, the AI proxy, etc.) just goes to the network.
const CACHE = 'recipe-book-v1';
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
  e.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).catch(() => cached))
  );
});
