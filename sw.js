// Service Worker - Lentera Hati Gurindam PWA
// v26 - network-only for app shell, no cache loops
const CACHE_NAME = 'lhg-pwa-v26';

// These are NEVER cached (always fresh from network)
const NEVER_CACHE = [
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/sw.js'
];

// These can be cached (rarely change)
const CACHEABLE = [
  '/js/html2pdf.bundle.min.js',
  '/manifest.json',
  '/img/logo-circle.png',
  '/img/idcard-template.jpg',
  '/img/icon-192x192.png',
  '/img/icon-512x512.png'
];

self.addEventListener('install', (event) => {
  // Skip waiting immediately — take control right away
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CACHEABLE).catch(() => {});
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Handle skipWaiting message from page
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept Supabase API calls or non-GET
  if (url.hostname.includes('supabase.co') || event.request.method !== 'GET') {
    return;
  }

  // For app shell files (HTML, CSS, JS) — ALWAYS go to network first, never serve stale
  const pathname = url.pathname;
  const isAppShell = NEVER_CACHE.some(p => pathname.endsWith(p.replace('/', ''))) ||
                     pathname.endsWith('.html') ||
                     pathname.endsWith('.css') ||
                     pathname.endsWith('.js');

  if (isAppShell) {
    // Network-only for app shell: if offline, show stale but prefer fresh
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' }).catch(() => {
        return caches.match(event.request);
      })
    );
    return;
  }

  // For static assets (images, fonts) — cache first, network fallback
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
