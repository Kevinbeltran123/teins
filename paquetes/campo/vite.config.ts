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
      workbox: {
        globPatterns: ["**/*.{js,css,html,woff2,png}"],
        // La API nunca pasa por el service worker ni por su caché.
        navigateFallbackDenylist: [/^\/api\//],
        // Avisos push (ADR-0023): el manejador vive en public/ y se suma al service worker generado.
        importScripts: ["avisos-sw.js"],
      },
      manifest: {
        // Así se llama bajo el ícono y en los avisos (Kevin, 2026-09-26).
        name: "TEINS",
        short_name: "TEINS",
        lang: "es-CO",
        display: "standalone",
        orientation: "portrait",
        background_color: "#0B0F17",
        theme_color: "#0B0F17",
        // Íconos provisionales hasta tener el logo de TEINS.
        icons: [
          { src: "icono-192.png", sizes: "192x192", type: "image/png" },
          { src: "icono-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
  server: {
    host: true,
    // Mismo origen para la API (ADR-0016): la cookie de sesión viaja sin CORS.
    proxy: { "/api": process.env.TEINS_API ?? "http://localhost:3000" },
  },
  preview: { proxy: { "/api": process.env.TEINS_API ?? "http://localhost:3000" } },
});
