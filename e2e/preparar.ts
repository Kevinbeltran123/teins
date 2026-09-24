import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

/**
 * Deja la base lista para la corrida: migraciones, organización y formatos de prueba (sembrar es
 * idempotente) y dos usuarios propios de esta corrida, con contraseñas que no se guardan en ningún lado.
 */
const ORGANIZACION = "00000000-0000-4000-8000-000000000001";

export default function preparar() {
  const servidor = { cwd: new URL("../paquetes/servidor/", import.meta.url).pathname, stdio: "inherit" as const };
  execFileSync("pnpm", ["migrar"], servidor);
  execFileSync("pnpm", ["sembrar"], { ...servidor, stdio: "ignore" });

  const sufijo = randomBytes(3).toString("hex");
  const usuarios = {
    tecnico: { usuario: `tecnico.e2e.${sufijo}`, nombre: `Técnico E2E ${sufijo}`, contrasena: randomBytes(12).toString("base64url") },
    oficina: { usuario: `oficina.e2e.${sufijo}`, nombre: `Oficina E2E ${sufijo}`, contrasena: randomBytes(12).toString("base64url") },
  };
  for (const [rol, u] of Object.entries(usuarios)) {
    execFileSync("pnpm", ["crear-usuario", "--organizacion", ORGANIZACION, "--usuario", u.usuario, "--nombre", u.nombre, "--rol", rol], {
      ...servidor,
      env: { ...process.env, TEINS_CONTRASENA: u.contrasena },
    });
  }
  mkdirSync("test-results", { recursive: true });
  writeFileSync("test-results/usuarios.json", JSON.stringify(usuarios));

  // El worker no tiene puerto que esperar: se arranca aquí y se detiene al terminar la corrida.
  const worker = spawn("npx", ["tsx", "--env-file=.env", "src/worker.ts"], { cwd: servidor.cwd, stdio: "ignore" });
  return async () => {
    worker.kill("SIGTERM");
  };
}
