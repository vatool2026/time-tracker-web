/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();

self.addEventListener('push', function (event: PushEvent) {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: data.icon || '/icons/icon-default.svg',
      badge: data.badge || '/icons/icon-default.svg',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: '2',
        url: data.url || '/dashboard'
      }
    };
    event.waitUntil(self.registration.showNotification(data.title || 'Zeiterfassung', options));
  }
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  // Resolve the target against our own origin; never navigate to foreign origins.
  let target = new URL('/dashboard', self.location.origin);
  try {
    const candidate = new URL(event.notification.data?.url || '/dashboard', self.location.origin);
    if (candidate.origin === self.location.origin) target = candidate;
  } catch {
    // keep default
  }

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          try {
            const focused = await client.focus();
            if (focused.url !== target.href && 'navigate' in focused) {
              await focused.navigate(target.href);
            }
            return;
          } catch (err) {
            console.error('Failed to focus/navigate client, opening new window instead:', err);
            break;
          }
        }
      }
      // No usable window: open the app at the target
      if (self.clients.openWindow) {
        await self.clients.openWindow(target.href);
      }
    })()
  );
});
