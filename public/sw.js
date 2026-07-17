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

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If there's already a window open, focus it
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        // You can change '/' to the specific URL you want to open
        return clients.openWindow('/');
      }
    })
  );
});
