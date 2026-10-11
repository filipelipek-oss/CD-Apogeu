/**
 * =========================================================================
 * OPERAÇÃO DESTINAÇÃO FINAL | CÂMARA DOS DEPUTADOS (CARGO 4: ARQUIVOLOGIA)
 * PWA SERVICE WORKER — FILIPE OLIVEIRA SANTOS
 * =========================================================================
 */

const VERSION = 'v6.0.0';
const CACHE_PREFIX = 'destinacao-final-filipe';
const CACHES = {
  shell: `${CACHE_PREFIX}-shell-${VERSION}`,
  assets: `${CACHE_PREFIX}-assets-${VERSION}`,
  fonts: `${CACHE_PREFIX}-fonts-${VERSION}`
};

const CORE_SHELL = [
  './',
  './index.html',
  './manifest.json'
];

const LOCAL_ASSETS = [
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/logo-entalpia.png',
  './assets/banner.jpg',
  './assets/watermark.jpg',
  './banner.jpg',
  './watermark.jpg',
  './logo-entalpia.png'
];

const EXTERNAL_FONTS = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700;900&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const shellCache = await caches.open(CACHES.shell);
      await shellCache.addAll(CORE_SHELL);

      const assetCache = await caches.open(CACHES.assets);
      await Promise.allSettled(
        LOCAL_ASSETS.map(async (url) => {
          try {
            const response = await fetch(url, { cache: 'no-cache' });
            if (response && response.ok) {
              await assetCache.put(url, response);
            }
          } catch (_) {}
        })
      );

      const fontCache = await caches.open(CACHES.fonts);
      await Promise.allSettled(
        EXTERNAL_FONTS.map(async (url) => {
          try {
            const response = await fetch(url);
            if (response && response.ok) {
              await fontCache.put(url, response);
            }
          } catch (_) {}
        })
      );

      return self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const activeCacheKeys = Object.values(CACHES);
      const existingKeys = await caches.keys();

      await Promise.all(
        existingKeys.map(async (key) => {
          if (!activeCacheKeys.includes(key)) {
            await caches.delete(key);
          }
        })
      );

      return self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (!url.protocol.startsWith('http')) return;

  // Documentos: Network-First com limite de tempo e salvaguarda offline
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      (async () => {
        try {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Network timeout')), 2500)
          );

          const networkPromise = fetch(request).then(async (response) => {
            if (response && response.status === 200) {
              const shellCache = await caches.open(CACHES.shell);
              shellCache.put(request, response.clone());
            }
            return response;
          });

          return await Promise.race([networkPromise, timeoutPromise]);
        } catch (_) {}

        const cachedResponse = await caches.match(request);
        if (cachedResponse) return cachedResponse;

        const fallback = await caches.match('./index.html');
        return fallback || Response.error();
      })()
    );
    return;
  }

  // Tipografias Google: Cache-First
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      (async () => {
        const fontCache = await caches.open(CACHES.fonts);
        const cached = await fontCache.match(request);
        if (cached) return cached;

        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            fontCache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (_) {
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // Imagens e recursos visuais: Stale-While-Revalidate
  if (request.destination === 'image' || url.pathname.includes('/assets/')) {
    event.respondWith(
      (async () => {
        const assetCache = await caches.open(CACHES.assets);
        const cached = await assetCache.match(request);

        const networkFetch = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              assetCache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => null);

        return cached || (await networkFetch) || Response.error();
      })()
    );
    return;
  }

  // Restantes recursos estáticos
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then(async (networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const shellCache = await caches.open(CACHES.shell);
            shellCache.put(request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.origin && event.origin !== self.location.origin) return;
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});