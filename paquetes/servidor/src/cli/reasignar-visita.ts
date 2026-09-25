import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { leerConfig } from "../config";
import { conectar, enOrganizacion } from "../plataforma/base-de-datos";
import { clientesYSitios } from "../modulos/clientes";
import { crearIdentidad } from "../modulos/identidad";
import { crearVisitas } from "../modulos/visitas";

/**
 * Reemplaza los técnicos de una visita. A quien sale se le retira de su teléfono en la siguiente
 * bajada; los levantamientos que ya empezó se conservan y se pueden enviar (regla 17).
 *   pnpm reasignar-visita --organizacion <uuid> --visita <uuid> --tecnicos ana.perez
 */
const { values } = parseArgs({ options: { organizacion: { type: "string" }, visita: { type: "string" }, tecnicos: { type: "string" } } });
const { organizacion, visita, tecnicos } = values;
if (!organizacion || !visita || !tecnicos) {
  console.error("Uso: pnpm reasignar-visita --organizacion <uuid> --visita <uuid> --tecnicos <u1,u2>");
  process.exit(1);
}

const config = leerConfig();
const conexion = conectar(config.DATABASE_URL, 2);
try {
  const ids = await crearIdentidad(conexion.bd, config).tecnicos(organizacion, tecnicos.split(","));
  await enOrganizacion(conexion.bd, organizacion, (tx) =>
    crearVisitas(clientesYSitios).reasignar(tx, {
      organizacionId: organizacion,
      autorId: "administrador",
      correlacion: `consola:${randomUUID()}`,
      visitaId: visita,
      tecnicos: ids,
    }),
  );
  console.log(`Visita ${visita} asignada a ${tecnicos}`);
} finally {
  await conexion.cerrar();
}
