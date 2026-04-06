/* ─── MA Streaming Service Worker — Offline Support ─────────────── */
const CACHE_NAME = 'ma-streaming-v1';
const OFFLINE_URL = '/offline';

/* Pages to pre-cache on install */
const PRECACHE_URLS = [
  '/',
  '/offline',
  '/live',
  '/entertainment',
  '/kids',
];

/* ── Install: pre-cache shell pages ── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {});
    }).then(() => self.skipWaiting())
  );
});

/* ── Activate: clean old caches ── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch: network-first with offline fallback ── */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  /* Skip non-GET, cross-origin streaming requests, and API calls */
  if (request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/proxy/')) return;
  if (url.pathname.startsWith('/free-hls/')) return;
  if (url.pathname.startsWith('/vod-play/')) return;
  if (url.pathname.startsWith('/xtream-')) return;
  if (!url.origin.startsWith(self.location.origin)) return;

  /* For navigation requests: network first, offline page fallback */
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          /* Cache successful navigation responses */
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          /* Try cache, then offline page */
          return caches.match(request)
            .then(cached => cached || caches.match(OFFLINE_URL))
            .then(fallback => fallback || new Response('Offline', { status: 503 }));
        })
    );
    return;
  }

  /* For static assets (_next/static): cache-first */
  if (url.pathname.startsWith('/_next/static/') || url.pathname.match(/\.(js|css|woff2?|png|jpg|svg|ico)$/)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached || new Response('', { status: 503 }));
      })
    );
    return;
  }

  /* Default: network with cache fallback */
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request).then(c => c || new Response('', { status: 503 })))
  );
});

/* ── Background sync for offline actions ── */
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
