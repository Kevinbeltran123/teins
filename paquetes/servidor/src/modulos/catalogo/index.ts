import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { enOrganizacion, esViolacionUnica, type BaseDeDatos, type TxOrganizacion } from "../../plataforma/base-de-datos";
import { problema } from "../../plataforma/errores";
import { evaluar, politicas } from "../../plataforma/politicas";
import { registrarOperacion } from "../../plataforma/rutas";
import { registrar } from "../auditoria";
import { registrarCambios } from "../cambios";
import type { Identidad } from "../identidad";
import { itemsCatalogo, preciosCatalogo } from "./esquema";

export interface ItemDeCatalogo {
  id: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  activo: boolean;
}

/** El catálogo baja a los teléfonos (ADR-0025): cada ítem creado o cambiado se registra para toda la organización. */
const paraLosTelefonos = (tx: TxOrganizacion, organizacionId: string, ids: readonly string[]) =>
  registrarCambios(tx, ids.map((entidadId) => ({ organizacionId, entidad: "item_catalogo" as const, entidadId, operacion: "cambio" as const })));

/** Interfaz pública del módulo de catálogo (iteración 11; modelo de dominio, "Formatos y catálogos"). */
export interface Catalogo {
  /** Ítems por id, activos o no: una línea vinculada a un ítem desactivado conserva su vínculo. */
  items(tx: TxOrganizacion, ids: readonly string[]): Promise<Map<string, ItemDeCatalogo>>;
  /** Precio vigente de cada ítem que tiene uno (ADR-0029). */
  preciosVigentes(tx: TxOrganizacion, ids?: readonly string[]): Promise<Map<string, { valor: number; desde: Date }>>;
  registrarRutas(app: FastifyInstance): void;
}

/** El vigente es el más reciente de cada ítem. */
async function vigentes(tx: TxOrganizacion, ids?: readonly string[]): Promise<Map<string, { valor: number; desde: Date }>> {
  if (ids && ids.length === 0) return new Map();
  const filas = await tx
    .selectDistinctOn([preciosCatalogo.itemId], { itemId: preciosCatalogo.itemId, valor: preciosCatalogo.valor, desde: preciosCatalogo.desde })
    .from(preciosCatalogo)
    .where(ids ? inArray(preciosCatalogo.itemId, [...ids]) : undefined)
    .orderBy(preciosCatalogo.itemId, desc(preciosCatalogo.desde), desc(preciosCatalogo.id));
  return new Map(filas.map((f) => [f.itemId, { valor: f.valor, desde: f.desde }]));
}

const comoItem = (f: typeof itemsCatalogo.$inferSelect, precio?: { valor: number; desde: Date }) => ({
  id: f.id,
  codigo: f.codigo,
  descripcion: f.descripcion,
  unidad: f.unidad,
  activo: f.activo,
  actualizadoEn: f.actualizadoEn.toISOString(),
  precio: precio ? { valor: precio.valor, desde: precio.desde.toISOString() } : null,
});

