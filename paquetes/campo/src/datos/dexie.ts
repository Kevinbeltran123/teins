import Dexie, { type EntityTable } from "dexie";
import { agregarFoto, responder, type Levantamiento } from "@teins/dominio";
import type { ArchivoLocal, RepositorioLevantamientos } from "./repositorio";

type BaseCampo = Dexie & {
  levantamientos: EntityTable<Levantamiento, "id">;
  archivos: EntityTable<ArchivoLocal, "id">;
};

/**
 * Regla absoluta (ADR-0004): una versión nueva nunca borra la base. Cada `version(n)`
 * agrega una migración con `upgrade` y se prueba con borradores pendientes.
 */
export function abrirBase(nombre = "teins-campo"): BaseCampo {
  const db = new Dexie(nombre) as BaseCampo;
  db.version(1).stores({
    levantamientos: "id, estado, actualizadoEn",
    archivos: "id",
  });
  return db;
}

export function repositorioDexie(db: BaseCampo): RepositorioLevantamientos {
  async function modificar(id: string, cambio: (l: Levantamiento) => Levantamiento) {
    const levantamiento = await db.levantamientos.get(id);
    if (!levantamiento) throw new Error(`Levantamiento ${id} no existe en el dispositivo`);
    await db.levantamientos.put(cambio(levantamiento));
  }

  return {
    async crear(levantamiento) {
      await db.levantamientos.add(levantamiento);
    },
    obtener: (id) => db.levantamientos.get(id),
    listar: () => db.levantamientos.orderBy("actualizadoEn").reverse().toArray(),

    guardarRespuesta(id, seccion, campo, valor, ahora) {
      return db.transaction("rw", db.levantamientos, () =>
        modificar(id, (l) => responder(l, seccion, campo, valor, ahora)),
      );
    },

    agregarFoto(id, seccion, campo, archivo, ahora) {
      return db.transaction("rw", db.levantamientos, db.archivos, async () => {
        // Direccionado por contenido: la misma foto dos veces es un solo archivo.
        await db.archivos.put(archivo);
        await modificar(id, (l) => agregarFoto(l, seccion, campo, archivo.id, ahora));
      });
    },

    async obtenerArchivos(ids) {
      const archivos = await db.archivos.bulkGet([...ids]);
      return archivos.filter((a) => a !== undefined);
    },
    todosLosArchivos: () => db.archivos.toArray(),
  };
}
