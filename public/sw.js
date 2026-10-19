// CampusNotes Production Service Worker
// Conservative caching: only content-hashed /assets/* and network-first for HTML shell
// Never intercepts Firebase RTDB, Firebase Auth, APIs, or PDF streams

const CACHE_VERSION = 'cn-assets-v1';
const ASSETS_CACHE = `${CACHE_VERSION}-hashed`;
const HTML_CACHE = `${CACHE_VERSION}-html`;

self.addEventListener('install', () => {
  // Activate immediately without waiting for existing clients to close
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key.startsWith('cn-') && !key.startsWith(CACHE_VERSION)) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  // 2. NEVER intercept Firebase, Google APIs, IP lookup, or PDF blob/stream downloads
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('ipify.org') ||
    url.pathname.includes('/file_blobs/') ||
    url.pathname.endsWith('.pdf') ||
    url.protocol === 'ws:' ||
    url.protocol === 'wss:'
  ) {
    return;
  }

  // 3. Cache-First for content-hashed Vite assets (/assets/*)
  // These files contain content hashes (e.g. index-6BuMaPwK.js) and are immutable
  if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(ASSETS_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) {
          return cached;
        }
        const response = await fetch(request);
        if (response.status === 200) {
          cache.put(request, response.clone());
        }
        return response;
      })
    );
    return;
  }

  // 4. Network-First for HTML navigation requests (/, /materials, etc.)
  // Always fetches fresh HTML from network so users get new asset hashes immediately on deploys
  // Falls back to cached HTML only if offline or network completely fails
  if (request.mode === 'navigate' || (request.headers.get('accept') && request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(request)
        .then(async (networkResponse) => {
          if (networkResponse.status === 200) {
            const cache = await caches.open(HTML_CACHE);
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(async () => {
          // Offline fallback
          const cache = await caches.open(HTML_CACHE);
          const cached = await cache.match(request);
          if (cached) {
            return cached;
          }
          const rootCached = await cache.match('/');
          if (rootCached) {
            return rootCached;
          }
          return new Response('CampusNotes is offline. Please check your connection.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          });
        })
    );
    return;
  }
});
