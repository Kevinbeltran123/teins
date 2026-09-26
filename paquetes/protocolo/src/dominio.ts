import { z } from "zod";
import { DECIMAL_CANONICO, HUELLA_SHA256, ID_REPETICION, LIMITES } from "@teins/dominio";
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
    z.array(Huella).max(LIMITES.fotosPorCampo).readonly(),
    /** Boceto (iteración 10): la huella de su archivo. */
    z.object({ boceto: Huella }).strict(),
    z.object({ noObtenido: z.literal(true), motivo: z.string().max(LIMITES.motivo) }).strict(),
  ])
  .meta({ id: "Valor" });

const ClaveEsquema = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/);
/** Identificador de formato: admite guiones (`prueba-ups`); las claves de sección y campo no. */
const IdFormato = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/);

/** Sección o repetición de una sección repetible: `tableros~k3f9x2ab` (iteración 9). */
export const ClaveDeRespuestas = z.string().regex(/^[a-z][a-z0-9_]{0,63}(~[a-z0-9]{8})?$/);

export const Respuestas = z.record(ClaveDeRespuestas, z.record(ClaveEsquema, Valor).readonly()).readonly().meta({ id: "Respuestas" });

/** Repeticiones de las secciones repetibles, en orden (iteración 9). La validación completa la hace `dominio`. */
export const Repeticiones = z
  .record(ClaveEsquema, z.array(z.object({ id: z.string().regex(ID_REPETICION), nombre: z.string().max(LIMITES.nombreDeRepeticion) }).strict()).max(LIMITES.repeticiones).readonly())
  .readonly()
  .meta({ id: "Repeticiones" });

const CampoBase = { clave: ClaveEsquema, etiqueta: z.string().min(1).max(200), obligatorio: z.boolean().optional() };
export const DefinicionCampo = z.discriminatedUnion("tipo", [
  z.object({ ...CampoBase, tipo: z.literal("texto") }),
  z.object({ ...CampoBase, tipo: z.literal("medida"), unidades: z.array(z.string().min(1).max(20)).min(1).readonly() }),
  z.object({ ...CampoBase, tipo: z.literal("foto"), min: z.int().min(0).max(LIMITES.fotosPorCampo).optional() }),
  z.object({ ...CampoBase, tipo: z.literal("boceto") }),
]);

export const VersionFormato = z
  .object({
    formato: IdFormato,
    version: z.int().positive(),
    nombre: z.string().min(1).max(120).optional(),
    appMinima: z.int().positive().optional(),
    secciones: z
      .array(
        z.object({
          clave: ClaveEsquema,
          titulo: z.string().min(1).max(200),
          repetible: z
            .object({
              etiqueta: z.string().min(1).max(60),
              min: z.int().min(0).max(LIMITES.repeticiones).optional(),
              max: z.int().min(1).max(LIMITES.repeticiones).optional(),
            })
            .optional(),
          campos: z.array(DefinicionCampo).readonly(),
        }),
      )
      .readonly(),
  })
  .meta({ id: "VersionFormato" });

/** Documento de un boceto (ADR-0019), tal como lo entrega el servidor ya verificado. */
const PuntoBoceto = z.tuple([z.number(), z.number()]).readonly();
export const DocumentoBoceto = z
  .object({
    formato: z.literal("teins-boceto"),
    version: z.literal(1),
    ancho: z.number(),
    alto: z.number(),
    cuadricula: z.number(),
    elementos: z
      .array(
        z.discriminatedUnion("tipo", [
          z.object({ tipo: z.literal("trazo"), grosor: z.number(), puntos: z.array(z.tuple([z.number(), z.number(), z.number()]).readonly()).readonly(), contorno: z.array(PuntoBoceto).readonly() }),
          z.object({ tipo: z.literal("linea"), grosor: z.number(), desde: PuntoBoceto, hasta: PuntoBoceto }),
          z.object({ tipo: z.literal("texto"), en: PuntoBoceto, texto: z.string(), tamano: z.number() }),
        ]),
      )
      .readonly(),
  })
  .meta({ id: "DocumentoBoceto" });

// Comprobaciones en compilación: lo que la frontera acepta es exactamente lo que el dominio usa.
type Asignable<A, B> = [A] extends [B] ? true : false;
const _respuestas: Asignable<z.output<typeof Respuestas>, dominio.Respuestas> = true;
const _repeticiones: Asignable<z.output<typeof Repeticiones>, dominio.Repeticiones> = true;
const _formato: Asignable<z.output<typeof VersionFormato>, dominio.VersionFormato> = true;
const _formatoInverso: Asignable<dominio.VersionFormato, z.input<typeof VersionFormato>> = true;
const _boceto: Asignable<z.output<typeof DocumentoBoceto>, dominio.DocumentoBoceto> = true;
void [_respuestas, _repeticiones, _formato, _formatoInverso, _boceto];
