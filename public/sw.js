// @ts-nocheck
// sw.js - HerbTratos Service Worker
//
// Estratégia:
//   JS / CSS / HTML  → Network-first  (sempre tenta a rede; cache só como fallback offline)
//   Imagens / fontes → Cache-first    (raramente mudam, vale cachear)
//   Firebase / APIs  → Nunca intercepta

const CACHE_NAME = 'herbtratos-v9';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// ── Install: pré-cacheia apenas o esqueleto mínimo ────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando v9...');
  self.skipWaiting(); // Ativa imediatamente sem esperar abas fecharem
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

// ── Activate: apaga caches de versões antigas ─────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Ativando v8...');
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => {
          console.log('[SW] Removendo cache antigo:', k);
          return caches.delete(k);
        })
      ))
      .then(() => self.clients.claim()) // Assume controle de todas as abas abertas
  );
});

// ── Fetch: estratégia por tipo de arquivo ─────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Nunca intercepta Firebase, Firestore, googleapis
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('firebaseio') ||
    url.hostname.includes('gstatic')
  ) {
    return;
  }

  // Só intercepta GET
  if (event.request.method !== 'GET') return;

  const isJSorCSS = /\.(js|css)(\?.*)?$/.test(url.pathname);
  const isHTML    = url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/');
  const isImage   = /\.(png|jpg|jpeg|svg|ico|webp|woff2?|ttf)(\?.*)?$/.test(url.pathname);

  if (isJSorCSS || isHTML) {
    // ── Network-first: sempre busca a versão mais nova ──────
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // Atualiza o cache com a resposta nova
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline: serve do cache se disponível
          return caches.match(event.request);
        })
    );
    return;
  }

  if (isImage) {
    // ── Cache-first: imagens raramente mudam ───────────────
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((networkResponse) => {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return networkResponse;
        });
      })
    );
    return;
  }

  // Demais recursos: network com fallback para cache
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});