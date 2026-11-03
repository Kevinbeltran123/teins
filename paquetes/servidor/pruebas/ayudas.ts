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
    DATABASE_URL_PORTAL: inject("urlPortal"),
    S3_ENDPOINT: inject("s3Endpoint"),
    S3_REGION: "us-east-1",
    S3_BUCKET: BUCKET_DE_PRUEBA,
    S3_ACCESS_KEY_ID: "prueba",
    S3_SECRET_ACCESS_KEY: "prueba",
    S3_FORZAR_RUTA: "true",
    AUTH_SECRETO: "secreto-de-prueba-que-no-es-real-0123456789",
    ORIGENES_CONFIABLES: "http://localhost:5173,http://localhost:5174,http://localhost:5175",
    PORTAL_URL: "http://localhost:5175",
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
import { cerrarNavegador } from "../src/plataforma/pdf";
import { crearArchivos } from "../src/modulos/archivos";
import { crearAvisos, type EnviadorDeAvisos } from "../src/modulos/avisos";
import { crearEnvios, type ProveedorDeCorreo, type Proveedores } from "../src/modulos/envios";
import { crearFormatos } from "../src/modulos/formatos";
import { crearIdentidad } from "../src/modulos/identidad";
import { soltarRevisionesDe } from "../src/modulos/levantamientos";
import { crearGeneradorPdf } from "../src/modulos/informes";
import { crearGeneradorPdfDeCotizaciones } from "../src/modulos/cotizaciones";
import { recuperarTrabajosAMedias } from "../src/modulos/mantenimiento";
import { accesosDelPortal, crearCorreosDelPortal } from "../src/modulos/portal";
import { definirTareas } from "../src/tareas";
import { codigoTotp } from "./totp";

const requerir = createRequire(import.meta.url);
export const formatoDePrueba = (version: 1 | 2) =>
  JSON.parse(readFileSync(requerir.resolve(`@teins/dominio/formatos-de-prueba/prueba-ups.v${version}.json`), "utf8"));

export const ORIGEN = "http://localhost:5173";
export const cabecerasSync = { [CABECERA_VERSION]: String(VERSION_PROTOCOLO) };

/**
 * Servidor completo sobre la base y el almacenamiento reales de la prueba. Con `enviadorDeAvisos`, este
 * archivo también procesa los avisos push; sin él, no los toma de la cola compartida (son de otro archivo). Lo mismo
 * con `correosDelPortal` (ADR-0053): solo el archivo que lo trae envía los correos del portal.
 */
