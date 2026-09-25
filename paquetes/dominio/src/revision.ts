import type { VersionFormato } from "./formato";
import type { Respuestas, Valor } from "./levantamiento";
import { validarCampo, validarRespuestas, type ErrorValidacion } from "./validacion";

/** Estados del levantamiento después del envío (modelo de dominio, sección 5). */
export type EstadoRevision = "enviado" | "en_revision" | "revisado";

/** Quién tiene la revisión: solo esa persona corrige y marca revisado (regla 4, toma de revisión I-1). */
export interface Revision {
  estado: EstadoRevision;
  revisorId: string | null;
}

export type ResultadoToma =
  | { ok: true; revision: Revision; anterior: string | null }
  | { ok: false; motivo: "estado_invalido" | "ya_es_suya" }
  | { ok: false; motivo: "tomado_por_otro"; revisorId: string };

/**
 * Tomar para revisar. Si otra persona la tiene, solo se la quita pidiéndolo explícitamente
 * (`reasignar`), y el cambio de responsable queda registrado.
 */
export function tomarRevision(revision: Revision, actorId: string, reasignar: boolean): ResultadoToma {
  if (revision.estado === "enviado") return { ok: true, revision: { estado: "en_revision", revisorId: actorId }, anterior: null };
  if (revision.estado !== "en_revision") return { ok: false, motivo: "estado_invalido" };
  if (revision.revisorId === actorId) return { ok: false, motivo: "ya_es_suya" };
  if (!reasignar) return { ok: false, motivo: "tomado_por_otro", revisorId: revision.revisorId ?? "" };
  return { ok: true, revision: { estado: "en_revision", revisorId: actorId }, anterior: revision.revisorId };
}

export type MotivoSinPermiso = "estado_invalido" | "no_tomado";

/** Solo quien tomó la revisión edita, y solo mientras está en revisión (regla 4). */
export function puedeEditar(revision: Revision, actorId: string): MotivoSinPermiso | null {
  if (revision.estado !== "en_revision") return "estado_invalido";
  return revision.revisorId === actorId ? null : "no_tomado";
}

export interface Correccion {
  seccion: string;
  campo: string;
  /** `undefined` borra el dato. */
  valor: Valor | undefined;
}

/** Un cambio por campo, tal como lo registra la auditoría (QA-8). */
export interface CambioDeCampo {
  seccion: string;
  campo: string;
  anterior: Valor | undefined;
  nuevo: Valor | undefined;
}

export type ResultadoCorreccion = { ok: true; respuestas: Respuestas; cambios: CambioDeCampo[] } | { ok: false; errores: ErrorValidacion[] };

const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Aplica correcciones de oficina con las mismas reglas del envío (reglas 3 y 5). Devuelve solo los
 * campos que de verdad cambian: reescribir el mismo valor no es un cambio ni deja registro.
 * Las fotos no se corrigen desde oficina.
 */
export function corregir(formato: VersionFormato, respuestas: Respuestas, correcciones: readonly Correccion[]): ResultadoCorreccion {
  const errores: ErrorValidacion[] = [];
  const nuevas: Record<string, Record<string, Valor>> = Object.fromEntries(Object.entries(respuestas).map(([s, v]) => [s, { ...v }]));
  const cambios: CambioDeCampo[] = [];

  for (const { seccion, campo, valor } of correcciones) {
    const definicion = formato.secciones.find((s) => s.clave === seccion)?.campos.find((c) => c.clave === campo);
    if (!definicion) {
      errores.push({ seccion, campo, codigo: "campo_desconocido" });
      continue;
    }
    if (definicion.tipo === "foto") {
      errores.push({ seccion, campo, codigo: "no_corregible" });
      continue;
    }
    const codigo = validarCampo(definicion, valor);
    if (codigo) {
      errores.push({ seccion, campo, codigo });
      continue;
    }
    const anterior = nuevas[seccion]?.[campo];
    if (igual(anterior, valor)) continue;
    const valores = (nuevas[seccion] ??= {});
    if (valor === undefined) delete valores[campo];
    else valores[campo] = valor;
    cambios.push({ seccion, campo, anterior, nuevo: valor });
  }
  return errores.length > 0 ? { ok: false, errores } : { ok: true, respuestas: nuevas, cambios };
}

export type ResultadoMarca = { ok: true; revision: Revision } | { ok: false; motivo: MotivoSinPermiso } | { ok: false; motivo: "respuestas_invalidas"; errores: ErrorValidacion[] };

/** Marcar revisado: quien tiene la revisión, con respuestas válidas contra su formato. */
export function marcarRevisado(revision: Revision, actorId: string, formato: VersionFormato, respuestas: Respuestas): ResultadoMarca {
  const motivo = puedeEditar(revision, actorId);
  if (motivo) return { ok: false, motivo };
  const errores = validarRespuestas(formato, respuestas);
  if (errores.length > 0) return { ok: false, motivo: "respuestas_invalidas", errores };
  return { ok: true, revision: { estado: "revisado", revisorId: actorId } };
}
