import { and, asc, count, eq, gt, or } from "drizzle-orm";
import type { TxOrganizacion } from "../../plataforma/base-de-datos";
import { problema } from "../../plataforma/errores";
import { levantamientos } from "./esquema";

/** Cursor opaco de paginación por llave (ADR-0014): estable aunque lleguen envíos nuevos. */
function leerCursor(cursor: string | undefined): { recibidoEn: Date; id: string } | null {
  if (!cursor) return null;
  try {
    const [iso, id] = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as [string, string];
    const recibidoEn = new Date(iso);
    if (Number.isNaN(recibidoEn.getTime()) || typeof id !== "string") throw new Error();
    return { recibidoEn, id };
  } catch {
    throw problema("entrada_invalida", "Cursor inválido");
  }
}

const escribirCursor = (recibidoEn: Date, id: string) => Buffer.from(JSON.stringify([recibidoEn.toISOString(), id])).toString("base64url");

export async function paginaDeEnviados(tx: TxOrganizacion, cursor: string | undefined, limite: number) {
  const desde = leerCursor(cursor);
  const filas = await tx
    .select({
      id: levantamientos.id,
      formato: levantamientos.formato,
      versionFormato: levantamientos.versionFormato,
      tecnicoId: levantamientos.tecnicoId,
      recibidoEn: levantamientos.recibidoEn,
      cantidadFotos: levantamientos.cantidadFotos,
    })
    .from(levantamientos)
    .where(
      and(
        eq(levantamientos.estado, "enviado"),
        desde
          ? or(gt(levantamientos.recibidoEn, desde.recibidoEn), and(eq(levantamientos.recibidoEn, desde.recibidoEn), gt(levantamientos.id, desde.id)))
          : undefined,
      ),
    )
    // El que más lleva esperando primero (DESIGN.md, punto focal de oficina).
    .orderBy(asc(levantamientos.recibidoEn), asc(levantamientos.id))
    .limit(limite + 1);
  const [{ total } = { total: 0 }] = await tx.select({ total: count() }).from(levantamientos).where(eq(levantamientos.estado, "enviado"));
  const hayMas = filas.length > limite;
  const pagina = hayMas ? filas.slice(0, limite) : filas;
  const ultimo = pagina.at(-1);
  return { filas: pagina, total, siguienteCursor: hayMas && ultimo ? escribirCursor(ultimo.recibidoEn, ultimo.id) : null };
}

export async function detalle(tx: TxOrganizacion, id: string) {
  const [fila] = await tx.select().from(levantamientos).where(eq(levantamientos.id, id));
  return fila;
}
