import { eq } from "drizzle-orm";
import type { RepositorioLevantamientos } from "./aplicacion/puertos";
import { comandosProcesados, levantamientos } from "./esquema";

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
