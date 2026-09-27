import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { leerConfig } from "../config";
import { conectar, enOrganizacion } from "../plataforma/base-de-datos";
import { crearSimbolos } from "../modulos/simbolos";

/**
 * Publica la biblioteca de símbolos de los bocetos desde un archivo JSON (ADR-0027): una lista de símbolos con su
 * id, nombre, categoría y trazado. Los que ya no están en el archivo se retiran. Llega a los teléfonos (app 10) en
 * la siguiente bajada, sin publicar la app.
 *   pnpm publicar-simbolos --organizacion <uuid> --archivo simbolos.json
 */
const { values } = parseArgs({ options: { organizacion: { type: "string" }, archivo: { type: "string" } } });
const { organizacion, archivo } = values;
if (!organizacion || !archivo) {
  console.error("Uso: pnpm publicar-simbolos --organizacion <uuid> --archivo <ruta.json>");
  process.exit(1);
}

const config = leerConfig();
const conexion = conectar(config.DATABASE_URL, 2);
try {
  const biblioteca: unknown = JSON.parse(readFileSync(archivo, "utf8"));
  const r = await enOrganizacion(conexion.bd, organizacion, (tx) => crearSimbolos().publicar(tx, organizacion, biblioteca));
  console.log(`Biblioteca publicada desde ${archivo}: ${r.nuevos} nuevos, ${r.cambiados} cambiados y ${r.retirados} retirados`);
} finally {
  await conexion.cerrar();
}
