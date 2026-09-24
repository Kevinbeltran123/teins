import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";

export type BaseDeDatos = NodePgDatabase;
type Transaccion = Parameters<Parameters<BaseDeDatos["transaction"]>[0]>[0];

declare const marca: unique symbol;
/**
 * Transacción con la organización fijada (ADR-0009). Los repositorios de negocio solo aceptan
 * este tipo: es imposible consultar datos de negocio sin pasar por `enOrganizacion`.
 */
export type TxOrganizacion = Transaccion & { readonly [marca]: "organizacion" };

export interface Conexion {
  bd: BaseDeDatos;
  pool: pg.Pool;
  cerrar(): Promise<void>;
}

export function conectar(url: string, maximo: number): Conexion {
  const pool = new pg.Pool({ connectionString: url, max: maximo, idleTimeoutMillis: 30_000 });
  return { bd: drizzle(pool), pool, cerrar: () => pool.end() };
}

/** Ejecuta `fn` en una transacción donde la seguridad por fila solo deja ver la organización dada. */
export function enOrganizacion<T>(bd: BaseDeDatos, organizacionId: string, fn: (tx: TxOrganizacion) => Promise<T>): Promise<T> {
  return bd.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.organizacion', ${organizacionId}, true)`);
    return fn(tx as TxOrganizacion);
  });
}

const CODIGO_VIOLACION_UNICA = "23505";

export function esViolacionUnica(error: unknown, restriccion?: string): boolean {
  const causa = (error as { cause?: unknown })?.cause ?? error;
  const e = causa as { code?: string; constraint?: string };
  return e?.code === CODIGO_VIOLACION_UNICA && (restriccion === undefined || e.constraint === restriccion);
}
