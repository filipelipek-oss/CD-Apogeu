/**
 * =========================================================================
 * OPERAÇÃO DESTINAÇÃO FINAL | CÂMARA DOS DEPUTADOS (CARGO 4: ARQUIVOLOGIA)
 * PWA SERVICE WORKER — FILIPE OLIVEIRA SANTOS
 * =========================================================================
 * Estratégia de Alta Performance e Blindagem de Segurança:
 *  - Shell & Documentos: Network-First com Timeout Resiliente e Fallback Offline
 *  - Imagens e Identidade Visual: Stale-While-Revalidate com Fallbacks Locais
 *  - Tipografia Externa: Cache-First isolado (Google Fonts)
 *  - Segurança: Validação de Origem em postMessage, sanitização de status HTTP
 *  - Conformidade PWA: Suporte integral aos critérios do PWABuilder
 * =========================================================================
 */

const VERSION = 'v5.0.0';
const CACHE_PREFIX = 'destinacao-final-filipe';
const CACHES = {
  shell: `${CACHE_PREFIX}-shell-${VERSION}`,
  assets: `${CACHE_PREFIX}-assets-${VERSION}`,
  fonts: `${CACHE_PREFIX}-fonts-${VERSION}`
};

// 1. Núcleo Estrutural Inegociável (App Shell Canônico)
const CORE_SHELL = [
  './',
  './index.html',
  './manifest.json'
];

// 2. Ativos Locais com Contingências Reais de Diretório
const LOCAL_ASSETS = [
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/logo-entalpia.png',
  './assets/banner.jpg',
  './assets/watermark.jpg',
  // Rotas de contingência caso os arquivos estejam em asset/ ou na raiz
  './banner.jpg',
  './watermark.jpg',
  './logo-entalpia.png'
];

// 3. Tipografias Oficiais (Google Fonts)
const EXTERNAL_FONTS = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700;900&display=swap'
];

// =========================================================================
// CICLO 1: INSTALAÇÃO (Precache Resiliente)
// =========================================================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      // 1.1 Cache obrigatório do Shell básico
      const shellCache = await caches.open(CACHES.shell);
      await shellCache.addAll(CORE_SHELL);

      // 1.2 Cache de ativos visuais sem bloquear instalação caso algum falte
      const assetCache = await caches.open(CACHES.assets);
      await Promise.allSettled(
        LOCAL_ASSETS.map(async (url) => {
          try {
            const response = await fetch(url, { cache: 'no-cache' });
            if (response && response.ok) {
              await assetCache.put(url, response);
            }
          } catch (_) {
            // Silencia recursos opcionais não encontrados
          }
        })
      );

      // 1.3 Cache das fontes externas
      const fontCache = await caches.open(CACHES.fonts);
      await Promise.allSettled(
        EXTERNAL_FONTS.map(async (url) => {
          try {
            const response = await fetch(url);
            if (response && response.ok) {
              await fontCache.put(url, response);
            }
          } catch (_) {
            // Ignora se estiver offline no momento da instalação
          }
        })
      );

      return self.skipWaiting();
    })()
  );
});

// =========================================================================
// CICLO 2: ATIVAÇÃO (Limpeza Cirúrgica de Caches Anteriores)
// =========================================================================
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

// =========================================================================
// CICLO 3: INTERCEPTAÇÃO E ROTEAMENTO (Fetch Routing Inteligente)
// =========================================================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignora esquemas que não sejam HTTP/HTTPS (extensões do browser, etc.)
  if (!url.protocol.startsWith('http')) return;

  // A. NAVEGAÇÃO / HTML (Network-First com Timeout de 2,5s e Fallback Offline)
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      (async () => {
        try {
          // Timeout para conexões instáveis: não trava a abertura do app
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
        } catch (_) {
          // Rede falhou ou deu timeout: busca versão cacheada
        }

        const cachedResponse = await caches.match(request);
        if (cachedResponse) return cachedResponse;

        // Fallback final: entrega a raiz do aplicativo instalada
        const fallback = await caches.match('./index.html');
        return fallback || Response.error();
      })()
    );
    return;
  }

  // B. FONTES EXTERNAS (Cache-First)
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

  // C. IMAGENS E MÍDIA (Stale-While-Revalidate)
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

  // D. DEMAIS RECURSOS ESTÁTICOS (Stale-While-Revalidate Padrão)
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

// =========================================================================
// CICLO 4: MENSAGENS E SEGURANÇA DE ORIGEM
// =========================================================================
self.addEventListener('message', (event) => {
  // Blindagem de segurança: rejeita mensagens de origens não autorizadas
  if (event.origin && event.origin !== self.location.origin) return;

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});