/* BridgeLearn V15 — Service Worker  (network-first, version 32) */
const VERSION    = 'bl15-v32';
const DATA_CACHE = 'bl15-data-v32';

/* ── Install: take over immediately, no pre-caching of shell ───── */
self.addEventListener('install', () => {
  self.skipWaiting();
});

/* ── Activate: delete ALL old caches, claim all clients ────────── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== VERSION && k !== DATA_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch: network-first for JS/CSS/HTML, cache-fallback for data */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Cross-origin (Firebase, CDN) — pass through
  if (url.origin !== location.origin) return;

  // Data files: network-first, cache fallback
  if (url.pathname.startsWith('/data/')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(DATA_CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // JS, CSS, HTML — ALWAYS network-first so fresh code is served immediately
  // Falls back to cache only when offline
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(VERSION).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(cached => {
        if (cached) return cached;
        if (e.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/index.html');
        }
      }))
  );
});
