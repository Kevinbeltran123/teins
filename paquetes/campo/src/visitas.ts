import type { VisitaLocal } from "./datos/modelo";

/** Fecha de hoy en el teléfono, como AAAA-MM-DD (la misma forma de `programadaPara`). */
export const hoyLocal = (ahora = new Date()) => ahora.toLocaleDateString("en-CA");

const dia = new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

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
  return dia.format(new Date(`${programadaPara}T00:00:00Z`));
}

/** "14:05" → "2:05 p. m.": la forma en que se dice la hora en Colombia, igual en todos los teléfonos. */
export function horaCorta(hhmm: string): string {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "a. m." : "p. m."}`;
}

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

/** Grupos de "Mis visitas", en el orden en que se muestran. */
const GRUPO = { conBorrador: 0, hoy: 1, atrasada: 2, futura: 3, atendida: 4 } as const;

/**
 * Orden de "Mis visitas". La primera es el punto focal de la pantalla (DESIGN.md): va en el bloque
 * azul con la acción principal.
 *
 * 1. Con un borrador a medias, aunque sea de otro día: es trabajo que solo existe en este teléfono.
 * 2. Las de hoy sin atender: el plan del día.
 * 3. Las atrasadas sin atender: siguen asignadas, oficina las espera, pero no tapan las de hoy.
 * 4. Las futuras.
 * 5. Las atendidas (algo enviado y nada a medias): al terminar una visita, el foco pasa a la siguiente.
 *
 * Dentro de cada grupo, por fecha (la más antigua primero; las atendidas, la más reciente primero), en el mismo
 * día por hora de inicio con las de todo el día al final (`compararPorHorario`), y después por cliente, para que el
 * orden no dependa del servidor.
 */
export function ordenarVisitas(
  visitas: readonly VisitaLocal[],
  hoy: string,
  conBorrador: ReadonlySet<string>,
  conEnviados: ReadonlySet<string>,
): VisitaLocal[] {
  const grupo = (v: VisitaLocal) =>
    conBorrador.has(v.id)
      ? GRUPO.conBorrador
      : conEnviados.has(v.id)
        ? GRUPO.atendida
        : v.programadaPara === hoy
          ? GRUPO.hoy
          : v.programadaPara < hoy
            ? GRUPO.atrasada
            : GRUPO.futura;
  return [...visitas].sort((a, b) => {
    const [ga, gb] = [grupo(a), grupo(b)];
    if (ga !== gb) return ga - gb;
    const porFecha = ga === GRUPO.atendida ? b.programadaPara.localeCompare(a.programadaPara) : 0;
    return porFecha || compararPorHorario(a, b) || a.cliente.nombre.localeCompare(b.cliente.nombre, "es");
  });
}
