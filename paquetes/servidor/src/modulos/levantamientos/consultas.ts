import { and, asc, count, eq, gt, inArray, or } from "drizzle-orm";
import type { EstadoRevision } from "@teins/dominio";
import type { TxOrganizacion } from "../../plataforma/base-de-datos";
import { problema } from "../../plataforma/errores";
import { comentarios, levantamientos } from "./esquema";

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

export async function paginaPorEstado(tx: TxOrganizacion, estado: EstadoRevision, cursor: string | undefined, limite: number) {
  const desde = leerCursor(cursor);
  const filas = await tx
    .select({
      id: levantamientos.id,
      formato: levantamientos.formato,
      versionFormato: levantamientos.versionFormato,
      tecnicoId: levantamientos.tecnicoId,
      revisorId: levantamientos.revisorId,
      estado: levantamientos.estado,
      version: levantamientos.version,
      recibidoEn: levantamientos.recibidoEn,
      cantidadFotos: levantamientos.cantidadFotos,
    })
    .from(levantamientos)
    .where(
      and(
        eq(levantamientos.estado, estado),
        desde
          ? or(gt(levantamientos.recibidoEn, desde.recibidoEn), and(eq(levantamientos.recibidoEn, desde.recibidoEn), gt(levantamientos.id, desde.id)))
          : undefined,
      ),
    )
    // El que más lleva esperando primero (DESIGN.md, punto focal de oficina).
    .orderBy(asc(levantamientos.recibidoEn), asc(levantamientos.id))
    .limit(limite + 1);
  const [{ total } = { total: 0 }] = await tx.select({ total: count() }).from(levantamientos).where(eq(levantamientos.estado, estado));
  const hayMas = filas.length > limite;
  const pagina = hayMas ? filas.slice(0, limite) : filas;
  const ultimo = pagina.at(-1);
  return { filas: pagina, total, siguienteCursor: hayMas && ultimo ? escribirCursor(ultimo.recibidoEn, ultimo.id) : null };
}

export async function detalle(tx: TxOrganizacion, id: string) {
  const [fila] = await tx.select().from(levantamientos).where(eq(levantamientos.id, id));
  return fila;
}

export async function comentariosDe(tx: TxOrganizacion, ids: readonly string[]) {
  if (ids.length === 0) return [];
  return tx
    .select({
      id: comentarios.id,
      levantamientoId: comentarios.levantamientoId,
      autorId: comentarios.autorId,
      texto: comentarios.texto,
      seccion: comentarios.seccion,
      campo: comentarios.campo,
      creadoEn: comentarios.creadoEn,
    })
    .from(comentarios)
    .where(inArray(comentarios.levantamientoId, [...ids]))
    .orderBy(asc(comentarios.creadoEn), asc(comentarios.id));
}

/** Estado y comentarios de los levantamientos propios del técnico, para la bajada. */
export async function estadosDe(tx: TxOrganizacion, ids: readonly string[], tecnicoId: string) {
  if (ids.length === 0) return [];
  const filas = await tx
    .select({ id: levantamientos.id, estado: levantamientos.estado, recibidoEn: levantamientos.recibidoEn })
    .from(levantamientos)
    .where(and(inArray(levantamientos.id, [...ids]), eq(levantamientos.tecnicoId, tecnicoId)));
  const porLevantamiento = Map.groupBy(await comentariosDe(tx, filas.map((f) => f.id)), (c) => c.levantamientoId);
  return filas.map((f) => ({ ...f, estado: f.estado as EstadoRevision, comentarios: porLevantamiento.get(f.id) ?? [] }));
}

/** Levantamientos de una visita, para componer su informe (regla 9). */
export async function deVisita(tx: TxOrganizacion, visitaId: string) {
  const filas = await tx
    .select({
      id: levantamientos.id,
      visitaId: levantamientos.visitaId,
      estado: levantamientos.estado,
      formato: levantamientos.formato,
      versionFormato: levantamientos.versionFormato,
      tecnicoId: levantamientos.tecnicoId,
      revisorId: levantamientos.revisorId,
      recibidoEn: levantamientos.recibidoEn,
      respuestas: levantamientos.respuestas,
    })
    .from(levantamientos)
    .where(eq(levantamientos.visitaId, visitaId))
    .orderBy(asc(levantamientos.recibidoEn), asc(levantamientos.id));
  return filas.map((f) => ({ ...f, estado: f.estado as EstadoRevision }));
}
