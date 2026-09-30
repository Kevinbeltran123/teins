import type { VisitaLocal } from "./datos/modelo";

/** Fecha de hoy en el teléfono, como AAAA-MM-DD (la misma forma de `programadaPara`). */
export const hoyLocal = (ahora = new Date()) => ahora.toLocaleDateString("en-CA");

const dia = new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** "Hoy", "Mañana", "Ayer" o "mié, 30 sept". La visita tiene día, no hora (P2 pendiente). */
export function fechaDeVisita(programadaPara: string, hoy: string): string {
  if (programadaPara === hoy) return "Hoy";
  if (programadaPara === sumarDias(hoy, 1)) return "Mañana";
  if (programadaPara === sumarDias(hoy, -1)) return "Ayer";
  return dia.format(new Date(`${programadaPara}T00:00:00Z`));
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
 * Dentro de cada grupo, por fecha (la más antigua primero; las atendidas, la más reciente primero)
 * y después por cliente, para que el orden no dependa del servidor.
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
    const porFecha = ga === GRUPO.atendida ? b.programadaPara.localeCompare(a.programadaPara) : a.programadaPara.localeCompare(b.programadaPara);
    return porFecha || a.cliente.nombre.localeCompare(b.cliente.nombre, "es");
  });
}
