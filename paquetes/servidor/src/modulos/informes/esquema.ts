import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgPolicy, pgSchema, text, unique, uuid } from "drizzle-orm/pg-core";
import type { ContenidoVersion, Plano } from "@teins/dominio";
import { aislamientoPorOrganizacion, marcaDeTiempo, organizacionId, rolPortal } from "../../plataforma/esquema-comun";

export const esquemaInformes = pgSchema("informes");

/** Borrador del informe de una visita (P26, supuesto: uno por visita). Oficina lo edita; nunca lo ve el cliente. */
export const informes = esquemaInformes.table(
  "informes",
  {
    id: uuid("id").primaryKey(),
    organizacionId: organizacionId(),
    visitaId: uuid("visita_id").notNull(),
    introduccion: text("introduccion").notNull().default(""),
    conclusiones: text("conclusiones").notNull().default(""),
    levantamientos: uuid("levantamientos").array().notNull().default([]),
    planos: jsonb("planos").$type<Plano[]>().notNull().default([]),
    /** Concurrencia optimista (ADR-0005): dos personas componiendo no se pisan. */
    version: integer("version").notNull().default(1),
    creadoEn: marcaDeTiempo("creado_en").notNull().defaultNow(),
  },
  (t) => [unique("informes_una_por_visita").on(t.organizacionId, t.visitaId), aislamientoPorOrganizacion("informes")],
).enableRLS();

export type EstadoPdf = "generando" | "listo" | "fallido";

/**
 * Versión publicada: copia congelada, nunca se edita (regla 10, QA-9). La aplicación solo puede
 * escribir las columnas del PDF, que genera el worker después de publicar (ADR-0013).
 */
export const versionesPublicadas = esquemaInformes.table(
  "versiones",
  {
    id: uuid("id").primaryKey(),
    organizacionId: organizacionId(),
    informeId: uuid("informe_id")
      .notNull()
      .references(() => informes.id),
    /** Cliente de la visita al publicar: la barrera del portal filtra por él (QA-4). */
    clienteId: uuid("cliente_id"),
    numero: integer("numero").notNull(),
    contenido: jsonb("contenido").$type<ContenidoVersion>().notNull(),
    publicadaPor: text("publicada_por").notNull(),
    publicadaEn: marcaDeTiempo("publicada_en").notNull(),
    pdfEstado: text("pdf_estado").$type<EstadoPdf>().notNull().default("generando"),
    /** SHA-256 del PDF entregado: el mismo archivo para siempre (QA-17). */
    pdfHuella: text("pdf_huella"),
    pdfGeneradoEn: marcaDeTiempo("pdf_generado_en"),
    pdfError: text("pdf_error"),
    /**
     * Retiro del portal por una persona administradora (iteración 6). La copia congelada no cambia:
     * la versión se conserva, oficina la sigue viendo y el cliente deja de verla.
     */
    retiradaEn: marcaDeTiempo("retirada_en"),
    retiradaPor: text("retirada_por"),
    motivoRetiro: text("motivo_retiro"),
  },
  (t) => [
    unique("versiones_numero").on(t.informeId, t.numero),
    index("versiones_informe_idx").on(t.informeId),
    aislamientoPorOrganizacion("versiones"),
    // ADR-0009, parte 3: aunque el código del portal falle, la base solo le devuelve lo publicado,
    // con PDF listo y sin retirar, de la organización y el cliente de la sesión.
    pgPolicy("versiones_portal_cliente", {
      as: "permissive",
      to: rolPortal,
      for: "select",
      using: sql`organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid
        and cliente_id = nullif(current_setting('app.cliente', true), '')::uuid
        and pdf_estado = 'listo'
        and retirada_en is null`,
    }),
  ],
).enableRLS();
