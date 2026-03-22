import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
import { visualizer } from "rollup-plugin-visualizer";

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
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
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
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,json,woff2}"],
      },
      devOptions: {
        enabled: false,
      },
    }),
    mode === "analyze" &&
      visualizer({
        filename: "dist/stats.html",
        gzipSize: true,
        brotliSize: true,
      }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "es2020",
    cssCodeSplit: true,
    minify: "esbuild",
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          ui: ["framer-motion", "lucide-react", "sonner"],
          maps: ["leaflet", "react-leaflet", "@react-google-maps/api"],
          supabase: ["@supabase/supabase-js"],
          query: ["@tanstack/react-query"],
        },
      },
    },
  },
}));
