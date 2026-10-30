import { z } from "zod";
import { DECIMAL_CANONICO, DOCUMENTO_DE_IDENTIDAD, HORA_HHMM, HUELLA_SHA256, ID_LINEA, ID_REPETICION, LIMITES, LIMITES_CANTIDADES, LIMITES_FIRMA } from "@teins/dominio";
import type * as dominio from "@teins/dominio";

/**
 * Forma de los datos del dominio en la frontera. Solo valida la estructura;
 * las reglas contra el formato las aplica `validarRespuestas` de `dominio`.
 */
export const Huella = z.string().regex(HUELLA_SHA256).meta({ id: "Huella", description: "SHA-256 en hexadecimal minúscula" });
export const Uuid = z.uuid();
export const Fecha = z.iso.datetime({ offset: true });
/** Hora del día como "HH:MM" (ADR-0050). */
export const Hora = z.string().regex(HORA_HHMM);

/** Línea de cantidad (F9): la forma; la regla 6 (cantidad positiva, unidad permitida) la aplica `dominio`. */
export const LineaCantidad = z
  .object({
    id: z.string().regex(ID_LINEA),
    descripcion: z.string().max(LIMITES_CANTIDADES.descripcion),
    cantidad: z.string().max(LIMITES.decimal),
    unidad: z.string().max(20),
    observacion: z.string().max(LIMITES_CANTIDADES.observacion).optional(),
    /** Ítem del catálogo que eligió el técnico (iteración 17, ADR-0025). */
    item: Uuid.optional(),
  })
  .strict()
  .meta({ id: "LineaCantidad" });

export const Valor = z
  .union([
    z.string().max(LIMITES.texto),
    z.object({ valor: z.string().regex(DECIMAL_CANONICO).max(LIMITES.decimal), unidad: z.string().min(1).max(20) }).strict(),
    z.array(Huella).max(LIMITES.fotosPorCampo).readonly(),
    /** Boceto (iteración 10): la huella de su archivo. */
    z.object({ boceto: Huella }).strict(),
    /** Cantidades (iteración 11): las líneas de la tabla. */
    z.array(LineaCantidad).max(LIMITES_CANTIDADES.lineas).readonly(),
    /** Firma del cliente (iteración 16, ADR-0024): la huella de sus trazos, quién, cuándo y qué leyó. */
    z
      .object({
        firma: Huella,
        nombre: z.string().max(LIMITES_FIRMA.nombre),
        cargo: z.string().max(LIMITES_FIRMA.cargo).optional(),
        firmadoEn: Fecha,
        declaracion: z.string().max(LIMITES_FIRMA.declaracion),
        /** Cédula de quien firmó, si el formato la pide (ADR-0050). */
        documento: z.string().regex(DOCUMENTO_DE_IDENTIDAD).optional(),
      })
      .strict(),
    /** Varias opciones elegidas y su «Otro» (ADR-0050): un objeto, para no confundirse con una lista de fotos. */
    z.object({ elegidas: z.array(z.string().min(1).max(LIMITES.opcion)).max(20).readonly(), otro: z.string().min(1).max(LIMITES.otro).optional() }).strict(),
    /** Hora de llegada y de salida (ADR-0050). */
    z.object({ desde: Hora, hasta: Hora.optional() }).strict(),
    z.object({ noObtenido: z.literal(true), motivo: z.string().max(LIMITES.motivo) }).strict(),
  ])
  .meta({ id: "Valor" });

const ClaveEsquema = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/);
/** Identificador de formato: admite guiones (`prueba-ups`); las claves de sección y campo no. */
export const IdFormato = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/);

/** Sección o repetición de una sección repetible: `tableros~k3f9x2ab` (iteración 9). */
export const ClaveDeRespuestas = z.string().regex(/^[a-z][a-z0-9_]{0,63}(~[a-z0-9]{8})?$/);

export const Respuestas = z.record(ClaveDeRespuestas, z.record(ClaveEsquema, Valor).readonly()).readonly().meta({ id: "Respuestas" });

/** Repeticiones de las secciones repetibles, en orden (iteración 9). La validación completa la hace `dominio`. */
export const Repeticiones = z
  .record(ClaveEsquema, z.array(z.object({ id: z.string().regex(ID_REPETICION), nombre: z.string().max(LIMITES.nombreDeRepeticion) }).strict()).max(LIMITES.repeticiones).readonly())
  .readonly()
  .meta({ id: "Repeticiones" });

