import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNotNull, isNull, lt, notInArray, or } from "drizzle-orm";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { asunto, htmlDeCorreo, textoDeCorreo, variablesDeWhatsapp, type TextoPropio } from "@teins/documentos";
import type { Respuesta } from "@teins/protocolo";
import type { Config } from "../../config";
import { claveDeObjeto, leerTodo, type Almacenamiento } from "../../plataforma/almacenamiento";
import { enOrganizacion, type BaseDeDatos, type TxOrganizacion } from "../../plataforma/base-de-datos";
import { encolar, type Trabajos } from "../../plataforma/cola";
import { problema } from "../../plataforma/errores";
import { registrarRutaPublica } from "../../plataforma/rutas";
import { avisar } from "../avisos";
import { contactosDelCliente } from "../clientes";
import { nombreDe } from "../identidad";
import { envios, type CanalDeEnvio, type FilaEnvio, type MensajeDeEnvio } from "./esquema";
import { eventoDeResend, eventosDeWhatsapp, firmaMetaValida, firmaSvixValida, type EventoDeEnvio } from "./eventos";
import { NoAceptado, RechazoDefinitivo, type Proveedores } from "./proveedores";

export type { MensajeDeCotizacion, MensajeDeEnvio, MensajeDeInforme } from "./esquema";
export { proveedoresSegunConfig, proveedoresSimulados, RechazoDefinitivo, type Proveedores, type ProveedorDeCorreo, type ProveedorDeWhatsapp } from "./proveedores";

type EnvioDeVersion = Respuesta<"obtenerInforme">["versiones"][number]["envios"][number];

/** Resend admite 40 MB después de codificar en base64: por encima de esto el PDF no va adjunto (ADR-0028, parte 3). */
const BYTES_MAXIMOS_ADJUNTO = 30 * 1024 * 1024;

export interface Programacion {
  organizacionId: string;
  versionId: string;
  /** Cliente de la versión; las versiones muy antiguas pueden no tenerlo. */
  clienteId: string | null | undefined;
  mensaje: MensajeDeEnvio;
  destinos: readonly { contactoId: string; canal?: CanalDeEnvio | undefined }[];
  por: string;
  /** Ruta del PDF en el almacenamiento, si ya está listo: los envíos se encolan de una vez. */
  pdfRuta?: string | undefined;
  /** La decisión de enviar (regla 4): si ya se programó con esta llave, no se programa otra vez. */
  llave?: string | undefined;
  /** El asunto y el texto que escribió oficina (ADR-0036): se copian al envío por correo; WhatsApp va con su plantilla. */
  personal?: TextoPropio | undefined;
}

/**
 * Crea un envío "En cola" por destinatario y canal, en la transacción de quien lo pide (publicar o
 * enviar otra vez). Sale cuando el PDF está listo (ADR-0028, parte 3). Devuelve cuántos creó: 0 si la llave
 * ya se usó. Quien llama tiene bloqueada la fila de la versión, así que dos pedidos con la misma llave no se cruzan.
 */
export async function programarEnvios(tx: TxOrganizacion, p: Programacion): Promise<number> {
  if (p.destinos.length === 0) return 0;
  if (!p.clienteId) throw problema("estado_invalido", "La versión no tiene cliente: no hay a quién enviarla");
  if (p.llave) {
    const [repetido] = await tx.select({ id: envios.id }).from(envios).where(and(eq(envios.versionId, p.versionId), eq(envios.llave, p.llave))).limit(1);
    if (repetido) return 0;
  }
  const destinatarios = await contactosDelCliente.paraEnviar(tx, p.clienteId, p.destinos);
  for (const d of destinatarios) {
    const id = randomUUID();
    const mensaje = d.canal === "correo" && p.personal ? { ...p.mensaje, personal: { asunto: p.personal.asunto, texto: p.personal.texto } } : p.mensaje;
    await tx.insert(envios).values({ id, organizacionId: p.organizacionId, versionId: p.versionId, contactoId: d.contactoId, contactoNombre: d.nombre, canal: d.canal, destino: d.destino, mensaje, creadoPor: p.por, llave: p.llave ?? null });
    if (p.pdfRuta) await encolarEnvio(tx, { organizacionId: p.organizacionId, envioId: id, pdfRuta: p.pdfRuta });
  }
  return destinatarios.length;
}

