const CACHE_NAME = 'time-tracker-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass-through fetch for now, enough to satisfy PWA criteria
  event.respondWith(fetch(event.request).catch(() => new Response('Offline')));
});
