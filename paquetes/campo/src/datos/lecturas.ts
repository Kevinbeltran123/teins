import type { BaseCampo } from "./base";
import type { BajadaLocal, EstadoDeEnvio, EstadoServidor, VisitaLocal } from "./modelo";
import { abrirEstado, abrirVisita } from "./registros";

/**
 * Lecturas para las pantallas: abren lo sellado (ADR-0022); lo que se guarda a la vista (estado de los envíos, la
 * bajada) sale tal cual, sin el contenido sellado. Sirven dentro de `useLiveQuery`.
 */
export async function visitasDe(db: BaseCampo, tecnicoId: string): Promise<VisitaLocal[]> {
  return Promise.all((await db.visitas.where("tecnicoId").equals(tecnicoId).toArray()).map((v) => abrirVisita(db, v)));
}

export async function visitaDe(db: BaseCampo, tecnicoId: string, id: string): Promise<VisitaLocal | null> {
  const v = await db.visitas.get([tecnicoId, id]);
  return v ? abrirVisita(db, v) : null;
}

export async function estadosDe(db: BaseCampo, tecnicoId: string): Promise<EstadoServidor[]> {
  return Promise.all((await db.estadosServidor.where("tecnicoId").equals(tecnicoId).toArray()).map((e) => abrirEstado(db, e)));
}

export async function estadoDe(db: BaseCampo, id: string): Promise<EstadoServidor | null> {
  const e = await db.estadosServidor.get(id);
  return e ? abrirEstado(db, e) : null;
}

export function enviosDe(db: BaseCampo, tecnicoId: string): Promise<EstadoDeEnvio[]> {
  return db.envios.where("tecnicoId").equals(tecnicoId).toArray();
}

export async function bajadaDe(db: BaseCampo, tecnicoId: string): Promise<BajadaLocal | null> {
  return (await db.bajadas.get(tecnicoId)) ?? null;
}

/** Hasta dónde leyó el técnico cada chat, por levantamiento. Sin abrir lo sellado: lo leído no lleva contenido. */
export async function leidoPorLevantamiento(db: BaseCampo, tecnicoId: string): Promise<Map<string, string>> {
  return new Map((await db.lecturasDeChat.where("tecnicoId").equals(tecnicoId).toArray()).map((l) => [l.levantamientoId, l.leidoHasta]));
}

/** Cuántas respuestas esperan salir, por levantamiento: se cuentan por lo que está a la vista, sin abrirlas. */
export async function enColaPorLevantamiento(db: BaseCampo, tecnicoId: string): Promise<Map<string, number>> {
  const enCola = new Map<string, number>();
  for (const r of await db.respuestasPendientes.where("tecnicoId").equals(tecnicoId).toArray()) if (!r.enviada && !r.rechazo) enCola.set(r.levantamientoId, (enCola.get(r.levantamientoId) ?? 0) + 1);
  return enCola;
}
