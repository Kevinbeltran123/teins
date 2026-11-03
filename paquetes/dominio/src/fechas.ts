/**
 * Fechas y pesos como se muestran en Colombia, en un solo lugar para que el PDF, el correo, el aviso y la pantalla
 * digan lo mismo. Solo usa Intl, que es parte del lenguaje: dominio sigue sin dependencias.
 */

export const ZONA_COLOMBIA = "America/Bogota";

/** "2026-10-27": el día de calendario en Colombia de un momento, en la misma forma de `programadaPara`. */
export const fechaEnColombia = (momento: Date = new Date()) => momento.toLocaleDateString("en-CA", { timeZone: ZONA_COLOMBIA });

/**
 * Un día de calendario ("2026-10-27") con el formato pedido. El día no tiene hora ni zona: se lee como medianoche UTC
 * y se formatea en UTC, para que ninguna zona lo corra al día anterior.
 */
export const formatearDia = (aaaaMmDd: string, opciones: Omit<Intl.DateTimeFormatOptions, "timeZone">) =>
  new Intl.DateTimeFormat("es-CO", { ...opciones, timeZone: "UTC" }).format(new Date(`${aaaaMmDd}T00:00:00Z`));

/**
 * "$ 1.234.567": pesos colombianos enteros (ADR-0029). El formateador se crea al usarlo, no al cargar el módulo:
 * una llamada en el nivel superior impide que el empaquetador descarte este archivo donde no se usa (campo).
 */
export const pesos = (valor: number) => `$ ${valor.toLocaleString("es-CO", { maximumFractionDigits: 0 })}`;

/** "14:05" → "2:05 p. m.": la forma en que se dice la hora en Colombia, igual en todas partes. El mediodía es "12:00 p. m.". */
export function horaCorta(hhmm: string): string {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "a. m." : "p. m."}`;
}

/** "3 h 16 min", "2 h", "45 min". */
export function duracionTexto(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return [h > 0 ? `${h} h` : "", m > 0 || h === 0 ? `${m} min` : ""].filter(Boolean).join(" ");
}

/** Minutos entre dos horas "HH:MM"; si la salida es menor que la entrada, fue al día siguiente. Sin salida, null. */
export function minutosDeHorario({ desde, hasta }: { desde: string; hasta?: string | undefined }): number | null {
  if (hasta === undefined) return null;
  const aMinutos = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
  const diferencia = aMinutos(hasta) - aMinutos(desde);
  return diferencia >= 0 ? diferencia : diferencia + 24 * 60;
}
