import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // ADR-0015: la versión nueva se ofrece y el técnico decide cuándo aplicarla.
      registerType: "prompt",
      // El service worker solo guarda la app; los datos viven en IndexedDB.
      workbox: { globPatterns: ["**/*.{js,css,html,woff2,png}"] },
      manifest: {
        name: "TEINS Campo",
        short_name: "TEINS Campo",
        lang: "es-CO",
        display: "standalone",
        orientation: "portrait",
        background_color: "#FFFFFF",
        theme_color: "#002B81",
        // Íconos provisionales hasta tener el logo de TEINS.
        icons: [
          { src: "icono-192.png", sizes: "192x192", type: "image/png" },
          { src: "icono-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
  server: { host: true },
});
