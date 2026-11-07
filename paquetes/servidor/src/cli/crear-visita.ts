import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { leerConfig } from "../config";
import { conectar, enOrganizacion } from "../plataforma/base-de-datos";
import { clientesYSitios } from "../modulos/clientes";
import { crearFormatos } from "../modulos/formatos";
import { crearIdentidad } from "../modulos/identidad";
import { crearVisitas } from "../modulos/visitas";

/**
 * Programa una visita y la asigna a uno o varios técnicos; les llega en la siguiente bajada. El servicio es la clave de un
 * formato de la organización (ADR-0057); su nombre queda como motivo. Sin `--formato`, `--motivo` es un texto libre y el
 * teléfono ofrece todos los formatos, como las visitas anteriores.
 *   pnpm crear-visita --organizacion <uuid> --cliente <uuid> --sitio <uuid> --formato servicio-ups --fecha 2026-10-01 --tecnicos ana.perez,luis.gomez
 */
const { values } = parseArgs({
  options: {
    organizacion: { type: "string" },
    cliente: { type: "string" },
    sitio: { type: "string" },
    formato: { type: "string" },
    motivo: { type: "string" },
    fecha: { type: "string" },
    tecnicos: { type: "string" },
  },
});
const { organizacion, cliente, sitio, formato, motivo, fecha, tecnicos } = values;
if (!organizacion || !cliente || !sitio || !(formato || motivo) || !fecha || !tecnicos) {
  console.error("Uso: pnpm crear-visita --organizacion <uuid> --cliente <uuid> --sitio <uuid> (--formato <clave> | --motivo <m>) --fecha AAAA-MM-DD --tecnicos <u1,u2>");
  process.exit(1);
}

const config = leerConfig();
const conexion = conectar(config.DATABASE_URL, 2);
try {
  const ids = await crearIdentidad(conexion.bd, config).tecnicos(organizacion, tecnicos.split(","));
  const id = await enOrganizacion(conexion.bd, organizacion, async (tx) => {
    const servicio = formato ? (await crearFormatos().vigentes(tx)).find((f) => f.clave === formato) : undefined;
    if (formato && !servicio) throw new Error(`No hay un formato «${formato}» publicado en la organización`);
    return crearVisitas(clientesYSitios).crear(tx, {
      organizacionId: organizacion,
      autorId: "administrador",
      correlacion: `consola:${randomUUID()}`,
      clienteId: cliente,
      sitioId: sitio,
      motivo: servicio?.nombre ?? motivo!,
      formato: servicio?.clave ?? null,
      programadaPara: fecha,
      tecnicos: ids,
    });
  });
  console.log(`Visita creada: ${id}`);
} finally {
  await conexion.cerrar();
}
