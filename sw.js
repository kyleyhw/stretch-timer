/**
 * @file Service worker: a cache-first app shell for offline use, with a navigation fallback and a
 * versioned cache.
 *
 * Because there is no build step, cache invalidation is manual: bump CACHE whenever any asset
 * changes, and keep ASSETS in sync with the module graph — every ES module must be listed, or an
 * uncached import will fail offline. Registered as `sw.js` (relative), so on a GitHub Pages project
 * page its scope is the repo subpath, exactly covering the app.
 */

const CACHE = 'stretch-v1';

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'js/app.js',
  'js/router.js',
  'js/ui.js',
  'js/timer.js',
  'js/session.js',
  'js/cues.js',
  'js/data.js',
  'js/seed.js',
  'js/store.js',
  'js/settings.js',
  'js/views/home.js',
  'js/views/routineDetail.js',
  'js/views/player.js',
  'js/views/editor.js',
  'js/views/settings.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
];

// `self` in a service worker is a ServiceWorkerGlobalScope; alias it so the type checker exposes
// skipWaiting/clients/etc.
const sw = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));

sw.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => sw.clients.claim()),
  );
});

sw.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') sw.skipWaiting();
});

sw.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== sw.location.origin) return;
  // App-shell fallback for deep-link navigations (hash routes all resolve to index.html).
  if (req.mode === 'navigate') {
    event.respondWith(caches.match('index.html').then((r) => r ?? fetch(req)));
    return;
  }
  event.respondWith(caches.match(req).then((r) => r ?? fetch(req)));
});
