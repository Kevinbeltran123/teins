import { and, asc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import type { BaseDeDatos, TxOrganizacion } from "../../plataforma/base-de-datos";
import { epocas, registro } from "./esquema";

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

/**
 * De estos ids, los que no tienen ninguna fila en el registro: un teléfono que baja desde cero nunca los recibiría. Pasa
 * si una limpieza borró sus filas (antes de ADR-0038 se borraba todo el registro); publicar de nuevo los repara.
 */
export async function sinRegistro(tx: TxOrganizacion, entidad: Entidad, ids: readonly string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const con = await tx
    .selectDistinct({ entidadId: registro.entidadId })
    .from(registro)
    .where(and(eq(registro.entidad, entidad), inArray(registro.entidadId, [...ids])));
  const registrados = new Set(con.map((f) => f.entidadId));
  return ids.filter((id) => !registrados.has(id));
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

/**
 * Compacta el registro (ADR-0044): borra cada fila que ya tiene otra más nueva para la misma entidad y el mismo
 * destinatario. La bajada solo usa el último cambio de cada entidad, así que ningún teléfono pierde nada. La
 * aplicación solo inserta y lee: esto lo hace la conexión del dueño de la base, desde la tarea periódica.
 */
export async function compactarRegistro(propietario: BaseDeDatos): Promise<number> {
  const resultado = await propietario.execute(sql`
    delete from cambios.registro viejo
    using cambios.registro nuevo
    where nuevo.organizacion_id = viejo.organizacion_id
      and nuevo.usuario_id is not distinct from viejo.usuario_id
      and nuevo.entidad = viejo.entidad
      and nuevo.entidad_id = viejo.entidad_id
      and nuevo.secuencia > viejo.secuencia`);
  return resultado.rowCount ?? 0;
}

/** La época sin limpiezas (ADR-0038): la de toda organización hasta que alguien deja limpio su entorno. */
export const EPOCA_INICIAL = "inicial";

/** La época de la bajada de la organización fijada en la transacción (ADR-0038). */
export async function leerEpoca(tx: TxOrganizacion): Promise<string> {
  const [fila] = await tx.select({ epoca: epocas.epoca }).from(epocas).limit(1);
  return fila?.epoca ?? EPOCA_INICIAL;
}
