import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { leerConfig } from "../config";
import { conectar, enOrganizacion } from "../plataforma/base-de-datos";
import { clientesYSitios } from "../modulos/clientes";
import { crearIdentidad } from "../modulos/identidad";
import { crearVisitas } from "../modulos/visitas";

/**
 * Programa una visita y la asigna a uno o varios técnicos; les llega en la siguiente bajada.
 *   pnpm crear-visita --organizacion <uuid> --cliente <uuid> --sitio <uuid> --motivo Mantenimiento --fecha 2026-10-01 --tecnicos ana.perez,luis.gomez
 */
const { values } = parseArgs({
  options: {
    organizacion: { type: "string" },
    cliente: { type: "string" },
    sitio: { type: "string" },
    motivo: { type: "string" },
    fecha: { type: "string" },
    tecnicos: { type: "string" },
  },
});
const { organizacion, cliente, sitio, motivo, fecha, tecnicos } = values;
if (!organizacion || !cliente || !sitio || !motivo || !fecha || !tecnicos) {
  console.error("Uso: pnpm crear-visita --organizacion <uuid> --cliente <uuid> --sitio <uuid> --motivo <m> --fecha AAAA-MM-DD --tecnicos <u1,u2>");
  process.exit(1);
}

const config = leerConfig();
const conexion = conectar(config.DATABASE_URL, 2);
try {
  const ids = await crearIdentidad(conexion.bd, config).tecnicos(organizacion, tecnicos.split(","));
  const id = await enOrganizacion(conexion.bd, organizacion, (tx) =>
    crearVisitas(clientesYSitios).crear(tx, {
      organizacionId: organizacion,
      autorId: "administrador",
      correlacion: `consola:${randomUUID()}`,
      clienteId: cliente,
      sitioId: sitio,
      motivo,
      programadaPara: fecha,
      tecnicos: ids,
    }),
  );
  console.log(`Visita creada: ${id}`);
} finally {
  await conexion.cerrar();
}
