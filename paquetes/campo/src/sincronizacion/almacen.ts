import { fotosReferenciadas } from "@teins/dominio";
import type { BaseCampo } from "../datos/base";
import type { ArchivoLocal, EnvioLocal } from "../datos/modelo";

/** Operaciones del motor sobre la base local. */
export interface AlmacenSincronizacion {
  /** Fotos pendientes de los levantamientos de este técnico: nunca se suben con la sesión de otro. */
  archivosPorSubir(tecnicoId: string): Promise<ArchivoLocal[]>;
  marcarSubida(huella: string): Promise<void>;
  registrarErrorDeSubida(huella: string, mensaje: string): Promise<void>;
  marcarPorSubir(huellas: readonly string[]): Promise<void>;
  enviosListos(ahora: number, tecnicoId: string): Promise<EnvioLocal[]>;
  /** Cuándo toca el próximo intento pendiente de este técnico, o null si no hay nada que esperar. */
  proximoIntento(tecnicoId: string): Promise<number | null>;
  actualizarEnvio(levantamientoId: string, cambios: Partial<EnvioLocal>): Promise<void>;
  /** Un envío que quedó "enviando" porque la app se cerró en medio vuelve a pendiente. */
  recuperarInterrumpidos(): Promise<void>;
  /** Tras iniciar sesión o actualizar la app, lo que esperaba por eso vuelve a la cola. */
  reanudar(desde: EnvioLocal["estado"]): Promise<void>;
}

export function almacenDexie(db: BaseCampo): AlmacenSincronizacion {
  return {
    async archivosPorSubir(tecnicoId) {
      const propios = await db.levantamientos.where("tecnicoId").equals(tecnicoId).toArray();
      const huellas = new Set(propios.flatMap((l) => fotosReferenciadas(l.respuestas)));
      const pendientes = await db.archivos.where("subida").equals("pendiente").toArray();
      return pendientes.filter((a) => huellas.has(a.id));
    },
    async marcarSubida(huella) {
      await db.archivos.update(huella, { subida: "subida", ultimoErrorDeSubida: undefined });
    },
    async registrarErrorDeSubida(huella, mensaje) {
      await db.archivos.update(huella, { ultimoErrorDeSubida: mensaje });
    },
    async marcarPorSubir(huellas) {
      await db.archivos.where("id").anyOf([...huellas]).modify({ subida: "pendiente" });
    },
    async enviosListos(ahora, tecnicoId) {
      const pendientes = await db.envios.where("estado").equals("pendiente").filter((e) => e.tecnicoId === tecnicoId).toArray();
      return pendientes.filter((e) => e.proximoIntentoEn <= ahora).sort((a, b) => a.creadoEn.localeCompare(b.creadoEn));
    },
    async proximoIntento(tecnicoId) {
      const pendientes = await db.envios.where("estado").equals("pendiente").filter((e) => e.tecnicoId === tecnicoId).toArray();
      return pendientes.length === 0 ? null : Math.min(...pendientes.map((e) => e.proximoIntentoEn));
    },
    async actualizarEnvio(levantamientoId, cambios) {
      await db.envios.update(levantamientoId, cambios);
    },
    async recuperarInterrumpidos() {
      await db.envios.where("estado").equals("enviando").modify({ estado: "pendiente" });
    },
    async reanudar(desde) {
      await db.envios.where("estado").equals(desde).modify({ estado: "pendiente", proximoIntentoEn: 0 });
    },
  };
}
