import { sql } from "drizzle-orm";
import { check, date, index, integer, pgSchema, text, time, uuid } from "drizzle-orm/pg-core";
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
    /**
     * Horario (ADR-0037): sin inicio, la visita ocupa todo el día; con inicio y fin, ese rango; con inicio y sin fin,
     * desde el inicio hasta que un técnico la termine (o hasta el final del día).
     */
    horaInicio: time("hora_inicio"),
    horaFin: time("hora_fin"),
    /** Un técnico la terminó desde su teléfono (ADR-0037): con la hora que declaró el teléfono, nunca futura. */
    terminadaEn: marcaDeTiempo("terminada_en"),
    terminadaPor: text("terminada_por"),
    tecnicos: text("tecnicos").array().notNull(),
    creadaEn: marcaDeTiempo("creada_en").notNull().defaultNow(),
    version: integer("version").notNull().default(1),
    /** Cancelada: el único estado explícito de la visita (modelo de dominio, sección 5). */
    canceladaEn: marcaDeTiempo("cancelada_en"),
    canceladaPor: text("cancelada_por"),
    motivoCancelacion: text("motivo_cancelacion"),
    /** Atendida y de un día anterior: salió de los teléfonos y no vuelve a bajar (ADR-0041). */
    cerradaEn: marcaDeTiempo("cerrada_en"),
  },
  (t) => [
    index("visitas_programada_idx").on(t.organizacionId, t.programadaPara),
    aislamientoPorOrganizacion("visitas"),
    check("visitas_horario_valido", sql`${t.horaFin} IS NULL OR (${t.horaInicio} IS NOT NULL AND ${t.horaFin} > ${t.horaInicio})`),
  ],
).enableRLS();
