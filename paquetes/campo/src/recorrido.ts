import { campoVisible, esDatoSimple, leerClave, seccionVisible, sinRespuestasHuerfanas, validarRespuestas, type DefinicionCampo, type DefinicionSeccion, type Respuestas, type VersionFormato } from "@teins/dominio";
import type { LevantamientoLocal } from "./datos/modelo";

/**
 * Un paso del recorrido. Cada sección da uno o más: los datos y las fotos van juntos; los materiales, el
 * boceto y la firma, cada uno en su propia pantalla (como en el prototipo aprobado). Una sección repetible
 * es un solo paso con sus tarjetas. Todo sale del formato (regla 6).
 */
export interface Paso {
  id: string;
  seccion: DefinicionSeccion;
  campos: readonly DefinicionCampo[];
  titulo: string;
}

/** Bocetos, cantidades y firmas ocupan su paso; las fotos van con los datos. */
const soloEnSuPaso = (c: DefinicionCampo) => !esDatoSimple(c) && c.tipo !== "foto";

/**
 * Con `respuestas`, sin lo oculto (ADR-0058): una sección oculta no da pasos y un paso sin campos visibles sale. Los pasos
 * se arman con todos los campos y después se filtran: así el id de un paso no cambia cuando algo aparece o desaparece.
 */
export function pasosDe(formato: VersionFormato, respuestas: Respuestas = {}): Paso[] {
  return todosLosPasos(formato).flatMap((p) => {
    if (!seccionVisible(p.seccion, respuestas)) return [];
    if (p.seccion.repetible) return [p];
    const campos = p.campos.filter((c) => campoVisible(c, p.seccion.clave, respuestas));
    return campos.length > 0 ? [{ ...p, campos }] : [];
  });
}

function todosLosPasos(formato: VersionFormato): Paso[] {
  const pasos: Paso[] = [];
  for (const seccion of formato.secciones) {
    if (seccion.repetible) {
      pasos.push({ id: seccion.clave, seccion, campos: seccion.campos, titulo: seccion.titulo });
      continue;
    }
    const grupos: DefinicionCampo[][] = [];
    for (const campo of seccion.campos) {
      const ultimo = grupos.at(-1);
      if (!soloEnSuPaso(campo) && ultimo && !soloEnSuPaso(ultimo[0]!)) ultimo.push(campo);
      else grupos.push([campo]);
    }
    grupos.forEach((campos, i) =>
      pasos.push({ id: `${seccion.clave}#${i}`, seccion, campos, titulo: grupos.length > 1 && soloEnSuPaso(campos[0]!) ? campos[0]!.etiqueta : seccion.titulo }),
    );
  }
  return pasos;
}

/** Cuántos pasos están hechos y cuál sigue, para la tarjeta de la visita en Mis visitas. */
export function resumenDeRecorrido(formato: VersionFormato, l: LevantamientoLocal) {
  const pasos = pasosDe(formato, l.respuestas);
  // Lo de un tablero quitado no cuenta: no se puede completar y no sale al enviar (iteración 42).
  const limpio = sinRespuestasHuerfanas(l);
  const errores = validarRespuestas(formato, limpio.respuestas, limpio.repeticiones);
  const hechos = pasos.map((p) => {
    const falta = errores.some((e) => leerClave(e.seccion).seccion === p.seccion.clave && (p.seccion.repetible || !e.campo || p.campos.some((c) => c.clave === e.campo)));
    const tocado = p.seccion.repetible ? (l.repeticiones?.[p.seccion.clave]?.length ?? 0) > 0 : p.campos.some((c) => l.respuestas[p.seccion.clave]?.[c.clave] !== undefined);
    return !falta && tocado;
  });
  return { pasos, hechos, siguiente: pasos.find((_, i) => !hechos[i]) };
}

/** Un título dentro de una frase («Siguiente: identificación del equipo»): baja solo la primera letra, nunca la de una sigla («UPS»). */
export const enFrase = (titulo: string) => (/^\p{Lu}{2}/u.test(titulo) ? titulo : titulo.charAt(0).toLowerCase() + titulo.slice(1));
