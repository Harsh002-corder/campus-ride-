import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

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
      injectRegister: false,
      manifest: false,
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      includeAssets: [
        "campusride-icon.ico",
        "campusride-icon.png",
        "icons/favicon-16.png",
        "icons/favicon-32.png",
        "icons/favicon-192.png",
        "icons/favicon-512.png",
      ],
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff,woff2}"],
      },
      devOptions: {
        enabled: mode === "development",
        type: "module",
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;

          if (id.includes("react") || id.includes("scheduler")) {
            return "react-vendor";
          }

          if (id.includes("@react-google-maps") || id.includes("react-leaflet") || id.includes("leaflet")) {
            return "maps-vendor";
          }

          if (id.includes("socket.io-client") || id.includes("engine.io-client")) {
            return "realtime-vendor";
          }

          if (id.includes("@radix-ui") || id.includes("framer-motion") || id.includes("recharts")) {
            return "ui-vendor";
          }

          return "vendor";
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
