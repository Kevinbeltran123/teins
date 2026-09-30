import { randomBytes, randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { leerConfig } from "../config";
import { conectar } from "../plataforma/base-de-datos";
import { crearIdentidad } from "../modulos/identidad";

/**
 * Recuperación de acceso por el administrador (ADR-0009). Toma la contraseña de TEINS_CONTRASENA
 * o genera una y la muestra una sola vez. Cierra todas las sesiones del usuario.
 *   pnpm restablecer-contrasena --usuario ana.perez
 */
const { values } = parseArgs({ options: { usuario: { type: "string" } } });
if (!values.usuario) {
  console.error("Uso: [TEINS_CONTRASENA=...] pnpm restablecer-contrasena --usuario <usuario>");
  process.exit(1);
}
const generada = !process.env.TEINS_CONTRASENA;
const contrasena = process.env.TEINS_CONTRASENA ?? randomBytes(12).toString("base64url");

const config = leerConfig();
const conexion = conectar(config.DATABASE_URL, 2);
try {
  await crearIdentidad(conexion.bd, config).restablecerContrasena(values.usuario, contrasena, { autorId: "administrador", correlacion: `consola:${randomUUID()}` });
  console.log(`Contraseña restablecida para ${values.usuario}; sus sesiones se cerraron.${generada ? ` Nueva contraseña: ${contrasena}` : ""}`);
} finally {
  await conexion.cerrar();
}
