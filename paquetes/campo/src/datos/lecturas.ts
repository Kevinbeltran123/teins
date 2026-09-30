import type { BaseCampo } from "./base";
import type { EstadoServidor, VisitaLocal } from "./modelo";
import { abrirEstado, abrirVisita } from "./registros";

/** Lecturas para las pantallas: abren lo sellado (ADR-0022). Sirven dentro de `useLiveQuery`. */
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
