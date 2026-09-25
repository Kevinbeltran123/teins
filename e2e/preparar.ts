import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { nuevaVisita, nuevoUsuario } from "./consola";
import { REMOTO } from "./destino";

/**
 * Deja la base lista para la corrida: migraciones, organización y formatos de prueba (sembrar es
 * idempotente), dos usuarios propios de esta corrida, con contraseñas que no se guardan en ningún lado,
 * y una visita asignada al técnico.
 */
export default function preparar() {
  const servidor = { cwd: new URL("../paquetes/servidor/", import.meta.url).pathname, stdio: "inherit" as const };
  // Un entorno desplegado ya migra al desplegar y se sembró una vez; su worker ya corre.
  if (!REMOTO) {
    execFileSync("pnpm", ["migrar"], servidor);
    execFileSync("pnpm", ["sembrar"], { ...servidor, stdio: "ignore" });
  }

  const tecnico = nuevoUsuario("tecnico", "tecnico.e2e");
  const oficina = nuevoUsuario("oficina", "oficina");
  const cliente = nuevaVisita(tecnico);
  mkdirSync("test-results", { recursive: true });
  writeFileSync("test-results/usuarios.json", JSON.stringify({ tecnico, oficina, cliente }));

  if (REMOTO) return;
  // El worker no tiene puerto que esperar: se arranca aquí y se detiene al terminar la corrida.
  const worker = spawn("npx", ["tsx", "--env-file=.env", "src/worker.ts"], { cwd: servidor.cwd, stdio: "ignore" });
  return async () => {
    worker.kill("SIGTERM");
  };
}
