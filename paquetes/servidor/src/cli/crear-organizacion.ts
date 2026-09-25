import { parseArgs } from "node:util";
import { leerConfig } from "../config";
import { conectar } from "../plataforma/base-de-datos";
import { organizaciones } from "../modulos/identidad/esquema";

/**
 * Crea la organización de un entorno (regla 15: todo dato pertenece a una). En desarrollo y pruebas la crea
 * `sembrar`; en producción, que nunca se siembra, este comando (lo usa infra/railway/montar.sh). Si ya
 * existe con ese identificador, no la toca.
 *   pnpm crear-organizacion --id <uuid> --nombre TEINS
 */
const { values } = parseArgs({ options: { id: { type: "string" }, nombre: { type: "string" } } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
if (!values.id || !UUID.test(values.id) || !values.nombre?.trim()) {
  console.error("Uso: pnpm crear-organizacion --id <uuid> --nombre <nombre>");
  process.exit(1);
}

const config = leerConfig();
const propietario = conectar(config.DATABASE_URL_PROPIETARIO, 1);
try {
  const [creada] = await propietario.bd.insert(organizaciones).values({ id: values.id, nombre: values.nombre.trim() }).onConflictDoNothing().returning({ id: organizaciones.id });
  console.log(creada ? `Organización creada: ${values.nombre.trim()} (${values.id})` : `La organización ${values.id} ya existía: no se tocó`);
} finally {
  await propietario.cerrar();
}
