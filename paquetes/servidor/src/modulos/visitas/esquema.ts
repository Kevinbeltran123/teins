import { date, integer, pgSchema, text, uuid } from "drizzle-orm/pg-core";
import { aislamientoPorOrganizacion, marcaDeTiempo, organizacionId } from "../../plataforma/esquema-comun";

export const esquemaVisitas = pgSchema("visitas");

/**
 * Visita programada por oficina (supuesto de P2). Su avance se deduce de sus levantamientos;
 * los técnicos asignados se reemplazan al reasignar, y la auditoría guarda el antes y el después.
 */
export const visitas = esquemaVisitas.table(
  "visitas",
  {
    id: uuid("id").primaryKey(),
    organizacionId: organizacionId(),
    clienteId: uuid("cliente_id").notNull(),
    sitioId: uuid("sitio_id").notNull(),
    motivo: text("motivo").notNull(),
    programadaPara: date("programada_para").notNull(),
    tecnicos: text("tecnicos").array().notNull(),
    creadaEn: marcaDeTiempo("creada_en").notNull().defaultNow(),
    version: integer("version").notNull().default(1),
  },
  () => [aislamientoPorOrganizacion("visitas")],
).enableRLS();
