import { defineConfig, devices } from "@playwright/test";

const enCI = Boolean(process.env.CI);
const servidor = { cwd: "../paquetes/servidor", env: { INICIOS_DE_SESION_POR_MINUTO: "1000" } };

/**
 * Extremo a extremo (ADR-0018, nivel 5): Chromium y WebKit sobre el sistema completo.
 * Requiere PostgreSQL y S3 corriendo (docker compose up) y el .env del servidor.
 * WebKit de escritorio no es Safari de iPhone: la lista de verificación manual sigue siendo obligatoria.
 */
export default defineConfig({
  testDir: "pruebas",
  globalSetup: "./preparar.ts",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: enCI ? 1 : 0,
  workers: 1,
  reporter: enCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { trace: "retain-on-failure", locale: "es-CO", timezoneId: "America/Bogota" },
  projects: [
    { name: "chromium", use: { ...devices["Pixel 7"] } },
    { name: "webkit", use: { ...devices["iPhone 13"] } },
  ],
  webServer: [
    { ...servidor, command: "npx tsx --env-file=.env src/web.ts", url: "http://localhost:3000/salud", reuseExistingServer: false },
    { cwd: "../paquetes/campo", command: "pnpm build && pnpm preview --port 5173 --strictPort", url: "http://localhost:5173", reuseExistingServer: !enCI, timeout: 120_000 },
    { cwd: "../paquetes/oficina", command: "pnpm build && pnpm preview", url: "http://localhost:5174", reuseExistingServer: !enCI, timeout: 120_000 },
  ],
});
