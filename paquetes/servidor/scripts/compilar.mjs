// Compilación de producción del servidor (ADR-0016): un archivo por punto de entrada, con dominio y
// protocolo incluidos (son TypeScript del monorepo) y las bibliotecas como dependencias normales.
import { readFileSync } from "node:fs";
import { build } from "esbuild";

const paquete = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const bibliotecas = Object.keys(paquete.dependencies).filter((d) => !d.startsWith("@teins/"));

await build({
  entryPoints: {
    web: "src/web.ts",
    worker: "src/worker.ts",
    "cli/migrar": "src/cli/migrar.ts",
    "cli/sembrar": "src/cli/sembrar.ts",
    "cli/crear-usuario": "src/cli/crear-usuario.ts",
    "cli/restablecer-contrasena": "src/cli/restablecer-contrasena.ts",
  },
  outdir: "dist",
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  sourcemap: true,
  external: bibliotecas.flatMap((b) => [b, `${b}/*`]),
  logLevel: "info",
});
