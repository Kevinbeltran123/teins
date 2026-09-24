import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { documentoOpenApi, TIPO_PROBLEMA } from "@teins/protocolo";
import type { Config } from "./config";
import type { Almacenamiento } from "./plataforma/almacenamiento";
import type { BaseDeDatos } from "./plataforma/base-de-datos";
import { ErrorProblema, problema } from "./plataforma/errores";
import { exigirPoliticas, registrarRutaPublica } from "./plataforma/rutas";
import { crearIdentidad } from "./modulos/identidad";
import { crearArchivos } from "./modulos/archivos";
import { crearFormatos } from "./modulos/formatos";
import { crearLevantamientos } from "./modulos/levantamientos";

export interface Dependencias {
  config: Config;
  bd: BaseDeDatos;
  almacenamiento: Almacenamiento;
}

const CABECERA_CORRELACION = "x-correlacion";
const CORRELACION_VALIDA = /^[A-Za-z0-9._-]{8,64}$/;

/**
 * Construye el rol web (ADR-0001). Los módulos se componen aquí y solo se ven entre sí
 * por su interfaz pública.
 */
export async function construirApp({ config, bd, almacenamiento }: Dependencias): Promise<{ app: FastifyInstance; rutas: Set<string> }> {
  const app = Fastify({
    logger: {
      level: config.NIVEL_REGISTRO,
      // Nunca se registran credenciales ni contenido (ADR-0017).
      redact: ["req.headers.cookie", "req.headers.authorization", 'res.headers["set-cookie"]'],
    },
    genReqId: (solicitud) => {
      const recibida = solicitud.headers[CABECERA_CORRELACION];
      return typeof recibida === "string" && CORRELACION_VALIDA.test(recibida) ? recibida : randomUUID();
    },
    requestIdLogLabel: "correlacion",
    bodyLimit: 2 * 1024 * 1024,
    trustProxy: config.NODE_ENV === "production",
  });

  // Un cliente real puede enviar content-type JSON sin cuerpo (por ejemplo, al confirmar una subida).
  // Se acepta como "sin cuerpo" y se conserva el analizador de Fastify, que bloquea __proto__ y constructor.
  const analizarJson = app.getDefaultJsonParser("error", "error");
  app.addContentTypeParser("application/json", { parseAs: "string" }, (solicitud, cuerpo, listo) => {
    const texto = cuerpo.toString();
    if (texto === "") return listo(null, undefined);
    analizarJson(solicitud, texto, listo);
  });

  const rutas = new Set<string>();
  exigirPoliticas(app, rutas);

  // Defensa contra falsificación de solicitudes entre sitios, además de la cookie SameSite:
  // un navegador siempre envía Origin en solicitudes que modifican; si no es una superficie propia, se rechaza.
  const origenes = new Set(config.ORIGENES_CONFIABLES.map((o) => new URL(o).origin));
  app.addHook("onRequest", async (solicitud) => {
    if (solicitud.method === "GET" || solicitud.method === "HEAD") return;
    const origen = solicitud.headers.origin;
    if (origen !== undefined && !origenes.has(origen)) throw problema("sin_permiso", "Origen no permitido");
  });

  app.addHook("onSend", async (solicitud, respuesta) => {
    respuesta.header(CABECERA_CORRELACION, solicitud.id);
  });

  app.setErrorHandler((error, solicitud, respuesta) => {
    let causa: ErrorProblema;
    if (error instanceof ErrorProblema) causa = error;
    else if ((error as { validation?: unknown }).validation || (error as { statusCode?: number }).statusCode === 400) {
      causa = problema("entrada_invalida", "El cuerpo de la solicitud no es JSON válido");
    } else if ((error as { statusCode?: number }).statusCode === 413) causa = problema("entrada_invalida", "La solicitud es demasiado grande");
    else {
      solicitud.log.error({ err: error }, "Error no controlado");
      causa = problema("error_interno");
    }
    if (causa.estado >= 500) solicitud.log.error({ codigo: causa.codigo }, causa.message);
    return respuesta.status(causa.estado).type(TIPO_PROBLEMA).send(causa.aProblema(solicitud.id));
  });

  app.setNotFoundHandler((solicitud, respuesta) =>
    respuesta.status(404).type(TIPO_PROBLEMA).send(problema("no_encontrado", "La ruta no existe").aProblema(solicitud.id)),
  );

  const identidad = crearIdentidad(bd, config);
  app.decorate("resolverActor", identidad.resolverActor);

  const formatos = crearFormatos();
  const archivos = crearArchivos({ bd, almacenamiento, config });
  const levantamientos = crearLevantamientos({ bd, formatos, archivos, identidad });

  registrarRutaPublica(app, {
    method: "GET",
    url: "/salud",
    motivo: "Verificación de disponibilidad de la plataforma",
    handler: async (_solicitud, respuesta) => {
      await bd.execute(sql`select 1`);
      return respuesta.send({ estado: "ok" });
    },
  });

  const openapi = documentoOpenApi();
  registrarRutaPublica(app, {
    method: "GET",
    url: "/api/openapi.json",
    motivo: "Contrato público de la API (ADR-0014)",
    handler: async () => openapi,
  });

  identidad.registrarRutas(app);
  archivos.registrarRutas(app);
  levantamientos.registrarRutas(app);

  await app.ready();
  return { app, rutas };
}
