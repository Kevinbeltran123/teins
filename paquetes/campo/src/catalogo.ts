import { esCantidades } from "@teins/dominio";
import type { ItemCatalogoLocal, LevantamientoLocal } from "./datos/modelo";

/**
 * Catálogo en el teléfono (iteración 17, ADR-0025): buscar y proponer ítems sin conexión y sin biblioteca;
 * unos miles de ítems se recorren en milisegundos.
 */

/** Sin tildes ni mayúsculas: "categoría" y "CATEGORIA" se encuentran igual. */
export const normalizar = (texto: string) => texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Palabras para comparar; las medidas "20x12" se parten en sus números sin partir "exterior". */
const palabras = (texto: string) =>
  normalizar(texto)
    .replace(/(\d)x(\d)/g, "$1 $2")
    .split(/[\s\-_/.,()]+/)
    .filter(Boolean);

/** Cuántas líneas de los levantamientos de este teléfono usan cada ítem. Nada de esto sube al servidor. */
export function usosPorItem(levantamientos: readonly LevantamientoLocal[]): Map<string, number> {
  const usos = new Map<string, number>();
  for (const l of levantamientos) {
    for (const seccion of Object.values(l.respuestas)) {
      for (const valor of Object.values(seccion)) {
        if (!esCantidades(valor)) continue;
        for (const linea of valor) if (linea.item) usos.set(linea.item, (usos.get(linea.item) ?? 0) + 1);
      }
    }
  }
  return usos;
}

/** Solo lo que el campo admite: un ítem con una unidad que el formato no permite no se podría enviar. */
const elegibles = (items: readonly ItemCatalogoLocal[], unidades: readonly string[]) => items.filter((i) => i.activo && unidades.includes(i.unidad));

const porUso = (usos: ReadonlyMap<string, number>) => (a: ItemCatalogoLocal, b: ItemCatalogoLocal) =>
  (usos.get(b.id) ?? 0) - (usos.get(a.id) ?? 0) || a.descripcion.localeCompare(b.descripcion, "es");

/** "Los que más usas": los ítems con más líneas en este teléfono, de los que admite el campo. */
export function frecuentes(items: readonly ItemCatalogoLocal[], usos: ReadonlyMap<string, number>, unidades: readonly string[], maximo = 6): ItemCatalogoLocal[] {
  return elegibles(items, unidades)
    .filter((i) => (usos.get(i.id) ?? 0) > 0)
    .sort(porUso(usos))
    .slice(0, maximo);
}

/**
 * Cada palabra de la consulta tiene que ser el comienzo de una palabra del código o de la descripción
 * ("cab utp" encuentra "Cable UTP categoría 6A"), o la consulta el comienzo del código ("cab-6"). Primero
 * el código exacto; después, los que más usa el técnico.
 */
export function buscarEnCatalogo(items: readonly ItemCatalogoLocal[], consulta: string, unidades: readonly string[], usos: ReadonlyMap<string, number>, maximo = 30): ItemCatalogoLocal[] {
  const buscadas = palabras(consulta);
  if (buscadas.length === 0) return [];
  const codigoBuscado = normalizar(consulta).replace(/\s+/g, "");
  const coinciden = elegibles(items, unidades).filter((i) => {
    if (normalizar(i.codigo).startsWith(codigoBuscado)) return true;
    const propias = palabras(`${i.codigo} ${i.descripcion}`);
    return buscadas.every((b) => propias.some((p) => p.startsWith(b)));
  });
  const exacto = (i: ItemCatalogoLocal) => (normalizar(i.codigo) === codigoBuscado ? 0 : 1);
  return coinciden.sort((a, b) => exacto(a) - exacto(b) || porUso(usos)(a, b)).slice(0, maximo);
}