/** Respuestas frecuentes de un campo, que se eligen con un toque (rediseño Recorrido). */
const ValoresComunes = z.array(z.string().min(1).max(40)).min(1).max(8).readonly();
/** Las opciones de una selección (ADR-0050): de 2 a 20, cada una de 1 a 60 caracteres. */
const Opciones = z.array(z.string().min(1).max(LIMITES.opcion)).min(2).max(20).readonly();
const CampoBase = { clave: ClaveEsquema, etiqueta: z.string().min(1).max(200), obligatorio: z.boolean().optional() };
export const DefinicionCampo = z.discriminatedUnion("tipo", [
  z.object({ ...CampoBase, tipo: z.literal("texto"), largo: z.boolean().optional(), valoresComunes: ValoresComunes.optional() }),
  z.object({ ...CampoBase, tipo: z.literal("medida"), unidades: z.array(z.string().min(1).max(20)).min(1).readonly(), valoresComunes: ValoresComunes.optional() }),
  z.object({ ...CampoBase, tipo: z.literal("opcion"), opciones: Opciones, otro: z.boolean().optional() }),
  z.object({ ...CampoBase, tipo: z.literal("opciones"), opciones: Opciones, otro: z.boolean().optional() }),
  z.object({ ...CampoBase, tipo: z.literal("horario") }),
  z.object({
    ...CampoBase,
    tipo: z.literal("foto"),
    min: z.int().min(0).max(LIMITES.fotosPorCampo).optional(),
    puestos: z.array(z.string().min(1).max(40)).min(1).max(LIMITES.fotosPorCampo).readonly().optional(),
    /** La foto lleva la franja de hora, ubicación y mapa (ADR-0052). Una app anterior la ignora, pero no recibe el formato (appMinima). */
    sello: z.object({ ubicacion: z.boolean().optional(), mapa: z.boolean().optional() }).optional(),
  }),
  z.object({ ...CampoBase, tipo: z.literal("boceto") }),
  z.object({ ...CampoBase, tipo: z.literal("cantidades"), unidades: z.array(z.string().min(1).max(20)).min(1).readonly() }),
  z.object({ ...CampoBase, tipo: z.literal("firma"), declaracion: z.string().min(1).max(LIMITES_FIRMA.declaracion).optional(), documento: z.enum(["opcional", "obligatorio"]).optional() }),
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
          /** Solo para la empresa (ADR-0039): no sale en el informe salvo que oficina la muestre. Una app anterior la ignora. */
          soloEmpresa: z.boolean().optional(),
          repetible: z
            .object({
              etiqueta: z.string().min(1).max(60),
              min: z.int().min(0).max(LIMITES.repeticiones).optional(),
              max: z.int().min(1).max(LIMITES.repeticiones).optional(),
            })
            .optional(),
          /** Mediciones por fase en filas y columnas (ADR-0050). Las reglas de fondo las aplica `validarDefinicionFormato`. */
          tablas: z
            .array(
              z.object({
                titulo: z.string().min(1).max(60).optional(),
                columnas: z.array(z.string().min(1).max(20)).min(1).max(4).readonly(),
                filas: z.array(z.object({ etiqueta: z.string().min(1).max(60), campos: z.array(ClaveEsquema).min(1).max(4).readonly() })).min(1).max(30).readonly(),
              }),
            )
            .max(4)
            .readonly()
            .optional(),
          campos: z.array(DefinicionCampo).readonly(),
        }),
      )
      .readonly(),
  })
  .meta({ id: "VersionFormato" });

/** Documento de un boceto (ADR-0019, ADR-0026), tal como lo entrega el servidor ya verificado. */
const PuntoBoceto = z.tuple([z.number(), z.number()]).readonly();
const ElementosBoceto = z
  .array(
    z.discriminatedUnion("tipo", [
      z.object({ tipo: z.literal("trazo"), grosor: z.number(), puntos: z.array(z.tuple([z.number(), z.number(), z.number()]).readonly()).readonly(), contorno: z.array(PuntoBoceto).readonly() }),
      z.object({ tipo: z.literal("linea"), grosor: z.number(), desde: PuntoBoceto, hasta: PuntoBoceto }),
      z.object({ tipo: z.literal("texto"), en: PuntoBoceto, texto: z.string(), tamano: z.number() }),
      // Versión 2 (ADR-0026).
      z.object({ tipo: z.literal("polilinea"), grosor: z.number(), puntos: z.array(PuntoBoceto).readonly(), cerrada: z.boolean() }),
      z.object({ tipo: z.literal("elipse"), grosor: z.number(), centro: PuntoBoceto, radios: PuntoBoceto, giro: z.number() }),
      z.object({ tipo: z.literal("cota"), grosor: z.number(), desde: PuntoBoceto, hasta: PuntoBoceto, texto: z.string() }),
      // Desde la app 10 (ADR-0027).
      z.object({
        tipo: z.literal("simbolo"),
        simbolo: z.string(),
        nombre: z.string(),
        trazado: z.string(),
        relleno: z.string().optional(),
        texto: z.string().optional(),
        codigo: z.string().optional(),
        centro: PuntoBoceto,
        tamano: z.number(),
        giro: z.number(),
      }),
    ]),
  )
  .readonly();
export const DocumentoBoceto = z
  .discriminatedUnion("version", [
    z.object({ formato: z.literal("teins-boceto"), version: z.literal(1), ancho: z.number(), alto: z.number(), cuadricula: z.number(), elementos: ElementosBoceto }),
    // Versión 2: hojas con nombre (ADR-0026).
    z.object({
      formato: z.literal("teins-boceto"),
      version: z.literal(2),
      cuadricula: z.number(),
      hojas: z.array(z.object({ nombre: z.string(), ancho: z.number(), alto: z.number(), elementos: ElementosBoceto })).readonly(),
    }),
  ])
  .meta({ id: "DocumentoBoceto" });

// Comprobaciones en compilación: lo que la frontera acepta es exactamente lo que el dominio usa.
type Asignable<A, B> = [A] extends [B] ? true : false;
const _respuestas: Asignable<z.output<typeof Respuestas>, dominio.Respuestas> = true;
const _repeticiones: Asignable<z.output<typeof Repeticiones>, dominio.Repeticiones> = true;
const _formato: Asignable<z.output<typeof VersionFormato>, dominio.VersionFormato> = true;
const _formatoInverso: Asignable<dominio.VersionFormato, z.input<typeof VersionFormato>> = true;
const _boceto: Asignable<z.output<typeof DocumentoBoceto>, dominio.DocumentoBoceto> = true;
void [_respuestas, _repeticiones, _formato, _formatoInverso, _boceto];
