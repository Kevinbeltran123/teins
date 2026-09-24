import { bigint, boolean, check, index, integer, pgSchema, text, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { marcaDeTiempo } from "../../plataforma/esquema-comun";

/**
 * Esquema del módulo de identidad. Las claves en inglés de usuarios, sesiones, cuentas y
 * verificaciones las exige Better Auth; las columnas usan los nombres del proyecto.
 */
export const identidad = pgSchema("identidad");

export const organizaciones = identidad.table("organizaciones", {
  id: uuid("id").primaryKey(),
  nombre: text("nombre").notNull(),
  creadaEn: marcaDeTiempo("creada_en").notNull().defaultNow(),
});

export const usuarios = identidad.table(
  "usuarios",
  {
    id: text("id").primaryKey(),
    name: text("nombre").notNull(),
    /** Los técnicos no tienen correo (P35): se guarda uno interno no entregable (dominio .invalid). */
    email: text("correo").notNull().unique(),
    emailVerified: boolean("correo_verificado").notNull().default(false),
    image: text("imagen"),
    createdAt: marcaDeTiempo("creado_en").notNull().defaultNow(),
    updatedAt: marcaDeTiempo("actualizado_en").notNull().defaultNow(),
    username: text("usuario").unique(),
    displayUsername: text("usuario_visible"),
    organizacionId: uuid("organizacion_id")
      .notNull()
      .references(() => organizaciones.id),
    rol: text("rol").notNull(),
  },
  (t) => [check("usuarios_rol_valido", sql`${t.rol} in ('tecnico', 'oficina')`), index("usuarios_organizacion_idx").on(t.organizacionId)],
);

export const sesiones = identidad.table(
  "sesiones",
  {
    id: text("id").primaryKey(),
    expiresAt: marcaDeTiempo("expira_en").notNull(),
    token: text("token").notNull().unique(),
    createdAt: marcaDeTiempo("creada_en").notNull().defaultNow(),
    updatedAt: marcaDeTiempo("actualizada_en").notNull().defaultNow(),
    ipAddress: text("ip"),
    userAgent: text("agente"),
    userId: text("usuario_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
  },
  (t) => [index("sesiones_usuario_idx").on(t.userId)],
);

export const cuentas = identidad.table(
  "cuentas",
  {
    id: text("id").primaryKey(),
    accountId: text("cuenta_id").notNull(),
    providerId: text("proveedor_id").notNull(),
    userId: text("usuario_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    accessToken: text("token_acceso"),
    refreshToken: text("token_renovacion"),
    idToken: text("token_id"),
    accessTokenExpiresAt: marcaDeTiempo("token_acceso_expira_en"),
    refreshTokenExpiresAt: marcaDeTiempo("token_renovacion_expira_en"),
    scope: text("alcance"),
    password: text("contrasena"),
    createdAt: marcaDeTiempo("creada_en").notNull().defaultNow(),
    updatedAt: marcaDeTiempo("actualizada_en").notNull().defaultNow(),
  },
  (t) => [index("cuentas_usuario_idx").on(t.userId)],
);

export const verificaciones = identidad.table(
  "verificaciones",
  {
    id: text("id").primaryKey(),
    identifier: text("identificador").notNull(),
    value: text("valor").notNull(),
    expiresAt: marcaDeTiempo("expira_en").notNull(),
    createdAt: marcaDeTiempo("creada_en").notNull().defaultNow(),
    updatedAt: marcaDeTiempo("actualizada_en").notNull().defaultNow(),
  },
  (t) => [index("verificaciones_identificador_idx").on(t.identifier)],
);

/** Límite de intentos compartido entre instancias (QA-7): vive en la base, no en memoria. */
export const limitesDeTasa = identidad.table("limites_de_tasa", {
  id: text("id").primaryKey(),
  key: text("llave").notNull().unique(),
  count: integer("conteo").notNull(),
  lastRequest: bigint("ultima_solicitud", { mode: "number" }).notNull(),
});
