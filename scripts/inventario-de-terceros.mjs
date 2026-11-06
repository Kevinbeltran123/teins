// Inventario de los componentes de terceros de producción (ADR-0056): con cada versión se publican
//   - sbom.cdx.json: la lista de materiales de software en CycloneDX 1.5 (nombre, versión, licencia);
//   - AVISOS-DE-TERCEROS.txt: el aviso de copyright y el texto de licencia de cada uno, que las licencias
//     permisivas (MIT, Apache, BSD) exigen entregar con el software.
// Lee la misma lista que verificar-licencias.mjs. Uso: node scripts/inventario-de-terceros.mjs <carpeta> <version>
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [carpeta, version] = process.argv.slice(2);
if (!carpeta || !version) {
  console.error("Uso: node scripts/inventario-de-terceros.mjs <carpeta> <version>");
  process.exit(1);
}

const salida = execFileSync("pnpm", ["licenses", "list", "--prod", "--json"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const paquetes = Object.values(JSON.parse(salida))
  .flat()
  .flatMap((p) => p.versions.map((v, i) => ({ nombre: p.name, version: v, licencia: p.license, ruta: p.paths[i] ?? p.paths[0] })))
  .sort((a, b) => a.nombre.localeCompare(b.nombre) || a.version.localeCompare(b.version));

/** El archivo de licencia del paquete (LICENSE, LICENCE, COPYING, con o sin extensión). */
const textoDeLicencia = (ruta) => {
  if (!ruta || !existsSync(ruta)) return null;
  const archivo = readdirSync(ruta).find((f) => /^(licen[cs]e|copying)(\.|-|$)/i.test(f));
  return archivo ? readFileSync(join(ruta, archivo), "utf8").trim() : null;
};

// Una expresión con OR, AND o paréntesis va como expresión SPDX; una sola licencia, como id.
const licenciaCdx = (l) => (/[\s()]/.test(l) ? [{ expression: l }] : [{ license: { id: l } }]);
const sbom = {
  bomFormat: "CycloneDX",
  specVersion: "1.5",
  version: 1,
  metadata: { timestamp: new Date().toISOString(), component: { type: "application", name: "teins", version } },
  components: paquetes.map((p) => ({
    type: "library",
    name: p.nombre,
    version: p.version,
    purl: `pkg:npm/${p.nombre.replace("@", "%40")}@${p.version}`,
    licenses: licenciaCdx(p.licencia),
  })),
};

const sinTexto = [];
const avisos = paquetes.map((p) => {
  const texto = textoDeLicencia(p.ruta);
  if (!texto) sinTexto.push(`${p.nombre}@${p.version}`);
  return `${p.nombre}@${p.version} (${p.licencia})\n\n${texto ?? `Licencia ${p.licencia}; el paquete no incluye el texto.`}`;
});

mkdirSync(carpeta, { recursive: true });
writeFileSync(join(carpeta, "sbom.cdx.json"), JSON.stringify(sbom, null, 2) + "\n");
writeFileSync(
  join(carpeta, "AVISOS-DE-TERCEROS.txt"),
  `Componentes de terceros de teins ${version} y sus licencias (${paquetes.length}).\n\n` + avisos.join(`\n\n${"-".repeat(72)}\n\n`) + "\n",
);
console.log(`Inventario de ${paquetes.length} componentes en ${carpeta}${sinTexto.length ? `; ${sinTexto.length} sin texto de licencia propio` : ""}.`);
