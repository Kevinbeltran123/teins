import { and, asc, count, desc, eq, gt, inArray, isNotNull, isNull, lt, or, type SQL } from "drizzle-orm";
import type { EstadoRevision } from "@teins/dominio";
import { Uuid } from "@teins/protocolo";
import type { TxOrganizacion } from "../../plataforma/base-de-datos";
import { problema } from "../../plataforma/errores";
import { comentarios, levantamientos, lineasCantidad } from "./esquema";

/** Cursor opaco de paginación por llave (ADR-0014): estable aunque lleguen envíos nuevos. */
function leerCursor(cursor: string | undefined): { recibidoEn: Date; id: string } | null {
  if (!cursor) return null;
  try {
    const [iso, id] = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as [string, string];
    const recibidoEn = new Date(iso);
    if (Number.isNaN(recibidoEn.getTime()) || typeof id !== "string" || !Uuid.safeParse(id).success) throw new Error();
    return { recibidoEn, id };
  } catch {
    throw problema("entrada_invalida", "Cursor inválido");
  }
}

const escribirCursor = (recibidoEn: Date, id: string) => Buffer.from(JSON.stringify([recibidoEn.toISOString(), id])).toString("base64url");

/** `filtro`: la búsqueda (iteración 23), ya resuelta a una condición; cuenta también en el total. */
export async function paginaPorEstado(tx: TxOrganizacion, estado: EstadoRevision, cursor: string | undefined, limite: number, filtro?: SQL) {
  const desde = leerCursor(cursor);
  // Por revisar y en revisión: el que más lleva esperando primero (DESIGN.md, punto focal de oficina). Los
  // revisados ya no esperan a nadie: se buscan los últimos, para abrir su informe.
  const recientesPrimero = estado === "revisado";
  const despues = recientesPrimero ? lt : gt;
  const orden = recientesPrimero ? desc : asc;
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
      visitaId: levantamientos.visitaId,
    })
    .from(levantamientos)
    .where(
      and(
        eq(levantamientos.estado, estado),
        filtro,
        desde
          ? or(despues(levantamientos.recibidoEn, desde.recibidoEn), and(eq(levantamientos.recibidoEn, desde.recibidoEn), despues(levantamientos.id, desde.id)))
          : undefined,
      ),
    )
    .orderBy(orden(levantamientos.recibidoEn), orden(levantamientos.id))
    .limit(limite + 1);
  const [{ total } = { total: 0 }] = await tx.select({ total: count() }).from(levantamientos).where(and(eq(levantamientos.estado, estado), filtro));
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
      repeticiones: levantamientos.repeticiones,
    })
    .from(levantamientos)
    .where(eq(levantamientos.visitaId, visitaId))
    .orderBy(asc(levantamientos.recibidoEn), asc(levantamientos.id));
  return filas.map((f) => ({ ...f, estado: f.estado as EstadoRevision }));
}

export interface ConteoDeVisita {
  enviados: number;
  enRevision: number;
  revisados: number;
}

/** Cuántos levantamientos tiene cada visita en cada estado: el avance de la visita se deduce de esto. */
export async function conteosPorVisita(tx: TxOrganizacion, visitaIds: readonly string[]): Promise<Map<string, ConteoDeVisita>> {
  const resultado = new Map<string, ConteoDeVisita>();
  if (visitaIds.length === 0) return resultado;
  const filas = await tx
    .select({ visitaId: levantamientos.visitaId, estado: levantamientos.estado, n: count() })
    .from(levantamientos)
    .where(inArray(levantamientos.visitaId, [...visitaIds]))
    .groupBy(levantamientos.visitaId, levantamientos.estado);
  for (const f of filas) {
    if (!f.visitaId) continue;
    const c = resultado.get(f.visitaId) ?? { enviados: 0, enRevision: 0, revisados: 0 };
    if (f.estado === "enviado") c.enviados += f.n;
    else if (f.estado === "en_revision") c.enRevision += f.n;
    else if (f.estado === "revisado") c.revisados += f.n;
    resultado.set(f.visitaId, c);
  }
  return resultado;
}

/** Líneas vigentes vinculadas al catálogo de un levantamiento (para la revisión). */
export async function vinculosDe(tx: TxOrganizacion, levantamientoId: string) {
  return tx
    .select({ seccion: lineasCantidad.seccion, campo: lineasCantidad.campo, linea: lineasCantidad.linea, itemId: lineasCantidad.itemCatalogoId, vinculadaPor: lineasCantidad.vinculadaPor })
    .from(lineasCantidad)
    .where(and(eq(lineasCantidad.levantamientoId, levantamientoId), isNull(lineasCantidad.quitadaEn), isNotNull(lineasCantidad.itemCatalogoId)));
}

/** Líneas vigentes de todos los levantamientos de una visita, en orden, con lo necesario para exportarlas. */
export async function lineasDeVisita(tx: TxOrganizacion, visitaId: string) {
  return tx
    .select({
      levantamientoId: levantamientos.id,
      tecnicoId: levantamientos.tecnicoId,
      estado: levantamientos.estado,
      formato: levantamientos.formato,
      versionFormato: levantamientos.versionFormato,
      repeticiones: levantamientos.repeticiones,
      seccion: lineasCantidad.seccion,
      campo: lineasCantidad.campo,
      descripcion: lineasCantidad.descripcion,
      cantidad: lineasCantidad.cantidad,
      unidad: lineasCantidad.unidad,
      observacion: lineasCantidad.observacion,
      itemId: lineasCantidad.itemCatalogoId,
    })
    .from(lineasCantidad)
    .innerJoin(levantamientos, eq(levantamientos.id, lineasCantidad.levantamientoId))
    .where(and(eq(levantamientos.visitaId, visitaId), isNull(lineasCantidad.quitadaEn)))
    .orderBy(asc(levantamientos.recibidoEn), asc(levantamientos.id), asc(lineasCantidad.seccion), asc(lineasCantidad.campo), asc(lineasCantidad.orden));
}

/** Una línea de cantidad de un levantamiento revisado: lo único que entra en una cotización (ADR-0029). */
export interface LineaRevisadaDeVisita {
  visitaId: string;
  levantamientoId: string;
  descripcion: string;
  cantidad: string;
  unidad: string;
  itemId: string | null;
}

/** Líneas vigentes de los levantamientos revisados; sin `visitaIds`, de todas las visitas de la organización. */
export async function cantidadesRevisadas(tx: TxOrganizacion, visitaIds?: readonly string[]): Promise<LineaRevisadaDeVisita[]> {
  if (visitaIds && visitaIds.length === 0) return [];
  const filas = await tx
    .select({
      visitaId: levantamientos.visitaId,
      levantamientoId: levantamientos.id,
      descripcion: lineasCantidad.descripcion,
      cantidad: lineasCantidad.cantidad,
      unidad: lineasCantidad.unidad,
      itemId: lineasCantidad.itemCatalogoId,
    })
    .from(lineasCantidad)
    .innerJoin(levantamientos, eq(levantamientos.id, lineasCantidad.levantamientoId))
    .where(and(eq(levantamientos.estado, "revisado"), isNull(lineasCantidad.quitadaEn), isNotNull(levantamientos.visitaId), visitaIds ? inArray(levantamientos.visitaId, [...visitaIds]) : undefined))
    .orderBy(asc(levantamientos.recibidoEn), asc(levantamientos.id), asc(lineasCantidad.seccion), asc(lineasCantidad.campo), asc(lineasCantidad.orden));
  return filas.map((f) => ({ ...f, visitaId: f.visitaId! }));
}
