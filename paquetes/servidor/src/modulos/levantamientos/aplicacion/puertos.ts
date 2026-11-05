import type { EstadoRevision, Repeticiones, Respuestas, VersionFormato } from "@teins/dominio";
import type { ResultadoComando } from "@teins/protocolo";
import type { TxOrganizacion } from "../../../plataforma/base-de-datos";
import type { EntradaAuditoria } from "../../auditoria";
import type { Aviso } from "../../avisos";
import type { Cambio } from "../../cambios";
import type { EstadoArchivo } from "../../archivos";

/** Lo que el núcleo necesita de afuera (ADR-0001: núcleo hexagonal). Los adaptadores viven en el módulo. */
export interface LevantamientoRecibido {
  id: string;
  organizacionId: string;
  tecnicoId: string;
  formato: string;
  versionFormato: number;
  visitaId: string | null;
  respuestas: Respuestas;
  repeticiones: Repeticiones;
  cantidadFotos: number;
  creadoEnDispositivo: Date;
  enviadoEnDispositivo: Date;
  recibidoEn: Date;
}

/** Lo que se proyecta a la tabla de líneas de cantidad (ADR-0006, parte 2; iteración 11). */
export interface DatosDeProyeccion {
  organizacionId: string;
  levantamientoId: string;
  formato: VersionFormato;
  respuestas: Respuestas;
  repeticiones: Repeticiones;
  /** Hora del guardado: marca las líneas quitadas y las que entran vinculadas. */
  en: Date;
  /**
   * Solo al recibir (ADR-0025): los ítems que eligió el técnico y existen en la organización. Esas líneas
   * entran vinculadas, a nombre del técnico; las demás, sin vínculo.
   */
  elegidosEnCampo?: { tecnicoId: string; items: ReadonlySet<string> };
}

/** Proyección de las cantidades: al recibir y al corregir, en la misma transacción. */
export interface ProyeccionDeCantidades {
  proyectarCantidades(tx: TxOrganizacion, datos: DatosDeProyeccion): Promise<void>;
}

export interface ComandoReservado {
  usuarioId: string;
  resultado: ResultadoComando | null;
}

export interface RepositorioLevantamientos extends ProyeccionDeCantidades {
  /** Inserta la llave; un duplicado en vuelo queda bloqueado por el índice único hasta que el primero confirme. */
  reservarLlave(tx: TxOrganizacion, datos: { llave: string; organizacionId: string; usuarioId: string; tipo: string }): Promise<void>;
  guardarResultado(tx: TxOrganizacion, llave: string, resultado: ResultadoComando): Promise<void>;
  comandoReservado(tx: TxOrganizacion, llave: string): Promise<ComandoReservado | undefined>;
  insertar(tx: TxOrganizacion, levantamiento: LevantamientoRecibido): Promise<void>;
  /** Si el técnico ya tiene en la visita un levantamiento distinto de `excepto` (ADR-0054). */
  yaTieneEnLaVisita(tx: TxOrganizacion, datos: { visitaId: string; tecnicoId: string; excepto: string }): Promise<boolean>;
}

/** Lo que la revisión lee y escribe del agregado. */
export interface LevantamientoEnRevision {
  id: string;
  tecnicoId: string;
  estado: EstadoRevision;
  revisorId: string | null;
  version: number;
  formato: string;
  versionFormato: number;
  respuestas: Respuestas;
  repeticiones: Repeticiones;
  /** Como el técnico lo reconoce en su teléfono: por el día en que lo creó. */
  creadoEnDispositivo: Date;
  /** Para decir de qué cliente es en los avisos de una conversación (ADR-0040). */
  visitaId: string | null;
}

export interface CambiosDeRevision {
  estado?: EstadoRevision;
  revisorId?: string;
  respuestas?: Respuestas;
  tomadoEn?: Date;
  revisadoEn?: Date;
}

