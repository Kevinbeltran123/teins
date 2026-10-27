import { formatearDia, pesos, ZONA_COLOMBIA } from "@teins/dominio";
const fechaHora = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" });
const hora = new Intl.DateTimeFormat("es-CO", { timeStyle: "short" });
const relativo = new Intl.RelativeTimeFormat("es-CO", { numeric: "auto" });

export const aFechaHora = (iso: string) => fechaHora.format(new Date(iso));
const fecha = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" });
/** "27 sept 2026": cuándo rige un precio, sin la hora. */
export const aFecha = (iso: string) => fecha.format(new Date(iso));
export const aHora = (ms: number) => hora.format(new Date(ms));

/** "hace 3 horas": cuánto lleva esperando. */
export function haceCuanto(iso: string, ahora = Date.now()): string {
  const segundos = Math.round((new Date(iso).getTime() - ahora) / 1000);
  const unidades: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unidad, tamano] of unidades) {
    if (Math.abs(segundos) >= tamano) return relativo.format(Math.round(segundos / tamano), unidad);
  }
  return "hace un momento";
}

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const enBogota = (d: Date) => new Date(d.toLocaleString("en-US", { timeZone: ZONA_COLOMBIA }));
const diasEntre = (a: Date, b: Date) => Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86_400_000);

/** "jue 25 sep": el día corto de una fecha; "hoy" y "ayer" cuando lo son. */
export function aDiaCorto(iso: string, ahora = Date.now()): string {
  const d = enBogota(new Date(iso));
  const dias = diasEntre(d, enBogota(new Date(ahora)));
  if (dias === 0) return "hoy";
  if (dias === 1) return "ayer";
  return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`;
}

/** "jue 25 sep · 4:12 p. m.". */
export const aFechaCorta = (iso: string, ahora = Date.now()) => `${aDiaCorto(iso, ahora)} · ${hora.format(new Date(iso))}`;

/** Cuánto lleva esperando, por días de calendario: "Hoy", "Desde ayer", "3 días". */
export function cuantoLleva(iso: string, ahora = Date.now()): { texto: string; dias: number } {
  const dias = Math.max(0, diasEntre(enBogota(new Date(iso)), enBogota(new Date(ahora))));
  return { texto: dias === 0 ? "Hoy" : dias === 1 ? "Desde ayer" : `${dias} días`, dias };
}

/** "$ 1.234.567": pesos colombianos enteros (ADR-0029), igual que en el PDF. */
export { pesos };

/** "jueves 2 de octubre": el día de una visita, con el día de la semana. */
export const diaConSemana = (aaaaMmDd: string) => formatearDia(aaaaMmDd, { weekday: "long", day: "numeric", month: "long" }).replace(",", "");

/** El mayor precio unitario que acepta el servidor. */
const PRECIO_MAXIMO = 1_000_000_000;

/**
 * Lee pesos enteros como se escriben en Colombia: "4.800", "$ 4.800", "4800" o "4800,00". Vacío es null;
 * lo que no es un entero de pesos (centavos, "4.8", texto) es undefined.
 */
export function leerPesos(texto: string): number | null | undefined {
  const limpio = texto.replace(/[$\s]/g, "");
  if (limpio === "") return null;
  const partes = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,0+)?$/.exec(limpio);
  if (!partes) return undefined;
  const valor = Number(partes[1]!.replace(/\./g, ""));
  return Number.isSafeInteger(valor) && valor <= PRECIO_MAXIMO ? valor : undefined;
}

/** Iniciales de una persona para su distintivo: quien comparte computador ve de un vistazo quién es. */
export const iniciales = (nombre: string) =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

/** "Ana Torres, Jorge Pardo y Marta Gil". */
export function enLista(nombres: readonly string[]): string {
  return nombres.length <= 1 ? (nombres[0] ?? "") : `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}
