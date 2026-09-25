import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { leerConfig } from "../config";
import { conectar } from "../plataforma/base-de-datos";
import { crearIdentidad } from "../modulos/identidad";

/**
 * Marca (o con --quitar, desmarca) a una persona de oficina como administradora. Sirve para la primera
 * persona administradora de una organización; después se hace desde la pantalla de administración.
 * Administrar exige además activar el segundo factor desde oficina (ADR-0009).
 *   pnpm marcar-administrador --usuario ana.perez [--quitar]
 */
const { values } = parseArgs({ options: { usuario: { type: "string" }, quitar: { type: "boolean" } } });
if (!values.usuario) {
  console.error("Uso: pnpm marcar-administrador --usuario <usuario> [--quitar]");
  process.exit(1);
}

const config = leerConfig();
const conexion = conectar(config.DATABASE_URL, 2);
try {
  await crearIdentidad(conexion.bd, config).marcarAdministrador(values.usuario, !values.quitar, { autorId: "administrador", correlacion: `consola:${randomUUID()}` });
  console.log(values.quitar ? `${values.usuario} ya no administra.` : `${values.usuario} administra. Debe activar el segundo factor en oficina antes de usarlo.`);
} finally {
  await conexion.cerrar();
}
