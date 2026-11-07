import {
  aDecimalColombiano,
  bloques,
  campoVisible,
  describirValor,
  esBoceto,
  esCantidades,
  esDatoSimple,
  esFirma,
  esNoObtenido,
  seccionVisible,
  sinRespuestasHuerfanas,
  validarRespuestas,
  type DefinicionCampo,
  type DefinicionSeccion,
  type Valor,
  type ValorCantidades,
  type VersionFormato,
} from "@teins/dominio";
import type { LevantamientoLocal } from "./datos/modelo";
import type { Paso } from "./recorrido";

export const claveDeError = (seccion: string, campo: string) => `${seccion}.${campo}`;

/** Panel por grupo (DESIGN.md): campos de datos seguidos juntos; cada campo de fotos, bocetos o cantidades aparte. */
export function agrupar(campos: readonly DefinicionCampo[]): DefinicionCampo[][] {
  const grupos: DefinicionCampo[][] = [];
  const solo = (c: DefinicionCampo) => !esDatoSimple(c);
  for (const campo of campos) {
    const ultimo = grupos.at(-1);
    if (!solo(campo) && ultimo && !solo(ultimo[0]!)) ultimo.push(campo);
    else grupos.push([campo]);
  }
  return grupos;
}

/**
 * Cuánto falta para poder enviar, con la misma validación del envío (dominio): no hay una regla aparte que
 * pueda decir "listo" cuando el envío diría que no.
 */
export function progreso(formato: VersionFormato, l: LevantamientoLocal) {
  // Las respuestas de un tablero quitado no se pueden completar ni salen al enviar (iteración 42).
  const limpio = sinRespuestasHuerfanas(l);
  const errores = validarRespuestas(formato, limpio.respuestas, limpio.repeticiones);
  const conError = new Set(errores.map((e) => claveDeError(e.seccion, e.campo ?? "")));
  let obligatorios = 0;
  let completos = 0;
  for (const b of bloques(formato, l.repeticiones ?? {})) {
    // Lo oculto no se exige (ADR-0058): no cuenta en el avance.
    if (!seccionVisible(b.seccion, limpio.respuestas)) continue;
    for (const c of b.seccion.campos) {
      if (!c.obligatorio || !campoVisible(c, b.clave, limpio.respuestas)) continue;
      obligatorios++;
      if (!conError.has(claveDeError(b.clave, c.clave))) completos++;
    }
  }
  return { errores, obligatorios, completos };
}

/** Los datos que resumen una repetición en su tarjeta: los tres primeros que tienen valor y se leen en una línea. */
export function datosDeResumen(seccion: DefinicionSeccion, respuestas: Record<string, Valor> | undefined) {
  const legibles = seccion.campos.filter(esDatoSimple);
  return legibles
    .filter((c) => respuestas?.[c.clave] !== undefined && !esNoObtenido(respuestas[c.clave]))
    .slice(0, 3)
    // Etiqueta corta en la tarjeta ("Corriente nominal" → "Corriente"); una cuenta sin unidad ("12 und" → "12").
    .map((c) => ({ etiqueta: c.etiqueta.split(" ")[0]!, valor: describirValor(c, respuestas?.[c.clave]).replace(/ und$/, "") }));
}

/** "Cable UTP × 120 m · Breaker × 4 · 2 más". */
function lineasEnTexto(lineas: ValorCantidades): string {
  if (lineas.length === 0) return "Sin materiales";
  const primeras = lineas.slice(0, 2).map((l) => `${l.descripcion} × ${aDecimalColombiano(l.cantidad)}${l.unidad === "und" ? "" : ` ${l.unidad}`}`);
  return [...primeras, ...(lineas.length > 2 ? [`${lineas.length - 2} más`] : [])].join(" · ");
}

/** Lo que lleva un paso, en una línea, para el repaso antes de enviar (iteración 32). */
export function resumenDePaso(p: Paso, l: LevantamientoLocal): string {
  if (p.seccion.repetible) {
    const lista = l.repeticiones?.[p.seccion.clave] ?? [];
    return lista.length === 0 ? `Ningún ${p.seccion.repetible.etiqueta.toLowerCase()}` : `${lista.length} · ${lista.map((r) => r.nombre).join(", ")}`;
  }
  const partes = p.campos.flatMap((c) => {
    const v = l.respuestas[p.seccion.clave]?.[c.clave];
    if (v === undefined) return [];
    if (c.tipo === "cantidades" && esCantidades(v)) return [lineasEnTexto(v)];
    if (esFirma(v)) return [`${v.nombre}${v.cargo ? ` · ${v.cargo}` : ""}`];
    if (esBoceto(v)) return ["Dibujado"];
    return [describirValor(c, v)];
  });
  return partes.length > 0 ? partes.slice(0, 3).join(" · ") : "Sin datos";
}

/** Fotos, repeticiones y materiales: lo que se envía en números, solo lo que el formato tiene. */
export function cifrasDelBorrador(pasos: readonly Paso[], l: LevantamientoLocal, fotos: number) {
  const cifras = [{ valor: fotos, texto: fotos === 1 ? "foto" : "fotos" }];
  for (const p of pasos)
    if (p.seccion.repetible) cifras.push({ valor: l.repeticiones?.[p.seccion.clave]?.length ?? 0, texto: p.seccion.titulo.toLowerCase() });
  const lineas = pasos.flatMap((p) => p.campos.filter((c) => c.tipo === "cantidades").map((c) => l.respuestas[p.seccion.clave]?.[c.clave]));
  if (lineas.length > 0) {
    const total = lineas.reduce<number>((suma, v) => suma + (esCantidades(v) ? v.length : 0), 0);
    cifras.push({ valor: total, texto: total === 1 ? "material" : "materiales" });
  }
  return cifras.slice(0, 3);
}
