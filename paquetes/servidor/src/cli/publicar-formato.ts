import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { leerConfig } from "../config";
import { conectar, enOrganizacion } from "../plataforma/base-de-datos";
import { crearFormatos } from "../modulos/formatos";

/**
 * Publica una versión de formato desde un archivo JSON (ADR-0006). El meta-esquema la valida antes;
 * llega a los teléfonos en la siguiente bajada, sin publicar la app (QA-11).
 *   pnpm publicar-formato --organizacion <uuid> --archivo formatos/ups.v3.json
 */
const { values } = parseArgs({ options: { organizacion: { type: "string" }, archivo: { type: "string" } } });
const { organizacion, archivo } = values;
if (!organizacion || !archivo) {
  console.error("Uso: pnpm publicar-formato --organizacion <uuid> --archivo <ruta.json>");
  process.exit(1);
}

const config = leerConfig();
const conexion = conectar(config.DATABASE_URL, 2);
try {
  const definicion: unknown = JSON.parse(readFileSync(archivo, "utf8"));
  const r = await enOrganizacion(conexion.bd, organizacion, (tx) => crearFormatos().publicar(tx, organizacion, definicion));
  console.log(r === "publicada" ? `Formato publicado desde ${archivo}` : `Esa versión ya estaba publicada con el mismo contenido`);
} finally {
  await conexion.cerrar();
}
