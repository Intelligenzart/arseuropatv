/* =====================================================
   ARS EUROPA TV — Service Worker
   Versione: 1.0
   Strategia: Cache-first per assets statici,
   Network-first per la navigazione.
   YouTube e Google APIs sempre da rete.
===================================================== */

const CACHE_NAME = 'ars-europa-tv-v1';
const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

/* ---- INSTALL ---- */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(SHELL_ASSETS);
    })
  );
  self.skipWaiting();
});

/* ---- ACTIVATE ---- */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

/* ---- FETCH ---- */
const BYPASS_ORIGINS = [
  'youtube.com',
  'youtu.be',
  'ytimg.com',
  'googlevideo.com',
  'googleapis.com',
  'google.com',
  'fonts.gstatic.com',
];

function shouldBypass(url) {
  return BYPASS_ORIGINS.some(origin => url.includes(origin));
}

self.addEventListener('fetch', event => {
  const url = event.request.url;

  /* Lascia passare tutto ciò che è YouTube/Google */
  if (shouldBypass(url)) return;

  /* Google Fonts: cache persistente (stale-while-revalidate) */
  if (url.includes('fonts.googleapis.com')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(event.request).then(cached => {
          const fetchPromise = fetch(event.request).then(response => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          });
          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  /* Navigazione (HTML) — network-first con fallback alla cache */
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  /* Tutto il resto — cache-first */
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
