// Compilación de producción del servidor (ADR-0016): un archivo por punto de entrada, con dominio y
// protocolo incluidos (son TypeScript del monorepo) y las bibliotecas como dependencias normales.
import { readdirSync, readFileSync } from "node:fs";
import { build } from "esbuild";

const paquete = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const bibliotecas = Object.keys(paquete.dependencies).filter((d) => !d.startsWith("@teins/"));
// Todo comando de administración entra en la imagen: uno nuevo no puede quedar fuera por olvido.
const comandos = readdirSync(new URL("../src/cli", import.meta.url)).filter((a) => a.endsWith(".ts") && !a.endsWith(".test.ts"));

await build({
  entryPoints: {
    web: "src/web.ts",
    worker: "src/worker.ts",
    ...Object.fromEntries(comandos.map((a) => [`cli/${a.slice(0, -3)}`, `src/cli/${a}`])),
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