/** Versiones con envíos que llevan más de `antesDe` en cola (ADR-0043): su dueño los vuelve a lanzar si el PDF está listo. */
export async function versionesConEnviosAtascados(tx: TxOrganizacion, antesDe: Date): Promise<string[]> {
  const filas = await tx.selectDistinct({ versionId: envios.versionId }).from(envios).where(and(eq(envios.estado, "en_cola"), lt(envios.actualizadoEn, antesDe)));
  return filas.map((f) => f.versionId);
}

/** El PDF de la versión quedó listo: salen sus envíos en cola, en la misma transacción que lo marca (ADR-0012). */
export async function enviarAlQuedarListo(tx: TxOrganizacion, { organizacionId, versionId, pdfRuta }: { organizacionId: string; versionId: string; pdfRuta: string }): Promise<void> {
  const pendientes = await tx.select({ id: envios.id }).from(envios).where(and(eq(envios.versionId, versionId), eq(envios.estado, "en_cola")));
  for (const { id } of pendientes) await encolarEnvio(tx, { organizacionId, envioId: id, pdfRuta });
}

/** El motivo de un envío que se canceló porque su versión se retiró (ADR-0047). */
const VERSION_RETIRADA = "Versión retirada";

/**
 * La versión se retiró: sus envíos en cola no salen. Quedan cancelados por quien la retiró, con el motivo y sin aviso,
 * porque lo decidió oficina (ADR-0047); no se reanudan, porque la versión ya no se entrega (regla 10). Uno que ya
 * estaba saliendo no se detiene: si el proveedor lo acepta, pasa a "Enviado" (`marcarEnviado`); si no, queda cancelado.
 */
export async function cancelarEnviosDeVersion(tx: TxOrganizacion, { versionId, por }: { versionId: string; por: string }): Promise<void> {
  await tx
    .update(envios)
    .set({ estado: "cancelado", error: VERSION_RETIRADA, canceladoPor: por, canceladoEn: new Date(), actualizadoEn: new Date() })
    .where(and(eq(envios.versionId, versionId), eq(envios.estado, "en_cola")));
}

/**
 * Cancelar un envío que espera en cola (ADR-0034). Solo si todavía no empezó a salir: el worker marca la salida
 * (`enviadoEn`) con un UPDATE condicionado al mismo estado, así que entre cancelar y salir gana el que llega primero a
 * la fila y un cancelado nunca sale. Devuelve qué pasó para que quien llama lo diga.
 */
export async function cancelarEnvio(tx: TxOrganizacion, { versionId, envioId, por }: { versionId: string; envioId: string; por: string }): Promise<"cancelado" | "ya_salio" | "ya_cancelado" | "no_existe"> {
  const [cancelado] = await tx
    .update(envios)
    .set({ estado: "cancelado", canceladoPor: por, canceladoEn: new Date(), actualizadoEn: new Date() })
    .where(and(eq(envios.id, envioId), eq(envios.versionId, versionId), eq(envios.estado, "en_cola"), isNull(envios.enviadoEn)))
    .returning({ id: envios.id });
  if (cancelado) return "cancelado";
  const [fila] = await tx.select({ estado: envios.estado }).from(envios).where(and(eq(envios.id, envioId), eq(envios.versionId, versionId)));
  if (!fila) return "no_existe";
  return fila.estado === "cancelado" ? "ya_cancelado" : "ya_salio";
}

/**
 * Deshacer la cancelación: vuelve a "En cola" y, si el PDF ya está listo (`pdfRuta`), sale de nuevo por el mismo
 * trabajo, con su misma llave. Solo un cancelado se reanuda.
 */
