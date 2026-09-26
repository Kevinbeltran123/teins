import { defineConfig, devices } from "@playwright/test";
import { REMOTO } from "./destino";

const enCI = Boolean(process.env.CI);
/**
 * Avisos push (ADR-0023): el rol web solo necesita la clave pública para que las superficies ofrezcan
 * activarlos. No es un secreto; la privada no existe aquí porque en el extremo a extremo no corre el worker.
 */
const CLAVE_PUBLICA_AVISOS = "BOXZWm72IS92BJJBRVsOr18iQm923oFhf1AEZDwBe6t-q8GJISfEGyTTVn4agceqiue9pH2hTy8V1NqMosVxqpk";
const servidor = { cwd: "../paquetes/servidor", env: { INICIOS_DE_SESION_POR_MINUTO: "1000", AVISOS_VAPID_PUBLICA: CLAVE_PUBLICA_AVISOS } };

/**
 * Extremo a extremo (ADR-0018, nivel 5): Chromium y WebKit sobre el sistema completo.
 * Requiere PostgreSQL y S3 corriendo (docker compose up) y el .env del servidor.
 * WebKit de escritorio no es Safari de iPhone: la lista de verificación manual sigue siendo obligatoria.
 * Contra un entorno desplegado: E2E_CAMPO_URL=https://... E2E_OFICINA_URL=https://... (ver destino.ts).
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
  webServer: REMOTO
    ? []
    : [
    { ...servidor, command: "npx tsx --env-file=.env src/web.ts", url: "http://localhost:3000/salud", reuseExistingServer: false },
    { cwd: "../paquetes/campo", command: "pnpm build && pnpm preview --port 5173 --strictPort", url: "http://localhost:5173", reuseExistingServer: !enCI, timeout: 120_000 },
    { cwd: "../paquetes/oficina", command: "pnpm build && pnpm preview", url: "http://localhost:5174", reuseExistingServer: !enCI, timeout: 120_000 },
    { cwd: "../paquetes/portal", command: "pnpm build && pnpm preview", url: "http://localhost:5175", reuseExistingServer: !enCI, timeout: 120_000 },
      ],
});
