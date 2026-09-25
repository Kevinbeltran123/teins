import { index, pgSchema, text, uuid } from "drizzle-orm/pg-core";
import { aislamientoPorOrganizacion, marcaDeTiempo, organizacionId } from "../../plataforma/esquema-comun";

export const esquemaClientes = pgSchema("clientes");

/** Datos mínimos del cliente (regla 18, minimización): lo que el técnico necesita para llegar. */
export const clientes = esquemaClientes.table(
  "clientes",
  {
    id: uuid("id").primaryKey(),
    organizacionId: organizacionId(),
    nombre: text("nombre").notNull(),
    creadoEn: marcaDeTiempo("creado_en").notNull().defaultNow(),
  },
  () => [aislamientoPorOrganizacion("clientes")],
).enableRLS();

export const sitios = esquemaClientes.table(
  "sitios",
  {
    id: uuid("id").primaryKey(),
    organizacionId: organizacionId(),
    clienteId: uuid("cliente_id")
      .notNull()
      .references(() => clientes.id),
    nombre: text("nombre").notNull(),
    direccion: text("direccion").notNull(),
    creadoEn: marcaDeTiempo("creado_en").notNull().defaultNow(),
  },
  (t) => [index("sitios_cliente_idx").on(t.clienteId), aislamientoPorOrganizacion("sitios")],
).enableRLS();
