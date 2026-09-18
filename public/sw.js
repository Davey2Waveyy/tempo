// Minimal service worker: enables install (PWA) and an offline app shell.
// It deliberately never caches /api/ — auth and workspace data always hit the
// network so nothing private or stale is served from the cache.
const CACHE = 'tempo-shell-v2';
const SHELL = [
  '/',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/favicon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  // Never intercept anything but same-origin GETs, and never touch the API.
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/')
  )
    return;
  // Page loads must always reflect the latest deploy. The HTML carries no
  // cache headers, so a plain fetch could return a browser-cached copy that
  // still points at the previous build's assets — which left installed apps
  // stuck on an old version. Fetch navigations fresh (bypassing the HTTP
  // cache), refresh the offline shell copy, and fall back to it only offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          const copy = response.clone();
          caches
            .open(CACHE)
            .then((cache) => cache.put('/', copy))
            .catch(() => {});
          return response;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }
  // Other GETs (content-hashed assets): network-first, cache fallback.
  event.respondWith(
    fetch(request).catch(() =>
      caches.match(request).then((cached) => cached || caches.match('/')),
    ),
  );
});
