import type { Levantamiento, VersionFormato } from "@teins/dominio";
import type { EnviarLevantamiento, VisitaAsignada } from "@teins/protocolo";

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

/**
 * Resultado real del último contacto con el servidor. navigator.onLine no basta: dice "en línea"
 * con una red sin internet, un portal cautivo o una señal que no alcanza.
 */
export interface EstadoRed {
  alcanzable: boolean;
  desde: string;
}

/** Versión de formato recibida en la bajada (ADR-0006). Inmutable: se guarda tal cual llegó. */
export type FormatoLocal = VersionFormato;

/**
 * Visita asignada, por técnico: en un teléfono compartido cada uno ve las suyas. Si se reasigna y el
 * técnico ya empezó levantamientos en ella, se conserva marcada para que pueda terminarlos (regla 17).
 */
export type VisitaLocal = VisitaAsignada & {
  tecnicoId: string;
  fueraDeAlcance?: true;
  /** Por qué salió (desde la iteración 7); sin él, se trata como reasignada. */
  motivoSalida?: "reasignada" | "cancelada";
};

/** Nota de oficina sobre un levantamiento enviado (corte 3). No modifica datos. */
export interface ComentarioDeOficina {
  id: string;
  texto: string;
  seccion?: string | undefined;
  campo?: string | undefined;
  autor: string;
  creadoEn: string;
}

/** Estado de negocio de un levantamiento propio según el servidor. Distinto del estado de envío. */
export interface EstadoServidor {
  id: string;
  tecnicoId: string;
  estado: "enviado" | "en_revision" | "revisado";
  recibidoEn: string;
  /** Sin índice: agregar el campo no exige una versión nueva de la base local. */
  comentarios?: ComentarioDeOficina[] | undefined;
}

/** Avance de la bajada de un técnico y su permiso de trabajo sin conexión (ADR-0009, parte 2). */
export interface BajadaLocal {
  tecnicoId: string;
  puntoDeControl: number;
  /** Versión de la app con que se bajó hasta ese punto: si cambia, se baja desde cero (ADR-0015, punto 4). */
  versionApp: number;
  ultimaEn?: string | undefined;
  permisoLocalHasta: string;
  /** El servidor rechazó la sesión y no hay orden de borrado: hay que iniciar sesión. */
  sesionVencida?: boolean | undefined;
}

/** Identidad del teléfono ante el servidor. El secreto autentica la consulta de órdenes de borrado. */
export interface DispositivoLocal {
  id: string;
  secreto: string;
}

export type Ajuste =
  | { clave: "usuario"; valor: UsuarioLocal }
  | { clave: "red"; valor: EstadoRed }
  | { clave: "dispositivo"; valor: DispositivoLocal }
  /** Se borraron los datos de un usuario revocado: la pantalla de inicio de sesión lo explica. */
  | { clave: "acceso_cerrado"; valor: { nombre: string; en: string } }
  /** Usuarios cuyos datos ya se borraron y falta avisarle al servidor. */
  | { clave: "borrados_por_confirmar"; valor: string[] };
