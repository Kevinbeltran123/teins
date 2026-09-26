import { and, eq, sql } from "drizzle-orm";
import type { EstadoRevision } from "@teins/dominio";
import type { RepositorioLevantamientos, RepositorioRevision } from "./aplicacion/puertos";
import { comandosProcesados, comentarios, levantamientos } from "./esquema";

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
};
