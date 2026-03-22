/// <reference lib="webworker" />

import { clientsClaim } from "workbox-core";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { ExpirationPlugin } from "workbox-expiration";
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute, setCatchHandler } from "workbox-routing";
import { CacheFirst, NetworkFirst, NetworkOnly, StaleWhileRevalidate } from "workbox-strategies";

declare let self: ServiceWorkerGlobalScope;

const CAMPUSRIDE_CACHE_VERSION = "campusride-v20260322b";
const CACHE_NAMES = {
  STATIC_ASSETS: `${CAMPUSRIDE_CACHE_VERSION}-static-assets`,
  MAP_UI: `${CAMPUSRIDE_CACHE_VERSION}-map-ui`,
  API: `${CAMPUSRIDE_CACHE_VERSION}-api`,
  STABLE_API: `${CAMPUSRIDE_CACHE_VERSION}-stable-api`,
  PAGES: `${CAMPUSRIDE_CACHE_VERSION}-pages`,
};

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

const isStableApiRequest = (url: URL) => (
  apiOrigins.has(url.origin)
  && (
    /^\/api\/settings\b/.test(url.pathname)
    || /^\/api\/stops\b/.test(url.pathname)
    || /^\/api\/users\/me\/favorites\b/.test(url.pathname)
    || /^\/api\/users\/me\/?$/.test(url.pathname)
  )
);

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      const currentCaches = new Set(Object.values(CACHE_NAMES));
      const oldCaches = cacheNames.filter((name) => !currentCaches.has(name));
      await Promise.all(oldCaches.map((cacheName) => caches.delete(cacheName)));
    })(),
  );
  self.clients.claim();
});

registerRoute(
  ({ url, request }) => url.origin === self.location.origin && staticDestinations.has(request.destination),
  new CacheFirst({
    cacheName: CACHE_NAMES.STATIC_ASSETS,
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
    cacheName: CACHE_NAMES.MAP_UI,
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
  ({ url, request }) => request.method === "GET" && isStableApiRequest(url),
  new StaleWhileRevalidate({
    cacheName: CACHE_NAMES.STABLE_API,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 40,
        maxAgeSeconds: 60 * 30,
      }),
    ],
  }),
);

registerRoute(
  ({ url, request }) => request.method === "GET" && apiOrigins.has(url.origin) && url.pathname.startsWith("/api/"),
  new NetworkFirst({
    cacheName: CACHE_NAMES.API,
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

registerRoute(
  ({ request, url }) => (
    request.mode === "navigate"
    && !url.pathname.startsWith("/api/")
    && !url.pathname.startsWith("/socket.io/")
    && !url.pathname.startsWith("/offline.html")
  ),
  new NetworkFirst({
    cacheName: CACHE_NAMES.PAGES,
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
  const request = (event as FetchEvent).request;
  if (request?.destination === "document") {
    const offlinePage = await caches.match("/offline.html", { ignoreSearch: true });
    if (offlinePage) return offlinePage;
  }

  return Response.error();
});

self.addEventListener("push", (event) => {
  let payload: Record<string, unknown> = {};

  try {
    payload = event.data?.json?.() ?? {};
  } catch {
    payload = {};
  }

  const notification = (payload.notification as Record<string, unknown> | undefined) || {};
  const data = (payload.data as Record<string, unknown> | undefined) || payload;
  const rideId = String(data.rideId || "").trim() || null;
  const targetUrl = String(data.url || "").trim() || (rideId ? `/ride-tracking/${rideId}` : "/rides");
  const title = String(notification.title || payload.title || "Campus Ride");
  const body = String(notification.body || payload.body || "Ride update available.");

  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: "/icons/favicon-192.png",
    badge: "/icons/favicon-192.png",
    data: {
      url: targetUrl,
      type: String(data.type || "ride-update"),
      rideId,
    },
    tag: String(data.tag || data.type || `campusride-notification-${rideId || "general"}`),
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/rides";

  event.waitUntil((async () => {
    const windowClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

    for (const client of windowClients) {
      if ("focus" in client && "url" in client) {
        const currentUrl = new URL(client.url);
        const nextUrl = new URL(targetUrl, self.location.origin);

        if (currentUrl.origin === nextUrl.origin) {
          await client.navigate(nextUrl.pathname + nextUrl.search + nextUrl.hash);
          await client.focus();
          return;
        }

        await client.focus();
        return;
      }
    }

    await self.clients.openWindow(targetUrl);
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});

export {};
