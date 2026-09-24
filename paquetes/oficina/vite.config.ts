import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const api = process.env.TEINS_API ?? "http://localhost:3000";

// Oficina trabaja en línea: sin service worker (ADR-0002). Mismo origen para la API (ADR-0016).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5174, strictPort: true, proxy: { "/api": api } },
  preview: { port: 5174, strictPort: true, proxy: { "/api": api } },
});
