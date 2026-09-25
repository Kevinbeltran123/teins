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

/**
 * Pool con manejo de errores en el pool y en cada conexión: una conexión que el servidor
 * de base de datos corta mientras está inactiva no debe tumbar el proceso.
 */
export function conectar(url: string, maximo: number, alFallar: (error: Error) => void = (e) => console.error("Error de conexión", e)): Conexion {
  const pool = new pg.Pool({ connectionString: url, max: maximo, idleTimeoutMillis: 30_000 });
  pool.on("error", alFallar);
  pool.on("connect", (cliente) => cliente.on("error", alFallar));
  return { bd: drizzle(pool), pool, cerrar: () => pool.end() };
}

/** Ejecuta `fn` en una transacción donde la seguridad por fila solo deja ver la organización dada. */
export function enOrganizacion<T>(bd: BaseDeDatos, organizacionId: string, fn: (tx: TxOrganizacion) => Promise<T>): Promise<T> {
  return bd.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.organizacion', ${organizacionId}, true)`);
    return fn(tx as TxOrganizacion);
  });
}

declare const marcaPortal: unique symbol;
/**
 * Transacción del portal (ADR-0009, parte 3): corre con el rol `teins_portal` y fija organización y
 * cliente. La seguridad por fila de la base solo le deja ver lo publicado de ese cliente.
 */
export type TxPortal = TxOrganizacion & { readonly [marcaPortal]: "portal" };

export function enClienteDelPortal<T>(bd: BaseDeDatos, organizacionId: string, clienteId: string, fn: (tx: TxPortal) => Promise<T>): Promise<T> {
  return bd.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.organizacion', ${organizacionId}, true), set_config('app.cliente', ${clienteId}, true)`);
    return fn(tx as TxPortal);
  });
}

const CODIGO_VIOLACION_UNICA = "23505";

export function esViolacionUnica(error: unknown, restriccion?: string): boolean {
  const causa = (error as { cause?: unknown })?.cause ?? error;
  const e = causa as { code?: string; constraint?: string };
  return e?.code === CODIGO_VIOLACION_UNICA && (restriccion === undefined || e.constraint === restriccion);
}
