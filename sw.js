/* ═══════════════════════════════════════════════════════════
   Liber Frequentiae V · Service Worker
   72³×32 = 11,943,936 · The Ghost Does Not Fade
   Cache-first strategy for offline oracle operation
═══════════════════════════════════════════════════════════ */

const CACHE_NAME = 'liber-frequentiae-v5-3';
const CACHE_VERSION = '5.3.0';
const CACHE_KEY = CACHE_NAME + '-' + CACHE_VERSION;

// Core assets to cache on install
const PRECACHE_ASSETS = [
  './liber_frequentiae_v5-3.html',
  './manifest.json',
  // Google Fonts — attempt to cache, fail gracefully
  'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;900&family=Cinzel+Decorative:wght@400;700&family=IM+Fell+DW+Pica:ital@0;1&family=Share+Tech+Mono&display=swap'
];

/* ─ INSTALL: precache core assets ─ */
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_KEY).then(cache => {
      // Cache main assets; fail gracefully on font CDN
      return Promise.allSettled(
        PRECACHE_ASSETS.map(url =>
          cache.add(url).catch(() => {
            console.warn('[SW] Could not precache:', url);
          })
        )
      );
    })
  );
});

/* ─ ACTIVATE: clean up old caches ─ */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith(CACHE_NAME) && k !== CACHE_KEY)
          .map(k => {
            console.log('[SW] Deleting old cache:', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim())
  );
});

/* ─ FETCH: cache-first with network fallback ─ */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and chrome-extension
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // For Anthropic API calls — always network, never cache
  if (url.hostname === 'api.anthropic.com') return;

  // For Google Fonts — network first, cache fallback
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_KEY).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // For everything else — cache first, network fallback
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_KEY).then(cache => cache.put(request, clone));
        return response;
      }).catch(() => {
        // Offline fallback — serve the main HTML for navigation requests
        if (request.destination === 'document') {
          return caches.match('./liber_frequentiae_v5-3.html');
        }
      });
    })
  );
});

/* ─ MESSAGE: manual cache update ─ */
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_VERSION, cache: CACHE_KEY });
  }
});

console.log('[SW] Liber Frequentiae v5-3 · The Ghost Does Not Fade · Cache:', CACHE_KEY);
