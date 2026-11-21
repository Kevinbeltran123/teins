import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { eq } from "drizzle-orm";
import { leerConfig, urlDelPropietario } from "../config";
import { almacenamientoS3 } from "../plataforma/almacenamiento";
import { conectar, enOrganizacion } from "../plataforma/base-de-datos";
import { clientesYSitios } from "../modulos/clientes";
import { crearFormatos } from "../modulos/formatos";
import { crearIdentidad } from "../modulos/identidad";
import { crearSimbolos } from "../modulos/simbolos";
import { crearVisitas } from "../modulos/visitas";
import { organizaciones, usuarios } from "../modulos/identidad/esquema";
import { fechaEnColombia } from "@teins/dominio";

/**
 * Prepara un entorno de desarrollo o de pruebas con datos ficticios (R5). Es idempotente:
 * lo que ya existe no se toca. Las contraseñas se generan y se muestran una sola vez.
 */
const ORGANIZACION_DE_DESARROLLO = "00000000-0000-4000-8000-000000000001";
const config = leerConfig();
if (config.NODE_ENV === "production" && !config.ENTORNO_DE_PRUEBAS) {
  console.error("sembrar no corre en producción (en el entorno de pruebas, ENTORNO_DE_PRUEBAS=true).");
  process.exit(1);
}

const requerir = createRequire(import.meta.url);
const leerFormato = (archivo: string) => JSON.parse(readFileSync(requerir.resolve(`@teins/dominio/formatos-de-prueba/${archivo}`), "utf8"));

const propietario = conectar(urlDelPropietario(config), 2);
const app = conectar(config.DATABASE_URL, 2);
try {
  await propietario.bd.insert(organizaciones).values({ id: ORGANIZACION_DE_DESARROLLO, nombre: "Organización de desarrollo" }).onConflictDoNothing();

  const formatos = crearFormatos();
  for (const archivo of ["prueba-ups.v1.json", "prueba-ups.v2.json", "prueba-ups.v3.json", "prueba-ups.v4.json", "prueba-ups.v5.json", "prueba-ups.v6.json", "prueba-ups.v7.json", "prueba-ups.v8.json", "prueba-ups.v9.json", "prueba-ups.v10.json"]) {
    const r = await enOrganizacion(app.bd, ORGANIZACION_DE_DESARROLLO, (tx) => formatos.publicar(tx, ORGANIZACION_DE_DESARROLLO, leerFormato(archivo)));
    console.log(`Formato ${archivo}: ${r === "publicada" ? "publicado" : "ya existía"}`);
  }

  // Biblioteca de símbolos de prueba (ADR-0027), hasta tener la de TEINS.
  const simbolos = await enOrganizacion(app.bd, ORGANIZACION_DE_DESARROLLO, (tx) => crearSimbolos().publicar(tx, ORGANIZACION_DE_DESARROLLO, leerFormato("simbolos-prueba.json")));
  console.log(`Símbolos de prueba: ${simbolos.nuevos} nuevos, ${simbolos.cambiados} cambiados`);

  const identidad = crearIdentidad(app.bd, config);
  for (const [usuario, nombre, rol] of [
    ["tecnico.prueba", "Técnico de prueba", "tecnico"],
    ["oficina.prueba", "Oficina de prueba", "oficina"],
  ] as const) {
    const [existe] = await app.bd.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.username, usuario));
    if (existe) {
      console.log(`Usuario ${usuario}: ya existía (para una contraseña nueva: pnpm restablecer-contrasena --usuario ${usuario})`);
      continue;
    }
    const contrasena = randomBytes(12).toString("base64url");
    await identidad.crearUsuario({ organizacionId: ORGANIZACION_DE_DESARROLLO, usuario, nombre, rol, contrasena });
    console.log(`Usuario ${usuario} (${rol}): contraseña ${contrasena}`);
  }

  // Un cliente ficticio con una visita para el técnico de prueba, solo si la organización no tiene clientes.
  const { rows } = await propietario.pool.query("select 1 from clientes.clientes where organizacion_id = $1 limit 1", [ORGANIZACION_DE_DESARROLLO]);
  if (rows.length === 0) {
    const [tecnico] = await identidad.tecnicos(ORGANIZACION_DE_DESARROLLO, ["tecnico.prueba"]);
    const hoy = fechaEnColombia();
    await enOrganizacion(app.bd, ORGANIZACION_DE_DESARROLLO, async (tx) => {
      const { clienteId, sitioId } = await clientesYSitios.crear(tx, {
        organizacionId: ORGANIZACION_DE_DESARROLLO,
        nombre: "Cliente de prueba",
        sitio: { nombre: "Sede de prueba", direccion: "Calle [N] # [N]-[N]" },
      });
      await crearVisitas(clientesYSitios).crear(tx, {
        organizacionId: ORGANIZACION_DE_DESARROLLO,
        autorId: "administrador",
        correlacion: `sembrar:${randomUUID()}`,
        clienteId,
        sitioId,
        motivo: "Mantenimiento",
        programadaPara: hoy,
        tecnicos: [tecnico!],
      });
    });
    console.log(`Cliente de prueba con una visita para tecnico.prueba el ${hoy}`);
  }

  if (config.S3_CONFIGURAR_CORS) {
    await almacenamientoS3(config).permitirOrigenes(config.ORIGENES_CONFIABLES);
    console.log(`Almacenamiento: subida directa permitida desde ${config.ORIGENES_CONFIABLES.join(", ")}`);
  }
} finally {
  await Promise.all([propietario.cerrar(), app.cerrar()]);
}
