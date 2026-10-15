import { randomUUID } from "node:crypto";
import Fastify, { LogController, type FastifyInstance } from "fastify";
import helmet from "@fastify/helmet";
import { sql } from "drizzle-orm";
import { TIPO_PROBLEMA } from "@teins/protocolo";
import { documentoOpenApi } from "@teins/protocolo/openapi";
import type { Config } from "./config";
import type { Almacenamiento } from "./plataforma/almacenamiento";
import type { BaseDeDatos } from "./plataforma/base-de-datos";
import { ErrorProblema, problema } from "./plataforma/errores";
import { exigirPoliticas, registrarRutaPublica } from "./plataforma/rutas";
import { servirSuperficies, type Superficie } from "./plataforma/superficies";
import { crearIdentidad } from "./modulos/identidad";
import { crearArchivos } from "./modulos/archivos";
import { crearFormatos } from "./modulos/formatos";
import { crearLevantamientos, soltarRevisionesDe } from "./modulos/levantamientos";
import { clientesYSitios, registrarRutasDeClientes } from "./modulos/clientes";
import { crearSincronizacion } from "./modulos/sincronizacion";
import { crearVisitas } from "./modulos/visitas";
import { crearInformes } from "./modulos/informes";
import { crearAccesosDeClientes, crearPortal, renombrarClienteDelPortal } from "./modulos/portal";
import { crearCatalogo } from "./modulos/catalogo";
import { crearSimbolos } from "./modulos/simbolos";
import { crearAvisos } from "./modulos/avisos";
import { crearEnvios } from "./modulos/envios";
import { crearCotizaciones } from "./modulos/cotizaciones";

export interface Dependencias {
  config: Config;
  bd: BaseDeDatos;
  /** Conexión con el rol `teins_portal` (ADR-0009, parte 3). Sin ella, el rol web no atiende el portal. */
  bdPortal?: BaseDeDatos;
  almacenamiento: Almacenamiento;
}

const CABECERA_CORRELACION = "x-correlacion";

/**
 * Construye el rol web (ADR-0001). Los módulos se componen aquí y solo se ven entre sí
 * por su interfaz pública.
 */
