import { normalizarBusqueda } from "../../../plataforma/busqueda";

/** Cálculos puros de las herramientas del asistente (iteración 53): estadísticas, redondeo, formato y redacción. */

/** "Ibagué", " IBAGUE " e "ibague" son la misma ciudad: sin mayúsculas, tildes ni espacios de más. */
export const normalizarTexto = (texto: string) => normalizarBusqueda(texto).replace(/\s+/g, " ");

/** Percentil con interpolación lineal entre los dos valores vecinos, como `numpy.percentile` por omisión. */
export function percentil(valores: readonly number[], p: number): number {
  if (valores.length === 0) throw new Error("Sin valores");
  const orden = [...valores].sort((a, b) => a - b);
  const posicion = (p / 100) * (orden.length - 1);
  const abajo = Math.floor(posicion);
  const arriba = Math.ceil(posicion);
  return orden[abajo]! + (orden[arriba]! - orden[abajo]!) * (posicion - abajo);
}

export const mediana = (valores: readonly number[]) => percentil(valores, 50);

export interface Estadisticas {
  n: number;
  minimo: number;
  mediana: number;
  percentil80: number;
  maximo: number;
}

export function estadisticas(valores: readonly number[]): Estadisticas {
  return { n: valores.length, minimo: Math.min(...valores), mediana: mediana(valores), percentil80: percentil(valores, 80), maximo: Math.max(...valores) };
}

/**
 * Hacia arriba al entero. Antes se quita el ruido de la coma flotante: 30 × 40 da 1200,0000000001 y no debe pedir
 * un metro de más.
 */
export const redondearArriba = (valor: number) => Math.ceil(Number(valor.toFixed(6)));

/** "4485" → "4.485", "1234.5" → "1.234,5": miles con punto y decimales con coma, sin pasar por coma flotante. */
export function decimalColombiano(decimal: string): string {
  const negativo = decimal.startsWith("-");
  const [entero = "0", fraccion] = (negativo ? decimal.slice(1) : decimal).split(".");
  let agrupado = entero;
  if (/^\d+$/.test(entero)) {
    agrupado = "";
    for (let i = 0; i < entero.length; i++) agrupado += `${i > 0 && (entero.length - i) % 3 === 0 ? "." : ""}${entero[i]}`;
  }
  return `${negativo ? "-" : ""}${agrupado}${fraccion ? `,${fraccion}` : ""}`;
}

/** Un número con decimales fijos: 28.9583 con 1 → "29,0". */
export const numeroColombiano = (valor: number, decimales = 0) => decimalColombiano(valor.toFixed(decimales));

/** "4.485 m". */
export const cantidadConUnidad = (decimal: string, unidad: string) => `${decimalColombiano(decimal)} ${unidad}`;

export const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"] as const;

/** "2026-02" → "feb". */
export const mesCorto = (aaaaMm: string) => MESES_CORTOS[Number(aaaaMm.slice(5, 7)) - 1] ?? aaaaMm;

/** Los meses de `desde` a `hasta` (AAAA-MM), ambos incluidos. */
export function mesesEntre(desde: string, hasta: string): string[] {
  const meses: string[] = [];
  let [anio, mes] = [Number(desde.slice(0, 4)), Number(desde.slice(5, 7))];
  const fin = Number(hasta.slice(0, 4)) * 12 + Number(hasta.slice(5, 7));
  while (anio * 12 + mes <= fin) {
    meses.push(`${anio}-${String(mes).padStart(2, "0")}`);
    mes++;
    if (mes > 12) [anio, mes] = [anio + 1, 1];
  }
  return meses;
}

/** ¿Es un día que existe, escrito AAAA-MM-DD? "2026-02-30" no. */
export function esFechaReal(texto: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const fecha = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === texto;
}

/**
 * Un correo: el usuario y, pegados, la @ y un dominio con al menos un punto. Se busca en dos pasos para que un texto
 * largo sin @ no se recorra una vez por cada letra.
 */
const USUARIO_DE_CORREO = /[\p{L}\p{N}._%+-]+/gu;
const DOMINIO_DE_CORREO = /@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/uy;

function sinCorreos(texto: string): string {
  let salida = "";
  let desde = 0;
  USUARIO_DE_CORREO.lastIndex = 0;
  for (let usuario = USUARIO_DE_CORREO.exec(texto); usuario; usuario = USUARIO_DE_CORREO.exec(texto)) {
    DOMINIO_DE_CORREO.lastIndex = USUARIO_DE_CORREO.lastIndex;
    if (!DOMINIO_DE_CORREO.test(texto)) continue;
    salida += `${texto.slice(desde, usuario.index)}[correo]`;
    desde = USUARIO_DE_CORREO.lastIndex = DOMINIO_DE_CORREO.lastIndex;
  }
  return salida + texto.slice(desde);
}

/**
 * Celulares (3xx) y fijos con indicativo (60x) de Colombia, de 10 dígitos, con o sin +57, espacios, puntos, guiones o
 * paréntesis. Los bordes impiden partir un número más largo; cantidades y fechas no empiezan así ni tienen esa forma.
 */
const CELULAR = /(?<![\p{L}\p{N}])(?:\+?57[\s.-]?)?(?:\(\s*(?:3\d{2}|60\d)\s*\)|3\d{2}|60\d)[\s.-]?\d{3}[\s.-]?\d{4}(?![\p{N}])/gu;

/** Correos y teléfonos escritos dentro de un texto libre, cambiados por `[correo]` y `[celular]`. */
export const redactar = (texto: string) => sinCorreos(texto).replace(CELULAR, "[celular]");

/**
 * ¿La etiqueta de un campo de texto pregunta por una persona o por cómo ubicarla? Entonces su valor es un dato personal
 * y nunca sale (ADR-0060). Genérico en español, sin claves de ningún formato (R7).
 */
const PREGUNTA_POR_PERSONA =
  /\b(?:quien|quienes|contacto|contactos|responsable|responsables|recibe|reciben|atiende|atienden|encargado|encargada|encargados|cedula|telefono|telefonos|celular|celulares|correo|correos|e-?mail|whatsapp)\b|\bdocumento de identidad\b|\bnombre de(?:l| la)? (?:contacto|persona|quien)\b/;

export const preguntaPorPersona = (etiqueta: string) => PREGUNTA_POR_PERSONA.test(normalizarTexto(etiqueta));

/** "A", "A y B", "A, B y C". */
export const unirConY = (partes: readonly string[]) => (partes.length < 2 ? (partes[0] ?? "") : `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}`);

/** "1 ítem", "3 ítems". */
export const contar = (n: number, singular: string, plural: string) => `${numeroColombiano(n)} ${n === 1 ? singular : plural}`;
