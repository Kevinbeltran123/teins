import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import webpush from "web-push";
import type { Config } from "../../config";
import { enOrganizacion, type BaseDeDatos, type TxOrganizacion } from "../../plataforma/base-de-datos";
import { encolar, type Trabajos } from "../../plataforma/cola";
import { problema } from "../../plataforma/errores";
import { politicas } from "../../plataforma/politicas";
import { registrarOperacion } from "../../plataforma/rutas";
import { suscripciones } from "./esquema";

/** Hechos que merecen un aviso (ADR-0023): cada uno pide una acción de quien lo recibe. */
export type Aviso =
  | { tipo: "visita_asignada" | "visita_cancelada" | "visita_retirada"; organizacionId: string; tecnicos: readonly string[]; visitaId: string; programadaPara: string; horaInicio?: string | null }
  | { tipo: "visita_reprogramada"; organizacionId: string; tecnicos: readonly string[]; visitaId: string; antes: string; despues: string; horaAntes?: string | null; horaDespues?: string | null }
  | { tipo: "comentario" | "levantamiento_revisado"; organizacionId: string; tecnicoId: string; levantamientoId: string; creadoEn: Date }
  | { tipo: "levantamiento_enviado"; organizacionId: string; levantamientoId: string; tecnico: string }
  /** A quien publicó o pidió el envío: una copia del informe no llegó al cliente (ADR-0028). */
  | { tipo: "envio_fallido"; organizacionId: string; usuarioId: string; versionId: string; documento: "informe" | "cotizacion" };

/** Lo que se ve en el aviso. Nunca lleva datos del cliente: se lee con el teléfono bloqueado (R5). */
export interface Contenido {
  titulo: string;
  cuerpo: string;
  /** Agrupa por entidad: un aviso nuevo de la misma visita reemplaza al anterior. */
  etiqueta: string;
}

