import { execFileSync, spawn } from "node:child_process";
import { REMOTO } from "./destino";

/**
 * Deja la base lista para la corrida: migraciones, organización y formatos de prueba (sembrar es
 * idempotente). Cada prueba crea sus propios usuarios y visitas (consola.ts): ninguna depende de otra,
 * y por eso pueden correr en paralelo.
 */
export default function preparar() {
  const servidor = { cwd: new URL("../paquetes/servidor/", import.meta.url).pathname, stdio: "inherit" as const };
  // Un entorno desplegado ya migra al desplegar y se sembró una vez; su worker ya corre.
  if (!REMOTO) {
    execFileSync("pnpm", ["migrar"], servidor);
    execFileSync("pnpm", ["sembrar"], { ...servidor, stdio: "ignore" });
  }

  if (REMOTO) return;
  // El worker no tiene puerto que esperar: se arranca aquí y se detiene al terminar la corrida.
  // Envíos al cliente simulados (ADR-0028): nada sale del equipo y "rebota" se rechaza. El .env no los pisa.
  // El asistente, con el modelo simulado (ADR-0060): no llama a ninguna API; la pausa por paso deja ver el avance.
  const worker = spawn(process.execPath, ["--env-file=.env", "--import", "tsx", "src/worker.ts"], {
    cwd: servidor.cwd,
    stdio: "ignore",
    env: { ...process.env, ENVIOS_SIMULADOS: "true", ASISTENTE_SIMULADO: "true", ASISTENTE_SIMULADO_PAUSA_MS: "600" },
  });
  return async () => {
    worker.kill("SIGTERM");
  };
}