export async function servidorDePrueba(
  opciones: { config?: Partial<Record<string, string>>; enviadorDeAvisos?: EnviadorDeAvisos; proveedoresDeEnvio?: Proveedores; correosDelPortal?: ProveedorDeCorreo } = {},
) {
  const config = configDePrueba({ INICIOS_DE_SESION_POR_MINUTO: "1000", ...opciones.config });
  const { app: conexionApp, propietario } = conexionesDePrueba();
  const almacenamiento = almacenamientoS3(config);
  const conexionPortal = conectar(inject("urlPortal"), 4);
  afterAll(() => conexionPortal.cerrar());
  const { app, rutas } = await construirApp({ config, bd: conexionApp.bd, bdPortal: conexionPortal.bd, almacenamiento });
  afterAll(() => app.close());
  const identidad = crearIdentidad(conexionApp.bd, config, { alDesactivar: soltarRevisionesDe });
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

  const informes = crearGeneradorPdf({ bd: conexionApp.bd, almacenamiento, config });
  // Los PDF comparten un Chromium por proceso: se cierra al terminar el archivo de pruebas.
  afterAll(() => cerrarNavegador());
  const avisos = crearAvisos({ bd: conexionApp.bd, config, enviador: opciones.enviadorDeAvisos });
  // Envíos al cliente (ADR-0028): con los proveedores que traiga la prueba.
  const envios = crearEnvios({ bd: conexionApp.bd, almacenamiento, config, proveedores: opciones.proveedoresDeEnvio ?? {}, accesoAlPortal: accesosDelPortal.tieneAcceso });
  const tareas = definirTareas({
    archivos,
    informes,
    avisos,
    envios,
    cotizaciones: crearGeneradorPdfDeCotizaciones({ bd: conexionApp.bd, almacenamiento, config }),
    portal: crearCorreosDelPortal({ bd: conexionApp.bd, config, proveedores: { correo: opciones.correosDelPortal } }),
    mantenimiento: { recuperar: () => recuperarTrabajosAMedias(conexionApp.bd) },
  });
  // La cola es compartida entre archivos: solo el que trae sus proveedores procesa los envíos, con los suyos.
  if (!opciones.proveedoresDeEnvio) delete tareas["envios.enviar"];
  if (!opciones.enviadorDeAvisos) delete tareas["avisos.enviar"];
  if (!opciones.correosDelPortal) delete tareas["portal.correo"];
  /**
   * Ejecuta los trabajos pendientes, como lo haría el worker. Los archivos de pruebas corren en paralelo
   * y comparten la cola: una pasada puede terminar mientras otro archivo aún procesa un trabajo, así que
   * se repite hasta que no quede ninguno listo ni en curso. Uno que nunca se intentó cuenta aunque su hora sea futura:
   * bajo carga el reloj de la base puede retroceder unas décimas y dejar lo recién encolado "para después".
   */
  async function procesarCola() {
    for (let i = 0; i < 200; i++) {
      await runOnce({ pgPool: propietario.pool, taskList: tareas });
      const { rows } = await propietario.pool.query(
        "select count(*)::int as n from graphile_worker.jobs where task_identifier = any($1) and (locked_at is not null or attempts = 0 or (run_at <= now() and attempts < max_attempts))",
        [Object.keys(tareas)],
      );
      if (rows[0].n === 0) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error("La cola no se vació");
  }

  /** Persona de oficina con la marca de administrador y el segundo factor activo (iteración 6). */
  async function nuevoAdministrador(organizacionId: string) {
    const usuario = `admin.${randomBytes(4).toString("hex")}`;
    const contrasena = "contrasena-de-prueba";
    const { id } = await identidad.crearUsuario({ organizacionId, usuario, nombre: "Administradora de prueba", rol: "oficina", contrasena });
    await identidad.marcarAdministrador(usuario, true, { autorId: "administrador", correlacion: "prueba" });
    const sinFactor = await iniciarSesion(app, usuario, contrasena);
    const { totpURI } = (await autenticacion(app, "/two-factor/enable", { password: contrasena }, sinFactor)).json() as { totpURI: string };
    const verificado = await autenticacion(app, "/two-factor/verify-totp", { code: codigoTotp(totpURI) }, sinFactor);
    if (verificado.statusCode !== 200) throw new Error(`No se pudo activar el segundo factor: ${verificado.body}`);
    return { id, usuario, contrasena, totpURI, cookie: cookiesDe(verificado) };
  }

  /**
   * Espera a que no quede ningún PDF generándose (de la organización o del informe dado). Un PDF que falla
   * una vez bajo carga (Chromium tarda en arrancar) vuelve a la cola unos segundos después: se espera por
   * tiempo, procesando la cola en cada vuelta, y no por un número fijo de vueltas.
   */
  async function esperarPdf(filtro: { organizacionId: string } | { informeId: string }, limiteMs = 90_000) {
    const [columna, valor] = "organizacionId" in filtro ? ["organizacion_id", filtro.organizacionId] : ["informe_id", filtro.informeId];
    const hasta = Date.now() + limiteMs;
    while (Date.now() < hasta) {
      await procesarCola();
      const { rows } = await propietario.pool.query(`select count(*)::int as n from informes.versiones where pdf_estado = 'generando' and ${columna} = $1`, [valor]);
      if (rows[0].n === 0) return;
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error("Hay PDF sin generar");
  }

  return { app, rutas, config, propietario, conexionApp, conexionPortal, identidad, nuevaOrganizacionConUsuarios, nuevoAdministrador, procesarCola, esperarPdf };
}

/** Llamada a una ruta de Better Auth desde oficina. */
export const autenticacion = (app: FastifyInstance, ruta: string, cuerpo: object, cookie?: string) =>
  app.inject({ method: "POST", url: `/api/auth${ruta}`, headers: { origin: ORIGEN, "content-type": "application/json", ...(cookie ? { cookie } : {}) }, payload: cuerpo });

/** Las cookies vigentes que deja una respuesta (las que expira se descartan). */
export function cookiesDe(r: { headers: Record<string, unknown> }): string {
  const cookies = [r.headers["set-cookie"]].flat().filter((c): c is string => typeof c === "string" && !/Max-Age=0/i.test(c));
  return cookies.map((c) => c.split(";")[0]).join("; ");
}

/** Inicia sesión. Con el segundo factor activo, la cookie es la del desafío, no la de sesión. */
export async function iniciarSesion(app: FastifyInstance, usuario: string, contrasena: string): Promise<string> {
  const r = await autenticacion(app, "/sign-in/username", { username: usuario, password: contrasena });
  if (r.statusCode !== 200) throw new Error(`No se pudo iniciar sesión (${r.statusCode}): ${r.body}`);
  return cookiesDe(r);
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