export async function construirApp({ config, bd, bdPortal, almacenamiento }: Dependencias): Promise<{ app: FastifyInstance; rutas: Set<string> }> {
  const proxies = config.PROXIES_DE_CONFIANZA ?? 0;
  const app = Fastify({
    logger: {
      level: config.NIVEL_REGISTRO,
      // Nunca se registran credenciales ni contenido (ADR-0017).
      redact: ["req.headers.cookie", "req.headers.authorization", 'res.headers["set-cookie"]'],
    },
    // La correlación va a la auditoría encadenada (ADR-0008): la genera el servidor, nunca quien pide.
    genReqId: () => randomUUID(),
    logController: new LogController({
      requestIdLogLabel: "correlacion",
      // Las verificaciones de disponibilidad llegan cada pocos segundos: no llenan los registros.
      disableRequestLogging: (solicitud) => solicitud.url === "/salud",
    }),
    bodyLimit: 2 * 1024 * 1024,
    // Se confía en un número fijo de proxies, contados desde el servidor: la IP del cliente es la que está justo
    // antes de ellos en X-Forwarded-For. En Railway la conexión llega de un proxy interno y la cabecera trae el
    // cliente y un salto interno (visto el 2026-09-29). Lo que el cliente escriba en la cabecera queda antes y se
    // ignora, aunque el borde dejara de descartarlo: los límites por origen (portal y Better Auth) no se burlan.
    // Va como función: Fastify no acepta un número porque no puede validar quién conecta; en Railway solo se
    // llega al servicio por su borde o por la red privada del proyecto.
    trustProxy: proxies > 0 ? (_direccion: string, salto: number) => salto < proxies : false,
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

  // Encabezados de seguridad. La CSP solo abre el almacenamiento de archivos, donde campo sube
  // y oficina lee fotos con URL firmada (ADR-0007); su origen sale del proveedor configurado.
  const almacen = new URL((await almacenamiento.firmarDescarga("origen")).url).origin;
  await app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", "blob:", "data:", almacen],
        connectSrc: ["'self'", almacen],
        fontSrc: ["'self'"],
        manifestSrc: ["'self'"],
        workerSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    // Las fotos llegan de otro origen (almacenamiento): no se exige CORP a los recursos incrustados.
    crossOriginEmbedderPolicy: false,
    strictTransportSecurity: config.NODE_ENV === "production" ? { maxAge: 31_536_000, includeSubDomains: true } : false,
  });

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
    else if ((error as { statusCode?: number }).statusCode === 415) causa = problema("entrada_invalida", "El cuerpo de la solicitud debe ser JSON");
    // PostgreSQL no guarda U+0000 en text ni en jsonb (22021, 22P05): es un dato de quien pide, y reintentar no lo arregla.
    else if (["22021", "22P05"].includes((error as { code?: string; cause?: { code?: string } }).code ?? (error as { cause?: { code?: string } }).cause?.code ?? "")) {
      causa = problema("entrada_invalida", "El texto tiene un carácter que no se puede guardar");
    }
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

  const identidad = crearIdentidad(bd, config, { alDesactivar: soltarRevisionesDe });
  app.decorate("resolverActor", identidad.resolverActor);

  const formatos = crearFormatos();
  const archivos = crearArchivos({ bd, almacenamiento, config });
  const visitas = crearVisitas(clientesYSitios);
  const catalogo = crearCatalogo(bd, identidad);
  const levantamientos = crearLevantamientos({ bd, formatos, archivos, visitas, identidad, catalogo });
  const sincronizacion = crearSincronizacion({ bd, formatos, visitas, levantamientos, identidad, catalogo, simbolos: crearSimbolos() });
  const informes = crearInformes({ bd, almacenamiento, config, archivos, levantamientos, visitas, identidad, formatos });

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
  sincronizacion.registrarRutas(app);
  informes.registrarRutas(app);
  // Por hacer: sin cancelar, terminar ni cerrar, y sin ningún levantamiento recibido (lo atendido ya se hizo).
  registrarRutasDeClientes(
    app,
    bd,
    identidad,
    async (tx, clienteId) => {
      const porHacer = await visitas.porHacer(tx, clienteId, new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" }));
      const atendidas = await levantamientos.conteosPorVisita(tx, porHacer.map((v) => v.id));
      return porHacer.filter((v) => !atendidas.has(v.id));
    },
    // Una corrección llega a los teléfonos que tienen sus visitas, y el nombre del cliente, también al portal.
    {
      cliente: async (tx, correccion) => {
        await renombrarClienteDelPortal(tx, correccion.clienteId, correccion.nombre);
        await visitas.avisarCorreccion(tx, correccion);
      },
      sitio: (tx, correccion) => visitas.avisarCorreccion(tx, correccion),
    },
  );
  // El rol web no envía (lo hace el worker): solo recibe los eventos firmados de los proveedores.
  crearEnvios({ bd, almacenamiento, config }).registrarRutas(app);
  crearCotizaciones({ bd, almacenamiento, config, levantamientos, visitas, catalogo, identidad }).registrarRutas(app);
  catalogo.registrarRutas(app);
  // El rol web no envía avisos (lo hace el worker): solo guarda suscripciones y entrega la clave pública.
  crearAvisos({ bd, config }).registrarRutas(app);
  visitas.registrarRutas(app, { bd, identidad, conteos: levantamientos.conteosPorVisita });
  crearAccesosDeClientes(bd).registrarRutas(app, config);
  if (bdPortal) crearPortal({ bdPortal, almacenamiento, config }).registrarRutas(app);

  const superficies: Superficie[] = [
    ...(config.SUPERFICIE_CAMPO_HOST ? [{ host: config.SUPERFICIE_CAMPO_HOST, carpeta: `${config.SUPERFICIES_DIR}/campo` }] : []),
    ...(config.SUPERFICIE_OFICINA_HOST ? [{ host: config.SUPERFICIE_OFICINA_HOST, carpeta: `${config.SUPERFICIES_DIR}/oficina` }] : []),
    ...(config.SUPERFICIE_PORTAL_HOST ? [{ host: config.SUPERFICIE_PORTAL_HOST, carpeta: `${config.SUPERFICIES_DIR}/portal` }] : []),
  ];
  if (superficies.length > 0) await servirSuperficies(app, superficies);

  await app.ready();
  return { app, rutas };
}
