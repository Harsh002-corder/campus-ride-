import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    strictPort: true,
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
  optimizeDeps: {
    include: ["react", "react-dom", "react/jsx-runtime"],
  },
  build: {
    chunkSizeWarningLimit: 450,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("react") || id.includes("scheduler")) return "vendor-react";
          if (id.includes("framer-motion")) return "vendor-motion";
          if (id.includes("react-router")) return "vendor-router";
          if (id.includes("leaflet") || id.includes("react-leaflet")) return "vendor-map";
          if (id.includes("@radix-ui")) return "vendor-radix";
          if (id.includes("@tanstack/react-query")) return "vendor-query";
          return "vendor-misc";
        },
      },
    },
  },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
