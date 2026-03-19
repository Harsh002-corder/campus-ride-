import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "campusride-icon.ico",
        "campusride-icon.png",
        "icons/favicon-16.png",
        "icons/favicon-32.png",
        "icons/favicon-192.png",
        "icons/favicon-512.png",
      ],
      manifest: {
        name: "CampusRide",
        short_name: "CampusRide",
        description: "Smart campus transport with real-time tracking, offline access, and instant updates.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#0a1020",
        theme_color: "#1d4ed8",
        icons: [
          {
            src: "/icons/favicon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/favicon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icons/favicon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        navigateFallback: "/offline.html",
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,json,woff2}"],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === "script" || request.destination === "style",
            handler: "CacheFirst",
            options: {
              cacheName: "static-assets-v1",
              expiration: {
                maxEntries: 120,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/") || url.href.includes("/api/"),
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache-v1",
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "images-cache-v1",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
