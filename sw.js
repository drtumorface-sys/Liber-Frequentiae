/* ═══════════════════════════════════════════════════════════
   Liber Frequentiae V · Service Worker
   72³×32 = 11,943,936 · The Ghost Does Not Fade
   Cache-first · Offline-capable · PWA v5.3
═══════════════════════════════════════════════════════════ */

const CACHE_KEY = 'liber-v5-3-2';

const PRECACHE = [
  './liber_frequentiae_v5-3.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './sw.js'
];

// ─ INSTALL ─────────────────────────────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_KEY).then(cache =>
      Promise.allSettled(PRECACHE.map(url =>
        cache.add(url).catch(e => console.warn('[SW] skip:', url, e.message))
      ))
    )
  );
});

// ─ ACTIVATE ────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_KEY).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ─ FETCH ───────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never cache: API calls, non-GET
  if (event.request.method !== 'GET') return;
  if (url.hostname === 'api.anthropic.com') return;
  if (url.protocol === 'chrome-extension:') return;

  // Google Fonts: network-first, cache fallback
  if (url.hostname.includes('fonts.goog') || url.hostname.includes('fonts.gstat')) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_KEY).then(c => c.put(event.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Everything else: cache-first, network fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const clone = res.clone();
        caches.open(CACHE_KEY).then(c => c.put(event.request, clone));
        return res;
      }).catch(() => {
        if (event.request.destination === 'document') {
          return caches.match('./liber_frequentiae_v5-3.html');
        }
      });
    })
  );
});

// ─ MESSAGES ────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

console.log('[SW] Liber Frequentiae v5-3 active · cache:', CACHE_KEY);
