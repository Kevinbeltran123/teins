import type { VersionFormato } from "./formato";

/** Medida: el número va como texto decimal para no introducir errores de coma flotante (ADR-0006). */
export interface ValorMedida {
  valor: string;
  unidad: string;
}

/** Fotos: identificadores de archivo (huella SHA-256), nunca el binario (ADR-0007). */
export type ValorFotos = readonly string[];

export type Valor = string | ValorMedida | ValorFotos;

export type EstadoLevantamiento = "borrador";

export interface Levantamiento {
  id: string;
  formato: string;
  versionFormato: number;
  estado: EstadoLevantamiento;
  /** Respuestas por clave de sección y clave de campo. */
  respuestas: Record<string, Record<string, Valor>>;
  /** Hora del dispositivo (regla 16); la oficial la pone el servidor al recibirlo. */
  creadoEn: string;
  actualizadoEn: string;
}

export function crearLevantamiento(formato: VersionFormato, id: string, ahora: Date): Levantamiento {
  const fecha = ahora.toISOString();
  return {
    id,
    formato: formato.formato,
    versionFormato: formato.version,
    estado: "borrador",
    respuestas: {},
    creadoEn: fecha,
    actualizadoEn: fecha,
  };
}
