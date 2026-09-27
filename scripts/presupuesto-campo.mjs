// Presupuesto de rendimiento de campo (ADR-0011, QA-16): JavaScript inicial comprimido.
// Se fijó midiendo el corte 1; subirlo es una decisión que se justifica en el pull request.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

// ADR-0030: 135 KB desde el rediseño Recorrido (antes 120, ADR-0011).
const PRESUPUESTO_JS_KB = 135;
const carpeta = "paquetes/campo/dist";

const html = readFileSync(join(carpeta, "index.html"), "utf8");
const scripts = [...html.matchAll(/<script[^>]+src="\/([^"]+\.js)"/g), ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="\/([^"]+\.js)"/g)].map((m) => m[1]);
if (scripts.length === 0) {
  console.error("No se encontró JavaScript inicial en campo/dist: compile antes de medir.");
  process.exit(1);
}
const kb = scripts.reduce((total, archivo) => total + gzipSync(readFileSync(join(carpeta, archivo))).length, 0) / 1024;
const linea = `JavaScript inicial de campo: ${kb.toFixed(1)} KB comprimido (presupuesto ${PRESUPUESTO_JS_KB} KB)`;
if (kb > PRESUPUESTO_JS_KB) {
  console.error(`${linea}. Supera el presupuesto.`);
  process.exit(1);
}
console.log(linea);
