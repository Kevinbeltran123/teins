import { defineConfig, devices } from "@playwright/test";

/**
 * Capturas de pantalla de los manuales (capturas/comun.ts). No corre en la integración continua: la configuración de
 * siempre solo mira `pruebas`. Uso: `pnpm --filter @teins/e2e capturas`, y con `CAPTURAS_FORMATOS=reales` para los
 * formatos de TEINS (las imágenes quedan fuera de git). Requiere `docker compose up` y el .env del servidor.
 *
 * Un solo recorrido, en orden: los datos, el teléfono del técnico (Safari de iPhone), oficina y el portal (escritorio).
 */
const CLAVE_PUBLICA_AVISOS = "BOXZWm72IS92BJJBRVsOr18iQm923oFhf1AEZDwBe6t-q8GJISfEGyTTVn4agceqiue9pH2hTy8V1NqMosVxqpk";
const servidor = { cwd: "../paquetes/servidor", env: { INICIOS_DE_SESION_POR_MINUTO: "10000", PORTAL_INTENTOS_POR_ORIGEN: "10000", AVISOS_VAPID_PUBLICA: CLAVE_PUBLICA_AVISOS } };
const escritorio = { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 860 } };

export default defineConfig({
  testDir: "capturas",
  outputDir: "test-results/capturas",
  globalSetup: "./capturas/preparar.ts",
  timeout: 600_000,
  expect: { timeout: 20_000 },
  workers: 1,
  reporter: "list",
  use: { locale: "es-CO", timezoneId: "America/Bogota", trace: "retain-on-failure", actionTimeout: 20_000 },
  projects: [
    { name: "datos", testMatch: "datos.setup.ts", use: escritorio },
    { name: "campo", testMatch: "campo.spec.ts", use: { ...devices["iPhone 13"] }, dependencies: ["datos"] },
    { name: "oficina", testMatch: "oficina.spec.ts", use: escritorio, dependencies: ["campo"] },
  ],
  webServer: [
    { ...servidor, command: "npx tsx --env-file=.env src/web.ts", url: "http://localhost:3000/salud", reuseExistingServer: true },
    { cwd: "../paquetes/campo", command: "pnpm build && pnpm preview --port 5173 --strictPort", url: "http://localhost:5173", reuseExistingServer: true, timeout: 120_000 },
    { cwd: "../paquetes/oficina", command: "pnpm build && pnpm preview", url: "http://localhost:5174", reuseExistingServer: true, timeout: 120_000 },
    { cwd: "../paquetes/portal", command: "pnpm build && pnpm preview", url: "http://localhost:5175", reuseExistingServer: true, timeout: 120_000 },
  ],
});
