import type { VersionFormato } from "./formato";
import type { Levantamiento } from "./levantamiento";
import { validarRespuestas, type ErrorValidacion } from "./validacion";

export type ResultadoEnvio =
  | { ok: true; levantamiento: Levantamiento }
  | { ok: false; motivo: "no_es_borrador" | "formato_distinto" }
  | { ok: false; motivo: "respuestas_invalidas"; errores: readonly ErrorValidacion[] };

/** Borrador → Enviado. Después del envío el técnico ya no edita (regla 4). */
export function enviarLevantamiento(levantamiento: Levantamiento, formato: VersionFormato, ahora: Date): ResultadoEnvio {
  if (levantamiento.estado !== "borrador") return { ok: false, motivo: "no_es_borrador" };
  if (levantamiento.formato !== formato.formato || levantamiento.versionFormato !== formato.version) {
    return { ok: false, motivo: "formato_distinto" };
  }
  const errores = validarRespuestas(formato, levantamiento.respuestas);
  if (errores.length > 0) return { ok: false, motivo: "respuestas_invalidas", errores };
  return { ok: true, levantamiento: { ...levantamiento, estado: "enviado", enviadoEn: ahora.toISOString() } };
}
