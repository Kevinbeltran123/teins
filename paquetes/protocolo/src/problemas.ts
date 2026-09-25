import { z } from "zod";
import { Huella } from "./dominio";

/** Códigos del dominio para errores en formato Problem Details (RFC 9457, ADR-0014). */
export const ESTADO_POR_CODIGO = {
  entrada_invalida: 400,
  no_autenticado: 401,
  sin_permiso: 403,
  no_encontrado: 404,
  conflicto: 409,
  /** Otra persona guardó antes sobre la misma versión (QA-25). */
  conflicto_de_version: 409,
  /** La revisión la tiene otra persona; quitársela exige pedirlo (I-1). */
  tomado_por_otro: 409,
  /** La acción no aplica en el estado actual del levantamiento. */
  estado_invalido: 409,
  /** Solo quien tomó la revisión edita (regla 4). */
  no_tomado: 403,
  archivos_faltantes: 409,
  archivos_en_verificacion: 409,
  archivo_demasiado_grande: 413,
  tipo_de_archivo_no_permitido: 415,
  respuestas_invalidas: 422,
  formato_desconocido: 422,
  version_protocolo_no_soportada: 426,
  demasiadas_solicitudes: 429,
  error_interno: 500,
} as const;

export type CodigoProblema = keyof typeof ESTADO_POR_CODIGO;
export const CodigoProblema = z.enum(Object.keys(ESTADO_POR_CODIGO) as [CodigoProblema, ...CodigoProblema[]]);

/** Qué puede hacer un cliente ante cada código. Lo usa el outbox de campo para decidir si reintenta. */
export const REINTENTABLE: Readonly<Record<CodigoProblema, boolean>> = {
  entrada_invalida: false,
  no_autenticado: false,
  sin_permiso: false,
  no_encontrado: false,
  conflicto: false,
  conflicto_de_version: false,
  tomado_por_otro: false,
  estado_invalido: false,
  no_tomado: false,
  archivos_faltantes: true,
  archivos_en_verificacion: true,
  archivo_demasiado_grande: false,
  tipo_de_archivo_no_permitido: false,
  respuestas_invalidas: false,
  formato_desconocido: false,
  version_protocolo_no_soportada: false,
  demasiadas_solicitudes: true,
  error_interno: true,
};

export const ErrorValidacion = z.object({ seccion: z.string(), campo: z.string().optional(), codigo: z.string() });

export const Problema = z
  .object({
    type: z.string(),
    title: z.string(),
    status: z.int(),
    detail: z.string().optional(),
    codigo: CodigoProblema,
    correlacion: z.string().optional(),
    faltantes: z.array(Huella).optional(),
    pendientes: z.array(Huella).optional(),
    errores: z.array(ErrorValidacion).optional(),
    versionMinima: z.int().optional(),
    /** Versión vigente cuando hay conflicto: la persona recarga y vuelve a intentar. */
    versionActual: z.int().optional(),
    revisor: z.object({ id: z.string(), nombre: z.string() }).optional(),
    reintentarEnSegundos: z.int().optional(),
    campos: z.array(z.object({ ruta: z.string(), mensaje: z.string() })).optional(),
  })
  .meta({ id: "Problema" });
export type Problema = z.infer<typeof Problema>;

export const TIPO_PROBLEMA = "application/problem+json";
export const tipoDeProblema = (codigo: CodigoProblema) => `urn:teins:problema:${codigo}`;
