// sw.js
// Service worker: makes the app work without internet.
// Bump VERSION when you upload a new version of the app, so phones pick it up.

const VERSION = 'v6';
const CACHE = `mq-${VERSION}`;

const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/ui.js',
  './js/quiz.js',
  './js/store.js',
  './js/topics.js',
  './js/config.js',
  './assets/success.mp3',
  './assets/failed.mp3',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // cache: 'reload' skips the browser's own copy of a file, so a new version
      // of the app is really picked up instead of the old one from the http cache
      .then((cache) => Promise.all(FILES.map((f) => cache.add(new Request(f, { cache: 'reload' })).catch(() => {}))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;                       // never touch the upload to the sheet
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;             // let the sheet request use the network
  event.respondWith(
    caches.match(req).then((hit) => {
      const fresh = fetch(req)
        .then((res) => {
          if (res && res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => hit || caches.match('./index.html'));
      return hit || fresh;
    }),
  );
});
