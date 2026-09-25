import type { EstadoRevision, Respuestas, VersionFormato } from "@teins/dominio";
import type { ResultadoComando } from "@teins/protocolo";
import type { TxOrganizacion } from "../../../plataforma/base-de-datos";
import type { EntradaAuditoria } from "../../auditoria";
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
  cantidadFotos: number;
  creadoEnDispositivo: Date;
  enviadoEnDispositivo: Date;
  recibidoEn: Date;
}

export interface ComandoReservado {
  usuarioId: string;
  resultado: ResultadoComando | null;
}

export interface RepositorioLevantamientos {
  /** Inserta la llave; un duplicado en vuelo queda bloqueado por el índice único hasta que el primero confirme. */
  reservarLlave(tx: TxOrganizacion, datos: { llave: string; organizacionId: string; usuarioId: string; tipo: string }): Promise<void>;
  guardarResultado(tx: TxOrganizacion, llave: string, resultado: ResultadoComando): Promise<void>;
  comandoReservado(tx: TxOrganizacion, llave: string): Promise<ComandoReservado | undefined>;
  insertar(tx: TxOrganizacion, levantamiento: LevantamientoRecibido): Promise<void>;
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
}

export interface RepositorioRevision {
  obtener(tx: TxOrganizacion, id: string): Promise<LevantamientoEnRevision | undefined>;
  /**
   * Concurrencia optimista (ADR-0005, patrón 2): actualiza solo si nadie guardó desde `versionEsperada`
   * y sube la versión. Devuelve false si otra persona guardó antes.
   */
  actualizar(tx: TxOrganizacion, id: string, versionEsperada: number, cambios: CambiosDeRevision): Promise<boolean>;
  agregarComentario(tx: TxOrganizacion, comentario: NuevoComentario): Promise<void>;
}

export interface PuertoFormatos {
  obtener(tx: TxOrganizacion, formato: string, version: number): Promise<VersionFormato | undefined>;
}

export interface PuertoArchivos {
  estados(tx: TxOrganizacion, huellas: readonly string[]): Promise<Map<string, EstadoArchivo>>;
}

export interface PuertoVisitas {
  existe(tx: TxOrganizacion, id: string): Promise<boolean>;
}

export type RegistrarAuditoria = (tx: TxOrganizacion, entradas: readonly EntradaAuditoria[]) => Promise<void>;

export type RegistrarCambios = (tx: TxOrganizacion, cambios: readonly Cambio[]) => Promise<void>;

/** Violaciones de unicidad que el caso de uso distingue. */
export const RESTRICCION_LLAVE = "comandos_procesados_pkey";
export const RESTRICCION_LEVANTAMIENTO = "levantamientos_pkey";
