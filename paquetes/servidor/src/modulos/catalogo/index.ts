import { randomUUID } from "node:crypto";
import { asc, eq, inArray, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { enOrganizacion, esViolacionUnica, type BaseDeDatos, type TxOrganizacion } from "../../plataforma/base-de-datos";
import { problema } from "../../plataforma/errores";
import { politicas } from "../../plataforma/politicas";
import { registrarOperacion } from "../../plataforma/rutas";
import { registrar } from "../auditoria";
import { itemsCatalogo } from "./esquema";

export interface ItemDeCatalogo {
  id: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  activo: boolean;
}

/** Interfaz pública del módulo de catálogo (iteración 11; modelo de dominio, "Formatos y catálogos"). */
export interface Catalogo {
  /** Ítems por id, activos o no: una línea vinculada a un ítem desactivado conserva su vínculo. */
  items(tx: TxOrganizacion, ids: readonly string[]): Promise<Map<string, ItemDeCatalogo>>;
  registrarRutas(app: FastifyInstance): void;
}

const comoItem = (f: typeof itemsCatalogo.$inferSelect) => ({
  id: f.id,
  codigo: f.codigo,
  descripcion: f.descripcion,
  unidad: f.unidad,
  activo: f.activo,
  actualizadoEn: f.actualizadoEn.toISOString(),
});

export function crearCatalogo(bd: BaseDeDatos): Catalogo {
  return {
    async items(tx, ids) {
      if (ids.length === 0) return new Map();
      const filas = await tx.select().from(itemsCatalogo).where(inArray(itemsCatalogo.id, [...ids]));
      return new Map(filas.map((f) => [f.id, { id: f.id, codigo: f.codigo, descripcion: f.descripcion, unidad: f.unidad, activo: f.activo }]));
    },

    registrarRutas(app) {
      registrarOperacion(app, "listarCatalogo", {
        politica: politicas.oficina,
        manejar: async ({ actor }) =>
          enOrganizacion(bd, actor.organizacionId, async (tx) => ({
            items: (await tx.select().from(itemsCatalogo).orderBy(asc(itemsCatalogo.codigo))).map(comoItem),
          })),
      });

      registrarOperacion(app, "crearItemCatalogo", {
        politica: politicas.oficina,
        manejar: async ({ cuerpo, actor, correlacion }) => {
          try {
            return await enOrganizacion(bd, actor.organizacionId, async (tx) => {
              const [fila] = await tx.insert(itemsCatalogo).values({ id: randomUUID(), organizacionId: actor.organizacionId, ...cuerpo }).returning();
              await registrar(tx, [
                { organizacionId: actor.organizacionId, agregadoTipo: "item_catalogo", agregadoId: fila!.id, tipoEvento: "item_catalogo_creado", autorId: actor.usuarioId, correlacion, valorNuevo: cuerpo },
              ]);
              return comoItem(fila!);
            });
          } catch (error) {
            if (esViolacionUnica(error, "items_codigo_por_organizacion")) throw problema("conflicto", `Ya hay un ítem con el código ${cuerpo.codigo}`);
            throw error;
          }
        },
      });

      registrarOperacion(app, "actualizarItemCatalogo", {
        politica: politicas.oficina,
        manejar: async ({ parametros: { id }, cuerpo, actor, correlacion }) =>
          enOrganizacion(bd, actor.organizacionId, async (tx) => {
            const [antes] = await tx.select().from(itemsCatalogo).where(eq(itemsCatalogo.id, id));
            if (!antes) throw problema("no_encontrado", "El ítem no existe");
            const [fila] = await tx.update(itemsCatalogo).set({ ...cuerpo, actualizadoEn: new Date() }).where(eq(itemsCatalogo.id, id)).returning();
            await registrar(tx, [
              {
                organizacionId: actor.organizacionId,
                agregadoTipo: "item_catalogo",
                agregadoId: id,
                tipoEvento: "item_catalogo_actualizado",
                autorId: actor.usuarioId,
                correlacion,
                valorAnterior: { descripcion: antes.descripcion, unidad: antes.unidad, activo: antes.activo },
                valorNuevo: cuerpo,
              },
            ]);
            return comoItem(fila!);
          }),
      });

      registrarOperacion(app, "importarCatalogo", {
        politica: politicas.oficina,
        manejar: async ({ cuerpo, actor, correlacion }) =>
          enOrganizacion(bd, actor.organizacionId, async (tx) => {
            // El último de cada código manda: un CSV con códigos repetidos no falla.
            const porCodigo = new Map(cuerpo.items.map((i) => [i.codigo, i]));
            const existentes = new Set(
              (await tx.select({ codigo: itemsCatalogo.codigo }).from(itemsCatalogo).where(inArray(itemsCatalogo.codigo, [...porCodigo.keys()]))).map((f) => f.codigo),
            );
            for (const lote of dividir([...porCodigo.values()], 500)) {
              await tx
                .insert(itemsCatalogo)
                .values(lote.map((i) => ({ id: randomUUID(), organizacionId: actor.organizacionId, ...i })))
                .onConflictDoUpdate({
                  target: [itemsCatalogo.organizacionId, itemsCatalogo.codigo],
                  set: { descripcion: sql`excluded.descripcion`, unidad: sql`excluded.unidad`, activo: true, actualizadoEn: new Date() },
                });
            }
            const creados = porCodigo.size - existentes.size;
            await registrar(tx, [
              {
                organizacionId: actor.organizacionId,
                agregadoTipo: "organizacion",
                agregadoId: actor.organizacionId,
                tipoEvento: "catalogo_importado",
                autorId: actor.usuarioId,
                correlacion,
                valorNuevo: { creados, actualizados: existentes.size },
              },
            ]);
            return { creados, actualizados: existentes.size };
          }),
      });
    },
  };
}

function dividir<T>(lista: readonly T[], tamano: number): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < lista.length; i += tamano) lotes.push(lista.slice(i, i + tamano));
  return lotes;
}