export async function reanudarEnvio(tx: TxOrganizacion, { organizacionId, versionId, envioId, pdfRuta }: { organizacionId: string; versionId: string; envioId: string; pdfRuta: string | undefined }): Promise<boolean> {
  const [reanudado] = await tx
    .update(envios)
    .set({ estado: "en_cola", error: null, canceladoPor: null, canceladoEn: null, actualizadoEn: new Date() })
    .where(and(eq(envios.id, envioId), eq(envios.versionId, versionId), eq(envios.estado, "cancelado")))
    .returning({ id: envios.id });
  if (!reanudado) return false;
  if (pdfRuta) await encolarEnvio(tx, { organizacionId, envioId, pdfRuta });
  return true;
}

/** Lo que las reglas de envío necesitan de una versión publicada, de informe o de cotización. */
interface VersionParaEnviar {
  id: string;
  retiradaEn: Date | null;
  pdfEstado: "generando" | "listo" | "fallido";
  pdfHuella: string | null;
}

/** El PDF para adjuntar, si ya está listo; sin él, el envío espera en cola a que lo esté (ADR-0028, parte 3). */
export const rutaDelPdf = (organizacionId: string, version: Pick<VersionParaEnviar, "pdfEstado" | "pdfHuella">): string | undefined =>
  version.pdfEstado === "listo" && version.pdfHuella ? claveDeObjeto(organizacionId, version.pdfHuella) : undefined;

/** Qué no se puede hacer con lo de una versión retirada, igual para el informe y la cotización. */
const NO_SALE: Record<"enviar" | "reanudar", string> = { enviar: "publique una nueva para enviarla", reanudar: "no se puede reanudar el envío" };

/**
 * Lo retirado no se vuelve a entregar (regla 10), y sin PDF no hay qué adjuntar: nada lo vuelve a generar y el envío
 * quedaría en cola para siempre. `retirada` dice cómo está retirada la versión en el documento de quien llama.
 */
export function exigirEnviable(version: Pick<VersionParaEnviar, "retiradaEn" | "pdfEstado">, retirada: string, para: "enviar" | "reanudar"): void {
  if (version.retiradaEn) throw problema("estado_invalido", `${retirada}: ${NO_SALE[para]}`);
  if (version.pdfEstado === "fallido") throw problema("estado_invalido", "No se pudo generar el PDF de esta versión: publique una nueva para enviarla");
}

/**
 * Cancelar o reanudar un envío en cola (ADR-0034), con la versión ya bloqueada por quien llama. Reanudar exige lo mismo
 * que enviar; `retirada` dice cómo está retirada la versión, como en `exigirEnviable`.
 */
export async function cancelarOReanudarEnvio(
  tx: TxOrganizacion,
  { accion, organizacionId, version, envioId, por, retirada }: { accion: "cancelar" | "reanudar"; organizacionId: string; version: VersionParaEnviar; envioId: string; por: string; retirada: string },
): Promise<void> {
  if (accion === "cancelar") {
    const resultado = await cancelarEnvio(tx, { versionId: version.id, envioId, por });
    if (resultado === "no_existe") throw problema("no_encontrado", "El envío no existe");
    if (resultado === "ya_salio") throw problema("estado_invalido", "El envío ya salió: lo enviado no se recupera");
    if (resultado === "ya_cancelado") throw problema("estado_invalido", "El envío ya estaba cancelado");
    return;
  }
  exigirEnviable(version, retirada, "reanudar");
  if (!(await reanudarEnvio(tx, { organizacionId, versionId: version.id, envioId, pdfRuta: rutaDelPdf(organizacionId, version) }))) {
    throw problema("estado_invalido", "El envío no estaba cancelado");
  }
}

/**
 * El proveedor lo aceptó o lo entregó: vale para uno en cola y para uno que el retiro alcanzó cuando ya salía
 * (`enviadoEn` marcado antes de llamar al proveedor). Un cancelado por oficina nunca empezó a salir (ADR-0034, 0047).
 */
const puedeSalir = or(eq(envios.estado, "en_cola"), and(eq(envios.estado, "cancelado"), eq(envios.error, VERSION_RETIRADA), isNotNull(envios.enviadoEn)));

