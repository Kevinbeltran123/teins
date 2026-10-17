import { sql } from "drizzle-orm";
import { bigint, check, index, integer, pgSchema, primaryKey, text } from "drizzle-orm/pg-core";
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
    /**
     * Plano (PDF de oficina): las páginas que se anexan al informe, contadas al verificarlo (iteración 26). 0: pdf-lib
     * no puede anexarlo y el PDF del informe fallaría. Nulo: otro tipo, o verificado antes de contarlas.
     */
    paginas: integer("paginas"),
    /**
     * Cuándo la limpieza de archivos sin uso vio que un levantamiento lo usa (ADR-0048). Un levantamiento no se borra
     * ni se le cambian sus archivos, así que desde entonces no se vuelve a mirar.
     */
    enUsoComprobadoEn: marcaDeTiempo("en_uso_comprobado_en"),
  },
  (t) => [
    primaryKey({ columns: [t.organizacionId, t.huella] }),
    check("archivos_estado_valido", sql`${t.estado} in ('pendiente', 'subido', 'verificado', 'rechazado')`),
    check("archivos_huella_valida", sql`${t.huella} ~ '^[0-9a-f]{64}$'`),
    check("archivos_paginas_validas", sql`${t.paginas} >= 0`),
    index("archivos_sin_comprobar_idx").on(t.organizacionId, t.creadoEn).where(sql`${t.enUsoComprobadoEn} is null`),
    aislamientoPorOrganizacion("archivos"),
  ],
).enableRLS();
