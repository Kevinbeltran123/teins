import type { Levantamiento, Valor } from "@teins/dominio";

/** Archivo guardado en el dispositivo. El identificador es su huella SHA-256 (ADR-0007). */
export interface ArchivoLocal {
  id: string;
  /** ArrayBuffer y no Blob: es lo más estable en IndexedDB de Safari; lo valida la prueba del corte 0. */
  datos: ArrayBuffer;
  tipo: string;
  creadoEn: string;
}

/** Puerto de ADR-0004: la lógica de captura no conoce Dexie. */
export interface RepositorioLevantamientos {
  crear(levantamiento: Levantamiento): Promise<void>;
  obtener(id: string): Promise<Levantamiento | undefined>;
  listar(): Promise<Levantamiento[]>;
  /** `undefined` borra la respuesta. */
  guardarRespuesta(id: string, seccion: string, campo: string, valor: Valor | undefined, ahora: Date): Promise<void>;
  /** Guarda el archivo y su referencia en la misma transacción: nunca queda una foto sin referencia. */
  agregarFoto(id: string, seccion: string, campo: string, archivo: ArchivoLocal, ahora: Date): Promise<void>;
  obtenerArchivos(ids: readonly string[]): Promise<ArchivoLocal[]>;
  todosLosArchivos(): Promise<ArchivoLocal[]>;
}
