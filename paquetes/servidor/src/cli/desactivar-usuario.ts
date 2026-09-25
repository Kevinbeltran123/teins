import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { leerConfig } from "../config";
import { conectar } from "../plataforma/base-de-datos";
import { crearIdentidad } from "../modulos/identidad";

/**
 * Revoca a un usuario (regla 13, P36): pierde el acceso de inmediato y sus teléfonos borran sus datos
 * en el siguiente contacto. Lo que no alcanzó a enviar no se acepta. Su autoría se conserva.
 *   pnpm desactivar-usuario --usuario ana.perez
 */
const { values } = parseArgs({ options: { usuario: { type: "string" } } });
if (!values.usuario) {
  console.error("Uso: pnpm desactivar-usuario --usuario <usuario>");
  process.exit(1);
}

const config = leerConfig();
const conexion = conectar(config.DATABASE_URL, 2);
try {
  const r = await crearIdentidad(conexion.bd, config).desactivarUsuario(values.usuario, { autorId: "administrador", correlacion: `consola:${randomUUID()}` });
  console.log(r === "desactivado" ? `Usuario ${values.usuario} desactivado; sus sesiones se cerraron y sus teléfonos borrarán sus datos al conectarse.` : `El usuario ${values.usuario} ya estaba desactivado.`);
} finally {
  await conexion.cerrar();
}