const ZONA = "America/Bogota";
const formatoDia = new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
/** "sáb, 3 de oct". */
const dia = (aaaaMmDd: string) => formatoDia.format(new Date(`${aaaaMmDd}T00:00:00Z`));
/** "14:00" → "2:00 p. m." (ADR-0037). */
const hora12 = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "p. m." : "a. m."}`;
};
const aLas = (hora: string | null | undefined) => (hora ? `, a las ${hora12(hora)}` : "");
const diaDe = (momento: Date) => dia(momento.toLocaleDateString("en-CA", { timeZone: ZONA }));

export function contenidoDe(aviso: Aviso): Contenido {
  switch (aviso.tipo) {
    case "visita_asignada":
      return { titulo: "Visita nueva", cuerpo: `Para el ${dia(aviso.programadaPara)}${aLas(aviso.horaInicio)}. Ábrela para ver el cliente y el sitio.`, etiqueta: `visita:${aviso.visitaId}` };
    case "visita_reprogramada":
      return aviso.antes !== aviso.despues
        ? { titulo: "Visita reprogramada", cuerpo: `La del ${dia(aviso.antes)} pasó al ${dia(aviso.despues)}${aLas(aviso.horaDespues)}.`, etiqueta: `visita:${aviso.visitaId}` }
        : (aviso.horaAntes ?? null) !== (aviso.horaDespues ?? null)
          ? { titulo: "Visita reprogramada", cuerpo: `La del ${dia(aviso.despues)} ${aviso.horaDespues ? `ahora es a las ${hora12(aviso.horaDespues)}` : "ahora es todo el día"}.`, etiqueta: `visita:${aviso.visitaId}` }
          : { titulo: "Visita cambiada", cuerpo: `Oficina cambió el motivo de la visita del ${dia(aviso.despues)}.`, etiqueta: `visita:${aviso.visitaId}` };
    case "visita_cancelada":
      return { titulo: "Visita cancelada", cuerpo: `Oficina canceló la visita del ${dia(aviso.programadaPara)}.`, etiqueta: `visita:${aviso.visitaId}` };
    case "visita_retirada":
      return { titulo: "Visita asignada a otra persona", cuerpo: `Ya no tienes la visita del ${dia(aviso.programadaPara)}.`, etiqueta: `visita:${aviso.visitaId}` };
    case "comentario":
      return { titulo: "Comentario de oficina", cuerpo: `En tu levantamiento del ${diaDe(aviso.creadoEn)}.`, etiqueta: `levantamiento:${aviso.levantamientoId}` };
    case "levantamiento_revisado":
      return { titulo: "Levantamiento revisado", cuerpo: `Oficina revisó tu levantamiento del ${diaDe(aviso.creadoEn)}.`, etiqueta: `levantamiento:${aviso.levantamientoId}` };
    case "levantamiento_enviado":
      return { titulo: "Levantamiento nuevo", cuerpo: `${aviso.tecnico} envió un levantamiento.`, etiqueta: `levantamiento:${aviso.levantamientoId}` };
    case "envio_fallido":
      return aviso.documento === "cotizacion"
        ? { titulo: "Un envío de la cotización no llegó", cuerpo: "Abra Cotizaciones para ver cuál y volver a enviarla.", etiqueta: `envio:${aviso.versionId}` }
        : { titulo: "Un envío del informe no llegó", cuerpo: "Abra Informes para ver cuál y volver a enviarlo.", etiqueta: `envio:${aviso.versionId}` };
  }
}

function destinatarios(aviso: Aviso) {
  switch (aviso.tipo) {
    case "levantamiento_enviado":
      return eq(suscripciones.superficie, "oficina");
    case "envio_fallido":
      return and(eq(suscripciones.superficie, "oficina"), eq(suscripciones.usuarioId, aviso.usuarioId));
    case "comentario":
    case "levantamiento_revisado":
      return and(eq(suscripciones.superficie, "campo"), eq(suscripciones.usuarioId, aviso.tecnicoId));
    default:
      return aviso.tecnicos.length === 0 ? undefined : and(eq(suscripciones.superficie, "campo"), inArray(suscripciones.usuarioId, [...aviso.tecnicos]));
  }
}

/**
 * Encola un aviso por suscripción, en la transacción del hecho (ADR-0023, parte 2): si el hecho se
 * revierte, no hay aviso; si un navegador falla, su reintento no repite el aviso en los demás.
 */
export async function avisar(tx: TxOrganizacion, aviso: Aviso): Promise<void> {
  const donde = destinatarios(aviso);
  if (!donde) return;
  const filas = await tx.select({ id: suscripciones.id }).from(suscripciones).where(donde);
  if (filas.length === 0) return;
  const contenido = contenidoDe(aviso);
  for (const { id } of filas) {
    await encolar(tx, "avisos.enviar", { organizacionId: aviso.organizacionId, suscripcionId: id, ...contenido }, { intentosMaximos: 5 });
  }
}

/** Desactivar o restablecer a una persona apaga sus avisos en todos sus navegadores (QA-5). */
export async function olvidarSuscripciones(tx: TxOrganizacion, usuarioId: string): Promise<void> {
  await tx.delete(suscripciones).where(eq(suscripciones.usuarioId, usuarioId));
}

/** Formato declarativo (Safari 18.4): se muestra sin código; en los demás navegadores lo lee el service worker. */
export const cargaDeclarativa = (contenido: Contenido, origen: string) =>
  JSON.stringify({
    web_push: 8030,
    notification: { title: contenido.titulo, body: contenido.cuerpo, navigate: new URL("/", origen).href, tag: contenido.etiqueta, lang: "es-CO", dir: "ltr", silent: false },
  });

/** Un aviso que no llega en un día ya no sirve: la bajada trae el estado de todos modos. */
const VIGENCIA_SEGUNDOS = 24 * 60 * 60;

/** Tema (RFC 8030): el servicio de avisos reemplaza uno pendiente del mismo tema. Hasta 32 caracteres base64url. */
const temaDe = (etiqueta: string) => createHash("sha256").update(etiqueta).digest("base64url").slice(0, 32);

/**
 * Servicios de avisos de los navegadores. Solo a ellos se envía: un `endpoint` arbitrario convertiría al
 * worker en un cliente HTTP al servicio de quien lo registre.
 */
const SERVICIOS_DE_AVISOS = [/^fcm\.googleapis\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)notify\.windows\.com$/];

export const esServicioDeAvisos = (endpoint: string) => {
  const url = new URL(endpoint);
  return url.protocol === "https:" && SERVICIOS_DE_AVISOS.some((host) => host.test(url.hostname));
};

export interface Destino {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Entrega un aviso cifrado y devuelve el estado HTTP del servicio de avisos; un error de red se lanza. */
export type EnviadorDeAvisos = (destino: Destino, carga: string, opciones: { vigenciaSegundos: number; tema: string }) => Promise<number>;

export interface ClavesVapid {
  publica: string;
  privada: string;
  contacto: string;
}

/** Opciones de cada envío: cifrado aes128gcm (RFC 8291) y firma VAPID (RFC 8292). */
export const opcionesDeEnvio = (claves: ClavesVapid, { vigenciaSegundos, tema }: { vigenciaSegundos: number; tema: string }): webpush.RequestOptions => ({
  vapidDetails: { subject: claves.contacto, publicKey: claves.publica, privateKey: claves.privada },
  TTL: vigenciaSegundos,
  topic: tema,
  urgency: "normal",
  contentEncoding: "aes128gcm",
  timeout: 15_000,
});

export function enviadorWebPush(claves: ClavesVapid): EnviadorDeAvisos {
  return async (destino, carga, opciones) => {
    try {
      const respuesta = await webpush.sendNotification({ endpoint: destino.endpoint, keys: { p256dh: destino.p256dh, auth: destino.auth } }, carga, opcionesDeEnvio(claves, opciones));
      return respuesta.statusCode;
    } catch (error) {
      if (error instanceof webpush.WebPushError) return error.statusCode;
      throw error;
    }
  };
}

/** Enviador según la configuración; sin claves, los avisos están apagados en este entorno. */
export function enviadorSegunConfig(config: Config): EnviadorDeAvisos | undefined {
  const { AVISOS_VAPID_PUBLICA: publica, AVISOS_VAPID_PRIVADA: privada, AVISOS_CONTACTO: contacto } = config;
  return publica && privada && contacto ? enviadorWebPush({ publica, privada, contacto }) : undefined;
}

export interface Avisos {
  registrarRutas(app: FastifyInstance): void;
  /** Manejador del trabajo `avisos.enviar`. */
  enviar(datos: Trabajos["avisos.enviar"]): Promise<void>;
}

/** Interfaz pública del módulo de avisos (ADR-0023). */
export function crearAvisos({ bd, config, enviador }: { bd: BaseDeDatos; config: Config; enviador?: EnviadorDeAvisos | undefined }): Avisos {
  return {
    async enviar({ organizacionId, suscripcionId, ...contenido }) {
      if (!enviador) return;
      const fila = await enOrganizacion(bd, organizacionId, async (tx) => (await tx.select().from(suscripciones).where(eq(suscripciones.id, suscripcionId)))[0]);
      // Ya no existe: la persona cerró sesión o se desactivó después de encolar.
      if (!fila) return;
      const estado = await enviador(fila, cargaDeclarativa(contenido, fila.origen), { vigenciaSegundos: VIGENCIA_SEGUNDOS, tema: temaDe(contenido.etiqueta) });
      if (estado === 429 || estado >= 500) throw new Error(`El servicio de avisos respondió ${estado}`);
      await enOrganizacion(bd, organizacionId, async (tx) => {
        if (estado >= 200 && estado < 300) {
          await tx.update(suscripciones).set({ ultimoEnvioEn: new Date(), ultimoError: null }).where(eq(suscripciones.id, suscripcionId));
        } else if (estado === 404 || estado === 410) {
          // El navegador ya no existe o quitó el permiso.
          await tx.delete(suscripciones).where(eq(suscripciones.id, suscripcionId));
        } else {
          await tx.update(suscripciones).set({ ultimoError: `${estado} el ${new Date().toISOString()}` }).where(eq(suscripciones.id, suscripcionId));
        }
      });
    },

    registrarRutas(app) {
      registrarOperacion(app, "configuracionAvisos", {
        politica: politicas.autenticado,
        manejar: async () => ({ clavePublica: config.AVISOS_VAPID_PUBLICA ?? null }),
      });

      registrarOperacion(app, "suscribirAvisos", {
        politica: politicas.autenticado,
        manejar: async ({ cuerpo, actor, origen }) => {
          if (!config.AVISOS_VAPID_PUBLICA) throw problema("no_encontrado", "Los avisos están apagados en este entorno");
          if (!origen) throw problema("entrada_invalida", "Falta el origen de la superficie");
          if (!esServicioDeAvisos(cuerpo.endpoint)) throw problema("entrada_invalida", "El endpoint no es de un servicio de avisos conocido");
          const datos = {
            usuarioId: actor.usuarioId,
            superficie: actor.rol === "tecnico" ? ("campo" as const) : ("oficina" as const),
            origen: new URL(origen).origin,
            p256dh: cuerpo.claves.p256dh,
            auth: cuerpo.claves.auth,
            ultimoError: null,
          };
          await enOrganizacion(bd, actor.organizacionId, (tx) =>
            tx
              .insert(suscripciones)
              .values({ id: randomUUID(), organizacionId: actor.organizacionId, endpoint: cuerpo.endpoint, ...datos })
              // Teléfono compartido: el navegador pasa a quien inició sesión.
              .onConflictDoUpdate({ target: [suscripciones.organizacionId, suscripciones.endpoint], set: { ...datos, creadaEn: new Date() } }),
          );
          return {};
        },
      });

      registrarOperacion(app, "quitarSuscripcionAvisos", {
        politica: politicas.autenticado,
        manejar: async ({ cuerpo, actor }) => {
          await enOrganizacion(bd, actor.organizacionId, (tx) =>
            tx.delete(suscripciones).where(and(eq(suscripciones.endpoint, cuerpo.endpoint), eq(suscripciones.usuarioId, actor.usuarioId))),
          );
          return {};
        },
      });
    },
  };
}
