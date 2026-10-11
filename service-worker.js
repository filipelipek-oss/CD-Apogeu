/**
 * OPERAÇÃO DESTINAÇÃO FINAL — PWA SERVICE WORKER
 * Versão v9.0.0 — Instalação resiliente para Tablets e Smartphones
 */

const VERSION = 'v9.0.0';
const CACHE_NAME = `destinacao-final-${VERSION}`;

// Recursos essenciais (se algum falhar, o SW continua funcionando normalmente)
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  'asset/icon-192.png',
  'assets/icon-192.png',
  'asset/icon-512.png',
  'assets/icon-512.png',
  'asset/logo-entalpia.png',
  'assets/logo-entalpia.png',
  'asset/banner.jpg',
  'assets/banner.jpg',
  'asset/watermark.jpg',
  'assets/watermark.jpg'
];

self.addEventListener('install', (event) => {
  // Assume o controle imediatamente, sem esperar fechar abas
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Salva cada arquivo individualmente para evitar que um 404 cancele a instalação do app
      return Promise.allSettled(
        ASSETS_TO_CACHE.map(async (url) => {
          try {
            const response = await fetch(url, { cache: 'reload' });
            if (response && response.status === 200) {
              await cache.put(url, response);
            }
          } catch (_) {
            // Ignora falhas de arquivos individuais
          }
        })
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  // Limpa caches antigos e assume os clientes conectados
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

  // Navegação: Tenta a rede primeiro; se estiver offline, busca no cache
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

  // Demais arquivos: responde com cache se existir, atualizando em segundo plano
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