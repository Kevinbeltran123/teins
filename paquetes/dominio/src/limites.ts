/** Límites compartidos por el dispositivo y el servidor. */
export const LIMITES = {
  texto: 10_000,
  motivo: 500,
  fotosPorCampo: 100,
  /** Repeticiones por sección repetible, si el formato no pide menos. */
  repeticiones: 50,
  nombreDeRepeticion: 120,
} as const;
