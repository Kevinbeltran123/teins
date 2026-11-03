import { boolean, index, pgSchema, text, uuid } from "drizzle-orm/pg-core";
import { aislamientoPorOrganizacion, marcaDeTiempo, organizacionId } from "../../plataforma/esquema-comun";

export const esquemaClientes = pgSchema("clientes");

/**
 * Datos mínimos del cliente (regla 18, minimización): lo que el técnico necesita para llegar. Se corrige el
 * nombre (queda quién y cuándo) y se archiva en vez de borrarse (ADR-0035): lo publicado conserva el suyo.
 */
export const clientes = esquemaClientes.table(
  "clientes",
  {
    id: uuid("id").primaryKey(),
    organizacionId: organizacionId(),
    nombre: text("nombre").notNull(),
    /** NIT, para el encabezado del informe (ADR-0051). Opcional: lo que falta sale como marcador. */
    nit: text("nit"),
    creadoEn: marcaDeTiempo("creado_en").notNull().defaultNow(),
    editadoPor: text("editado_por"),
    editadoEn: marcaDeTiempo("editado_en"),
    archivadoPor: text("archivado_por"),
    archivadoEn: marcaDeTiempo("archivado_en"),
  },
  () => [aislamientoPorOrganizacion("clientes")],
).enableRLS();

export const sitios = esquemaClientes.table(
  "sitios",
  {
    id: uuid("id").primaryKey(),
    organizacionId: organizacionId(),
    clienteId: uuid("cliente_id")
      .notNull()
      .references(() => clientes.id),
    nombre: text("nombre").notNull(),
    direccion: text("direccion").notNull(),
    /** Ciudad del sitio, para el encabezado del informe (ADR-0051). */
    ciudad: text("ciudad"),
    creadoEn: marcaDeTiempo("creado_en").notNull().defaultNow(),
    archivadoPor: text("archivado_por"),
    archivadoEn: marcaDeTiempo("archivado_en"),
  },
  (t) => [index("sitios_cliente_idx").on(t.clienteId), aislamientoPorOrganizacion("sitios")],
).enableRLS();

/**
 * Contactos del cliente que reciben el informe (ADR-0028, parte 5). Datos corporativos: nombre, cargo,
 * correo y celular. La autorización de WhatsApp queda con quién de oficina la confirmó y cuándo.
 */
export const contactos = esquemaClientes.table(
  "contactos",
  {
    id: uuid("id").primaryKey(),
    organizacionId: organizacionId(),
    clienteId: uuid("cliente_id")
      .notNull()
      .references(() => clientes.id),
    nombre: text("nombre").notNull(),
    cargo: text("cargo").notNull().default(""),
    correo: text("correo"),
    /** E.164, como lo exige WhatsApp. */
    celular: text("celular"),
    recibeCorreo: boolean("recibe_correo").notNull().default(false),
    recibeWhatsapp: boolean("recibe_whatsapp").notNull().default(false),
    /** Qué documentos recibe por esos canales (ADR-0029); los de antes recibían solo informes. */
    recibeInformes: boolean("recibe_informes").notNull().default(true),
    recibeCotizaciones: boolean("recibe_cotizaciones").notNull().default(false),
    whatsappAutorizadoPor: text("whatsapp_autorizado_por"),
    whatsappAutorizadoEn: marcaDeTiempo("whatsapp_autorizado_en"),
    correoRebotadoEn: marcaDeTiempo("correo_rebotado_en"),
    correoRebotadoMotivo: text("correo_rebotado_motivo"),
    /** Quitado por oficina: la aplicación no borra filas (ADR-0009); se borran sus datos de contacto y queda el nombre. */
    quitadoEn: marcaDeTiempo("quitado_en"),
    creadoEn: marcaDeTiempo("creado_en").notNull().defaultNow(),
  },
  (t) => [index("contactos_cliente_idx").on(t.clienteId), aislamientoPorOrganizacion("contactos")],
).enableRLS();

export type FilaContacto = typeof contactos.$inferSelect;
