/** Formatos de texto que comparten varios módulos: una sola definición para que todos acepten lo mismo. */

/** Forma canónica que produce `normalizarDecimal`: sin ceros a la izquierda, punto decimal. */
export const DECIMAL_CANONICO = /^(0|[1-9]\d*)(\.\d+)?$/;

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Id corto y estable de una repetición o de una línea de cantidades. */
export const ID_CORTO = /^[a-z0-9]{8}$/;
