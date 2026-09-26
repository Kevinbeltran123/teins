/** Límites compartidos por el dispositivo y el servidor. */
export const LIMITES = {
  texto: 10_000,
  motivo: 500,
  fotosPorCampo: 100,
  /** Repeticiones por sección repetible, si el formato no pide menos. */
  repeticiones: 50,
  nombreDeRepeticion: 120,
} as const;

/** Bocetos (ADR-0019): suficiente para un croquis de campo, acotado para el teléfono y el servidor. */
export const LIMITES_BOCETO = {
  elementos: 2_000,
  puntosPorTrazo: 4_000,
  texto: 200,
  /** Tamaño máximo del archivo del boceto. */
  bytes: 2_000_000,
} as const;
