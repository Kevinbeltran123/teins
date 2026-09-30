import type { SimboloLocal } from "./datos/modelo";
import { normalizar } from "./catalogo";

/**
 * Biblioteca de símbolos en el teléfono (iteración 19, ADR-0027): buscar y agrupar sin conexión, y recordar los
 * últimos que puso este técnico en este teléfono.
 */
const palabras = (texto: string) => normalizar(texto).split(/[\s\-_/.,()]+/).filter(Boolean);

/** Los activos, en el orden de la biblioteca, agrupados por categoría en el orden en que aparecen. */
export function porCategoria(simbolos: readonly SimboloLocal[]): { categoria: string; simbolos: SimboloLocal[] }[] {
  const grupos = new Map<string, SimboloLocal[]>();
  for (const s of [...simbolos].filter((s) => s.activo).sort((a, b) => a.orden - b.orden)) grupos.set(s.categoria, [...(grupos.get(s.categoria) ?? []), s]);
  return [...grupos].map(([categoria, lista]) => ({ categoria, simbolos: lista }));
}

/** Cada palabra buscada es el comienzo de una palabra del nombre, la categoría o la sigla ("tom" encuentra "Toma regulada"). */
export function buscarSimbolos(simbolos: readonly SimboloLocal[], consulta: string): SimboloLocal[] {
  const buscadas = palabras(consulta);
  if (buscadas.length === 0) return [];
  return simbolos
    .filter((s) => s.activo)
    .filter((s) => {
      const propias = palabras(`${s.nombre} ${s.categoria} ${s.texto ?? ""}`);
      return buscadas.every((b) => propias.some((p) => p.startsWith(b)));
    })
    .sort((a, b) => a.orden - b.orden);
}

const CLAVE_RECIENTES = "teins.simbolos.recientes";
const MAXIMO_RECIENTES = 6;

function idsRecientes(): string[] {
  try {
    const ids: unknown = JSON.parse(localStorage.getItem(CLAVE_RECIENTES) ?? "[]");
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/** Los últimos símbolos que se pusieron en este teléfono, que sigan en la biblioteca. Sin almacenamiento, ninguno. */
export function recientes(simbolos: readonly SimboloLocal[]): SimboloLocal[] {
  const activos = new Map(simbolos.filter((s) => s.activo).map((s) => [s.id, s]));
  return idsRecientes().flatMap((id) => (activos.has(id) ? [activos.get(id)!] : [])).slice(0, MAXIMO_RECIENTES);
}

export function recordarReciente(id: string): void {
  try {
    localStorage.setItem(CLAVE_RECIENTES, JSON.stringify([id, ...idsRecientes().filter((otro) => otro !== id)].slice(0, MAXIMO_RECIENTES * 2)));
  } catch {
    // Sin almacenamiento (navegación privada): no hay recientes, y nada más cambia.
  }
}
