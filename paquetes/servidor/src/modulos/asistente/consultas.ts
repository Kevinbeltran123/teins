import { and, eq, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import type { TxOrganizacion } from "../../plataforma/base-de-datos";
import { decimalCorto } from "./costo";
import { ajustes, gastos, intercambios } from "./esquema";

export const NOMBRE_POR_OMISION = "Chispa";
export const TOPE_POR_OMISION = "5";

/** El mes en curso en America/Bogota, AAAA-MM: el gasto y el uso son de ese mes. */
export const mesActual = sql<string>`to_char(now() at time zone 'America/Bogota', 'YYYY-MM')`;

/**
 * Una respuesta en curso venció: el trabajo arrancó hace más de 5 minutos (el límite es 3) o nunca arrancó en 30, lo que
 * puede esperar en la cola. El worker cayó o el trabajo se perdió.
 */
export const vencida = or(
  and(isNotNull(intercambios.iniciadoEn), lt(intercambios.iniciadoEn, sql`now() - interval '5 minutes'`)),
  and(isNull(intercambios.iniciadoEn), lt(intercambios.creadoEn, sql`now() - interval '30 minutes'`)),
)!;

export async function ajustesDe(tx: TxOrganizacion): Promise<{ nombre: string; topeUsd: string }> {
  const [fila] = await tx.select({ nombre: ajustes.nombre, tope: ajustes.topeMensualUsd }).from(ajustes);
  return { nombre: fila?.nombre ?? NOMBRE_POR_OMISION, topeUsd: decimalCorto(fila?.tope ?? TOPE_POR_OMISION) };
}

/** Suma al gasto del mes de la persona, en la misma transacción que lo causa. */
export async function sumarGasto(tx: TxOrganizacion, { organizacionId, usuarioId, preguntas = 0, gastoUsd = "0" }: { organizacionId: string; usuarioId: string; preguntas?: number; gastoUsd?: string }) {
  await tx
    .insert(gastos)
    .values({ organizacionId, usuarioId, mes: mesActual, preguntas, gastoUsd })
    .onConflictDoUpdate({
      target: [gastos.organizacionId, gastos.usuarioId, gastos.mes],
      set: { preguntas: sql`${gastos.preguntas} + excluded.preguntas`, gastoUsd: sql`${gastos.gastoUsd} + excluded.gasto_usd` },
    });
}

export async function gastoDelMes(tx: TxOrganizacion): Promise<string> {
  const [fila] = await tx
    .select({ gasto: sql<string>`coalesce(sum(${gastos.gastoUsd}), 0)::text` })
    .from(gastos)
    .where(eq(gastos.mes, mesActual));
  return decimalCorto(fila?.gasto ?? "0");
}

/** Si el gasto del mes ya llegó al tope. La comparación la hace la base, en decimal. */
export async function topeAgotado(tx: TxOrganizacion): Promise<boolean> {
  const { topeUsd } = await ajustesDe(tx);
  const gasto = await gastoDelMes(tx);
  const [fila] = await tx.execute<{ agotado: boolean }>(sql`select ${gasto}::numeric >= ${topeUsd}::numeric as agotado`).then((r) => r.rows);
  return fila?.agotado ?? false;
}
