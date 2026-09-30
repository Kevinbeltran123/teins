import { bigserial, index, pgSchema, text } from "drizzle-orm/pg-core";
import { aislamientoPorOrganizacion, marcaDeTiempo, organizacionId } from "../../plataforma/esquema-comun";

export const esquemaCambios = pgSchema("cambios");

/**
 * Registro de cambios para la bajada (ADR-0003, ADR-0005 patrón 3). Solo dice qué cambió y para
 * quién; el contenido se lee del módulo dueño al armar la bajada. La aplicación solo inserta y lee.
 */
export const registro = esquemaCambios.table(
  "registro",
  {
    secuencia: bigserial("secuencia", { mode: "number" }).primaryKey(),
    organizacionId: organizacionId(),
    /** Destinatario del cambio; null si es para toda la organización (formatos). */
    usuarioId: text("usuario_id"),
    entidad: text("entidad").notNull(),
    entidadId: text("entidad_id").notNull(),
    operacion: text("operacion").notNull(),
    registradoEn: marcaDeTiempo("registrado_en").notNull().defaultNow(),
  },
  (t) => [index("registro_bajada_idx").on(t.organizacionId, t.secuencia), aislamientoPorOrganizacion("registro")],
).enableRLS();
