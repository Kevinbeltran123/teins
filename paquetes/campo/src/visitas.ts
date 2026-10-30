import type { VisitaLocal } from "./datos/modelo";
import { formatearDia, horaCorta } from "@teins/dominio";

/** Fecha de hoy en el teléfono, como AAAA-MM-DD (la misma forma de `programadaPara`). */
export const hoyLocal = (ahora = new Date()) => ahora.toLocaleDateString("en-CA");


function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** "Hoy", "Mañana", "Ayer" o "mié, 30 sept". La hora, si tiene, va aparte (`horarioDeVisita`). */
export function fechaDeVisita(programadaPara: string, hoy: string): string {
  if (programadaPara === hoy) return "Hoy";
  if (programadaPara === sumarDias(hoy, 1)) return "Mañana";
  if (programadaPara === sumarDias(hoy, -1)) return "Ayer";
  return formatearDia(programadaPara, { weekday: "short", day: "numeric", month: "short" });
}

/**
 * Una visita se inicia desde su día (iteración 46): la de un día futuro no. El día programado se inicia a cualquier
 * hora —el horario es del compromiso con el cliente, no una cerradura— y las atrasadas se siguen iniciando. La regla
 * corre en el teléfono con su fecha local; el servidor no rechaza nada, así que un inicio hecho sin señal no se pierde.
 */
export const sePuedeIniciar = (v: Pick<VisitaLocal, "programadaPara">, hoy: string) => v.programadaPara <= hoy;

/** Lo que dice la tarjeta en lugar de «Iniciar levantamiento»: «Podrás iniciarla mañana» o el día con su nombre. */
export const cuandoSePodraIniciar = (programadaPara: string, hoy: string) =>
  programadaPara === sumarDias(hoy, 1)
    ? "Podrás iniciarla mañana"
    : `Podrás iniciarla el ${formatearDia(programadaPara, { weekday: "long", day: "numeric", month: "long" })}`;

// "14:05" → "2:05 p. m.": una sola fuente en `dominio`, igual en todas partes y en todos los teléfonos.
export { horaCorta };

/** Hora del teléfono de un momento ISO, como `horaCorta`: la de "Terminada 3:40 p. m.". */
export const horaDe = (iso: string) => {
  const d = new Date(iso);
  return horaCorta(`${d.getHours()}:${d.getMinutes()}`);
};

/**
 * El horario de la visita (ADR-0037): "9:00 a. m. a 11:00 a. m.", "Desde 2:00 p. m." si no tiene hora de fin, o null
 * si es de todo el día (no se dice nada: es lo que era una visita antes de tener horario).
 */
export function horarioDeVisita(v: Pick<VisitaLocal, "horaInicio" | "horaFin">): string | null {
  if (!v.horaInicio) return null;
  return v.horaFin ? `${horaCorta(v.horaInicio)} a ${horaCorta(v.horaFin)}` : `Desde ${horaCorta(v.horaInicio)}`;
}

/** Cuándo se terminó: lo que dice el servidor o, mientras no lo sabe, lo que el técnico tocó en este teléfono. */
export const terminadaEn = (v: VisitaLocal): string | null => v.terminada?.en ?? v.terminacionPendiente?.en ?? null;

/** Hora del teléfono como "HH:MM", la misma forma de `horaInicio`. */
const horaLocal = (ahora: Date) => `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`;

/**
 * En curso (ADR-0037): sin hora de fin, de hoy, ya empezó y nadie la terminó. Solo esta se termina desde el teléfono:
 * con hora de fin, el técnico queda libre a esa hora; de todo el día, no ocupa una franja; de otro día, el servidor
 * la libera al final de ese día.
 */
export function enCurso(v: VisitaLocal, ahora = new Date()): boolean {
  return Boolean(v.horaInicio) && !v.horaFin && !v.fueraDeAlcance && v.programadaPara === hoyLocal(ahora) && v.horaInicio! <= horaLocal(ahora) && terminadaEn(v) === null;
}

/**
 * Orden dentro del mismo día: las de hora, por hora de inicio; las de todo el día, después. Las de hora son un
 * compromiso con el cliente; las de todo el día se acomodan en lo que queda.
 */
export function compararPorHorario(a: Pick<VisitaLocal, "programadaPara" | "horaInicio">, b: Pick<VisitaLocal, "programadaPara" | "horaInicio">): number {
  return a.programadaPara.localeCompare(b.programadaPara) || (a.horaInicio ?? "99:99").localeCompare(b.horaInicio ?? "99:99");
}

/** Grupos de las visitas pendientes, en el orden en que se muestran. */
const GRUPO = { conBorrador: 0, hoy: 1, atrasada: 2, futura: 3 } as const;

/**
 * La agenda de "Mis visitas" (iteración 40). Una visita está atendida si tiene algo enviado o el técnico la terminó, y
 * no tiene un borrador a medias: ya no es la siguiente, ni atrasada.
 *
 * - `pendientes`: lo que falta, en orden. La primera es el punto focal de la pantalla (DESIGN.md): «Siguiente visita»,
 *   con la acción principal. Si no hay ninguna, no hay siguiente visita.
 *   1. Con un borrador a medias, aunque sea de otro día: es trabajo que solo existe en este teléfono.
 *   2. Las de hoy. 3. Las atrasadas: siguen asignadas y oficina las espera, pero no tapan las de hoy. 4. Las futuras.
 *   Dentro de cada grupo, por fecha; el mismo día por hora de inicio con las de todo el día al final
 *   (`compararPorHorario`) y después por cliente, para que el orden no dependa del servidor.
 * - `atendidasHoy`: las atendidas de hoy, aparte y al final, por si hace falta otro levantamiento (otro formato). Las
 *   de días anteriores no se muestran: su levantamiento sigue en «Enviados».
 */
export function agendaDeVisitas(
  visitas: readonly VisitaLocal[],
  hoy: string,
  conBorrador: ReadonlySet<string>,
  conEnviados: ReadonlySet<string>,
  ahora = new Date(),
): { pendientes: VisitaLocal[]; atendidasHoy: VisitaLocal[] } {
  const atendida = (v: VisitaLocal) => !conBorrador.has(v.id) && (conEnviados.has(v.id) || terminadaEn(v) !== null);
  const deHoy = (v: VisitaLocal) => {
    const terminada = terminadaEn(v);
    return v.programadaPara === hoy || (terminada !== null && hoyLocal(new Date(terminada)) === hoyLocal(ahora));
  };
  // Una cancelada o reasignada con un borrador a medias no tapa el plan del día: va con las atrasadas, para enviarla.
  const grupo = (v: VisitaLocal) =>
    conBorrador.has(v.id) && !v.fueraDeAlcance ? GRUPO.conBorrador : v.fueraDeAlcance ? GRUPO.atrasada : v.programadaPara === hoy ? GRUPO.hoy : v.programadaPara < hoy ? GRUPO.atrasada : GRUPO.futura;
  const porCliente = (a: VisitaLocal, b: VisitaLocal) => compararPorHorario(a, b) || a.cliente.nombre.localeCompare(b.cliente.nombre, "es");
  const pendientes = visitas.filter((v) => !atendida(v)).sort((a, b) => grupo(a) - grupo(b) || porCliente(a, b));
  const atendidasHoy = visitas.filter((v) => atendida(v) && deHoy(v)).sort(porCliente);
  return { pendientes, atendidasHoy };
}
