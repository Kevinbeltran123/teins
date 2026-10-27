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
