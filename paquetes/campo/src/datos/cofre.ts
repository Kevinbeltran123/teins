/**
 * Cifrado local (ADR-0009, parte 5; ADR-0022): AES-GCM de 256 bits con una clave no extraíble por
 * técnico en este teléfono. El beneficio principal es el borrado: destruir la clave vuelve ilegible
 * todo lo del técnico al instante, aunque borrar cientos de fotos se interrumpa.
 *
 * WebCrypto es asíncrono y una transacción de IndexedDB no puede esperarlo: quien escribe sella antes
 * de abrir la transacción y quien lee abre después. Dentro de una consulta en vivo, toda promesa que no
 * es de Dexie va envuelta en `Promise.resolve` (regla de `useLiveQuery`).
 */
import type { BaseCampo } from "./base";
import type { Sellado } from "./modelo";

export type { ClaveLocal, Sellado } from "./modelo";

/** Los datos de un técnico cuya clave ya no existe: los borró una orden de borrado y quedan por purgar. */
export class DatoIlegible extends Error {
  constructor(contexto: string) {
    super(`No se puede leer ${contexto}: su clave no está en este teléfono`);
    this.name = "DatoIlegible";
  }
}

const esperar = <T>(promesa: Promise<T>): Promise<T> => Promise.resolve(promesa);

/** Técnicos con un borrado sin terminar o sin confirmar: lo suyo espera a borrarse, no se sella. */
export async function enBorrado(db: BaseCampo): Promise<Set<string>> {
  const ajuste = await db.ajustes.get("borrados_por_confirmar");
  return new Set(ajuste?.clave === "borrados_por_confirmar" ? ajuste.valor : []);
}

/**
 * La clave del técnico; se crea la primera vez que hace falta. Nunca sale del navegador. A un técnico con
 * un borrado pendiente no se le crea otra: volvería legible lo que el borrado acaba de cerrar.
 */
export async function claveDe(db: BaseCampo, tecnicoId: string, contexto: string): Promise<CryptoKey> {
  const actual = await db.claves.get(tecnicoId);
  if (actual) return actual.clave;
  const nueva = await esperar(crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]));
  // Si otra pestaña la creó mientras tanto, gana la primera: nunca hay dos claves para un técnico. Con
  // `ajustes` en la transacción, el borrado (que destruye la clave y se marca junto) no se cuela en medio.
  return db.transaction("rw", [db.claves, db.ajustes], async () => {
    const otra = await db.claves.get(tecnicoId);
    if (otra) return otra.clave;
    if ((await enBorrado(db)).has(tecnicoId)) throw new DatoIlegible(contexto);
    await db.claves.add({ tecnicoId, clave: nueva, creadaEn: new Date().toISOString() });
    return nueva;
  });
}

/**
 * Cifra con el contexto como dato adicional autenticado: un sellado copiado a otro registro no abre.
 * `contexto` es, por ejemplo, "levantamiento:<id>".
 */
export async function sellarBytes(db: BaseCampo, tecnicoId: string, contexto: string, datos: BufferSource): Promise<Sellado> {
  const clave = await claveDe(db, tecnicoId, contexto);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cifrado = await esperar(crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(contexto) }, clave, datos));
  return { iv, datos: cifrado };
}

export async function abrirBytes(db: BaseCampo, tecnicoId: string, contexto: string, sellado: Sellado): Promise<ArrayBuffer> {
  const guardada = await db.claves.get(tecnicoId);
  if (!guardada) throw new DatoIlegible(contexto);
  return esperar(
    crypto.subtle.decrypt({ name: "AES-GCM", iv: sellado.iv as Uint8Array<ArrayBuffer>, additionalData: new TextEncoder().encode(contexto) }, guardada.clave, sellado.datos),
  );
}

export const sellarJson = (db: BaseCampo, tecnicoId: string, contexto: string, valor: unknown) =>
  sellarBytes(db, tecnicoId, contexto, new TextEncoder().encode(JSON.stringify(valor)));

export async function abrirJson<T>(db: BaseCampo, tecnicoId: string, contexto: string, sellado: Sellado): Promise<T> {
  return JSON.parse(new TextDecoder().decode(await abrirBytes(db, tecnicoId, contexto, sellado))) as T;
}

/** Contextos de cada registro sellado: el dato adicional autenticado. */
export const contexto = {
  levantamiento: (id: string) => `levantamiento:${id}`,
  archivo: (huella: string) => `archivo:${huella}`,
  envio: (levantamientoId: string) => `envio:${levantamientoId}`,
  visita: (tecnicoId: string, id: string) => `visita:${tecnicoId}:${id}`,
  estado: (id: string) => `estado:${id}`,
};
