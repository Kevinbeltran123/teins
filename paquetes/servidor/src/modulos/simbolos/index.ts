import { eq, inArray, sql } from "drizzle-orm";
import { validarBiblioteca, type DefinicionSimbolo } from "@teins/dominio";
import type { TxOrganizacion } from "../../plataforma/base-de-datos";
import { problema } from "../../plataforma/errores";
import { registrarCambios } from "../cambios";
import { simbolos } from "./esquema";

/** Lo que baja a los teléfonos (ADR-0027): la definición, su orden y si sigue en la biblioteca. */
export interface SimboloParaTelefono extends DefinicionSimbolo {
  orden: number;
  activo: boolean;
}

/** Interfaz pública del módulo de símbolos (iteración 19). */
export interface Simbolos {
  /**
   * Publica la biblioteca completa desde su archivo: crea o cambia cada símbolo y retira los que ya no están.
   * Lo que cambió baja a los teléfonos en la siguiente sincronización, sin publicar la app (como los formatos).
   */
  publicar(tx: TxOrganizacion, organizacionId: string, biblioteca: unknown): Promise<{ nuevos: number; cambiados: number; retirados: number }>;
  /** Símbolos por id, activos o no, para la bajada. */
  porId(tx: TxOrganizacion, ids: readonly string[]): Promise<SimboloParaTelefono[]>;
}

const comoSimbolo = (f: typeof simbolos.$inferSelect): SimboloParaTelefono => ({
  id: f.id,
  nombre: f.nombre,
  categoria: f.categoria,
  trazado: f.trazado,
  ...(f.relleno === null ? {} : { relleno: f.relleno }),
  ...(f.texto === null ? {} : { texto: f.texto }),
  ...(f.codigo === null ? {} : { codigo: f.codigo }),
  orden: f.orden,
  activo: f.activo,
});

export function crearSimbolos(): Simbolos {
  return {
    async publicar(tx, organizacionId, biblioteca) {
      const errores = validarBiblioteca(biblioteca);
      if (errores.length > 0) throw problema("entrada_invalida", errores.join("; "));
      const nuevos = (biblioteca as DefinicionSimbolo[]).map((s, orden) => ({
        id: s.id,
        nombre: s.nombre.trim(),
        categoria: s.categoria.trim(),
        trazado: s.trazado,
        relleno: s.relleno ?? null,
        texto: s.texto ?? null,
        codigo: s.codigo ?? null,
        orden,
        activo: true,
      }));
      const antes = new Map((await tx.select().from(simbolos).where(eq(simbolos.organizacionId, organizacionId))).map((f) => [f.id, f]));
      const tocados: string[] = [];
      let cambiados = 0;
      for (const s of nuevos) {
        const previo = antes.get(s.id);
        const igual = previo && (Object.keys(s) as (keyof typeof s)[]).every((k) => previo[k] === s[k]);
        if (igual) continue;
        if (previo) cambiados++;
        await tx
          .insert(simbolos)
          .values({ organizacionId, ...s })
          .onConflictDoUpdate({ target: [simbolos.organizacionId, simbolos.id], set: { ...s, actualizadoEn: sql`now()` } });
        tocados.push(s.id);
      }
      const quedan = new Set(nuevos.map((s) => s.id));
      const retirar = [...antes.values()].filter((f) => f.activo && !quedan.has(f.id)).map((f) => f.id);
      if (retirar.length > 0) {
        await tx
          .update(simbolos)
          .set({ activo: false, actualizadoEn: sql`now()` })
          .where(inArray(simbolos.id, retirar));
      }
      await registrarCambios(tx, [...tocados, ...retirar].map((entidadId) => ({ organizacionId, entidad: "simbolo" as const, entidadId, operacion: "cambio" as const })));
      return { nuevos: tocados.length - cambiados, cambiados, retirados: retirar.length };
    },

    async porId(tx, ids) {
      if (ids.length === 0) return [];
      return (await tx.select().from(simbolos).where(inArray(simbolos.id, [...ids]))).map(comoSimbolo);
    },
  };
}
