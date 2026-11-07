import type { Respuestas, Valor } from "./levantamiento";
import { bloques, type Bloque, type Repeticiones } from "./repeticiones";
import type { DefinicionCampo, VersionFormato } from "./formato";
import { campoVisible, seccionVisible, usaVisibilidad } from "./visibilidad";

/*
  Qué sale en el informe (ADR-0039). Oficina oculta o vuelve a mostrar partes de cada levantamiento: un bloque (una
  sección, o una repetición), un campo que va en su propio bloque (fotos, croquis, cantidades, firma) o una foto.
  Sin que nadie lo toque, no salen los croquis de campo ni lo que el formato marca "solo para la empresa".

  Se guarda como dos listas sobre lo que sale por omisión: lo que oficina ocultó y lo que volvió a mostrar. Las claves:
    "<levantamiento>|<bloque>"                      un bloque
    "<levantamiento>|<bloque>|<campo>"              un campo con bloque propio
    "<levantamiento>|<bloque>|<campo>|<huella>"     una foto
*/

export interface SeleccionInforme {
  ocultos: readonly string[];
  mostrados: readonly string[];
}

export const SELECCION_VACIA: SeleccionInforme = { ocultos: [], mostrados: [] };
export const LIMITES_SELECCION = { claves: 2000, largoClave: 300 } as const;

const SEP = "|";
export const claveOcultable = (...partes: readonly string[]) => partes.join(SEP);

/** Los campos que en el informe van en su propio bloque y se pueden ocultar solos. */
export const tieneBloquePropio = (c: DefinicionCampo) => c.tipo === "foto" || c.tipo === "boceto" || c.tipo === "cantidades" || c.tipo === "firma";

/** Lo que no sale sin que oficina lo pida: el bloque "solo para la empresa" y el croquis de campo (oficina adjunta su plano). */
export const bloqueOcultoPorOmision = (b: Pick<Bloque, "seccion">) => b.seccion.soloEmpresa === true;
export const campoOcultoPorOmision = (c: DefinicionCampo) => c.tipo === "boceto";

export function validarSeleccion(s: SeleccionInforme): boolean {
  const todas = [...s.ocultos, ...s.mostrados];
  return todas.length <= LIMITES_SELECCION.claves && todas.every((c) => c.length > 0 && c.length <= LIMITES_SELECCION.largoClave);
}

/** Lo que una parte decide por sí misma: lo que oficina eligió o, si no eligió, lo de por omisión. */
function propio(s: SeleccionInforme, clave: string, porOmision: boolean): boolean {
  if (s.ocultos.includes(clave)) return true;
  if (s.mostrados.includes(clave)) return false;
  return porOmision;
}

/** Ocultar o mostrar una parte: queda solo la elección que difiere de lo de por omisión. */
export function elegir(s: SeleccionInforme, clave: string, ocultar: boolean, porOmision: boolean): SeleccionInforme {
  const ocultos = s.ocultos.filter((c) => c !== clave);
  const mostrados = s.mostrados.filter((c) => c !== clave);
  if (ocultar && !porOmision) ocultos.push(clave);
  if (!ocultar && porOmision) mostrados.push(clave);
  return { ocultos, mostrados };
}

/** Mostrar todo lo de un levantamiento: también lo que no sale por omisión. */
export function mostrarTodo(s: SeleccionInforme, levantamientoId: string, formato: VersionFormato, repeticiones: Repeticiones = {}): SeleccionInforme {
  const prefijo = `${levantamientoId}${SEP}`;
  const mostrados = s.mostrados.filter((c) => !c.startsWith(prefijo));
  for (const b of bloques(formato, repeticiones)) {
    if (bloqueOcultoPorOmision(b)) mostrados.push(claveOcultable(levantamientoId, b.clave));
    for (const c of b.seccion.campos) if (tieneBloquePropio(c) && campoOcultoPorOmision(c)) mostrados.push(claveOcultable(levantamientoId, b.clave, c.clave));
  }
  return { ocultos: s.ocultos.filter((c) => !c.startsWith(prefijo)), mostrados };
}

/** Lo oculto de un levantamiento: cada parte hereda lo de la que la contiene (un bloque oculto oculta sus fotos). */
export function ocultosDe(s: SeleccionInforme, levantamientoId: string) {
  const bloque = (b: Pick<Bloque, "seccion" | "clave">) => propio(s, claveOcultable(levantamientoId, b.clave), bloqueOcultoPorOmision(b));
  const campo = (b: Pick<Bloque, "seccion" | "clave">, c: DefinicionCampo) => bloque(b) || (tieneBloquePropio(c) && propio(s, claveOcultable(levantamientoId, b.clave, c.clave), campoOcultoPorOmision(c)));
  const foto = (b: Pick<Bloque, "seccion" | "clave">, c: DefinicionCampo, huella: string) => campo(b, c) || propio(s, claveOcultable(levantamientoId, b.clave, c.clave, huella), false);
  return { bloque, campo, foto };
}

export interface CapituloSeleccionable {
  id: string;
  formato: VersionFormato;
  respuestas: Respuestas;
  repeticiones?: Repeticiones | undefined;
  ocultos?: readonly string[] | undefined;
}

/**
 * Lo que entra en la versión publicada (regla 18): sin lo oculto, ni sus valores ni sus fotos, así que el PDF tampoco
 * los incrusta. `ocultos` lleva los bloques y campos que la plantilla salta ("<bloque>" o "<bloque>|<campo>").
 */
export function aplicarSeleccion<T extends CapituloSeleccionable>(l: T, s: SeleccionInforme): T {
  const oculto = ocultosDe(s, l.id);
  const respuestas: Record<string, Record<string, Valor>> = {};
  const ocultos: string[] = [];
  // Lo oculto por una condición del formato (ADR-0058) se decide aquí, con todas las respuestas: después, sin las de lo que
  // oficina ocultó, una condición que dependa de ellas ya no se podría evaluar.
  for (const b of bloques(l.formato, l.repeticiones ?? {})) {
    if (oculto.bloque(b) || !seccionVisible(b.seccion, l.respuestas)) {
      ocultos.push(b.clave);
      continue;
    }
    const valores = l.respuestas[b.clave];
    const quedan: Record<string, Valor> = {};
    for (const c of b.seccion.campos) {
      if (oculto.campo(b, c) || !campoVisible(c, b.clave, l.respuestas)) {
        ocultos.push(claveOcultable(b.clave, c.clave));
        continue;
      }
      const v = valores?.[c.clave];
      if (v === undefined) continue;
      quedan[c.clave] = c.tipo === "foto" && Array.isArray(v) ? (v as readonly string[]).filter((h) => !oculto.foto(b, c, h)) : v;
    }
    if (valores !== undefined) respuestas[b.clave] = quedan;
  }
  // Con condiciones, `ocultos` va siempre: dice a la plantilla que ya se aplicaron y que no las vuelva a evaluar.
  return { ...l, respuestas, ...(ocultos.length > 0 || usaVisibilidad(l.formato) ? { ocultos } : {}) };
}
