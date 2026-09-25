import { bigint, boolean, check, index, integer, jsonb, pgSchema, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import type { SaludDispositivo } from "@teins/protocolo";
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
    /** Regla 13: un usuario desactivado no autentica y sus dispositivos borran sus datos; su autoría se conserva. */
    desactivadoEn: marcaDeTiempo("desactivado_en"),
    /** Persona de oficina que administra usuarios, dispositivos y accesos (iteración 6). */
    administrador: boolean("administrador").notNull().default(false),
    /** Segundo factor activo y verificado (Better Auth, ADR-0009). */
    twoFactorEnabled: boolean("segundo_factor").notNull().default(false),
  },
  (t) => [check("usuarios_rol_valido", sql`${t.rol} in ('tecnico', 'oficina')`), index("usuarios_organizacion_idx").on(t.organizacionId)],
);

/**
 * Uso de un teléfono por un usuario (modelo de dominio, agregado Dispositivo). Un teléfono compartido
 * tiene una fila por usuario, todas con la huella del mismo secreto. El secreto autentica la consulta
 * de órdenes de borrado cuando la sesión ya no existe (ADR-0009); el informe de salud viaja con cada
 * sincronización (ADR-0017).
 */
export const dispositivos = identidad.table(
  "dispositivos",
  {
    id: uuid("id").notNull(),
    usuarioId: text("usuario_id")
      .notNull()
      .references(() => usuarios.id),
    organizacionId: uuid("organizacion_id").notNull(),
    /** SHA-256 del secreto: el servidor nunca guarda el secreto. */
    secretoHuella: text("secreto_huella").notNull(),
    salud: jsonb("salud").$type<SaludDispositivo>(),
    registradoEn: marcaDeTiempo("registrado_en").notNull().defaultNow(),
    ultimoContacto: marcaDeTiempo("ultimo_contacto").notNull(),
    ordenDeBorradoEn: marcaDeTiempo("orden_de_borrado_en"),
    borradoConfirmadoEn: marcaDeTiempo("borrado_confirmado_en"),
  },
  (t) => [primaryKey({ columns: [t.id, t.usuarioId] }), index("dispositivos_usuario_idx").on(t.usuarioId)],
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

/**
 * Segundo factor TOTP (ADR-0009). Better Auth guarda el secreto y los códigos de respaldo cifrados
 * con el secreto de autenticación; el factor no cuenta hasta que la persona verifica un código.
 */
export const segundosFactores = identidad.table(
  "segundos_factores",
  {
    id: text("id").primaryKey(),
    secret: text("secreto").notNull(),
    backupCodes: text("codigos_de_respaldo").notNull(),
    userId: text("usuario_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    verified: boolean("verificado").notNull().default(true),
    failedVerificationCount: integer("intentos_fallidos").notNull().default(0),
    lockedUntil: marcaDeTiempo("bloqueado_hasta"),
  },
  (t) => [index("segundos_factores_usuario_idx").on(t.userId)],
);

/** Límite de intentos compartido entre instancias (QA-7): vive en la base, no en memoria. */
export const limitesDeTasa = identidad.table("limites_de_tasa", {
  id: text("id").primaryKey(),
  key: text("llave").notNull().unique(),
  count: integer("conteo").notNull(),
  lastRequest: bigint("ultima_solicitud", { mode: "number" }).notNull(),
});
