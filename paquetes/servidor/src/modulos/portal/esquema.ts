import { sql } from "drizzle-orm";
import { boolean, index, integer, pgPolicy, pgSchema, text, unique, uuid } from "drizzle-orm/pg-core";
import { aislamientoPorOrganizacion, marcaDeTiempo, organizacionId, rolPortal } from "../../plataforma/esquema-comun";

export const esquemaPortal = pgSchema("portal");

/**
 * Acceso al portal de un contacto del cliente (ADR-0053). Lo dan y lo quitan oficina (rol teins_app, desde el módulo
 * de clientes); el portal lo lee para el ingreso, sin conocer todavía la organización, y anota el último ingreso.
 * Las copias del correo, los nombres y lo que ve se mantienen al día con el contacto: el portal no lee clientes.
 */
export const accesosDeContactos = esquemaPortal.table(
  "accesos",
  {
    id: uuid("id").primaryKey(),
    organizacionId: organizacionId(),
    clienteId: uuid("cliente_id").notNull(),
    contactoId: uuid("contacto_id").notNull(),
    /** En minúsculas, como se escribe al pedir el código. */
    correo: text("correo").notNull(),
    contactoNombre: text("contacto_nombre").notNull(),
    clienteNombre: text("cliente_nombre").notNull(),
    /** Para el asunto del correo y la marca del portal. */
    organizacionNombre: text("organizacion_nombre").notNull(),
    veInformes: boolean("ve_informes").notNull(),
    veCotizaciones: boolean("ve_cotizaciones").notNull(),
    creadoEn: marcaDeTiempo("creado_en").notNull().defaultNow(),
    ultimoIngreso: marcaDeTiempo("ultimo_ingreso"),
  },
  (t) => [
    unique("accesos_uno_por_contacto").on(t.organizacionId, t.contactoId),
    unique("accesos_un_correo").on(t.organizacionId, t.correo),
    index("accesos_cliente_idx").on(t.organizacionId, t.clienteId),
    aislamientoPorOrganizacion("accesos"),
    pgPolicy("accesos_portal_lectura", { as: "permissive", to: rolPortal, for: "select", using: sql`true` }),
    pgPolicy("accesos_portal_ingreso", { as: "permissive", to: rolPortal, for: "update", using: sql`true`, withCheck: sql`true` }),
  ],
).enableRLS();

/**
 * Pedido de código (ADR-0053): uno vigente por acceso; pedir otro lo reemplaza. El código se deriva del id del pedido
 * con un secreto del servidor (claves.ts): aquí no queda. La huella es la de la cookie del navegador que lo pidió.
 */
export const pedidosDeCodigo = esquemaPortal.table(
  "pedidos",
  {
    accesoId: uuid("acceso_id")
      .primaryKey()
      .references(() => accesosDeContactos.id, { onDelete: "cascade" }),
    organizacionId: organizacionId(),
    pedidoId: uuid("pedido_id").notNull(),
    navegadorHuella: text("navegador_huella").notNull(),
    expiraEn: marcaDeTiempo("expira_en").notNull(),
    intentos: integer("intentos").notNull().default(0),
    creadoEn: marcaDeTiempo("creado_en").notNull().defaultNow(),
  },
  () => [aislamientoPorOrganizacion("pedidos"), pgPolicy("pedidos_portal", { as: "permissive", to: rolPortal, for: "all", using: sql`true`, withCheck: sql`true` })],
).enableRLS();

/** Sesión corta del portal. Se guarda la huella del token, nunca el token (va en la cookie). */
export const sesionesDelPortal = esquemaPortal.table(
  "sesiones",
  {
    tokenHuella: text("token_huella").primaryKey(),
    accesoId: uuid("acceso_id")
      .notNull()
      .references(() => accesosDeContactos.id, { onDelete: "cascade" }),
    organizacionId: organizacionId(),
    clienteId: uuid("cliente_id").notNull(),
    creadaEn: marcaDeTiempo("creada_en").notNull().defaultNow(),
    expiraEn: marcaDeTiempo("expira_en").notNull(),
  },
  (t) => [
    index("sesiones_acceso_idx").on(t.accesoId),
    aislamientoPorOrganizacion("sesiones"),
    pgPolicy("sesiones_portal", { as: "permissive", to: rolPortal, for: "all", using: sql`true`, withCheck: sql`true` }),
  ],
).enableRLS();

/** Límite de intentos (QA-7), por correo y por origen. Solo lo usa el portal. */
export const intentos = esquemaPortal.table("intentos", {
  llave: text("llave").primaryKey(),
  fallos: integer("fallos").notNull(),
  ultimoFallo: marcaDeTiempo("ultimo_fallo").notNull(),
  bloqueadoHasta: marcaDeTiempo("bloqueado_hasta"),
});
