import { sql } from "drizzle-orm";
import { index, integer, pgPolicy, pgSchema, text, unique, uuid } from "drizzle-orm/pg-core";
import { aislamientoPorOrganizacion, marcaDeTiempo, organizacionId, rolPortal } from "../../plataforma/esquema-comun";

export const esquemaPortal = pgSchema("portal");

/**
 * Acceso de cliente (ADR-0009, parte 4): uno por cliente. El identificador viaja en el QR; la clave
 * solo se guarda como hash. Regenerar cambia ambos. Lo crea y regenera la aplicación (rol teins_app);
 * el portal solo lo lee para el ingreso, sin conocer todavía la organización.
 */
export const accesosDeClientes = esquemaPortal.table(
  "accesos",
  {
    id: uuid("id").primaryKey(),
    organizacionId: organizacionId(),
    clienteId: uuid("cliente_id").notNull(),
    /** Nombre del cliente al crear el acceso: el portal no puede leer la tabla de clientes. */
    clienteNombre: text("cliente_nombre").notNull(),
    identificador: text("identificador").notNull().unique(),
    claveHash: text("clave_hash").notNull(),
    creadoEn: marcaDeTiempo("creado_en").notNull().defaultNow(),
    regeneradoEn: marcaDeTiempo("regenerado_en"),
  },
  (t) => [
    unique("accesos_uno_por_cliente").on(t.organizacionId, t.clienteId),
    aislamientoPorOrganizacion("accesos"),
    pgPolicy("accesos_portal_lectura", { as: "permissive", to: rolPortal, for: "select", using: sql`true` }),
  ],
).enableRLS();

/** Sesión corta del portal. Se guarda la huella del token, nunca el token (va en la cookie). */
export const sesionesDelPortal = esquemaPortal.table(
  "sesiones",
  {
    tokenHuella: text("token_huella").primaryKey(),
    accesoId: uuid("acceso_id")
      .notNull()
      .references(() => accesosDeClientes.id),
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

/** Límite de intentos (QA-7), por identificador y por origen. Solo lo usa el portal. */
export const intentos = esquemaPortal.table("intentos", {
  llave: text("llave").primaryKey(),
  fallos: integer("fallos").notNull(),
  ultimoFallo: marcaDeTiempo("ultimo_fallo").notNull(),
  bloqueadoHasta: marcaDeTiempo("bloqueado_hasta"),
});
