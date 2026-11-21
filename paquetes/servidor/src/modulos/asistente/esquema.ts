import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, numeric, pgSchema, primaryKey, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { RespuestaDelAsistente } from "@teins/protocolo";
import { aislamientoPorOrganizacion, marcaDeTiempo, organizacionId } from "../../plataforma/esquema-comun";
import type { PasoGuardado } from "./tipos";

export const esquemaAsistente = pgSchema("asistente");

/** Una conversación de una persona con el asistente (ADR-0060). Eliminar es lógico: «Deshacer» la restaura. */
export const conversaciones = esquemaAsistente.table(
  "conversaciones",
  {
    id: uuid("id").primaryKey(),
    organizacionId: organizacionId(),
    usuarioId: text("usuario_id").notNull(),
    titulo: text("titulo").notNull(),
    creadaEn: marcaDeTiempo("creada_en").notNull().defaultNow(),
    actualizadaEn: marcaDeTiempo("actualizada_en").notNull().defaultNow(),
    eliminadaEn: marcaDeTiempo("eliminada_en"),
  },
  (t) => [index("conversaciones_usuario_idx").on(t.organizacionId, t.usuarioId, t.actualizadaEn), aislamientoPorOrganizacion("conversaciones")],
).enableRLS();

/** Una pregunta y su respuesta. Los pasos guardan el resultado completo de cada herramienta: de ahí sale lo que se dibuja. */
export const intercambios = esquemaAsistente.table(
  "intercambios",
  {
    id: uuid("id").primaryKey(),
    organizacionId: organizacionId(),
    conversacionId: uuid("conversacion_id")
      .notNull()
      .references(() => conversaciones.id),
    usuarioId: text("usuario_id").notNull(),
    /** La decisión de preguntar (regla 4): repetirla devuelve este intercambio. */
    llave: uuid("llave").notNull(),
    pregunta: text("pregunta").notNull(),
    estado: text("estado", { enum: ["en_curso", "lista", "error", "detenida"] }).notNull().default("en_curso"),
    pasos: jsonb("pasos").$type<PasoGuardado[]>().notNull().default([]),
    respuesta: jsonb("respuesta").$type<RespuestaDelAsistente>(),
    error: text("error"),
    detenerPedido: boolean("detener_pedido").notNull().default(false),
    modelo: text("modelo").notNull(),
    tokensEntrada: integer("tokens_entrada").notNull().default(0),
    tokensSalida: integer("tokens_salida").notNull().default(0),
    tokensCacheLeida: integer("tokens_cache_leida").notNull().default(0),
    tokensCacheEscrita: integer("tokens_cache_escrita").notNull().default(0),
    costoUsd: numeric("costo_usd", { precision: 14, scale: 9 }).notNull().default("0"),
    creadoEn: marcaDeTiempo("creado_en").notNull().defaultNow(),
    /** Cuando el worker lo tomó: el vencimiento cuenta desde aquí (o desde `creado_en` si nunca arrancó). */
    iniciadoEn: marcaDeTiempo("iniciado_en"),
    terminadoEn: marcaDeTiempo("terminado_en"),
  },
  (t) => [
    uniqueIndex("intercambios_llave_idx").on(t.organizacionId, t.llave),
    index("intercambios_conversacion_idx").on(t.conversacionId, t.creadoEn),
    index("intercambios_mes_idx").on(t.organizacionId, t.creadoEn),
    // Una sola respuesta en curso por conversación, también cuando dos preguntas llegan a la vez.
    uniqueIndex("intercambios_uno_en_curso_idx").on(t.conversacionId).where(sql`estado = 'en_curso'`),
    check("intercambios_estado_valido", sql`${t.estado} in ('en_curso', 'lista', 'error', 'detenida')`),
    aislamientoPorOrganizacion("intercambios"),
  ],
).enableRLS();

/** Ajustes del asistente por organización. Sin fila, rigen los valores por omisión. */
export const ajustes = esquemaAsistente.table(
  "ajustes",
  {
    organizacionId: organizacionId().primaryKey(),
    /** El nombre que se ve en pantalla (R7: nada de la empresa escrito en el código). */
    nombre: text("nombre").notNull().default("Chispa"),
    topeMensualUsd: numeric("tope_mensual_usd", { precision: 10, scale: 2 }).notNull().default("5"),
  },
  () => [aislamientoPorOrganizacion("ajustes")],
).enableRLS();

/**
 * El gasto del mes por persona, aparte de las conversaciones: borrarlas (la persona o la purga) nunca baja el gasto, y
 * el tope y el uso leen de aquí. El mes es AAAA-MM en America/Bogota.
 */
export const gastos = esquemaAsistente.table(
  "gastos",
  {
    organizacionId: organizacionId(),
    usuarioId: text("usuario_id").notNull(),
    mes: text("mes").notNull(),
    preguntas: integer("preguntas").notNull().default(0),
    gastoUsd: numeric("gasto_usd", { precision: 14, scale: 9 }).notNull().default("0"),
  },
  (t) => [primaryKey({ columns: [t.organizacionId, t.usuarioId, t.mes] }), check("gastos_mes_valido", sql`${t.mes} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`), aislamientoPorOrganizacion("gastos")],
).enableRLS();

export type FilaIntercambio = typeof intercambios.$inferSelect;