export interface NuevoComentario {
  id: string;
  organizacionId: string;
  levantamientoId: string;
  autorId: string;
  texto: string;
  seccion: string | null;
  campo: string | null;
  creadoEn: Date;
  /** Conversaciones (ADR-0040): a qué comentario de oficina responde, de qué lado y, si es del técnico, su llave. */
  enRespuestaA?: string | null;
  de?: "oficina" | "tecnico";
  llave?: string | null;
}

export interface ComentarioGuardado extends NuevoComentario {
  editadoEn: Date | null;
  retiradoEn: Date | null;
  retiradoPor: string | null;
}

export interface RepositorioRevision extends ProyeccionDeCantidades {
  obtener(tx: TxOrganizacion, id: string): Promise<LevantamientoEnRevision | undefined>;
  /**
   * Concurrencia optimista (ADR-0005, patrón 2): actualiza solo si nadie guardó desde `versionEsperada`
   * y sube la versión. Devuelve false si otra persona guardó antes.
   */
  actualizar(tx: TxOrganizacion, id: string, versionEsperada: number, cambios: CambiosDeRevision): Promise<boolean>;
  agregarComentario(tx: TxOrganizacion, comentario: NuevoComentario): Promise<void>;
  /** Guarda la respuesta del técnico si su llave no se usó (regla 4); devuelve false si ya estaba. */
  agregarRespuesta(tx: TxOrganizacion, respuesta: NuevoComentario & { llave: string }): Promise<boolean>;
  comentarioPorLlave(tx: TxOrganizacion, llave: string): Promise<ComentarioGuardado | undefined>;
  /** Quien consulta leyó las conversaciones hasta `en` (ADR-0040). */
  leer(tx: TxOrganizacion, datos: { organizacionId: string; usuarioId: string; levantamientoId: string; en: Date }): Promise<void>;
  /** El comentario de este levantamiento, con su fila bloqueada para corregirlo (ADR-0035). */
  comentario(tx: TxOrganizacion, levantamientoId: string, comentarioId: string): Promise<ComentarioGuardado | undefined>;
  corregirComentario(tx: TxOrganizacion, comentarioId: string, cambios: Partial<Pick<ComentarioGuardado, "texto" | "editadoEn" | "retiradoEn" | "retiradoPor">>): Promise<void>;
  /**
   * Vincula (o desvincula, con `null`) una línea vigente al catálogo. Devuelve el ítem que tenía antes,
   * o `undefined` si la línea no existe.
   */
  vincularLinea(tx: TxOrganizacion, datos: { levantamientoId: string; seccion: string; campo: string; linea: string; itemId: string | null; autorId: string; en: Date }): Promise<string | null | undefined>;
}

export interface PuertoCatalogo {
  items(tx: TxOrganizacion, ids: readonly string[]): Promise<Map<string, { id: string; activo: boolean }>>;
}

export interface PuertoFormatos {
  obtener(tx: TxOrganizacion, formato: string, version: number): Promise<VersionFormato | undefined>;
}

export interface PuertoArchivos {
  estados(tx: TxOrganizacion, huellas: readonly string[]): Promise<Map<string, { estado: EstadoArchivo; tipo: string }>>;
}

export interface PuertoVisitas {
  existe(tx: TxOrganizacion, id: string): Promise<boolean>;
}

export type RegistrarAuditoria = (tx: TxOrganizacion, entradas: readonly EntradaAuditoria[]) => Promise<void>;

export type RegistrarCambios = (tx: TxOrganizacion, cambios: readonly Cambio[]) => Promise<void>;

/** Aviso push en la transacción del hecho (ADR-0023). */
export type Avisar = (tx: TxOrganizacion, aviso: Aviso) => Promise<void>;

/** Violaciones de unicidad que el caso de uso distingue. */
export const RESTRICCION_LLAVE = "comandos_procesados_pkey";
export const RESTRICCION_LEVANTAMIENTO = "levantamientos_pkey";
