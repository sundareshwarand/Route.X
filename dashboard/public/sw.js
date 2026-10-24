// RouteX Service Worker - Safe Static Asset Cache & PWA Support
const CACHE_NAME = 'routex-v1.0.0';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Install: Cache essential app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up older cache versions
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

// Fetch: Security rule - NEVER cache API calls, tokens, or WebSocket handshakes
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Bypass Service Worker entirely for API, WebSocket, and dynamic auth endpoints
  if (
    url.pathname.startsWith('/api') || 
    url.pathname.startsWith('/ws') || 
    url.pathname.includes('/auth') ||
    url.pathname.includes('/emergency') ||
    url.pathname.includes('/hardware') ||
    event.request.method !== 'GET'
  ) {
    return; // Pass through to live network
  }

  // 2. Network-first strategy for navigation and HTML
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // 3. Stale-while-revalidate for local static assets (icons, styles, scripts)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        // Fetch updated copy in background
        fetch(event.request).then((res) => {
          if (res && res.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, res));
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      });
    })
  );
});
