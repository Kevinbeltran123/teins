import { index, jsonb, pgSchema, text, uuid } from "drizzle-orm/pg-core";
import { aislamientoPorOrganizacion, marcaDeTiempo, organizacionId } from "../../plataforma/esquema-comun";

export const esquemaEnvios = pgSchema("envios");

export type CanalDeEnvio = "correo" | "whatsapp";
export type EstadoDeEnvio = "en_cola" | "enviado" | "entregado" | "fallido";

/** Lo que dice el mensaje, copiado de la versión al programarlo: el envío no lee el documento. */
export interface MensajeDeInforme {
  /** Los envíos de la iteración 20 no lo llevan: son informes. */
  documento?: "informe";
  organizacion: string;
  cliente: string;
  sitio: string;
  motivo: string;
  programadaPara: string;
  numero: number;
  nombreArchivo: string;
}

/** Una cotización publicada (ADR-0029): sin enlace al portal, que solo muestra informes. */
export interface MensajeDeCotizacion {
  documento: "cotizacion";
  organizacion: string;
  cliente: string;
  sitio: string;
  /** "COT-2026-0007". */
  cotizacion: string;
  /** Versión de la cotización. */
  numero: number;
  nombreArchivo: string;
}

export type MensajeDeEnvio = MensajeDeInforme | MensajeDeCotizacion;

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
    estado: text("estado", { enum: ["en_cola", "enviado", "entregado", "fallido"] }).notNull().default("en_cola"),
    /** Id del mensaje en el proveedor: con él llegan sus eventos. */
    proveedorId: text("proveedor_id"),
    error: text("error"),
    creadoPor: text("creado_por").notNull(),
    /** La decisión de enviar que lo creó (regla 4): repetirla no crea otro. Vacía al publicar y en los anteriores. */
    llave: uuid("llave"),
    creadoEn: marcaDeTiempo("creado_en").notNull().defaultNow(),
    enviadoEn: marcaDeTiempo("enviado_en"),
    actualizadoEn: marcaDeTiempo("actualizado_en").notNull().defaultNow(),
  },
  (t) => [index("envios_version_idx").on(t.organizacionId, t.versionId), aislamientoPorOrganizacion("envios")],
).enableRLS();

export type FilaEnvio = typeof envios.$inferSelect;
