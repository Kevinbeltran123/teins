import { index, pgSchema, text, uuid } from "drizzle-orm/pg-core";
import { aislamientoPorOrganizacion, marcaDeTiempo, organizacionId } from "../../plataforma/esquema-comun";

export const esquemaAvisos = pgSchema("avisos");

/**
 * Suscripción de un navegador a los avisos push de una persona (ADR-0023). El `endpoint` identifica al
 * navegador: en un teléfono compartido pasa a quien inicie sesión. Se borra al desactivar o restablecer a
 * la persona, al cerrar sesión y cuando el servicio de avisos la da por muerta.
 */
export const suscripciones = esquemaAvisos.table(
  "suscripciones",
  {
    id: uuid("id").primaryKey(),
    organizacionId: organizacionId(),
    usuarioId: text("usuario_id").notNull(),
    /** Según el rol de quien se suscribió, nunca según lo que diga el cliente. */
    superficie: text("superficie", { enum: ["campo", "oficina"] }).notNull(),
    /** Origen de la superficie: el aviso abre su inicio. */
    origen: text("origen").notNull(),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    creadaEn: marcaDeTiempo("creada_en").notNull().defaultNow(),
    ultimoEnvioEn: marcaDeTiempo("ultimo_envio_en"),
    /** Último rechazo que no se reintenta (un 4xx distinto de 404 y 410), para soporte. */
    ultimoError: text("ultimo_error"),
  },
  (t) => [index("suscripciones_usuario_idx").on(t.organizacionId, t.usuarioId), index("suscripciones_superficie_idx").on(t.organizacionId, t.superficie), aislamientoPorOrganizacion("suscripciones")],
).enableRLS();

export type FilaSuscripcion = typeof suscripciones.$inferSelect;
