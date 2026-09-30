import { boolean, integer, pgSchema, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { aislamientoPorOrganizacion, marcaDeTiempo, organizacionId } from "../../plataforma/esquema-comun";

export const esquemaSimbolos = pgSchema("simbolos");

/**
 * Símbolo de la biblioteca de los bocetos (iteración 19, ADR-0027). La organización publica la biblioteca
 * completa; el que sale de ella se retira (`activo = false`) y nunca se borra: los bocetos lo llevan copiado.
 * El id viene en el archivo de la biblioteca, así que es único por organización.
 */
export const simbolos = esquemaSimbolos.table(
  "simbolos",
  {
    organizacionId: organizacionId(),
    id: uuid("id").notNull(),
    nombre: text("nombre").notNull(),
    categoria: text("categoria").notNull(),
    trazado: text("trazado").notNull(),
    relleno: text("relleno"),
    texto: text("texto"),
    codigo: text("codigo"),
    /** El orden del archivo: así se ven las categorías y los símbolos en el teléfono. */
    orden: integer("orden").notNull(),
    activo: boolean("activo").notNull().default(true),
    creadoEn: marcaDeTiempo("creado_en").notNull().defaultNow(),
    actualizadoEn: marcaDeTiempo("actualizado_en").notNull().defaultNow(),
  },
  (t) => [primaryKey({ name: "simbolos_pkey", columns: [t.organizacionId, t.id] }), aislamientoPorOrganizacion("simbolos")],
).enableRLS();
