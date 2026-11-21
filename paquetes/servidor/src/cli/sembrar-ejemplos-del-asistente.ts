import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { parseArgs } from "node:util";
import { and, eq } from "drizzle-orm";
import { leerConfig } from "../config";
import { conectar, enOrganizacion } from "../plataforma/base-de-datos";
import { crearFormatos } from "../modulos/formatos";
import { usuarios } from "../modulos/identidad/esquema";
import { sembrarDatosDelAsistente } from "./sembrar-asistente";

/**
 * Siembra los datos de ejemplo del asistente (iteración 53) en una organización dada, con datos ficticios (R5): así una
 * prueba de extremo a extremo tiene cifras exactas sin depender de lo que otras crean en la organización de desarrollo.
 * Publica antes el formato de prueba que usan sus levantamientos. Idempotente.
 *   pnpm sembrar-asistente --organizacion <uuid> --tecnico <usuario> --revisor <usuario>
 */
const { values } = parseArgs({ options: { organizacion: { type: "string" }, tecnico: { type: "string" }, revisor: { type: "string" } } });
const { organizacion, tecnico, revisor } = values;
if (!organizacion || !tecnico || !revisor) {
  console.error("Uso: pnpm sembrar-asistente --organizacion <uuid> --tecnico <usuario> --revisor <usuario>");
  process.exit(1);
}

const config = leerConfig();
if (config.NODE_ENV === "production" && !config.ENTORNO_DE_PRUEBAS) {
  console.error("sembrar-asistente no corre en producción (en el entorno de pruebas, ENTORNO_DE_PRUEBAS=true).");
  process.exit(1);
}

const requerir = createRequire(import.meta.url);
const ARCHIVO_DEL_FORMATO = "@teins/dominio/formatos-de-prueba/prueba-ups.v10.json";

const conexion = conectar(config.DATABASE_URL, 2);
try {
  const idDe = async (usuario: string) => {
    const [fila] = await conexion.bd
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(and(eq(usuarios.username, usuario.trim().toLowerCase()), eq(usuarios.organizacionId, organizacion)));
    if (!fila) throw new Error(`El usuario ${usuario} no existe en la organización ${organizacion}`);
    return fila.id;
  };
  const personas = { tecnicoId: await idDe(tecnico), revisorId: await idDe(revisor) };
  const formato = JSON.parse(readFileSync(requerir.resolve(ARCHIVO_DEL_FORMATO), "utf8"));
  const publicado = await enOrganizacion(conexion.bd, organizacion, (tx) => crearFormatos().publicar(tx, organizacion, formato));
  console.log(`Formato prueba-ups v10: ${publicado === "publicada" ? "publicado" : "ya existía"}`);
  const sembrados = await sembrarDatosDelAsistente(conexion.bd, organizacion, personas);
  console.log(`Datos del asistente: ${sembrados ? "sembrados" : "ya existían"}`);
} finally {
  await conexion.cerrar();
}
