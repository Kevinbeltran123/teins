import { z } from "zod";
import { DECIMAL_CANONICO, HUELLA_SHA256, LIMITES } from "@teins/dominio";
import type * as dominio from "@teins/dominio";

/**
 * Forma de los datos del dominio en la frontera. Solo valida la estructura;
 * las reglas contra el formato las aplica `validarRespuestas` de `dominio`.
 */
export const Huella = z.string().regex(HUELLA_SHA256).meta({ id: "Huella", description: "SHA-256 en hexadecimal minúscula" });
export const Uuid = z.uuid();
export const Fecha = z.iso.datetime({ offset: true });

export const Valor = z
  .union([
    z.string().max(LIMITES.texto),
    z.object({ valor: z.string().regex(DECIMAL_CANONICO).max(40), unidad: z.string().min(1).max(20) }).strict(),
    z.array(Huella).max(LIMITES.fotosPorCampo),
    z.object({ noObtenido: z.literal(true), motivo: z.string().max(LIMITES.motivo) }).strict(),
  ])
  .meta({ id: "Valor" });

const ClaveEsquema = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/);

export const Respuestas = z.record(ClaveEsquema, z.record(ClaveEsquema, Valor)).meta({ id: "Respuestas" });

const CampoBase = { clave: ClaveEsquema, etiqueta: z.string().min(1).max(200), obligatorio: z.boolean().optional() };
export const DefinicionCampo = z.discriminatedUnion("tipo", [
  z.object({ ...CampoBase, tipo: z.literal("texto") }),
  z.object({ ...CampoBase, tipo: z.literal("medida"), unidades: z.array(z.string().min(1).max(20)).min(1).readonly() }),
  z.object({ ...CampoBase, tipo: z.literal("foto"), min: z.int().min(0).max(LIMITES.fotosPorCampo).optional() }),
]);

export const VersionFormato = z
  .object({
    formato: ClaveEsquema,
    version: z.int().positive(),
    secciones: z
      .array(z.object({ clave: ClaveEsquema, titulo: z.string().min(1).max(200), campos: z.array(DefinicionCampo).readonly() }))
      .readonly(),
  })
  .meta({ id: "VersionFormato" });

// Comprobaciones en compilación: lo que la frontera acepta es exactamente lo que el dominio usa.
type Asignable<A, B> = [A] extends [B] ? true : false;
const _respuestas: Asignable<z.output<typeof Respuestas>, dominio.Respuestas> = true;
const _formato: Asignable<z.output<typeof VersionFormato>, dominio.VersionFormato> = true;
const _formatoInverso: Asignable<dominio.VersionFormato, z.input<typeof VersionFormato>> = true;
void [_respuestas, _formato, _formatoInverso];
