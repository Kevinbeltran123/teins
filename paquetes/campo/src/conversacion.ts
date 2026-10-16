import type { ComentarioDeOficina, RespuestaPendiente } from "./datos/modelo";

/*
  El chat con oficina de un levantamiento enviado (ADR-0040, prototipos/hilos, «Campo»): un solo chat por
  levantamiento, como WhatsApp, con todas las conversaciones de oficina en el orden en que se escribieron.
*/

const formatoHora = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit" });
/** «8:26 p. m.», sin segundos. */
export const horaDelChat = (iso: string) => formatoHora.format(new Date(iso));

export interface MensajeDelChat {
  /** El del servidor o, mientras espera, la llave del teléfono. */
  id: string;
  /** La conversación a la que pertenece: el comentario de oficina que la abrió. */
  comentarioId: string;
  de: "oficina" | "tecnico";
  texto: string;
  en: string;
  /** Solo lo del técnico. */
  estado?: "cola" | "enviado" | "leido" | "rechazada" | undefined;
}

/** Lo de oficina y lo del técnico (del servidor y de la cola del teléfono), en orden; lo que el servidor ya devolvió no se repite. */
export function armarChat(comentarios: readonly ComentarioDeOficina[], pendientes: readonly RespuestaPendiente[]): MensajeDelChat[] {
  const mensajes: MensajeDelChat[] = [];
  const llegadas = new Set<string>();
  for (const c of comentarios) {
    mensajes.push({ id: c.id, comentarioId: c.id, de: "oficina", texto: c.texto, en: c.creadoEn });
    for (const r of c.respuestas ?? []) {
      if (r.llave) llegadas.add(r.llave);
      mensajes.push({ id: r.id, comentarioId: c.id, de: r.de, texto: r.texto, en: r.creadoEn, ...(r.de === "tecnico" ? { estado: r.leido ? "leido" : "enviado" } : {}) });
    }
  }
  for (const p of pendientes) {
    if (llegadas.has(p.llave)) continue;
    mensajes.push({ id: p.llave, comentarioId: p.comentarioId, de: "tecnico", texto: p.texto, en: p.enviada?.creadoEn ?? p.creadaEn, estado: p.rechazo ? "rechazada" : p.enviada ? "enviado" : "cola" });
  }
  return mensajes.sort((a, b) => a.en.localeCompare(b.en));
}

/** Lo de oficina que el técnico no ha visto: lo posterior a lo último que leyó. */
export const sinLeer = (chat: readonly MensajeDelChat[], leidoHasta: string | null) => chat.filter((m) => m.de === "oficina" && (!leidoHasta || m.en > leidoHasta)).length;

export type FilaDelChat =
  | { tipo: "hora"; en: string }
  | { tipo: "sin_leer"; cuantos: number }
  /**
   * `sigue`: va pegado al anterior (mismo lado y misma conversación). `referencia`: el primer mensaje de oficina de
   * una conversación lleva el dato del que habla. `cita`: lo del técnico que cambia de tema cita la pregunta de oficina.
   */
  | { tipo: "mensaje"; mensaje: MensajeDelChat; sigue: boolean; referencia: boolean; cita: string | undefined };

/** La hora va centrada entre grupos: al principio y cuando pasan 10 minutos o más. */
const LEJOS_MS = 10 * 60_000;

export function filasDelChat(chat: readonly MensajeDelChat[], leidoHasta: string | null): FilaDelChat[] {
  const filas: FilaDelChat[] = [];
  const nuevos = sinLeer(chat, leidoHasta);
  let franjaPuesta = false;
  let previo: MensajeDelChat | undefined;
  for (const m of chat) {
    const hora = !previo || Date.parse(m.en) - Date.parse(previo.en) >= LEJOS_MS;
    if (hora) filas.push({ tipo: "hora", en: m.en });
    const franja = !franjaPuesta && nuevos > 0 && m.de === "oficina" && (!leidoHasta || m.en > leidoHasta);
    if (franja) {
      franjaPuesta = true;
      filas.push({ tipo: "sin_leer", cuantos: nuevos });
    }
    const tema = !previo || previo.comentarioId !== m.comentarioId;
    const sigue = Boolean(previo && previo.de === m.de && !tema && !hora && !franja);
    const citada = m.de === "tecnico" && tema ? chat.filter((x) => x.de === "oficina" && x.comentarioId === m.comentarioId && x.en <= m.en).at(-1)?.texto : undefined;
    filas.push({ tipo: "mensaje", mensaje: m, sigue, referencia: m.de === "oficina" && m.id === m.comentarioId, cita: citada });
    previo = m;
  }
  return filas;
}
