const CACHE_NAME = 'time-tracker-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass-through fetch with a proper HTML offline fallback
  event.respondWith(
    fetch(event.request).catch(() => new Response(
      '<html><body><h1>Offline</h1><p>Bitte überprüfe deine Internetverbindung.</p></body></html>', 
      { headers: { 'Content-Type': 'text/html' } }
    ))
  );
});