/** El PDF de la versión no se pudo generar: sus envíos en cola no van a salir, y se avisa a quien los pidió (ADR-0012). */
export async function fallarEnviosDeVersion(tx: TxOrganizacion, versionId: string): Promise<void> {
  const pendientes = await tx.select().from(envios).where(and(eq(envios.versionId, versionId), eq(envios.estado, "en_cola")));
  for (const fila of pendientes) await marcarFallido(tx, fila, "No se pudo generar el PDF: publique una versión nueva");
}

const encolarEnvio = (tx: TxOrganizacion, datos: Trabajos["envios.enviar"]) => encolar(tx, "envios.enviar", datos, { llave: `envios.enviar:${datos.envioId}`, intentosMaximos: 5 });

const comoEnvio = (
  f: Pick<FilaEnvio, "id" | "contactoId" | "contactoNombre" | "canal" | "destino" | "estado" | "error" | "creadoEn" | "enviadoEn" | "canceladoPor" | "canceladoEn" | "mensaje">,
  nombres: Map<string, string>,
): EnvioDeVersion => ({
  id: f.id,
  contacto: { id: f.contactoId, nombre: f.contactoNombre },
  canal: f.canal,
  destino: f.destino,
  estado: f.estado,
  error: f.error,
  creadoEn: f.creadoEn.toISOString(),
  enviadoEn: f.enviadoEn?.toISOString() ?? null,
  cancelado: f.estado === "cancelado" && f.canceladoEn ? { en: f.canceladoEn.toISOString(), por: { id: f.canceladoPor ?? "", nombre: nombreDe(nombres, f.canceladoPor) } } : null,
  personalizado: f.mensaje.personal !== undefined,
});

/** Nombres de las personas, para decir quién canceló un envío (los da la identidad, a través de quien llama). */
export type NombresDePersonas = (ids: string[]) => Promise<Map<string, string>>;

/** Envíos por versión, del más reciente al más antiguo. */
export async function enviosDeVersiones(tx: TxOrganizacion, versionIds: readonly string[], nombres: NombresDePersonas): Promise<Map<string, EnvioDeVersion[]>> {
  const mapa = new Map<string, EnvioDeVersion[]>();
  if (versionIds.length === 0) return mapa;
  const filas = await tx.select().from(envios).where(inArray(envios.versionId, [...versionIds])).orderBy(desc(envios.creadoEn), envios.contactoNombre, envios.canal);
  const quienes = [...new Set(filas.flatMap((f) => (f.estado === "cancelado" && f.canceladoPor ? [f.canceladoPor] : [])))];
  const conNombre = quienes.length > 0 ? await nombres(quienes) : new Map<string, string>();
  for (const f of filas) mapa.set(f.versionId, [...(mapa.get(f.versionId) ?? []), comoEnvio(f, conNombre)]);
  return mapa;
}

/**
 * Versiones con una copia que no llegó y no se volvió a enviar: el último intento de algún contacto
 * y canal quedó "No llegó" (la bandeja de Informes lo muestra).
 */
export async function versionesConEnvioSinEntregar(tx: TxOrganizacion, versionIds: readonly string[]): Promise<Set<string>> {
  if (versionIds.length === 0) return new Set();
  const ultimos = tx
    .selectDistinctOn([envios.versionId, envios.contactoId, envios.canal], { versionId: envios.versionId, contactoId: envios.contactoId, canal: envios.canal, estado: envios.estado })
    .from(envios)
    .where(inArray(envios.versionId, [...versionIds]))
    .orderBy(envios.versionId, envios.contactoId, envios.canal, desc(envios.creadoEn))
    .as("ultimos");
  const filas = await tx.select({ versionId: ultimos.versionId, contactoId: ultimos.contactoId, canal: ultimos.canal }).from(ultimos).where(eq(ultimos.estado, "fallido"));
  // Solo cuenta lo que se puede volver a enviar: a un contacto que oficina quitó, o que ya no recibe por ese canal, no.
  const canales = await contactosDelCliente.canales(tx, [...new Set(filas.map((f) => f.contactoId))]);
  return new Set(filas.filter((f) => canales.get(f.contactoId)?.includes(f.canal)).map((f) => f.versionId));
}

