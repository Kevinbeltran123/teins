import type { DefinicionSeccion, VersionFormato } from "./formato";
import { ID_CORTO } from "./patrones";

/**
 * Secciones repetibles (F2, ADR-0006). Cada repetición es una clave más del mapa de respuestas,
 * `seccion~id`, y el levantamiento guarda aparte la lista ordenada de repeticiones con su nombre.
 * El id es estable: quitar una repetición no cambia la ruta de las demás (auditoría, correcciones).
 */
export interface Repeticion {
  id: string;
  nombre: string;
}

/** Repeticiones por clave de sección repetible, en el orden en que se agregaron. */
export type Repeticiones = Readonly<Record<string, readonly Repeticion[]>>;

/** Primera versión de `campo` que sabe capturar secciones repetibles (ADR-0015, punto 4). */
export const VERSION_APP_REPETIBLES = 4;

/** `~` no es válido en una clave de sección: la clave de una repetición nunca choca con otra. */
const SEPARADOR = "~";
export const ID_REPETICION = ID_CORTO;

export const claveDeRepeticion = (seccion: string, id: string) => `${seccion}${SEPARADOR}${id}`;

export function leerClave(clave: string): { seccion: string; repeticion?: string } {
  const partes = clave.split(SEPARADOR);
  // Con más de un separador no es una ruta válida: se devuelve entera, y como lleva `~` no coincide con ninguna sección.
  if (partes.length !== 2) return { seccion: clave };
  return { seccion: partes[0]!, repeticion: partes[1]! };
}

/** "Tablero 3": el primer número que ninguna repetición de la sección usa todavía como nombre. */
export function nombrePorDefecto(seccion: DefinicionSeccion, existentes: readonly Repeticion[]): string {
  const etiqueta = seccion.repetible?.etiqueta ?? seccion.titulo;
  const usados = new Set(existentes.map((r) => r.nombre));
  for (let n = existentes.length + 1; ; n++) if (!usados.has(`${etiqueta} ${n}`)) return `${etiqueta} ${n}`;
}

/** Lo que se captura, en orden: cada sección normal y cada repetición de las repetibles. */
export interface Bloque {
  seccion: DefinicionSeccion;
  /** Clave en el mapa de respuestas. */
  clave: string;
  repeticion?: Repeticion;
  /** "Tableros · Tablero 2", o el título de la sección. */
  titulo: string;
}

export function bloques(formato: VersionFormato, repeticiones: Repeticiones = {}): Bloque[] {
  return formato.secciones.flatMap((seccion): Bloque[] => {
    if (!seccion.repetible) return [{ seccion, clave: seccion.clave, titulo: seccion.titulo }];
    const lista = Array.isArray(repeticiones[seccion.clave]) ? repeticiones[seccion.clave]! : [];
    return lista.map((repeticion) => ({ seccion, clave: claveDeRepeticion(seccion.clave, repeticion.id), repeticion, titulo: `${seccion.titulo} · ${repeticion.nombre}` }));
  });
}

/** El bloque de una clave de respuestas, si existe en este levantamiento. */
export function bloqueDe(formato: VersionFormato, repeticiones: Repeticiones, clave: string): Bloque | undefined {
  return bloques(formato, repeticiones).find((b) => b.clave === clave);
}

/** "Tableros · Tablero 2 · Corriente nominal": un dato como lo lee una persona (historial, comentarios). */
export function rutaLegible(formato: VersionFormato, repeticiones: Repeticiones, seccion: string, campo?: string): string {
  const bloque = bloqueDe(formato, repeticiones, seccion);
  const etiqueta = campo ? bloque?.seccion.campos.find((c) => c.clave === campo)?.etiqueta ?? campo : undefined;
  return [bloque?.titulo ?? seccion, etiqueta].filter(Boolean).join(" · ");
}

/**
 * Cómo se nombra un dato en comentarios, errores e historial: en una repetición, la ruta completa
 * ("Tableros · Tablero 2 · Corriente nominal"), porque el nombre del campo solo no dice en cuál; en una
 * sección normal, el nombre del campo, como siempre ("potencia nominal" en minúsculas dentro de una frase).
 */
export function nombreDeDato(formato: VersionFormato, repeticiones: Repeticiones, seccion: string, campo: string, enFrase = false): string {
  if (leerClave(seccion).repeticion !== undefined) return rutaLegible(formato, repeticiones, seccion, campo);
  const etiqueta = formato.secciones.find((s) => s.clave === seccion)?.campos.find((c) => c.clave === campo)?.etiqueta ?? campo;
  return enFrase ? etiqueta.toLowerCase() : etiqueta;
}
