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
  /** Elementos por hoja. */
  elementos: 2_000,
  puntosPorTrazo: 4_000,
  texto: 200,
  /** Vértices de una polilínea (versión 2, ADR-0026). */
  puntosPorPolilinea: 200,
  /** Hojas de un boceto y largo de su nombre (versión 2): pisos, cuartos y detalles de un mismo sitio. */
  hojas: 12,
  nombreDeHoja: 60,
  /** Tamaño máximo del archivo del boceto. */
  bytes: 2_000_000,
} as const;

/** Cantidades (F9): una tabla por campo, con líneas cortas. */
export const LIMITES_CANTIDADES = {
  lineas: 200,
  descripcion: 200,
  observacion: 500,
} as const;
