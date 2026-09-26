/**
 * Firma del cliente (ADR-0024): una constancia de que el técnico estuvo en el sitio, no del contenido técnico.
 * Los trazos se guardan como un documento de boceto (lienzo de la versión 1, solo trazos), así que suben, se
 * verifican y se dibujan igual que un boceto; el valor del campo lleva quién firmó, cuándo y qué leyó.
 */
import { bocetoASvg, type DocumentoBoceto, type OpcionesSvg } from "./boceto";

/** Primera versión de `campo` que sabe tomar firmas (ADR-0015, punto 4). */
export const VERSION_APP_FIRMA = 7;

/** Si el formato no trae su propio texto. El de TEINS viene en su formato: la organización no está en el código (R7). */
export const DECLARACION_POR_DEFECTO = "Confirmo que {tecnico} visitó {sitio} el {fecha}.";

export const LIMITES_FIRMA = { nombre: 120, cargo: 120, declaracion: 500 } as const;

/** La constancia tal como la lee quien firma: la plantilla del formato con el técnico, el sitio y el día. */
export function llenarDeclaracion(plantilla: string | undefined, datos: { tecnico: string; sitio: string; fecha: string }): string {
  return (plantilla ?? DECLARACION_POR_DEFECTO).replace(/\{(tecnico|sitio|fecha)\}/g, (_, clave: keyof typeof datos) => datos[clave]);
}

/**
 * La firma como SVG, sin cuadrícula y recortada a sus trazos con un margen: en oficina y en el PDF se ve la
 * firma, no el lienzo vacío alrededor.
 */
export function firmaASvg(d: DocumentoBoceto, opciones: Omit<OpcionesSvg, "cuadricula"> = {}): string {
  const puntos = d.elementos.flatMap((e) => (e.tipo === "trazo" ? e.contorno : e.tipo === "linea" ? [e.desde, e.hasta] : [e.en]));
  const completo = bocetoASvg(d, { ...opciones, cuadricula: false, fondo: opciones.fondo ?? "none" });
  if (puntos.length === 0) return completo;
  const margen = 12;
  const xs = puntos.map(([x]) => x);
  const ys = puntos.map(([, y]) => y);
  const x = Math.max(0, Math.min(...xs) - margen);
  const y = Math.max(0, Math.min(...ys) - margen);
  const ancho = Math.min(d.ancho, Math.max(...xs) + margen) - x;
  const alto = Math.min(d.alto, Math.max(...ys) + margen) - y;
  return completo.replace(`viewBox="0 0 ${d.ancho} ${d.alto}" width="${d.ancho}" height="${d.alto}"`, `viewBox="${x} ${y} ${ancho} ${alto}" width="${ancho}" height="${alto}"`);
}
