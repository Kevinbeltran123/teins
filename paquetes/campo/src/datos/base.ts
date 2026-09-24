import Dexie, { type EntityTable } from "dexie";
import type { Ajuste, ArchivoLocal, EnvioLocal, LevantamientoLocal } from "./modelo";

export type BaseCampo = Dexie & {
  levantamientos: EntityTable<LevantamientoLocal, "id">;
  archivos: EntityTable<ArchivoLocal, "id">;
  envios: EntityTable<EnvioLocal, "levantamientoId">;
  ajustes: EntityTable<Ajuste, "clave">;
};

/**
 * Esquema local versionado (ADR-0004). Regla absoluta: una versión nueva nunca borra la base;
 * cada versión agrega y transforma con `upgrade`, y se prueba sobre datos de la anterior con
 * borradores y fotos pendientes (ADR-0018, nivel 4).
 */
export function abrirBase(nombre = "teins-campo"): BaseCampo {
  const db = new Dexie(nombre) as BaseCampo;

  // Corte 0: captura sin conexión.
  db.version(1).stores({
    levantamientos: "id, estado, actualizadoEn",
    archivos: "id",
  });

  // Corte 1: responsable de cada levantamiento, outbox de envíos, estado de subida de cada foto y sesión.
  db.version(2)
    .stores({
      levantamientos: "id, estado, actualizadoEn, tecnicoId",
      archivos: "id, subida",
      envios: "levantamientoId, estado, tecnicoId",
      ajustes: "clave",
    })
    .upgrade((tx) =>
      // Ninguna foto del corte 0 se subió todavía.
      tx
        .table<ArchivoLocal>("archivos")
        .toCollection()
        .modify((archivo) => {
          archivo.subida = "pendiente";
        }),
    );

  return db;
}
