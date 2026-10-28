import type { DefinicionSimbolo, Levantamiento, Repeticiones, Respuestas, VersionFormato } from "@teins/dominio";
import type { EnviarLevantamiento, VisitaAsignada } from "@teins/protocolo";

/** Un valor cifrado con AES-GCM (ADR-0022): el vector de inicio y el texto cifrado con su etiqueta. */
export interface Sellado {
  iv: Uint8Array;
  datos: ArrayBuffer;
}

/** Clave de un técnico en este teléfono: no extraíble, nunca sale del navegador (ADR-0009, parte 5). */
export interface ClaveLocal {
  tecnicoId: string;
  clave: CryptoKey;
  creadaEn: string;
}

/**
 * Levantamiento en el dispositivo, con su responsable (regla 1). Un teléfono puede compartirse:
 * solo se envía con la sesión de quien lo creó. Los del corte 0 no tienen responsable hasta el primer inicio de sesión.
 */
export type LevantamientoLocal = Levantamiento & {
  tecnicoId?: string | undefined;
  /**
   * Descartado por el técnico (ADR-0035): sale de Mis visitas y queda en la papelera del teléfono, de donde se recupera
   * durante 30 días; después se borra con sus fotos. A la vista, sin sellar: la papelera no necesita abrirlo.
   */
  descartadoEn?: string | undefined;
  /**
   * Cliente y sitio de su visita, copiados al crearlo o al enviarlo (iteración 42): la visita atendida sale del teléfono
   * al día siguiente (ADR-0041) y lo enviado sigue diciendo dónde fue. Va sellado con las respuestas.
   */
  lugar?: LugarDeVisita | undefined;
};

export interface LugarDeVisita {
  cliente: string;
  sitio: string;
}

/** Días que un levantamiento descartado se puede recuperar antes de borrarse del teléfono (ADR-0035). */
export const DIAS_EN_LA_PAPELERA = 30;

/**
 * Como se guarda (ADR-0022): respuestas, repeticiones y lugar van sellados; a la vista queda lo que necesitan
 * los índices y las transacciones (ids, estado, fechas, responsable y las huellas de sus archivos).
 * Sin `sellado`, es un registro de antes del cifrado o sin responsable todavía: se sella al conocerlo.
 */
export type LevantamientoGuardado = Omit<LevantamientoLocal, "respuestas" | "repeticiones" | "lugar"> & {
  respuestas?: Respuestas | undefined;
  repeticiones?: Repeticiones | undefined;
  lugar?: LugarDeVisita | undefined;
  sellado?: Sellado | undefined;
  /** Huellas de todos sus archivos y solo de sus fotos: para subir y borrar sin abrir el sellado. */
  archivos?: string[] | undefined;
  fotos?: string[] | undefined;
  /** Sube con cada escritura: la escritura optimista fuera de la transacción la compara. */
  rev?: number | undefined;
};

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

/** Como se guarda: con `iv`, `datos` va cifrado con la clave de `tecnicoId`. */
export type ArchivoGuardado = ArchivoLocal & {
  iv?: Uint8Array | undefined;
  tecnicoId?: string | undefined;
  /** Índice de los sellados: encontrar los que faltan sin leer los bytes de cada foto. */
  cifrado?: 1 | undefined;
};

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
  /** La versión de la app que el servidor rechazó: con otra versión, el envío vuelve a la cola (ADR-0015). */
  versionAppRechazada?: number | undefined;
}

/** Lo que muestran las pantallas de un envío: su estado, sin el comando. */
export type EstadoDeEnvio = Omit<EnvioLocal, "comando">;

/** Como se guarda: el comando (con las respuestas) va sellado. */
export type EnvioGuardado = Omit<EnvioLocal, "comando"> & { comando?: EnviarLevantamiento | undefined; sellado?: Sellado | undefined };

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
 * Ítem del catálogo de la organización (iteración 17, ADR-0025): sin precio y sin sellar, como los formatos,
 * porque no es dato de un cliente. Uno inactivo deja de sugerirse.
 */
export interface ItemCatalogoLocal {
  id: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  activo: boolean;
}

/**
 * Símbolo de la biblioteca de los bocetos (iteración 19, ADR-0027): sin sellar, como el catálogo. Uno inactivo
 * deja de ofrecerse; los bocetos que ya lo usan lo llevan copiado.
 */
export interface SimboloLocal extends DefinicionSimbolo {
  orden: number;
  activo: boolean;
}

/**
 * Visita asignada, por técnico: en un teléfono compartido cada uno ve las suyas. Si se reasigna y el
 * técnico ya empezó levantamientos en ella, se conserva marcada para que pueda terminarlos (regla 17).
 */
