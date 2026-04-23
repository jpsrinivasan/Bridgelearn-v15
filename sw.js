/* BridgeLearn V15 — Service Worker */
const CACHE_NAME   = 'bl15-v1';
const DATA_CACHE   = 'bl15-data-v1';

const SHELL_FILES = [
  '/',
  '/index.html',
  '/css/main.css',
  '/css/characters.css',
  '/css/themes.css',
  '/js/app.js',
  '/js/auth.js',
  '/js/ai.js',
  '/js/voice.js',
  '/js/gamification.js',
  '/js/games.js',
  '/js/languages.js',
  '/js/characters.js',
  '/js/progression.js',
  '/js/parent.js',
  '/js/storage.js',
  '/js/utils.js',
];

const DATA_FILES = [
  '/data/subjects.json',
  '/data/quiz.json',
  '/data/countries.json',
  '/data/states.json',
  '/data/languages.json',
  '/data/achievements.json',
];

/* ── Install ─────────────────────────────────────────────────── */
self.addEventListener('install', e => {
  e.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then(c => c.addAll(SHELL_FILES).catch(err => console.warn('[SW] Shell cache partial:', err))),
      caches.open(DATA_CACHE).then(c => c.addAll(DATA_FILES).catch(err => console.warn('[SW] Data cache partial:', err))),
    ]).then(() => self.skipWaiting())
  );
});

/* ── Activate ─────────────────────────────────────────────────── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME && k !== DATA_CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

/* ── Fetch ────────────────────────────────────────────────────── */
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Skip non-GET and cross-origin API calls
  if (e.request.method !== 'GET') return;
  if (url.origin !== location.origin && !url.href.includes('googleapis') && !url.href.includes('firebase')) return;

  // Data files: network first, cache fallback
  if (url.pathname.startsWith('/data/')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(DATA_CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // App shell: cache first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => {
        if (e.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/index.html');
        }
      });
    })
  );
});

/* ── Background sync for offline progress saves ───────────────── */
self.addEventListener('sync', e => {
  if (e.tag === 'sync-progress') {
    e.waitUntil(syncOfflineProgress());
  }
});

async function syncOfflineProgress() {
  // Will be handled by storage.js when connection returns
  const clients = await self.clients.matchAll();
  clients.forEach(c => c.postMessage({ type: 'SYNC_PROGRESS' }));
}
