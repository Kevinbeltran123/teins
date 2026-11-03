import { createContext } from "react";

/** El campo ocupa su propio paso del recorrido: la firma pone ahí su acción (prototipo aprobado). */
export const PasoPropio = createContext(false);

/**
 * Cada escritura en el teléfono pasa por aquí: si una falla (almacenamiento lleno, por ejemplo), la captura lo dice
 * hasta que la siguiente funcione. Sin esto, el técnico seguiría escribiendo en algo que no se guarda.
 */
export const VigilarGuardado = createContext<(escritura: Promise<unknown>) => void>(() => undefined);
/**
 * La llegada que se sugiere en un campo de horario (ADR-0050): la hora de la foto de llegada o, sin foto, la del
 * inicio del levantamiento. Solo se sugiere; el técnico decide si la usa.
 */
export const SugerenciaDeLlegada = createContext<{ hora: string; texto: string } | undefined>(undefined);
/** Ancla de un dato en la pantalla: el resumen de errores y el chat (en «Ver lo que enviaste») llevan hasta él. */
export const anclaDeDato = (seccion: string, campo: string) => `dato-${seccion}-${campo}`.replace(/[^a-zA-Z0-9_-]/g, "");
/** Ancla de una sección repetible: los errores sin dato (faltan repeticiones) llevan a su lista. */
export const anclaDeSeccion = (seccion: string) => `seccion-${seccion}`;

/**
 * Nombre de transición de la cabecera de la captura (iteración 27): el mismo que la tarjeta de su visita en el inicio,
 * para que la tarjeta se convierta en la cabecera. Entre pasos se queda; solo se desliza el cuerpo.
 */
export const CabeceraDeLaVisita = createContext<string | undefined>(undefined);
