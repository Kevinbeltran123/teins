// Licencias de las dependencias de producción (regla 12 de AGENTS.md, R7, I-30).
// Solo se aceptan licencias permisivas conocidas: una licencia nueva o desconocida detiene la
// integración continua hasta que alguien la revise y, si procede, la agregue aquí con su razón.
import { execFileSync } from "node:child_process";

const PERMITIDAS = new Set([
  "MIT",
  "MIT-0",
  "ISC",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "0BSD",
  "BlueOak-1.0.0",
  "CC0-1.0",
  "Unlicense",
  // Fuentes tipográficas (Atkinson Hyperlegible).
  "OFL-1.1",
  // Datos (caniuse-lite y similares), no código.
  "CC-BY-4.0",
  // Copyleft débil por archivo: permite uso comercial sin abrir el código propio.
  "MPL-2.0",
  // Licencia de la PSF, permisiva (argparse, vía graphile-worker → cosmiconfig → js-yaml).
  "Python-2.0",
]);

const salida = execFileSync("pnpm", ["licenses", "list", "--prod", "--json"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const porLicencia = JSON.parse(salida);

const problemas = [];
for (const [licencia, paquetes] of Object.entries(porLicencia)) {
  // Expresiones SPDX con OR: basta que una alternativa sea permitida.
  const alternativas = licencia.replace(/[()]/g, "").split(/\s+OR\s+/);
  if (alternativas.some((a) => PERMITIDAS.has(a.trim()))) continue;
  for (const p of paquetes) problemas.push(`${p.name}@${p.versions.join(",")}: ${licencia}`);
}

if (problemas.length > 0) {
  console.error("Dependencias con licencia no permitida o sin revisar:\n" + problemas.map((p) => `  ${p}`).join("\n"));
  process.exit(1);
}
console.log(`Licencias verificadas: ${Object.values(porLicencia).flat().length} paquetes, todas permitidas.`);
