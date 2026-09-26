import { and, eq, isNull, sql } from "drizzle-orm";
import { bloques, esCantidades, type EstadoRevision } from "@teins/dominio";
import type { TxOrganizacion } from "../../plataforma/base-de-datos";
import type { DatosDeProyeccion, RepositorioLevantamientos, RepositorioRevision } from "./aplicacion/puertos";
import { comandosProcesados, comentarios, levantamientos, lineasCantidad } from "./esquema";

/**
 * La tabla de líneas sigue al documento (ADR-0006, parte 2): inserta las nuevas, actualiza las que
 * cambian (conservando su vínculo al catálogo) y marca como quitadas las que ya no están (regla 14).
 */
async function proyectarCantidades(tx: TxOrganizacion, { organizacionId, levantamientoId, formato, respuestas, repeticiones, elegidosEnCampo }: DatosDeProyeccion) {
  const actuales: (typeof lineasCantidad.$inferInsert)[] = [];
  for (const bloque of bloques(formato, repeticiones)) {
    for (const campo of bloque.seccion.campos) {
      if (campo.tipo !== "cantidades") continue;
      const valor = respuestas[bloque.clave]?.[campo.clave];
      if (!esCantidades(valor)) continue;
      valor.forEach((l, orden) => {
        const elegido = elegidosEnCampo && l.item && elegidosEnCampo.items.has(l.item) ? { itemCatalogoId: l.item, vinculadaPor: elegidosEnCampo.tecnicoId, vinculadaEn: elegidosEnCampo.en } : {};
        actuales.push({
          organizacionId,
          levantamientoId,
          seccion: bloque.clave,
          campo: campo.clave,
          linea: l.id,
          orden,
          descripcion: l.descripcion.trim(),
          cantidad: l.cantidad,
          unidad: l.unidad,
          observacion: l.observacion?.trim() || null,
          // Solo cuenta al insertar: al corregir, el vínculo que ya tiene la tabla se conserva.
          ...elegido,
        });
      });
    }
  }
  const llave = (l: { seccion: string; campo: string; linea: string }) => `${l.seccion}\u0000${l.campo}\u0000${l.linea}`;
  if (actuales.length > 0) {
    await tx
      .insert(lineasCantidad)
      .values(actuales)
      .onConflictDoUpdate({
        target: [lineasCantidad.levantamientoId, lineasCantidad.seccion, lineasCantidad.campo, lineasCantidad.linea],
        set: {
          orden: sql`excluded.orden`,
          descripcion: sql`excluded.descripcion`,
          cantidad: sql`excluded.cantidad`,
          unidad: sql`excluded.unidad`,
          observacion: sql`excluded.observacion`,
          quitadaEn: null,
        },
      });
  }
  const vigentes = new Set(actuales.map(llave));
  const guardadas = await tx
    .select({ seccion: lineasCantidad.seccion, campo: lineasCantidad.campo, linea: lineasCantidad.linea })
    .from(lineasCantidad)
    .where(and(eq(lineasCantidad.levantamientoId, levantamientoId), isNull(lineasCantidad.quitadaEn)));
  for (const g of guardadas.filter((g) => !vigentes.has(llave(g)))) {
    await tx
      .update(lineasCantidad)
      .set({ quitadaEn: new Date() })
      .where(and(eq(lineasCantidad.levantamientoId, levantamientoId), eq(lineasCantidad.seccion, g.seccion), eq(lineasCantidad.campo, g.campo), eq(lineasCantidad.linea, g.linea)));
  }
}

/** Adaptador de Drizzle para el puerto del núcleo. */
export const repositorioDrizzle: RepositorioLevantamientos = {
  async reservarLlave(tx, { llave, organizacionId, usuarioId, tipo }) {
    await tx.insert(comandosProcesados).values({ llave, organizacionId, usuarioId, tipo });
  },
  async guardarResultado(tx, llave, resultado) {
    await tx.update(comandosProcesados).set({ resultado }).where(eq(comandosProcesados.llave, llave));
  },
  async comandoReservado(tx, llave) {
    const [fila] = await tx
      .select({ usuarioId: comandosProcesados.usuarioId, resultado: comandosProcesados.resultado })
      .from(comandosProcesados)
      .where(eq(comandosProcesados.llave, llave));
    return fila ? { usuarioId: fila.usuarioId, resultado: (fila.resultado as never) ?? null } : undefined;
  },
  async insertar(tx, l) {
    await tx.insert(levantamientos).values({ ...l, estado: "enviado" });
  },
  proyectarCantidades,
};

export const repositorioRevision: RepositorioRevision = {
  async obtener(tx, id) {
    const [fila] = await tx
      .select({
        id: levantamientos.id,
        tecnicoId: levantamientos.tecnicoId,
        estado: levantamientos.estado,
        revisorId: levantamientos.revisorId,
        version: levantamientos.version,
        formato: levantamientos.formato,
        versionFormato: levantamientos.versionFormato,
        respuestas: levantamientos.respuestas,
        repeticiones: levantamientos.repeticiones,
        creadoEnDispositivo: levantamientos.creadoEnDispositivo,
      })
      .from(levantamientos)
      .where(eq(levantamientos.id, id));
    return fila ? { ...fila, estado: fila.estado as EstadoRevision } : undefined;
  },
  async actualizar(tx, id, versionEsperada, cambios) {
    const filas = await tx
      .update(levantamientos)
      .set({ ...cambios, version: sql`${levantamientos.version} + 1` })
      .where(and(eq(levantamientos.id, id), eq(levantamientos.version, versionEsperada)))
      .returning({ id: levantamientos.id });
    return filas.length === 1;
  },
  async agregarComentario(tx, comentario) {
    await tx.insert(comentarios).values(comentario);
  },
  proyectarCantidades,
  async vincularLinea(tx, { levantamientoId, seccion, campo, linea, itemId, autorId }) {
    const donde = and(
      eq(lineasCantidad.levantamientoId, levantamientoId),
      eq(lineasCantidad.seccion, seccion),
      eq(lineasCantidad.campo, campo),
      eq(lineasCantidad.linea, linea),
      isNull(lineasCantidad.quitadaEn),
    );
    const [antes] = await tx.select({ itemCatalogoId: lineasCantidad.itemCatalogoId }).from(lineasCantidad).where(donde).for("update");
    if (!antes) return undefined;
    if (antes.itemCatalogoId !== itemId) {
      await tx.update(lineasCantidad).set({ itemCatalogoId: itemId, vinculadaPor: itemId ? autorId : null, vinculadaEn: itemId ? new Date() : null }).where(donde);
    }
    return antes.itemCatalogoId;
  },
};