export type VisitaLocal = VisitaAsignada & {
  tecnicoId: string;
  fueraDeAlcance?: true;
  /** Por qué salió (desde la iteración 7); sin él, se trata como reasignada. */
  motivoSalida?: "reasignada" | "cancelada";
  /** El técnico la terminó en este teléfono y falta que el servidor lo sepa (ADR-0037). */
  terminacionPendiente?: TerminacionPendiente | undefined;
  /** El servidor rechazó sin remedio la última terminación: el técnico lo ve junto a «Terminar visita» hasta volver a tocarlo. */
  terminacionRechazada?: true | undefined;
};

/**
 * "Terminar visita" sin señal (ADR-0037): se ve terminada al instante y el motor la envía con su llave, con la misma
 * espera que los envíos. Vive en la visita y no en el outbox: es un dato de la visita, no un levantamiento. Va a la
 * vista, sin sellar: una hora y una llave no dicen nada del cliente, y así la bajada la conserva sin abrir el sellado.
 */
export interface TerminacionPendiente {
  llave: string;
  /** Hora del teléfono al tocar "Terminar visita": declarativa, la que ve oficina. */
  en: string;
  intentos: number;
  /** Milisegundos desde época: no se intenta antes. */
  proximoIntentoEn: number;
}

/** Lo que va a la vista en una visita guardada; lo demás (cliente, sitio, dirección, motivo, horario) va sellado. */
type AlaVistaDeVisita = "id" | "tecnicoId" | "fueraDeAlcance" | "motivoSalida" | "terminacionPendiente" | "terminacionRechazada";

/** Como se guarda: cliente, sitio, dirección, motivo y horario van sellados. */
export type VisitaGuardada = Pick<VisitaLocal, AlaVistaDeVisita> & Partial<Omit<VisitaLocal, AlaVistaDeVisita>> & { sellado?: Sellado | undefined };

/** Un mensaje de la conversación de un comentario (ADR-0040), como lo dejó el servidor. */
export interface MensajeDeConversacion {
  id: string;
  texto: string;
  de: "oficina" | "tecnico";
  autor: string;
  creadoEn: string;
  /** Los del técnico: la llave con que salió de este u otro teléfono. */
  llave?: string | undefined;
  /** Los del técnico: alguien de oficina lo leyó («Leído»). */
  leido?: boolean | undefined;
}

/** Nota de oficina sobre un levantamiento enviado (corte 3). No modifica datos. */
export interface ComentarioDeOficina {
  id: string;
  texto: string;
  seccion?: string | undefined;
  campo?: string | undefined;
  autor: string;
  creadoEn: string;
  /** Oficina lo corrigió (ADR-0035). */
  editadoEn?: string | undefined;
  /** La conversación que abre (ADR-0040). Va sellada con el resto del estado. */
  respuestas?: MensajeDeConversacion[] | undefined;
}

/**
 * Lo que el técnico respondió y todavía no está en la bajada (ADR-0040). Sale solo cuando hay señal, con la espera de
 * los envíos; recibido, queda como enviado hasta que la bajada lo trae. Un rechazo sin remedio (ya revisado) lo deja
 * en el teléfono con su motivo: nunca se borra (regla 5).
 */
export interface RespuestaPendiente {
  llave: string;
  tecnicoId: string;
  levantamientoId: string;
  comentarioId: string;
  texto: string;
  /** Hora del teléfono al escribirlo: ordena el chat mientras no llega la del servidor. */
  creadaEn: string;
  intentos: number;
  proximoIntentoEn: number;
  enviada?: { id: string; creadoEn: string } | undefined;
  rechazo?: "revisado" | "no_existe" | "invalida" | undefined;
}

/** Lo que va a la vista; el texto, el comentario y la hora van sellados (ADR-0022). */
type AlaVistaDeRespuesta = "llave" | "tecnicoId" | "levantamientoId" | "intentos" | "proximoIntentoEn" | "enviada" | "rechazo";
export type RespuestaGuardada = Pick<RespuestaPendiente, AlaVistaDeRespuesta> & { sellado: Sellado };

/** Hasta cuándo leyó el técnico el chat de un levantamiento (ADR-0040). Sin contenido: no se sella. */
export interface LecturaDeChat {
  tecnicoId: string;
  levantamientoId: string;
  leidoHasta: string;
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

/** Como se guarda: los comentarios de oficina van sellados. */
export type EstadoServidorGuardado = EstadoServidor & { sellado?: Sellado | undefined };

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
  /** La última época de la bajada que vio este teléfono (ADR-0038); sin ella, la primera se adopta sin reiniciar. */
  epoca?: string | undefined;
  /** Cambió la época y se baja todo de nuevo: al terminar, sale lo enviado que el servidor ya no conoce (ADR-0038). */
  podar?: boolean | undefined;
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
  | { clave: "borrados_por_confirmar"; valor: string[] }
  /** Se cerró la sesión sin señal: falta cerrarla en el servidor (desde cuándo). */
  | { clave: "cierre_pendiente"; valor: string };
