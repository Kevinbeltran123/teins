import { defineConfig, devices } from "@playwright/test";
import { REMOTO } from "./destino";

const enCI = Boolean(process.env.CI);
/**
 * Avisos push (ADR-0023): el rol web solo necesita la clave pública para que las superficies ofrezcan
 * activarlos. No es un secreto; la privada no existe aquí porque en el extremo a extremo no corre el worker.
 */
const CLAVE_PUBLICA_AVISOS = "BOXZWm72IS92BJJBRVsOr18iQm923oFhf1AEZDwBe6t-q8GJISfEGyTTVn4agceqiue9pH2hTy8V1NqMosVxqpk";
/**
 * Inicios de sesión: Better Auth cuenta todos los de una IP (aquí, 127.0.0.1) y solo vuelve a cero tras 60 s sin
 * ninguno; el contador vive en la base y sobrevive al reinicio del servidor. Una ronda hace unos 220: con 1000, la
 * cuarta o quinta ronda seguida se quedaba un minuto sin poder entrar (la ráfaga de la iteración 47). 10 000 es el
 * máximo que acepta config.ts.
 */
const servidor = { cwd: "../paquetes/servidor", env: { INICIOS_DE_SESION_POR_MINUTO: "10000", AVISOS_VAPID_PUBLICA: CLAVE_PUBLICA_AVISOS } };

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
  // Cada prueba crea sus propios usuarios y visitas, así que los archivos corren en paralelo. En la integración,
  // una por núcleo (la máquina de un repositorio privado tiene 2), y WebKit en serie: con 2 o 3 a la vez los
  // recorridos largos pasaban de 90 s y no terminaba antes. Contra un entorno desplegado, una a la vez: el límite
  // de inicios de sesión por IP (QA-7) no se relaja allá.
  workers: REMOTO ? 1 : enCI ? 2 : 3,
  reporter: enCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { trace: "retain-on-failure", locale: "es-CO", timezoneId: "America/Bogota" },
  // Lo que recorre filas que comparte toda la corrida (la bandeja) va en «<navegador>-bandeja»: después de las
  // demás y solo, para que nadie le tome una fila. Pedir `--project webkit-bandeja` corre también `webkit` antes.
  projects: [
    { name: "chromium", use: { ...devices["Pixel 7"] }, grepInvert: /@bandeja-compartida/ },
    { name: "webkit", use: { ...devices["iPhone 13"] }, grepInvert: /@bandeja-compartida/, ...(enCI && { workers: 1 }) },
    { name: "chromium-bandeja", use: { ...devices["Pixel 7"] }, grep: /@bandeja-compartida/, dependencies: ["chromium"], workers: 1 },
    // En local los dos navegadores comparten la base: sin esperar a «chromium-bandeja», las dos tomaban la misma fila al
    // mismo tiempo. En la integración cada navegador va en su trabajo, con su base.
    { name: "webkit-bandeja", use: { ...devices["iPhone 13"] }, grep: /@bandeja-compartida/, dependencies: ["webkit", ...(enCI ? [] : ["chromium-bandeja"])], workers: 1 },
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
