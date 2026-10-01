import { bigint, index, integer, jsonb, pgSchema, primaryKey, text, unique, uuid } from "drizzle-orm/pg-core";
import type { ContenidoCotizacion } from "@teins/documentos";
import type { CondicionesCotizacion, Impuestos, LineaDeCotizacion } from "@teins/dominio";
import { aislamientoPorOrganizacion, marcaDeTiempo, organizacionId } from "../../plataforma/esquema-comun";

export const esquemaCotizaciones = pgSchema("cotizaciones");

export type EstadoPdfCotizacion = "generando" | "listo" | "fallido";

/** Último consecutivo por organización y año: se incrementa en la transacción que crea la cotización (ADR-0029). */
export const consecutivos = esquemaCotizaciones.table(
  "consecutivos",
  {
    organizacionId: organizacionId(),
    anio: integer("anio").notNull(),
    ultimo: integer("ultimo").notNull(),
  },
  (t) => [primaryKey({ columns: [t.organizacionId, t.anio] }), aislamientoPorOrganizacion("consecutivos")],
).enableRLS();

/** El borrador: líneas con su precio, impuestos y condiciones. Concurrencia optimista con `version`. */
export const cotizaciones = esquemaCotizaciones.table(
  "cotizaciones",
  {
    id: uuid("id").primaryKey(),
    organizacionId: organizacionId(),
    numero: text("numero").notNull(),
    visitaId: uuid("visita_id").notNull(),
    clienteId: uuid("cliente_id").notNull(),
    version: integer("version").notNull().default(1),
    lineas: jsonb("lineas").$type<LineaDeCotizacion[]>().notNull(),
    impuestos: jsonb("impuestos").$type<Impuestos>().notNull(),
    condiciones: jsonb("condiciones").$type<CondicionesCotizacion>().notNull(),
    creadaPor: text("creada_por").notNull(),
    creadaEn: marcaDeTiempo("creada_en").notNull().defaultNow(),
  },
  (t) => [unique("cotizaciones_numero_por_organizacion").on(t.organizacionId, t.numero), index("cotizaciones_visita_idx").on(t.organizacionId, t.visitaId), aislamientoPorOrganizacion("cotizaciones")],
).enableRLS();

/** Copia congelada de lo que se publicó: el PDF y el envío leen solo esto. */
export type { ContenidoCotizacion } from "@teins/documentos";

/** Versión publicada: la base solo deja cambiar el estado de su PDF (permisos por columna). */
export const versionesCotizacion = esquemaCotizaciones.table(
  "versiones",
  {
    id: uuid("id").primaryKey(),
    organizacionId: organizacionId(),
    cotizacionId: uuid("cotizacion_id")
      .notNull()
      .references(() => cotizaciones.id),
    numero: integer("numero").notNull(),
    contenido: jsonb("contenido").$type<ContenidoCotizacion>().notNull(),
    total: bigint("total", { mode: "number" }).notNull(),
    publicadaPor: text("publicada_por").notNull(),
    publicadaEn: marcaDeTiempo("publicada_en").notNull(),
    pdfEstado: text("pdf_estado", { enum: ["generando", "listo", "fallido"] }).notNull().default("generando"),
    pdfHuella: text("pdf_huella"),
    pdfGeneradoEn: marcaDeTiempo("pdf_generado_en"),
    pdfError: text("pdf_error"),
  },
  (t) => [unique("versiones_numero_por_cotizacion").on(t.cotizacionId, t.numero), aislamientoPorOrganizacion("versiones")],
).enableRLS();
