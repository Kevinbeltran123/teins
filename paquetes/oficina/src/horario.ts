import type { Respuesta } from "@teins/protocolo";

/*
  El horario de una visita (ADR-0037), como lo entiende oficina: el mismo criterio que el servidor usa para rechazar
  un cruce (paquetes/servidor, visitas `intervaloDe`). Sin hora de inicio ocupa todo el día; con inicio y fin, ese
  rango; con inicio y sin fin, desde el inicio hasta que el técnico la termine (o hasta el final del día).
*/

export type Ocupacion = Respuesta<"ocupacionDeTecnicos">["ocupaciones"][number];

export interface Horario {
  horaInicio: string | null;
  horaFin: string | null;
}

export const DIA_COMPLETO = 24 * 60;
export const aMinutos = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
export const aHora = (minutos: number) => `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;

/** "14:00" → "2:00 p. m."; el mediodía, "12:00 p. m.", igual que en el teléfono y en los avisos. */
export function hora12(hora: string): string {
  const total = aMinutos(hora);
  const h = Math.floor(total / 60), m = total % 60;
  const sufijo = h >= 12 ? "p. m." : "a. m.";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${sufijo}`;
}

/** "2 h", "30 min", "1 h 30 min". */
export function duracionTexto(minutos: number): string {
  const h = Math.floor(minutos / 60), m = minutos % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Minuto del día en Colombia de un momento, o null si cae en otro día que `fecha`. */
function minutoDelDia(momento: string, fecha: string): number | null {
  const d = new Date(momento);
  if (d.toLocaleDateString("en-CA", { timeZone: "America/Bogota" }) !== fecha) return null;
  const [h, m] = d.toLocaleTimeString("en-GB", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit", hour12: false }).split(":");
  return Number(h) * 60 + Number(m);
}

/** Lo que ocupa una visita ese día, en minutos [desde, hasta). */
export function intervalo(fecha: string, h: Horario, terminadaEn: string | null = null): [number, number] {
  if (!h.horaInicio) return [0, DIA_COMPLETO];
  const desde = aMinutos(h.horaInicio);
  if (h.horaFin) return [desde, aMinutos(h.horaFin)];
  const terminada = terminadaEn ? minutoDelDia(terminadaEn, fecha) : null;
  return [desde, terminada === null ? DIA_COMPLETO : Math.max(desde, terminada)];
}

const seCruzan = (a: [number, number], b: [number, number]) => a[0] < b[1] && b[0] < a[1];

/** Con qué visita se cruza el técnico a esa hora, si se cruza (sin contar la que se está cambiando). */
export function cruceDe(tecnicoId: string, fecha: string, pedido: Horario, ocupaciones: readonly Ocupacion[], excluir?: string): Ocupacion | null {
  const rango = intervalo(fecha, pedido);
  return ocupaciones.find((o) => o.tecnicoId === tecnicoId && o.visitaId !== excluir && seCruzan(rango, intervalo(fecha, o, o.terminadaEn))) ?? null;
}

/** Para el técnico libre: si tiene otra visita después, o desde cuándo está libre. Ayuda a elegir sin abrir la agenda. */
export function libreTexto(tecnicoId: string, fecha: string, pedido: Horario, ocupaciones: readonly Ocupacion[], excluir?: string): string {
  const suyas = ocupaciones.filter((o) => o.tecnicoId === tecnicoId && o.visitaId !== excluir);
  if (suyas.length === 0) return "Libre todo el día";
  const [desde, hasta] = intervalo(fecha, pedido);
  const despues = suyas.filter((o) => o.horaInicio && aMinutos(o.horaInicio) >= hasta).sort((a, b) => aMinutos(a.horaInicio!) - aMinutos(b.horaInicio!))[0];
  if (despues) return `Libre · tiene otra a las ${hora12(despues.horaInicio!)}`;
  const antes = suyas.map((o) => intervalo(fecha, o, o.terminadaEn)[1]).filter((fin) => fin <= desde).sort((a, b) => b - a)[0];
  return antes !== undefined && antes > 0 ? `Libre desde ${hora12(aHora(antes))}` : "Libre";
}

/** Lo que ocupa a un técnico, dicho para oficina: "Mantenimiento · Hotel Plaza Real · 9:00 a. m. a 12:00 m.". */
export function ocupadoTexto(o: Ocupacion): string {
  const cuando = !o.horaInicio ? "todo el día" : o.horaFin ? `${hora12(o.horaInicio)} a ${hora12(o.horaFin)}` : `desde ${hora12(o.horaInicio)}, sin terminar`;
  return `${o.motivo} · ${o.cliente} · ${cuando}`;
}

/** El horario de una visita en la lista: la hora y, debajo, lo que pasa con ella. */
export function horarioTexto(v: Horario & { terminada: { en: string } | null }): { hora: string; detalle: string | null } {
  if (!v.horaInicio) return { hora: "Todo el día", detalle: null };
  if (v.horaFin) return { hora: `${hora12(v.horaInicio)} a ${hora12(v.horaFin)}`, detalle: null };
  return { hora: `Desde ${hora12(v.horaInicio)}`, detalle: v.terminada ? `Terminó ${hora12(new Date(v.terminada.en).toLocaleTimeString("en-GB", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit", hour12: false }))}` : "Hasta que la terminen" };
}

/** Sin hora de fin, ya empezó hoy y nadie la ha terminado: en curso. */
export function enCurso(v: Horario & { programadaPara: string; terminada: unknown }, hoy: string, ahora = new Date()): boolean {
  if (!v.horaInicio || v.horaFin || v.terminada || v.programadaPara !== hoy) return false;
  const [h, m] = ahora.toLocaleTimeString("en-GB", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit", hour12: false }).split(":");
  return Number(h) * 60 + Number(m) >= aMinutos(v.horaInicio);
}

/** Orden dentro de un día: por hora de inicio; las de todo el día al final. */
export const ordenDelDia = (a: Horario, b: Horario) => (a.horaInicio ? aMinutos(a.horaInicio) : DIA_COMPLETO) - (b.horaInicio ? aMinutos(b.horaInicio) : DIA_COMPLETO);
