import type { DocumentoBoceto, Levantamiento, ResultadoEnvio, Valor, VersionFormato } from "@teins/dominio";
import type { ArchivoLocal, LevantamientoLocal } from "./modelo";

export type { ArchivoLocal, LevantamientoLocal } from "./modelo";

/** Archivo recién capturado: aún no se sube. */
export type ArchivoNuevo = Omit<ArchivoLocal, "subida" | "ultimoErrorDeSubida">;

/** Puerto de ADR-0004: la lógica de captura no conoce Dexie. */
export interface RepositorioLevantamientos {
  crear(levantamiento: Levantamiento, tecnicoId: string): Promise<void>;
  obtener(id: string): Promise<LevantamientoLocal | undefined>;
  /** Levantamientos de un técnico, del más reciente al más antiguo. */
  listar(tecnicoId: string): Promise<LevantamientoLocal[]>;
  /** Cuántos levantamientos del teléfono son de otras personas: se conservan, no se muestran. */
  contarDeOtros(tecnicoId: string): Promise<number>;
  /** Los levantamientos del corte 0 no tenían responsable: pasan a quien inicia sesión primero. */
  asignarSinResponsable(tecnicoId: string): Promise<void>;
  /** `undefined` borra la respuesta. */
  guardarRespuesta(id: string, seccion: string, campo: string, valor: Valor | undefined, ahora: Date): Promise<void>;
  /** Secciones repetibles (iteración 9): agrega al final, con el primer nombre libre ("Tablero 3"). */
  agregarRepeticion(id: string, formato: VersionFormato, seccion: string, ahora: Date): Promise<void>;
  renombrarRepeticion(id: string, seccion: string, repeticion: string, nombre: string, ahora: Date): Promise<void>;
  /** Quita la repetición con sus respuestas. */
  quitarRepeticion(id: string, seccion: string, repeticion: string, ahora: Date): Promise<void>;
  /**
   * Bocetos (iteración 10): el documento se guarda como archivo por su huella y la respuesta apunta a él,
   * en una transacción. La versión anterior se borra si nada más la usa. No sube hasta enviar (ADR-0019).
   */
  guardarBoceto(id: string, seccion: string, campo: string, documento: DocumentoBoceto, ahora: Date): Promise<void>;
  obtenerBoceto(huella: string): Promise<DocumentoBoceto | null>;
  /** Guarda el archivo y su referencia en la misma transacción: nunca queda una foto sin referencia. */
  agregarFoto(id: string, seccion: string, campo: string, archivo: ArchivoNuevo, ahora: Date): Promise<void>;
  obtenerArchivos(ids: readonly string[]): Promise<ArchivoLocal[]>;
  todosLosArchivos(): Promise<ArchivoLocal[]>;
  /** Todos los levantamientos del teléfono, de cualquier responsable: solo para el diagnóstico. */
  todos(): Promise<LevantamientoLocal[]>;
  /**
   * Borrador → Enviado y comando al outbox, en una transacción: si la app se cierra en medio,
   * o queda todo o no queda nada (ADR-0018, nivel 3: cierre entre guardar y encolar).
   */
  enviar(id: string, formato: VersionFormato, ahora: Date): Promise<ResultadoEnvio>;
  /** Un envío con error permanente vuelve a la cola cuando el técnico lo pide. */
  reintentarEnvio(id: string): Promise<void>;
}
