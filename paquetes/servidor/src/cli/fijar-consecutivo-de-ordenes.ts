import { parseArgs } from "node:util";
import { leerConfig } from "../config";
import { conectar, enOrganizacion } from "../plataforma/base-de-datos";
import { clientesYSitios } from "../modulos/clientes";
import { crearVisitas } from "../modulos/visitas";

/**
 * Fija el último número de orden de servicio de una organización, para que la siguiente visita siga desde el de TEINS
 * (ADR-0051). Nunca baja ni repite un número: si ya va más arriba, se niega.
 *   pnpm fijar-consecutivo-de-ordenes --organizacion <uuid> --ultimo 773   # la siguiente visita será la 0774
 */
const { values } = parseArgs({ options: { organizacion: { type: "string" }, ultimo: { type: "string" } } });
const ultimo = Number(values.ultimo);
if (!values.organizacion || values.ultimo === undefined || !Number.isInteger(ultimo) || ultimo < 0) {
  console.error("Uso: pnpm fijar-consecutivo-de-ordenes --organizacion <uuid> --ultimo <entero desde 0>");
  process.exit(1);
}

const config = leerConfig();
const conexion = conectar(config.DATABASE_URL, 2);
try {
  await enOrganizacion(conexion.bd, values.organizacion, (tx) => crearVisitas(clientesYSitios).fijarConsecutivoDeOrdenes(tx, values.organizacion!, ultimo));
  console.log(`Último número de orden fijado en ${ultimo}: la siguiente visita será la ${ultimo + 1}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await conexion.cerrar();
}
