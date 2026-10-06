import type { BaseCampo } from "./base";
import type { RespuestaPendiente } from "./modelo";
import { abrirRespuesta, sellarRespuesta } from "./registros";

/*
  El chat con oficina de un levantamiento enviado (ADR-0040). Lo que responde el técnico queda en el teléfono al
  instante, sellado, y el motor lo envía cuando hay señal; lo leído se guarda aquí, no en el servidor.
*/

/** Responde la conversación de un comentario de oficina. La llave la crea el teléfono: el servidor la ve una sola vez. */
export async function responder(db: BaseCampo, tecnicoId: string, datos: Pick<RespuestaPendiente, "levantamientoId" | "comentarioId" | "texto">, ahora: Date): Promise<RespuestaPendiente> {
  const respuesta: RespuestaPendiente = { ...datos, llave: crypto.randomUUID(), tecnicoId, creadaEn: ahora.toISOString(), intentos: 0, proximoIntentoEn: 0 };
  // WebCrypto no cabe en una transacción de Dexie (ADR-0022): se sella antes.
  await db.respuestasPendientes.add(await sellarRespuesta(db, respuesta));
  return respuesta;
}

/** Lo que este técnico respondió en un levantamiento y la bajada todavía no trae, en el orden en que lo escribió. */
export async function pendientesDe(db: BaseCampo, tecnicoId: string, levantamientoId: string): Promise<RespuestaPendiente[]> {
  const guardadas = await db.respuestasPendientes.where("levantamientoId").equals(levantamientoId).filter((r) => r.tecnicoId === tecnicoId).toArray();
  return (await Promise.all(guardadas.map((g) => abrirRespuesta(db, g)))).sort((a, b) => a.creadaEn.localeCompare(b.creadaEn));
}

export async function leidoHasta(db: BaseCampo, tecnicoId: string, levantamientoId: string): Promise<string | null> {
  return (await db.lecturasDeChat.get([tecnicoId, levantamientoId]))?.leidoHasta ?? null;
}

/** El técnico abrió el chat: lo de oficina hasta `hasta` queda leído. Solo avanza. */
export function marcarLeido(db: BaseCampo, tecnicoId: string, levantamientoId: string, hasta: string): Promise<void> {
  return db.transaction("rw", db.lecturasDeChat, async () => {
    const actual = await db.lecturasDeChat.get([tecnicoId, levantamientoId]);
    if (!actual || actual.leidoHasta < hasta) await db.lecturasDeChat.put({ tecnicoId, levantamientoId, leidoHasta: hasta });
  });
}
