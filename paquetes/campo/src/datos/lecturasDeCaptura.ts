import type { BaseCampo } from "./base";
import type { EstadoDeEnvio, ItemCatalogoLocal, SimboloLocal } from "./modelo";

/**
 * Lecturas que solo usa la captura, a la vista (sin nada sellado). Van aparte de `lecturas.ts`, que también usa el
 * inicio: así viajan con la captura, que se carga aparte, y no suman al JavaScript inicial (ADR-0011).
 */

/** El estado de envío de un levantamiento, sin el comando sellado. */
export async function envioDe(db: BaseCampo, levantamientoId: string): Promise<EstadoDeEnvio | null> {
  return (await db.envios.get(levantamientoId)) ?? null;
}

/** Envíos del teléfono que oficina todavía no recibió. */
export function cuantosPorSubir(db: BaseCampo): Promise<number> {
  return db.envios.filter((e) => e.estado !== "recibido").count();
}

/** De los archivos con estas huellas, cuántos ya subieron. */
export async function subidosDe(db: BaseCampo, huellas: string[]): Promise<number> {
  return (await db.archivos.bulkGet(huellas)).filter((a) => a && a.subida === "subida").length;
}

export function itemsDelCatalogo(db: BaseCampo): Promise<ItemCatalogoLocal[]> {
  return db.catalogo.toArray();
}

export function simbolosGuardados(db: BaseCampo): Promise<SimboloLocal[]> {
  return db.simbolos.toArray();
}