export function crearCatalogo(bd: BaseDeDatos, identidad: Pick<Identidad, "nombres">): Catalogo {
  return {
    async items(tx, ids) {
      if (ids.length === 0) return new Map();
      const filas = await tx.select().from(itemsCatalogo).where(inArray(itemsCatalogo.id, [...ids]));
      return new Map(filas.map((f) => [f.id, { id: f.id, codigo: f.codigo, descripcion: f.descripcion, unidad: f.unidad, activo: f.activo }]));
    },

    preciosVigentes: vigentes,

    registrarRutas(app) {
      registrarOperacion(app, "listarCatalogo", {
        politica: politicas.oficina,
        manejar: async ({ actor }) =>
          enOrganizacion(bd, actor.organizacionId, async (tx) => {
            const precios = await vigentes(tx);
            return { items: (await tx.select().from(itemsCatalogo).orderBy(asc(itemsCatalogo.codigo))).map((f) => comoItem(f, precios.get(f.id))) };
          }),
      });

      registrarOperacion(app, "crearItemCatalogo", {
        politica: politicas.oficina,
        manejar: async ({ cuerpo, actor, correlacion }) => {
          try {
            return await enOrganizacion(bd, actor.organizacionId, async (tx) => {
              const [fila] = await tx.insert(itemsCatalogo).values({ id: randomUUID(), organizacionId: actor.organizacionId, ...cuerpo }).returning();
              await paraLosTelefonos(tx, actor.organizacionId, [fila!.id]);
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
            await paraLosTelefonos(tx, actor.organizacionId, [id]);
            const precio = (await vigentes(tx, [id])).get(id);
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
            return comoItem(fila!, precio);
          }),
      });

      registrarOperacion(app, "cambiarPrecio", {
        politica: politicas.administrador,
        manejar: async ({ parametros: { id }, cuerpo, actor, correlacion }) =>
          enOrganizacion(bd, actor.organizacionId, async (tx) => {
            const [item] = await tx.select().from(itemsCatalogo).where(eq(itemsCatalogo.id, id));
            if (!item) throw problema("no_encontrado", "El ítem no existe");
            const anterior = (await vigentes(tx, [id])).get(id);
            const desde = new Date();
            // Nunca se pisa: el nuevo rige desde ahora y el anterior queda en la historia.
            await tx.insert(preciosCatalogo).values({ id: randomUUID(), organizacionId: actor.organizacionId, itemId: id, valor: cuerpo.precio, desde, por: actor.usuarioId, origen: "manual" });
            await registrar(tx, [
              { organizacionId: actor.organizacionId, agregadoTipo: "item_catalogo", agregadoId: id, tipoEvento: "precio_cambiado", autorId: actor.usuarioId, correlacion, valorAnterior: anterior?.valor ?? null, valorNuevo: cuerpo.precio },
            ]);
            return comoItem(item, { valor: cuerpo.precio, desde });
          }),
      });

      registrarOperacion(app, "historialDePrecio", {
        politica: politicas.oficina,
        manejar: async ({ parametros: { id }, actor }) => {
          const filas = await enOrganizacion(bd, actor.organizacionId, async (tx) => {
            const [item] = await tx.select({ id: itemsCatalogo.id }).from(itemsCatalogo).where(eq(itemsCatalogo.id, id));
            if (!item) throw problema("no_encontrado", "El ítem no existe");
            return tx.select().from(preciosCatalogo).where(eq(preciosCatalogo.itemId, id)).orderBy(desc(preciosCatalogo.desde), desc(preciosCatalogo.id));
          });
          const nombres = await identidad.nombres(actor.organizacionId, [...new Set(filas.map((f) => f.por))]);
          return {
            precios: filas.map((f) => ({ valor: f.valor, desde: f.desde.toISOString(), por: { id: f.por, nombre: nombres.get(f.por) ?? "[Usuario no disponible]" }, origen: f.origen })),
          };
        },
      });

      registrarOperacion(app, "importarCatalogo", {
        politica: politicas.oficina,
        manejar: async ({ cuerpo, actor, correlacion }) => {
          // Con precios, la misma política que cambiar un precio: administración con segundo factor (ADR-0029).
          if (cuerpo.items.some((i) => i.precio !== undefined)) {
            const decision = evaluar(politicas.administrador, actor);
            if (decision !== "permitido") throw problema(decision, "Importar precios es de administración");
          }
          return enOrganizacion(bd, actor.organizacionId, async (tx) => {
            // El último de cada código manda: un CSV con códigos repetidos no falla.
            const porCodigo = new Map(cuerpo.items.map((i) => [i.codigo, i]));
            const existentes = new Set(
              (await tx.select({ codigo: itemsCatalogo.codigo }).from(itemsCatalogo).where(inArray(itemsCatalogo.codigo, [...porCodigo.keys()]))).map((f) => f.codigo),
            );
            const tocados: string[] = [];
            for (const lote of dividir([...porCodigo.values()], 500)) {
              // Solo cambia (y baja a los teléfonos) lo nuevo o lo distinto. Un ítem desactivado sigue así:
              // reactivarlo es una decisión de oficina, no un efecto de importar la lista.
              const cambiados = await tx
                .insert(itemsCatalogo)
                .values(lote.map(({ precio: _precio, ...i }) => ({ id: randomUUID(), organizacionId: actor.organizacionId, ...i })))
                .onConflictDoUpdate({
                  target: [itemsCatalogo.organizacionId, itemsCatalogo.codigo],
                  set: { descripcion: sql`excluded.descripcion`, unidad: sql`excluded.unidad`, actualizadoEn: new Date() },
                  setWhere: sql`${itemsCatalogo.descripcion} is distinct from excluded.descripcion or ${itemsCatalogo.unidad} is distinct from excluded.unidad`,
                })
                .returning({ id: itemsCatalogo.id });
              tocados.push(...cambiados.map((f) => f.id));
              const filas = await tx.select({ id: itemsCatalogo.id, codigo: itemsCatalogo.codigo }).from(itemsCatalogo).where(inArray(itemsCatalogo.codigo, lote.map((i) => i.codigo)));
              // Solo se agrega a la historia un precio que cambia: reimportar la misma lista no la ensucia.
              const conPrecio = filas.flatMap((f) => {
                const precio = porCodigo.get(f.codigo)?.precio;
                return precio === undefined ? [] : [{ itemId: f.id, precio }];
              });
              const actuales = await vigentes(tx, conPrecio.map((p) => p.itemId));
              const nuevos = conPrecio.filter((p) => actuales.get(p.itemId)?.valor !== p.precio);
              if (nuevos.length > 0) {
                await tx.insert(preciosCatalogo).values(nuevos.map((p) => ({ id: randomUUID(), organizacionId: actor.organizacionId, itemId: p.itemId, valor: p.precio, por: actor.usuarioId, origen: "importado" as const })));
              }
            }
            await paraLosTelefonos(tx, actor.organizacionId, tocados);
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
          });
        },
      });
    },
  };
}

function dividir<T>(lista: readonly T[], tamano: number): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < lista.length; i += tamano) lotes.push(lista.slice(i, i + tamano));
  return lotes;
}
