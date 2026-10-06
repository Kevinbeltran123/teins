import { bigserial, index, pgSchema, primaryKey, text } from "drizzle-orm/pg-core";
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
  (t) => [
    index("registro_bajada_idx").on(t.organizacionId, t.secuencia),
    // La bajada de un técnico lee sus cambios y los de toda la organización; compactar busca por entidad (ADR-0044).
    index("registro_usuario_idx").on(t.organizacionId, t.usuarioId, t.secuencia),
    index("registro_entidad_idx").on(t.organizacionId, t.entidad, t.entidadId, t.secuencia),
    aislamientoPorOrganizacion("registro"),
  ],
).enableRLS();

/**
 * Época de la bajada por organización (ADR-0038). La cambia solo quien deja limpio un entorno (dejar-limpio.sql): un
 * teléfono que ve otra época quita lo que bajó del servidor y baja todo de nuevo. Sin fila, la época es la inicial.
 */
export const epocas = esquemaCambios.table(
  "epocas",
  {
    organizacionId: organizacionId(),
    epoca: text("epoca").notNull(),
  },
  (t) => [primaryKey({ columns: [t.organizacionId] }), aislamientoPorOrganizacion("epocas")],
).enableRLS();
