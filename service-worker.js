const CACHE_NAME = 'operacao-apogeu-filipe-v1';

// Arquivos estruturais essenciais (obrigatórios para o PWA rodar offline)
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// Imagens e fontes (cacheados com tolerância: se algum arquivo faltar na pasta, não trava a instalação)
const OPTIONAL_ASSETS = [
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/logo-entalpia.png',
  './assets/banner.jpg',
  './assets/watermark.jpg',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700;900&display=swap'
];

// ===== 1. INSTALAÇÃO DO SERVICE WORKER =====
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // 1.1 Cacheia os arquivos essenciais
      await cache.addAll(CORE_ASSETS);

      // 1.2 Cacheia as imagens e fontes sem travar caso alguma falte no disco
      await Promise.allSettled(
        OPTIONAL_ASSETS.map((url) =>
          fetch(url)
            .then((response) => {
              if (response && response.ok) {
                return cache.put(url, response);
              }
            })
            .catch(() => {
              // Silencia erros de arquivos opcionais não encontrados
            })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ===== 2. ATIVAÇÃO E LIMPEZA DE VERSÕES ANTIGAS =====
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

// ===== 3. ESTRATÉGIA DE INTERCEPTAÇÃO (CACHE-FIRST COM ATUALIZAÇÃO EM BACKGROUND) =====
self.addEventListener('fetch', (event) => {
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Atualiza o cache silenciosamente em background se houver internet
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => {});

        return cachedResponse;
      }

      // Se não estiver em cache, busca na rede e guarda uma cópia
      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'error') {
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        })
        .catch(() => {
          // Se estiver offline e for navegação de página, retorna o index.html
          if (event.request.destination === 'document') {
            return caches.match('./index.html');
          }
        });
    })
  );
});