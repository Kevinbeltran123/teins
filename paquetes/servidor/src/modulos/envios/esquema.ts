import { index, jsonb, pgSchema, text, uuid } from "drizzle-orm/pg-core";
import type { MensajeDeEnvio } from "@teins/documentos";
import { aislamientoPorOrganizacion, marcaDeTiempo, organizacionId } from "../../plataforma/esquema-comun";

export const esquemaEnvios = pgSchema("envios");

export type CanalDeEnvio = "correo" | "whatsapp";
export type EstadoDeEnvio = "en_cola" | "enviado" | "entregado" | "fallido" | "cancelado";

/** Lo que dice el mensaje, copiado de la versión al programarlo: el envío no lee el documento. */
export type { MensajeDeCotizacion, MensajeDeEnvio, MensajeDeInforme } from "@teins/documentos";

/**
 * Una copia del informe a un contacto por un canal (ADR-0028). El nombre y el destino se copian: el
 * contacto puede cambiar o quitarse, y esto es constancia de a dónde salió cada copia.
 */
export const envios = esquemaEnvios.table(
  "envios",
  {
    id: uuid("id").primaryKey(),
    organizacionId: organizacionId(),
    versionId: uuid("version_id").notNull(),
    contactoId: uuid("contacto_id").notNull(),
    contactoNombre: text("contacto_nombre").notNull(),
    canal: text("canal", { enum: ["correo", "whatsapp"] }).notNull(),
    destino: text("destino").notNull(),
    mensaje: jsonb("mensaje").$type<MensajeDeEnvio>().notNull(),
    /** "cancelado": oficina lo detuvo mientras esperaba en cola (ADR-0034); nunca sale. */
    estado: text("estado", { enum: ["en_cola", "enviado", "entregado", "fallido", "cancelado"] }).notNull().default("en_cola"),
    /** Id del mensaje en el proveedor: con él llegan sus eventos. */
    proveedorId: text("proveedor_id"),
    error: text("error"),
    creadoPor: text("creado_por").notNull(),
    /** La decisión de enviar que lo creó (regla 4): repetirla no crea otro. Vacía al publicar y en los anteriores. */
    llave: uuid("llave"),
    creadoEn: marcaDeTiempo("creado_en").notNull().defaultNow(),
    enviadoEn: marcaDeTiempo("enviado_en"),
    canceladoPor: text("cancelado_por"),
    canceladoEn: marcaDeTiempo("cancelado_en"),
    actualizadoEn: marcaDeTiempo("actualizado_en").notNull().defaultNow(),
  },
  (t) => [index("envios_version_idx").on(t.organizacionId, t.versionId), aislamientoPorOrganizacion("envios")],
).enableRLS();

export type FilaEnvio = typeof envios.$inferSelect;
