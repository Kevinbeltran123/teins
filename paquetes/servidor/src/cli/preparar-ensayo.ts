import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";
import { leerConfig, urlDelPropietario } from "../config";
import { ORGANIZACION_DEL_ENSAYO, usuarioDelEnsayo } from "../ensayo";
import { conectar, enOrganizacion } from "../plataforma/base-de-datos";
import { crearFormatos } from "../modulos/formatos";
import { crearIdentidad } from "../modulos/identidad";
import { organizaciones, usuarios } from "../modulos/identidad/esquema";

/**
 * Prepara el ensayo de carga (iteración 51) en desarrollo o en el entorno de pruebas: su organización, el formato de
 * prueba y sus usuarios ficticios (R5). Idempotente: lo que existe no se toca, así las sesiones que guardó el ensayo
 * siguen sirviendo y no hay que volver a iniciarlas (5 por minuto por dirección, QA-7). Con --restablecer, los que ya
 * existían quedan con TEINS_CONTRASENA y se cierran sus sesiones (si se perdió la contraseña). Uso:
 *   TEINS_CONTRASENA=... pnpm preparar-ensayo [--tecnicos 20] [--oficina 5] [--restablecer]
 */
const { values } = parseArgs({ options: { tecnicos: { type: "string", default: "20" }, oficina: { type: "string", default: "5" }, restablecer: { type: "boolean", default: false } } });
const contrasena = process.env.TEINS_CONTRASENA;
const cantidades = { tecnico: Number(values.tecnicos), oficina: Number(values.oficina) };
if (!contrasena || Object.values(cantidades).some((n) => !Number.isInteger(n) || n < 1 || n > 99)) {
  console.error("Uso: TEINS_CONTRASENA=... pnpm preparar-ensayo [--tecnicos 1-99] [--oficina 1-99] [--restablecer]");
  process.exit(1);
}

const config = leerConfig();
if (config.NODE_ENV === "production" && !config.ENTORNO_DE_PRUEBAS) {
  console.error("preparar-ensayo no corre en producción (en el entorno de pruebas, ENTORNO_DE_PRUEBAS=true).");
  process.exit(1);
}

const requerir = createRequire(import.meta.url);
const propietario = conectar(urlDelPropietario(config), 2);
const app = conectar(config.DATABASE_URL, 2);
try {
  await propietario.bd.insert(organizaciones).values({ id: ORGANIZACION_DEL_ENSAYO, nombre: "Ensayo de carga" }).onConflictDoNothing();
  // El formato más simple de prueba: sin campos obligatorios, admite todas las fotos que lleve el ensayo.
  const formato = JSON.parse(readFileSync(requerir.resolve("@teins/dominio/formatos-de-prueba/prueba-ups.v1.json"), "utf8"));
  const publicado = await enOrganizacion(app.bd, ORGANIZACION_DEL_ENSAYO, (tx) => crearFormatos().publicar(tx, ORGANIZACION_DEL_ENSAYO, formato));
  console.log(`Formato prueba-ups v1: ${publicado === "publicada" ? "publicado" : "ya existía"}`);

  const identidad = crearIdentidad(app.bd, config);
  const contexto = { autorId: "administrador", correlacion: `preparar-ensayo:${randomUUID()}` };
  const cuenta = { creados: 0, restablecidos: 0, existentes: 0 };
  for (const rol of ["tecnico", "oficina"] as const) {
    for (let numero = 1; numero <= cantidades[rol]; numero++) {
      const usuario = usuarioDelEnsayo(rol, numero);
      const [existe] = await app.bd.select({ organizacionId: usuarios.organizacionId }).from(usuarios).where(eq(usuarios.username, usuario));
      if (!existe) {
        const nombre = `${rol === "tecnico" ? "Técnico" : "Oficina"} del ensayo ${String(numero).padStart(2, "0")}`;
        await identidad.crearUsuario({ organizacionId: ORGANIZACION_DEL_ENSAYO, usuario, nombre, rol, contrasena }, contexto);
        cuenta.creados++;
      } else if (existe.organizacionId !== ORGANIZACION_DEL_ENSAYO) {
        // Nunca toca a alguien de otra organización que use el mismo nombre.
        throw new Error(`${usuario} existe en otra organización: el ensayo no lo usa`);
      } else if (values.restablecer) {
        await identidad.restablecerContrasena(usuario, contrasena, contexto);
        cuenta.restablecidos++;
      } else cuenta.existentes++;
    }
  }
  console.log(`Usuarios del ensayo: ${cuenta.creados} creados, ${cuenta.existentes} ya existían, ${cuenta.restablecidos} con contraseña restablecida`);
  console.log(`Organización del ensayo: ${ORGANIZACION_DEL_ENSAYO}`);
} finally {
  await Promise.all([propietario.cerrar(), app.cerrar()]);
}
