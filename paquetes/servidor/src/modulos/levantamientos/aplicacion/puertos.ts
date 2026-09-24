import type { Respuestas, VersionFormato } from "@teins/dominio";
import type { ResultadoComando } from "@teins/protocolo";
import type { TxOrganizacion } from "../../../plataforma/base-de-datos";
import type { EntradaAuditoria } from "../../auditoria";
import type { EstadoArchivo } from "../../archivos";

/** Lo que el núcleo necesita de afuera (ADR-0001: núcleo hexagonal). Los adaptadores viven en el módulo. */
export interface LevantamientoRecibido {
  id: string;
  organizacionId: string;
  tecnicoId: string;
  formato: string;
  versionFormato: number;
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

export interface PuertoFormatos {
  obtener(tx: TxOrganizacion, formato: string, version: number): Promise<VersionFormato | undefined>;
}

export interface PuertoArchivos {
  estados(tx: TxOrganizacion, huellas: readonly string[]): Promise<Map<string, EstadoArchivo>>;
}

export type RegistrarAuditoria = (tx: TxOrganizacion, entradas: readonly EntradaAuditoria[]) => Promise<void>;

/** Violaciones de unicidad que el caso de uso distingue. */
export const RESTRICCION_LLAVE = "comandos_procesados_pkey";
export const RESTRICCION_LEVANTAMIENTO = "levantamientos_pkey";
