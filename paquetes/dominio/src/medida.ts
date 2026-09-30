import type { ValorMedida } from "./levantamiento";

/**
 * Convierte lo que el técnico escribe en un decimal canónico con punto ("12.5"),
 * o null si no es un número válido.
 *
 * - Coma y punto son separador decimal; con más de un separador se rechaza, para no adivinar
 *   separadores de miles.
 * - "12," se acepta como "12" para que no salga error mientras el técnico escribe.
 * - Sin negativos: los campos del corte 0 no los necesitan.
 */
export function normalizarDecimal(entrada: string): string | null {
  const coincidencia = /^(\d*)(?:[.,](\d*))?$/.exec(entrada.trim());
  if (!coincidencia) return null;
  const [, entero = "", decimales = ""] = coincidencia;
  if (entero === "" && decimales === "") return null;
  const enteroSinCeros = entero.replace(/^0+(?=\d)/, "") || "0";
  return decimales === "" ? enteroSinCeros : `${enteroSinCeros}.${decimales}`;
}

/** Regla 5: una medida siempre lleva una unidad permitida para su campo. */
export function crearMedida(
  entrada: string,
  unidad: string,
  unidadesPermitidas: readonly string[],
): ValorMedida | null {
  if (!unidadesPermitidas.includes(unidad)) return null;
  const valor = normalizarDecimal(entrada);
  return valor === null ? null : { valor, unidad };
}
