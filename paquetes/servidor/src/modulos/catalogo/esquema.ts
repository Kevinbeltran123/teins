import { boolean, index, integer, pgSchema, text, unique, uuid } from "drizzle-orm/pg-core";
import { aislamientoPorOrganizacion, marcaDeTiempo, organizacionId } from "../../plataforma/esquema-comun";

export const esquemaCatalogo = pgSchema("catalogo");

/**
 * Ítem del catálogo de materiales y trabajos de la organización (modelo de dominio; P28). Oficina lo
 * gestiona; las líneas de cantidad se vinculan a él. Nunca se borra: se desactiva (regla 14).
 */
export const itemsCatalogo = esquemaCatalogo.table(
  "items",
  {
    id: uuid("id").primaryKey(),
    organizacionId: organizacionId(),
    codigo: text("codigo").notNull(),
    descripcion: text("descripcion").notNull(),
    unidad: text("unidad").notNull(),
    activo: boolean("activo").notNull().default(true),
    creadoEn: marcaDeTiempo("creado_en").notNull().defaultNow(),
    actualizadoEn: marcaDeTiempo("actualizado_en").notNull().defaultNow(),
  },
  (t) => [unique("items_codigo_por_organizacion").on(t.organizacionId, t.codigo), index("items_descripcion_idx").on(t.organizacionId, t.descripcion), aislamientoPorOrganizacion("items")],
).enableRLS();

/**
 * Lista de precios con historia (ADR-0029): cada cambio agrega un precio vigente desde su fecha; el
 * vigente es el más reciente. Pesos enteros, sin IVA. Nunca baja al teléfono (regla 7).
 */
export const preciosCatalogo = esquemaCatalogo.table(
  "precios",
  {
    id: uuid("id").primaryKey(),
    organizacionId: organizacionId(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => itemsCatalogo.id),
    valor: integer("valor").notNull(),
    desde: marcaDeTiempo("desde").notNull().defaultNow(),
    /** Quién lo puso: a mano o al importar el catálogo. */
    por: text("por").notNull(),
    origen: text("origen", { enum: ["manual", "importado"] }).notNull(),
  },
  (t) => [index("precios_item_idx").on(t.organizacionId, t.itemId, t.desde), aislamientoPorOrganizacion("precios")],
).enableRLS();
