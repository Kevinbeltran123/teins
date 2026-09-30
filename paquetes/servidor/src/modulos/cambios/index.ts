import { and, asc, eq, gt, isNull, or, sql } from "drizzle-orm";
import type { TxOrganizacion } from "../../plataforma/base-de-datos";
import { registro } from "./esquema";

export type Entidad = "formato" | "visita" | "levantamiento" | "item_catalogo" | "simbolo";
/** `fuera_de_alcance`: el destinatario deja de ver la entidad (por ejemplo, una visita reasignada). */
export type Operacion = "cambio" | "fuera_de_alcance";

export interface Cambio {
  organizacionId: string;
  /** Omitido: el cambio es para toda la organización. */
  usuarioId?: string;
  entidad: Entidad;
  entidadId: string;
  operacion: Operacion;
}

export interface CambioLeido {
  secuencia: number;
  entidad: Entidad;
  entidadId: string;
  operacion: Operacion;
}

/**
 * Registra cambios en la transacción del cambio que describen. Una secuencia de Postgres no
 * garantiza el orden de confirmación: si la transacción que obtuvo el 10 confirma después de la
 * que obtuvo el 11, un dispositivo que ya leyó hasta el 11 se salta el 10 para siempre. El bloqueo
 * consultivo por organización, que dura hasta el final de la transacción, hace que el orden de la
 * secuencia sea el de confirmación (ADR-0005, patrón 3). Conviene llamarlo al final de la transacción.
 */
export async function registrarCambios(tx: TxOrganizacion, cambios: readonly Cambio[]): Promise<void> {
  if (cambios.length === 0) return;
  for (const organizacionId of new Set(cambios.map((c) => c.organizacionId))) {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`cambios:${organizacionId}`}, 0))`);
  }
  await tx.insert(registro).values(cambios.map((c) => ({ ...c, usuarioId: c.usuarioId ?? null })));
}

/** Cambios para un usuario (los suyos y los de toda la organización) después de un punto de control. */
export async function leerCambios(tx: TxOrganizacion, usuarioId: string, desde: number, limite: number): Promise<CambioLeido[]> {
  const filas = await tx
    .select({ secuencia: registro.secuencia, entidad: registro.entidad, entidadId: registro.entidadId, operacion: registro.operacion })
    .from(registro)
    .where(and(gt(registro.secuencia, desde), or(isNull(registro.usuarioId), eq(registro.usuarioId, usuarioId))))
    .orderBy(asc(registro.secuencia))
    .limit(limite);
  return filas as CambioLeido[];
}
