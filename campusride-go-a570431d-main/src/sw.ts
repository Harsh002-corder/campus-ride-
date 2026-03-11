/// <reference lib="webworker" />

import { clientsClaim } from "workbox-core";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { ExpirationPlugin } from "workbox-expiration";
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute, setCatchHandler } from "workbox-routing";
import { CacheFirst, NetworkFirst, NetworkOnly } from "workbox-strategies";

declare let self: ServiceWorkerGlobalScope;

const DEFAULT_API_URL = import.meta.env.PROD
  ? "https://campusride-backend.onrender.com"
  : "http://localhost:4000";

const normalizeOrigin = (value?: string) => {
  if (!value) return "";

  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
};

const apiOrigins = new Set([
  normalizeOrigin(import.meta.env.VITE_API_URL || DEFAULT_API_URL),
  normalizeOrigin(DEFAULT_API_URL),
].filter(Boolean));

const staticDestinations = new Set(["style", "script", "worker", "font", "image"]);
const mapUiOrigins = new Set([
  "https://maps.googleapis.com",
  "https://maps.gstatic.com",
  "https://tile.openstreetmap.org",
]);

const isRealtimeApiRequest = (url: URL) => (
  apiOrigins.has(url.origin)
  && (
    /^\/api\/public\/rides\/[^/]+\/?$/.test(url.pathname)
    || /^\/api\/rides\/[^/]+\/location\/?$/.test(url.pathname)
    || /^\/api\/drivers\/me\/location\/?$/.test(url.pathname)
    || url.pathname.startsWith("/socket.io/")
  )
);

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  ({ url, request }) => url.origin === self.location.origin && staticDestinations.has(request.destination),
  new CacheFirst({
    cacheName: "campusride-static-assets",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 120,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    ],
  }),
);

registerRoute(
  ({ url, request }) => mapUiOrigins.has(url.origin) && staticDestinations.has(request.destination),
  new CacheFirst({
    cacheName: "campusride-map-ui",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 60 * 60 * 24 * 7,
      }),
    ],
  }),
);

registerRoute(
  ({ url }) => isRealtimeApiRequest(url),
  new NetworkOnly(),
);

registerRoute(
  ({ url, request }) => request.method === "GET" && apiOrigins.has(url.origin) && url.pathname.startsWith("/api/"),
  new NetworkFirst({
    cacheName: "campusride-api",
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 80,
        maxAgeSeconds: 60 * 10,
      }),
    ],
  }),
);

// Keep navigations fresh after deployments to avoid stale HTML referencing removed chunks.
registerRoute(
  ({ request, url }) => (
    request.mode === "navigate"
    && !url.pathname.startsWith("/api/")
    && !url.pathname.startsWith("/socket.io/")
    && !url.pathname.startsWith("/offline.html")
  ),
  new NetworkFirst({
    cacheName: "campusride-pages",
    networkTimeoutSeconds: 4,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 60 * 60 * 24,
      }),
    ],
  }),
);

setCatchHandler(async ({ event }) => {
  if (event.request.destination === "document") {
    const offlinePage = await caches.match("/offline.html", { ignoreSearch: true });
    if (offlinePage) return offlinePage;
  }

  return Response.error();
});

self.addEventListener("push", (event) => {
  const payload = event.data?.json?.() ?? {};
  const title = payload.title || "Campus Ride";
  const body = payload.body || "Ride update available.";
  const data = payload.data || {};

  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: "/icons/favicon-192.png",
    badge: "/icons/favicon-192.png",
    data: {
      url: data.url || "/rides",
      type: data.type || "ride-update",
      rideId: data.rideId || null,
    },
    tag: data.tag || data.type || "campusride-notification",
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/rides";

  event.waitUntil((async () => {
    const windowClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

    for (const client of windowClients) {
      if ("focus" in client) {
        await client.navigate(targetUrl);
        await client.focus();
        return;
      }
    }

    await self.clients.openWindow(targetUrl);
  })());
});

export {};