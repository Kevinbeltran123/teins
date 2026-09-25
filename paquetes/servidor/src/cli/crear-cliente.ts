import { parseArgs } from "node:util";
import { leerConfig } from "../config";
import { conectar, enOrganizacion } from "../plataforma/base-de-datos";
import { clientesYSitios } from "../modulos/clientes";

/**
 * Crea un cliente con su primer sitio. Las pantallas de oficina llegan con la gestión de visitas y clientes.
 *   pnpm crear-cliente --organizacion <uuid> --nombre "Cliente" --sitio "Sede principal" --direccion "Calle ..."
 */
const { values } = parseArgs({
  options: { organizacion: { type: "string" }, nombre: { type: "string" }, sitio: { type: "string" }, direccion: { type: "string" } },
});
const { organizacion, nombre, sitio, direccion } = values;
if (!organizacion || !nombre || !sitio || !direccion) {
  console.error("Uso: pnpm crear-cliente --organizacion <uuid> --nombre <n> --sitio <nombre del sitio> --direccion <d>");
  process.exit(1);
}

const config = leerConfig();
const conexion = conectar(config.DATABASE_URL, 2);
try {
  const { clienteId, sitioId } = await enOrganizacion(conexion.bd, organizacion, (tx) =>
    clientesYSitios.crear(tx, { organizacionId: organizacion, nombre, sitio: { nombre: sitio, direccion } }),
  );
  console.log(`Cliente creado: ${clienteId}\nSitio creado: ${sitioId}`);
} finally {
  await conexion.cerrar();
}
