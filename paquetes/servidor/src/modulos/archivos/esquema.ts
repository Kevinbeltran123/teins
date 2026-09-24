import { sql } from "drizzle-orm";
import { bigint, check, pgSchema, primaryKey, text } from "drizzle-orm/pg-core";
import { aislamientoPorOrganizacion, marcaDeTiempo, organizacionId } from "../../plataforma/esquema-comun";

export const esquemaArchivos = pgSchema("archivos");

export type EstadoArchivo = "pendiente" | "subido" | "verificado" | "rechazado";

/** Archivos direccionados por contenido (ADR-0007): la llave es la huella y el objeto nunca se sobrescribe. */
export const archivos = esquemaArchivos.table(
  "archivos",
  {
    organizacionId: organizacionId(),
    huella: text("huella").notNull(),
    tipo: text("tipo").notNull(),
    bytes: bigint("bytes", { mode: "number" }).notNull(),
    estado: text("estado").$type<EstadoArchivo>().notNull(),
    creadoPor: text("creado_por").notNull(),
    creadoEn: marcaDeTiempo("creado_en").notNull().defaultNow(),
    subidoEn: marcaDeTiempo("subido_en"),
    verificadoEn: marcaDeTiempo("verificado_en"),
    motivoRechazo: text("motivo_rechazo"),
  },
  (t) => [
    primaryKey({ columns: [t.organizacionId, t.huella] }),
    check("archivos_estado_valido", sql`${t.estado} in ('pendiente', 'subido', 'verificado', 'rechazado')`),
    check("archivos_huella_valida", sql`${t.huella} ~ '^[0-9a-f]{64}$'`),
    aislamientoPorOrganizacion("archivos"),
  ],
).enableRLS();
