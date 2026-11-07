import type { CondicionVisible, DefinicionCampo, DefinicionSeccion, VersionFormato } from "./formato";
import { esOpciones, type Respuestas } from "./levantamiento";

/** Primera versión de `campo` que evalúa las condiciones (ADR-0058, ADR-0015 punto 4). */
export const VERSION_APP_VISIBILIDAD = 17;

/**
 * Si se cumple la condición con lo respondido. `bloque`: la clave de respuestas del campo que la lleva (la sección, o
 * `seccion~id` en una repetible); sin `seccion`, la condición se lee ahí. Sin respuesta, no se cumple.
 */
function cumple(condicion: CondicionVisible, bloque: string, respuestas: Respuestas): boolean {
  const valor = respuestas[condicion.seccion ?? bloque]?.[condicion.campo];
  const elegidas = typeof valor === "string" ? [valor] : esOpciones(valor) ? valor.elegidas : [];
  return elegidas.some((o) => condicion.en.includes(o));
}

export const seccionVisible = (seccion: Pick<DefinicionSeccion, "clave" | "visibleSi">, respuestas: Respuestas) => !seccion.visibleSi || cumple(seccion.visibleSi, seccion.clave, respuestas);

export const campoVisible = (campo: Pick<DefinicionCampo, "visibleSi">, bloque: string, respuestas: Respuestas) => !campo.visibleSi || cumple(campo.visibleSi, bloque, respuestas);

/**
 * Lo que se revisa al publicar (ADR-0058): la condición apunta a una selección que existe **antes** en el formato (así no
 * hay ciclos), de una sección no repetible o de la misma, con opciones que esa selección tiene.
 */
export function erroresDeVisibilidad(definicion: VersionFormato): string[] {
  const errores: string[] = [];
  // Lo que ya apareció, en el orden del formato: solo se puede depender de eso.
  const antes = new Map<string, DefinicionCampo>();
  const revisar = (donde: string, condicion: CondicionVisible, seccionPropia: DefinicionSeccion, esDeSeccion: boolean) => {
    const seccion = condicion.seccion ?? seccionPropia.clave;
    if (esDeSeccion && seccion === seccionPropia.clave) return errores.push(`La condición de la sección ${seccionPropia.clave} debe nombrar otra sección`);
    const otra = definicion.secciones.find((s) => s.clave === seccion);
    if (otra?.repetible && otra.clave !== seccionPropia.clave) return errores.push(`La condición de ${donde} no puede depender de la sección repetible ${seccion}`);
    const campo = antes.get(`${seccion}.${condicion.campo}`);
    if (!campo) return errores.push(`La condición de ${donde} apunta a un campo que no existe antes: ${seccion}.${condicion.campo}`);
    if (campo.tipo !== "opcion" && campo.tipo !== "opciones") return errores.push(`La condición de ${donde} apunta a ${seccion}.${condicion.campo}, que no es una selección`);
    if (condicion.en.length === 0 || condicion.en.some((o) => !campo.opciones.includes(o))) errores.push(`La condición de ${donde} usa opciones que ${seccion}.${condicion.campo} no tiene`);
    return undefined;
  };
  for (const seccion of definicion.secciones) {
    if (seccion.visibleSi) revisar(seccion.clave, seccion.visibleSi, seccion, true);
    for (const campo of seccion.campos) {
      if (campo.visibleSi) revisar(`${seccion.clave}.${campo.clave}`, campo.visibleSi, seccion, false);
      antes.set(`${seccion.clave}.${campo.clave}`, campo);
    }
  }
  return errores;
}

export const usaVisibilidad = (definicion: VersionFormato) => definicion.secciones.some((s) => s.visibleSi || s.campos.some((c) => c.visibleSi));
