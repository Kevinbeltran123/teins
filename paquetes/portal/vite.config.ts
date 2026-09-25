import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const api = process.env.TEINS_API ?? "http://localhost:3000";

// Portal del cliente: en línea, sin service worker (ADR-0002); su propio host con /api en el mismo origen (ADR-0016).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5175, strictPort: true, proxy: { "/api": api } },
  preview: { port: 5175, strictPort: true, proxy: { "/api": api } },
});
