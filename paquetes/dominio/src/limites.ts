/** Límites compartidos por el dispositivo y el servidor. */
export const LIMITES = {
  texto: 10_000,
  motivo: 500,
  fotosPorCampo: 100,
  /** Repeticiones por sección repetible, si el formato no pide menos. */
  repeticiones: 50,
  nombreDeRepeticion: 120,
  /** Caracteres de un decimal (medida, cantidad): los mismos que recibe protocolo, para que el teléfono no deje salir otro. */
  decimal: 40,
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
  /**
   * Tamaño máximo del archivo del boceto, el mismo de una foto (iteración 42). Con 2 MB, unos 370 trazos a mano
   * alzada lo pasaban y el envío quedaba rechazado para siempre; el teléfono lo mide antes de enviar.
   */
  bytes: 10 * 1024 * 1024,
} as const;

/** Símbolos de los bocetos (iteración 19, ADR-0027): una biblioteca por organización. */
export const LIMITES_SIMBOLO = {
  nombre: 60,
  categoria: 40,
  /** Largo del trazado SVG, en caracteres. */
  trazado: 2_000,
  /** La sigla del centro ("UPS", "kWh"). */
  texto: 4,
  codigo: 40,
  porBiblioteca: 300,
  /** Tamaño de un símbolo en la hoja, en unidades del lienzo. */
  tamanoMinimo: 10,
  tamanoMaximo: 1_000,
} as const;

/** Cantidades (F9): una tabla por campo, con líneas cortas. */
export const LIMITES_CANTIDADES = {
  lineas: 200,
  descripcion: 200,
  observacion: 500,
} as const;
