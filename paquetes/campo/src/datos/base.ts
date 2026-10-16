import Dexie, { type EntityTable, type Table } from "dexie";
import type { VersionFormato } from "@teins/dominio";
import v1 from "@teins/dominio/formatos-de-prueba/prueba-ups.v1.json";
import v2 from "@teins/dominio/formatos-de-prueba/prueba-ups.v2.json";
import { VERSION_APP } from "../version";
import type { Ajuste, ClaveLocal, ArchivoGuardado, BajadaLocal, EnvioGuardado, EstadoServidorGuardado, FormatoLocal, ItemCatalogoLocal, LecturaDeChat, LevantamientoGuardado, RespuestaGuardada, SimboloLocal, UsuarioLocal, VisitaGuardada } from "./modelo";

export type BaseCampo = Dexie & {
  levantamientos: EntityTable<LevantamientoGuardado, "id">;
  archivos: EntityTable<ArchivoGuardado, "id">;
  envios: EntityTable<EnvioGuardado, "levantamientoId">;
  ajustes: EntityTable<Ajuste, "clave">;
  formatos: Table<FormatoLocal, [string, number]>;
  visitas: Table<VisitaGuardada, [string, string]>;
  estadosServidor: EntityTable<EstadoServidorGuardado, "id">;
  bajadas: EntityTable<BajadaLocal, "tecnicoId">;
  claves: EntityTable<ClaveLocal, "tecnicoId">;
  catalogo: EntityTable<ItemCatalogoLocal, "id">;
  simbolos: EntityTable<SimboloLocal, "id">;
  respuestasPendientes: EntityTable<RespuestaGuardada, "llave">;
  lecturasDeChat: Table<LecturaDeChat, [string, string]>;
};

/** Los formatos que los cortes 0 y 1 traían en el código. Solo los usa la migración a la versión 3. */
const FORMATOS_INCLUIDOS = [v1, v2] as VersionFormato[];
/** Permiso inicial de quien ya tenía sesión al actualizar: igual al de un contacto (ADR-0009, parte 2). */
const DIAS_DE_PERMISO_AL_MIGRAR = 7;

/** Usuario con sesión en el teléfono, o null. */
export async function leerUsuario(db: BaseCampo): Promise<UsuarioLocal | null> {
  const ajuste = await db.ajustes.get("usuario");
  return ajuste?.clave === "usuario" ? ajuste.valor : null;
}

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
        .table<ArchivoGuardado>("archivos")
        .toCollection()
        .modify((archivo) => {
          archivo.subida = "pendiente";
        }),
    );

  // Corte 2: formatos como datos, visitas, estado según el servidor, punto de control y permiso local.
  db.version(3)
    .stores({
      formatos: "[formato+version], formato",
      visitas: "[tecnicoId+id], tecnicoId",
      estadosServidor: "id, tecnicoId",
      bajadas: "tecnicoId",
    })
    .upgrade(async (tx) => {
      // Ningún borrador pierde su formato: los que venían en el código pasan a la base.
      await tx.table<FormatoLocal>("formatos").bulkPut(FORMATOS_INCLUIDOS);
      // Quien ya tenía sesión no queda bloqueado por estar sin señal justo después de actualizar.
      const usuario = await tx.table<Ajuste>("ajustes").get("usuario");
      if (usuario?.clave === "usuario") {
        const hasta = new Date(Date.now() + DIAS_DE_PERMISO_AL_MIGRAR * 86_400_000).toISOString();
        await tx.table<BajadaLocal>("bajadas").put({ tecnicoId: usuario.valor.id, puntoDeControl: 0, versionApp: VERSION_APP, permisoLocalHasta: hasta });
      }
    });

  // Iteración 12: una clave por técnico (ADR-0022). Sin `upgrade`: WebCrypto no cabe en la transacción
  // de la migración, así que lo de antes se sella después, registro por registro, sin borrar nada (regla 5).
  db.version(4).stores({ claves: "tecnicoId", archivos: "id, subida, cifrado" });

  // Iteración 17: el catálogo de la organización, para elegir materiales sin conexión (ADR-0025). Llega con
  // la bajada: al actualizar a la app 8, el teléfono baja todo de nuevo y lo trae completo.
  db.version(5).stores({ catalogo: "id" });

  // Iteración 19: la biblioteca de símbolos de los bocetos (ADR-0027), igual que el catálogo: llega con la bajada
  // y, al actualizar a la app 10, el teléfono baja todo de nuevo y la trae completa.
  db.version(6).stores({ simbolos: "id" });

  // Iteración 39: lo que el técnico responde a oficina y espera señal, sellado, y hasta dónde leyó cada chat (ADR-0040).
  // Solo tablas nuevas: no se transforma ni se borra nada de antes.
  db.version(7).stores({ respuestasPendientes: "llave, tecnicoId, levantamientoId", lecturasDeChat: "[tecnicoId+levantamientoId], tecnicoId" });

  return db;
}
