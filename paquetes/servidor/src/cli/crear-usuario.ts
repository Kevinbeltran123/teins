import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { leerConfig } from "../config";
import { ROLES, type Rol } from "../plataforma/actor";
import { conectar } from "../plataforma/base-de-datos";
import { crearIdentidad } from "../modulos/identidad";

/**
 * Crea un usuario interno. La contraseña se lee de TEINS_CONTRASENA para que no quede en el
 * historial de la terminal. Uso:
 *   TEINS_CONTRASENA=... pnpm crear-usuario --organizacion <uuid> --usuario ana.perez --nombre "Ana Pérez" --rol tecnico
 */
const { values } = parseArgs({
  options: { organizacion: { type: "string" }, usuario: { type: "string" }, nombre: { type: "string" }, rol: { type: "string" } },
});
const contrasena = process.env.TEINS_CONTRASENA;
if (!values.organizacion || !values.usuario || !values.nombre || !values.rol || !contrasena) {
  console.error("Faltan datos. Uso: TEINS_CONTRASENA=... pnpm crear-usuario --organizacion <uuid> --usuario <u> --nombre <n> --rol <tecnico|oficina>");
  process.exit(1);
}
if (!ROLES.includes(values.rol as Rol)) {
  console.error(`Rol inválido. Opciones: ${ROLES.join(", ")}`);
  process.exit(1);
}

const config = leerConfig();
const conexion = conectar(config.DATABASE_URL, 2);
try {
  const { id } = await crearIdentidad(conexion.bd, config).crearUsuario({
    organizacionId: values.organizacion,
    usuario: values.usuario,
    nombre: values.nombre,
    rol: values.rol as Rol,
    contrasena,
  }, { autorId: "administrador", correlacion: `consola:${randomUUID()}` });
  console.log(`Usuario creado: ${values.usuario} (${id})`);
} finally {
  await conexion.cerrar();
}