async function marcarEnviado(tx: TxOrganizacion, envioId: string, proveedorId: string | null): Promise<void> {
  await tx
    .update(envios)
    .set({ estado: "enviado", proveedorId, error: null, canceladoPor: null, canceladoEn: null, actualizadoEn: new Date() })
    .where(and(eq(envios.id, envioId), puedeSalir));
}

/**
 * "No llegó": queda el motivo y se avisa a quien lo pidió. Un rebote de correo marca al contacto. Sin `avisarle` no se
 * avisa: lo decidió oficina (quitó el contacto o su canal) y no hay nada que volver a enviar (iteración 42). Un
 * cancelado no pasa a "No llegó": no salió porque oficina lo detuvo (ADR-0034, 0047).
 */
async function marcarFallido(tx: TxOrganizacion, fila: FilaEnvio, motivo: string, rebote = false, avisarle = true): Promise<void> {
  const [cambiado] = await tx
    .update(envios)
    .set({ estado: "fallido", error: motivo.slice(0, 500), actualizadoEn: new Date() })
    .where(and(eq(envios.id, fila.id), notInArray(envios.estado, ["fallido", "cancelado"])))
    .returning({ id: envios.id });
  if (!cambiado) return;
  if (rebote && fila.canal === "correo") await contactosDelCliente.marcarRebote(tx, fila.contactoId, fila.destino, motivo);
  if (!avisarle) return;
  await avisar(tx, { tipo: "envio_fallido", organizacionId: fila.organizacionId, usuarioId: fila.creadoPor, versionId: fila.versionId, documento: fila.mensaje.documento ?? "informe" });
}

/**
 * Un evento firmado que no se entiende no mejora reintentándolo: queda en el registro y se acusa recibo,
 * para que el proveedor no lo repita sin fin.
 */
function leerEvento<T>(solicitud: FastifyRequest, cuerpo: Buffer, leer: (carga: unknown) => T): T | undefined {
  try {
    return leer(JSON.parse(cuerpo.toString("utf8")));
  } catch (error) {
    solicitud.log.warn({ err: error }, "Evento de un proveedor de envíos que no se entiende");
    return undefined;
  }
}

export interface Envios {
  /** Manejador del trabajo `envios.enviar` (worker). Idempotente: un envío que salió de "En cola" no se repite. */
  enviar(datos: Trabajos["envios.enviar"], contexto: { ultimoIntento: boolean }): Promise<void>;
  /** Eventos firmados de los proveedores (rol web). */
  registrarRutas(app: FastifyInstance): void;
}

