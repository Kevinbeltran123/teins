import type { Levantamiento } from "@teins/dominio";
import type { EnviarLevantamiento } from "@teins/protocolo";

/**
 * Levantamiento en el dispositivo, con su responsable (regla 1). Un teléfono puede compartirse:
 * solo se envía con la sesión de quien lo creó. Los del corte 0 no tienen responsable hasta el primer inicio de sesión.
 */
export type LevantamientoLocal = Levantamiento & { tecnicoId?: string | undefined };

/** Archivo guardado en el dispositivo. El identificador es su huella SHA-256 (ADR-0007). */
export interface ArchivoLocal {
  id: string;
  /** ArrayBuffer y no Blob: es lo más estable en IndexedDB de Safari; lo validó la prueba del corte 0. */
  datos: ArrayBuffer;
  tipo: string;
  creadoEn: string;
  /** Las fotos suben por adelantado cuando hay señal (ADR-0003); este estado vive solo aquí. */
  subida: "pendiente" | "subida";
  ultimoErrorDeSubida?: string | undefined;
}

/**
 * Estado de sincronización de un envío. Es distinto del estado de negocio del levantamiento
 * y vive solo en el dispositivo (modelo de dominio, sección 5).
 */
export type EstadoEnvio =
  | "pendiente"
  | "enviando"
  | "recibido"
  /** Error permanente: no se reintenta solo; se muestra al técnico. */
  | "error"
  /** La sesión venció o se cerró: se reanuda al iniciar sesión. */
  | "requiere_sesion"
  /** El servidor ya no acepta esta versión de la app: se reanuda al actualizar (ADR-0015). */
  | "requiere_actualizar";

/** Comando en el outbox local (ADR-0003). Se guarda completo al enviar: es inmutable. */
export interface EnvioLocal {
  levantamientoId: string;
  tecnicoId: string;
  comando: EnviarLevantamiento;
  estado: EstadoEnvio;
  intentos: number;
  /** Milisegundos desde época: el envío no se intenta antes. */
  proximoIntentoEn: number;
  ultimoError?: { codigo: string; mensaje: string } | undefined;
  recibidoEn?: string;
  creadoEn: string;
}

export interface UsuarioLocal {
  id: string;
  nombre: string;
  rol: "tecnico" | "oficina";
}

export interface Ajuste {
  clave: "usuario";
  valor: UsuarioLocal;
}
