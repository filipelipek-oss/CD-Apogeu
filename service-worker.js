/**
 * OPERAÇÃO DESTINAÇÃO FINAL — PWA SERVICE WORKER
 * Versão v17.0.0 — Resiliência Total PWABuilder & Suporte Amplo a Imagens
 */

const VERSION = 'v17.0.0';
const CACHE_NAME = `destinacao-final-${VERSION}`;

const CORE_RESOURCES = [
  './',
  './index.html',
  './manifest.json',
  'assets/icon-192.png',
  'asset/icon-192.png',
  'assets/icon-512.png',
  'asset/icon-512.png',
  'assets/logo-entalpia.png',
  'asset/logo-entalpia.png',
  'assets/banner.jpg',
  'asset/banner.jpg',
  'assets/watermark.jpg',
  'asset/watermark.jpg'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        CORE_RESOURCES.map(async (url) => {
          try {
            const response = await fetch(url, { cache: 'reload' });
            if (response && response.status === 200) {
              await cache.put(url, response);
            }
          } catch (_) {}
        })
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (!request.url.startsWith('http')) return;

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match('./index.html');
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse.clone()));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});