/** Interfaz pública del módulo de envíos al cliente (ADR-0028). */
export function crearEnvios({ bd, almacenamiento, config, proveedores = {} }: { bd: BaseDeDatos; almacenamiento: Almacenamiento; config: Config; proveedores?: Proveedores }): Envios {
  async function salir(fila: FilaEnvio, pdf: Buffer): Promise<{ id: string }> {
    const m = fila.mensaje;
    if (fila.canal === "correo") {
      if (!proveedores.correo) throw new RechazoDefinitivo("El envío por correo no está configurado en este entorno");
      const sinAdjunto = pdf.length > BYTES_MAXIMOS_ADJUNTO;
      const opciones = { nombre: fila.contactoNombre, portal: m.documento === "cotizacion" ? undefined : config.PORTAL_URL, sinAdjunto };
      return proveedores.correo({
        idempotencia: fila.id,
        de: config.CORREO_REMITENTE,
        para: fila.destino,
        responderA: config.CORREO_RESPONDER_A,
        asunto: asunto(m),
        html: htmlDeCorreo(m, opciones),
        texto: textoDeCorreo(m, opciones),
        adjunto: sinAdjunto ? null : { nombre: m.nombreArchivo, contenido: pdf },
        etiquetas: { organizacion: fila.organizacionId, envio: fila.id },
      });
    }
    if (!proveedores.whatsapp) throw new RechazoDefinitivo("El envío por WhatsApp no está configurado en este entorno");
    return proveedores.whatsapp({
      para: fila.destino,
      plantilla: m.documento === "cotizacion" ? config.WHATSAPP_PLANTILLA_COTIZACION : config.WHATSAPP_PLANTILLA,
      idioma: config.WHATSAPP_IDIOMA,
      variables: variablesDeWhatsapp(m, fila.contactoNombre),
      documento: { nombre: m.nombreArchivo, contenido: pdf },
      referencia: `${fila.organizacionId}:${fila.id}`,
    });
  }

  /** El estado solo avanza; un rebote o un fallo después de "Entregado" sí pasa a "No llegó" (ADR-0028, parte 4). */
  async function aplicar(evento: EventoDeEnvio): Promise<void> {
    await enOrganizacion(bd, evento.organizacionId, async (tx) => {
      const [fila] = await tx
        .select()
        .from(envios)
        .where(and(eq(envios.id, evento.envioId), or(isNull(envios.proveedorId), eq(envios.proveedorId, evento.proveedorId))));
      if (!fila) return;
      if (evento.estado === "fallido") return marcarFallido(tx, fila, evento.motivo ?? "El proveedor no lo entregó", evento.rebote);
      await tx
        .update(envios)
        .set({ estado: "entregado", proveedorId: evento.proveedorId, error: null, canceladoPor: null, canceladoEn: null, actualizadoEn: new Date() })
        .where(and(eq(envios.id, fila.id), or(eq(envios.estado, "enviado"), puedeSalir)));
    });
  }

  return {
    async enviar({ organizacionId, envioId, pdfRuta }, { ultimoIntento }) {
      const fila = await enOrganizacion(bd, organizacionId, async (tx) => {
        const [fila] = await tx.select().from(envios).where(eq(envios.id, envioId));
        if (!fila || fila.estado !== "en_cola") return undefined;
        // Mientras esperaba el PDF, el contacto pudo quitarse o dejar de recibir por este canal (ADR-0028, parte 5).
        if (!(await contactosDelCliente.sigueRecibiendo(tx, fila.contactoId, fila.canal, fila.destino))) {
          await marcarFallido(tx, fila, "El contacto ya no recibe por este canal", false, false);
          return undefined;
        }
        // Un intento anterior llegó al proveedor sin saberse el resultado. El correo repite con la misma
        // llave y Resend lo descarta; WhatsApp no tiene llave: queda "Enviado" y sus eventos lo confirman.
        if (fila.enviadoEn && fila.canal === "whatsapp") {
          await marcarEnviado(tx, fila.id, null);
          return undefined;
        }
        return fila;
      });
      if (!fila) return;

      /** Seguro que no salió: el siguiente intento lo manda. Definitivo o sin más intentos: "No llegó". */
      const noSalio = async (error: unknown): Promise<void> => {
        const definitivo = error instanceof RechazoDefinitivo || ultimoIntento;
        await enOrganizacion(bd, organizacionId, async (tx) => {
          if (definitivo) {
            const motivo = error instanceof RechazoDefinitivo ? error.message : `No se pudo enviar después de varios intentos: ${error instanceof Error ? error.message : String(error)}`;
            await marcarFallido(tx, fila, motivo);
          } else await tx.update(envios).set({ enviadoEn: null }).where(and(eq(envios.id, fila.id), eq(envios.estado, "en_cola")));
        });
        if (!definitivo) throw error;
      };

      // Leer el PDF no envía nada. Va antes de marcar la salida: si el proceso muere leyéndolo, el
      // reintento no da por enviado un WhatsApp que nunca salió.
      let pdf: Buffer;
      try {
        pdf = await leerTodo(almacenamiento, pdfRuta);
      } catch (error) {
        return noSalio(new NoAceptado(`No se pudo leer el PDF: ${error instanceof Error ? error.message : String(error)}`));
      }
      // Desde aquí puede salir. Si la versión se retiró mientras se leía el PDF, ya no sale.
      const [saliendo] = await enOrganizacion(bd, organizacionId, (tx) =>
        tx.update(envios).set({ enviadoEn: new Date() }).where(and(eq(envios.id, fila.id), eq(envios.estado, "en_cola"))).returning({ id: envios.id }),
      );
      if (!saliendo) return;

      let proveedorId: string | null;
      try {
        ({ id: proveedorId } = await salir(fila, pdf));
      } catch (error) {
        const seguroNoSalio = error instanceof RechazoDefinitivo || error instanceof NoAceptado;
        if (seguroNoSalio || fila.canal === "correo") return noSalio(error);
        proveedorId = null;
      }
      // Fuera del try: si esto falla, el reintento no lo marca "No llegó" ni repite el WhatsApp.
      await enOrganizacion(bd, organizacionId, (tx) => marcarEnviado(tx, fila.id, proveedorId));
    },

    registrarRutas(app) {
      // Cuerpo crudo: la firma se calcula sobre los bytes tal como llegaron. Solo en estas rutas.
      void app.register(async (eventos) => {
        eventos.removeContentTypeParser("application/json");
        eventos.addContentTypeParser("application/json", { parseAs: "buffer" }, (_solicitud, cuerpo, listo) => listo(null, cuerpo));

        registrarRutaPublica(eventos, {
          method: "POST",
          url: "/api/envios/eventos/correo",
          motivo: "Eventos de entrega de Resend, verificados por su firma (ADR-0028, parte 4)",
          handler: async (solicitud, respuesta) => {
            const secreto = config.RESEND_SECRETO_EVENTOS;
            const cuerpo = solicitud.body as Buffer | undefined;
            const cabecera = (nombre: string) => [solicitud.headers[nombre]].flat()[0];
            if (!secreto || !Buffer.isBuffer(cuerpo)) throw problema("no_encontrado", "Los eventos de correo están apagados en este entorno");
            if (!firmaSvixValida(secreto, { id: cabecera("svix-id"), hora: cabecera("svix-timestamp"), firma: cabecera("svix-signature") }, cuerpo)) throw problema("no_autenticado", "Firma inválida");
            const evento = leerEvento(solicitud, cuerpo, eventoDeResend);
            if (evento) await aplicar(evento);
            return respuesta.status(204).send();
          },
        });

        registrarRutaPublica(eventos, {
          method: "GET",
          url: "/api/envios/eventos/whatsapp",
          motivo: "Verificación de la dirección de eventos que hace Meta al registrarla (ADR-0028, parte 4)",
          handler: async (solicitud, respuesta) => {
            const q = solicitud.query as Record<string, string | undefined>;
            const token = config.WHATSAPP_TOKEN_VERIFICACION;
            if (!token || q["hub.mode"] !== "subscribe" || q["hub.verify_token"] !== token || !q["hub.challenge"]) throw problema("sin_permiso", "Token de verificación inválido");
            return respuesta.type("text/plain").send(q["hub.challenge"]);
          },
        });

        registrarRutaPublica(eventos, {
          method: "POST",
          url: "/api/envios/eventos/whatsapp",
          motivo: "Estados de los mensajes de WhatsApp, verificados por la firma de Meta (ADR-0028, parte 4)",
          handler: async (solicitud, respuesta) => {
            const secreto = config.WHATSAPP_SECRETO_APP;
            const cuerpo = solicitud.body as Buffer | undefined;
            if (!secreto || !Buffer.isBuffer(cuerpo)) throw problema("no_encontrado", "Los eventos de WhatsApp están apagados en este entorno");
            if (!firmaMetaValida(secreto, [solicitud.headers["x-hub-signature-256"]].flat()[0], cuerpo)) throw problema("no_autenticado", "Firma inválida");
            for (const evento of leerEvento(solicitud, cuerpo, eventosDeWhatsapp) ?? []) await aplicar(evento);
            return respuesta.status(200).send();
          },
        });
      });
    },
  };
}
