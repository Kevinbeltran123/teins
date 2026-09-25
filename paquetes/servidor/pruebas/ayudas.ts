import { randomUUID } from "node:crypto";
import { afterAll, inject } from "vitest";
import { leerConfig, type Config } from "../src/config";
import { conectar, type Conexion } from "../src/plataforma/base-de-datos";
import { BUCKET_DE_PRUEBA } from "./preparar";

/** Conexiones con el rol de la aplicación y con el dueño; se cierran al terminar el archivo. */
export function conexionesDePrueba(): { app: Conexion; propietario: Conexion } {
  const app = conectar(inject("urlApp"), 5);
  const propietario = conectar(inject("urlPropietario"), 2);
  afterAll(async () => {
    await Promise.all([app.cerrar(), propietario.cerrar()]);
  });
  return { app, propietario };
}

export function configDePrueba(extra: Partial<Record<string, string>> = {}): Config {
  return leerConfig({
    NODE_ENV: "test",
    NIVEL_REGISTRO: "silent",
    DATABASE_URL: inject("urlApp"),
    DATABASE_URL_PROPIETARIO: inject("urlPropietario"),
    S3_ENDPOINT: inject("s3Endpoint"),
    S3_REGION: "us-east-1",
    S3_BUCKET: BUCKET_DE_PRUEBA,
    S3_ACCESS_KEY_ID: "prueba",
    S3_SECRET_ACCESS_KEY: "prueba",
    S3_FORZAR_RUTA: "true",
    AUTH_SECRETO: "secreto-de-prueba-que-no-es-real-0123456789",
    ORIGENES_CONFIABLES: "http://localhost:5173,http://localhost:5174",
    ...extra,
  });
}

/** Crea una organización nueva: cada prueba trabaja aislada sin limpiar la base. */
export async function nuevaOrganizacion(propietario: Conexion, nombre = "Organización de prueba"): Promise<string> {
  const id = randomUUID();
  await propietario.pool.query("insert into identidad.organizaciones (id, nombre) values ($1, $2)", [id, nombre]);
  return id;
}

import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { FastifyInstance } from "fastify";
import { runOnce } from "graphile-worker";
import { CABECERA_VERSION, VERSION_PROTOCOLO } from "@teins/protocolo";
import { construirApp } from "../src/app";
import { almacenamientoS3 } from "../src/plataforma/almacenamiento";
import { enOrganizacion } from "../src/plataforma/base-de-datos";
import { crearArchivos } from "../src/modulos/archivos";
import { crearFormatos } from "../src/modulos/formatos";
import { crearIdentidad } from "../src/modulos/identidad";
import { definirTareas } from "../src/tareas";

const requerir = createRequire(import.meta.url);
export const formatoDePrueba = (version: 1 | 2) =>
  JSON.parse(readFileSync(requerir.resolve(`@teins/dominio/formatos-de-prueba/prueba-ups.v${version}.json`), "utf8"));

export const ORIGEN = "http://localhost:5173";
export const cabecerasSync = { [CABECERA_VERSION]: String(VERSION_PROTOCOLO) };

/** Servidor completo sobre la base y el almacenamiento reales de la prueba. */
export async function servidorDePrueba() {
  const config = configDePrueba({ INICIOS_DE_SESION_POR_MINUTO: "1000" });
  const { app: conexionApp, propietario } = conexionesDePrueba();
  const almacenamiento = almacenamientoS3(config);
  const { app, rutas } = await construirApp({ config, bd: conexionApp.bd, almacenamiento });
  afterAll(() => app.close());
  const identidad = crearIdentidad(conexionApp.bd, config);
  const archivos = crearArchivos({ bd: conexionApp.bd, almacenamiento, config });

  /** Organización con los formatos de prueba publicados y un técnico y una persona de oficina. */
  async function nuevaOrganizacionConUsuarios() {
    const organizacionId = await nuevaOrganizacion(propietario);
    const formatos = crearFormatos();
    await enOrganizacion(conexionApp.bd, organizacionId, async (tx) => {
      await formatos.publicar(tx, organizacionId, formatoDePrueba(1));
      await formatos.publicar(tx, organizacionId, formatoDePrueba(2));
    });
    const sufijo = randomBytes(4).toString("hex");
    const contrasena = "contrasena-de-prueba";
    const tecnico = `tecnico.${sufijo}`;
    const oficina = `oficina.${sufijo}`;
    const t = await identidad.crearUsuario({ organizacionId, usuario: tecnico, nombre: "Técnico de prueba", rol: "tecnico", contrasena });
    const o = await identidad.crearUsuario({ organizacionId, usuario: oficina, nombre: "Oficina de prueba", rol: "oficina", contrasena });
    return {
      organizacionId,
      tecnico: { id: t.id, cookie: await iniciarSesion(app, tecnico, contrasena) },
      oficina: { id: o.id, cookie: await iniciarSesion(app, oficina, contrasena) },
    };
  }

  /** Ejecuta los trabajos pendientes de la cola, como lo haría el worker. */
  const procesarCola = () => runOnce({ pgPool: propietario.pool, taskList: definirTareas({ archivos }) });

  return { app, rutas, config, propietario, conexionApp, identidad, nuevaOrganizacionConUsuarios, procesarCola };
}

export async function iniciarSesion(app: FastifyInstance, usuario: string, contrasena: string): Promise<string> {
  const r = await app.inject({
    method: "POST",
    url: "/api/auth/sign-in/username",
    headers: { origin: ORIGEN, "content-type": "application/json" },
    payload: { username: usuario, password: contrasena },
  });
  if (r.statusCode !== 200) throw new Error(`No se pudo iniciar sesión (${r.statusCode}): ${r.body}`);
  const cookies = [r.headers["set-cookie"]].flat().filter((c): c is string => typeof c === "string");
  return cookies.map((c) => c.split(";")[0]).join("; ");
}

/** JPEG mínimo de 1×1 (ficticio). Un segmento de comentario con `variante` da otra huella al mismo dibujo. */
export function jpegDePrueba(variante = randomBytes(8).toString("hex")): { datos: Buffer; huella: string } {
  const base = Buffer.from(
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
    "base64",
  );
  const texto = Buffer.from(variante, "utf8");
  const longitud = Buffer.alloc(2);
  longitud.writeUInt16BE(texto.length + 2);
  // SOI (FFD8) + COM (FFFE, longitud, texto) + resto del archivo.
  const datos = Buffer.concat([base.subarray(0, 2), Buffer.from([0xff, 0xfe]), longitud, texto, base.subarray(2)]);
  return { datos, huella: createHash("sha256").update(datos).digest("hex") };
}
