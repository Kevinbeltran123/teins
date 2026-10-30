/** Formatos de texto que comparten varios módulos: una sola definición para que todos acepten lo mismo. */

/** Forma canónica que produce `normalizarDecimal`: sin ceros a la izquierda, punto decimal. */
export const DECIMAL_CANONICO = /^(0|[1-9]\d*)(\.\d+)?$/;

/** El mismo UUID que acepta `z.uuid()` en protocolo (versión 1 a 8, variante RFC, nulo y máximo): lo que pasa aquí nunca se rechaza al bajar. */
export const UUID = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;

/** Id corto y estable de una repetición o de una línea de cantidades. */
export const ID_CORTO = /^[a-z0-9]{8}$/;

/** Hora del día como "HH:MM", de 00:00 a 23:59 (horario de un campo). */
export const HORA_HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Cédula de ciudadanía: solo dígitos, de 5 a 12. */
export const DOCUMENTO_DE_IDENTIDAD = /^\d{5,12}$/;
