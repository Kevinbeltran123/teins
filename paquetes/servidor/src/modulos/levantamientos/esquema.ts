import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgSchema, primaryKey, text, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import type { Repeticiones, Respuestas } from "@teins/dominio";
import { aislamientoPorOrganizacion, marcaDeTiempo, organizacionId } from "../../plataforma/esquema-comun";

export const esquemaLevantamientos = pgSchema("levantamientos");

/**
 * Modelo híbrido (ADR-0006): metadatos consultables en columnas; contenido variable en JSONB.
 * El identificador lo genera el dispositivo (UUID v7).
 */
export const levantamientos = esquemaLevantamientos.table(
  "levantamientos",
  {
    id: uuid("id").primaryKey(),
    organizacionId: organizacionId(),
    tecnicoId: text("tecnico_id").notNull(),
    formato: text("formato").notNull(),
    versionFormato: integer("version_formato").notNull(),
    /** Nulo en los levantamientos de los cortes 0 y 1, capturados antes de existir las visitas. */
    visitaId: uuid("visita_id"),
    estado: text("estado").notNull(),
    respuestas: jsonb("respuestas").$type<Respuestas>().notNull(),
    /** Repeticiones de las secciones repetibles, en orden (iteración 9). Vacío en formatos sin ellas. */
    repeticiones: jsonb("repeticiones").$type<Repeticiones>().notNull().default({}),
    /** Derivado de las respuestas al recibirlo: la bandeja lo muestra sin leer el documento. */
    cantidadFotos: integer("cantidad_fotos").notNull().default(0),
    /** Quién tiene la revisión (I-1): solo esa persona corrige y marca revisado. */
    revisorId: text("revisor_id"),
    tomadoEn: marcaDeTiempo("tomado_en"),
    revisadoEn: marcaDeTiempo("revisado_en"),
    /** Concurrencia optimista para la revisión (ADR-0005, QA-25). */
    version: integer("version").notNull().default(1),
    creadoEnDispositivo: marcaDeTiempo("creado_en_dispositivo").notNull(),
    enviadoEnDispositivo: marcaDeTiempo("enviado_en_dispositivo").notNull(),
    recibidoEn: marcaDeTiempo("recibido_en").notNull(),
  },
  (t) => [
    check("levantamientos_estado_valido", sql`${t.estado} in ('enviado', 'en_revision', 'revisado')`),
    index("levantamientos_bandeja_idx").on(t.organizacionId, t.estado, t.recibidoEn, t.id),
    index("levantamientos_visita_idx").on(t.organizacionId, t.visitaId),
    aislamientoPorOrganizacion("levantamientos"),
  ],
).enableRLS();

/**
 * Idempotencia (ADR-0005, patrón 1): la llave única bloquea un duplicado en vuelo hasta que el
 * primero confirma, y el resultado guardado responde igual a todo reintento. Las llaves no expiran.
 */
export const comandosProcesados = esquemaLevantamientos.table(
  "comandos_procesados",
  {
    llave: text("llave").primaryKey(),
    organizacionId: organizacionId(),
    usuarioId: text("usuario_id").notNull(),
    tipo: text("tipo").notNull(),
    resultado: jsonb("resultado"),
    procesadoEn: marcaDeTiempo("procesado_en").notNull().defaultNow(),
  },
  () => [aislamientoPorOrganizacion("comandos_procesados")],
).enableRLS();

/**
 * Comentarios de oficina al técnico (modelo de dominio: no modifican datos). Bajan al técnico con el estado de
 * su levantamiento. Su autor los edita o los retira mientras no esté Revisado (ADR-0035): retirar es anular,
 * la fila se conserva; la base solo deja cambiar esas columnas. Un comentario de oficina abre una conversación
 * (ADR-0040): las respuestas de las dos partes son filas con `en_respuesta_a`; las del técnico llevan la llave
 * con que las mandó el teléfono.
 */
export const comentarios = esquemaLevantamientos.table(
  "comentarios",
  {
    id: uuid("id").primaryKey(),
    organizacionId: organizacionId(),
    levantamientoId: uuid("levantamiento_id")
      .notNull()
      .references(() => levantamientos.id),
    autorId: text("autor_id").notNull(),
    texto: text("texto").notNull(),
    seccion: text("seccion"),
    campo: text("campo"),
    creadoEn: marcaDeTiempo("creado_en").notNull().defaultNow(),
    editadoEn: marcaDeTiempo("editado_en"),
    retiradoEn: marcaDeTiempo("retirado_en"),
    retiradoPor: text("retirado_por"),
    enRespuestaA: uuid("en_respuesta_a").references((): AnyPgColumn => comentarios.id),
    de: text("de").notNull().default("oficina"),
    llave: uuid("llave").unique(),
  },
  (t) => [
    index("comentarios_levantamiento_idx").on(t.levantamientoId, t.creadoEn),
    check("comentarios_de_valido", sql`${t.de} in ('oficina', 'tecnico')`),
    aislamientoPorOrganizacion("comentarios"),
  ],
).enableRLS();

/**
 * Hasta cuándo leyó cada persona de oficina las conversaciones de un levantamiento (ADR-0040): apaga su punto de
 * «sin leer» y le dice al técnico «Leído».
 */
export const lecturas = esquemaLevantamientos.table(
  "lecturas",
  {
    organizacionId: organizacionId(),
    usuarioId: text("usuario_id").notNull(),
    levantamientoId: uuid("levantamiento_id")
      .notNull()
      .references(() => levantamientos.id),
    leidoHasta: marcaDeTiempo("leido_hasta").notNull(),
  },
  (t) => [primaryKey({ columns: [t.usuarioId, t.levantamientoId] }), index("lecturas_levantamiento_idx").on(t.levantamientoId), aislamientoPorOrganizacion("lecturas")],
).enableRLS();

/**
 * Líneas de cantidad (ADR-0006, parte 2; iteración 11): proyección relacional de los campos `cantidades`
 * del documento, escrita en la misma transacción al recibir y al corregir. Aquí vive el vínculo al
 * catálogo, que pone oficina (regla 6). Una línea que desaparece del documento se marca como quitada:
 * nada se borra (regla 14).
 */
export const lineasCantidad = esquemaLevantamientos.table(
  "lineas_cantidad",
  {
    organizacionId: organizacionId(),
    levantamientoId: uuid("levantamiento_id")
      .notNull()
      .references(() => levantamientos.id),
    /** Clave de la sección en las respuestas (`seccion` o `seccion~id` en una repetible). */
    seccion: text("seccion").notNull(),
    campo: text("campo").notNull(),
    linea: text("linea").notNull(),
    orden: integer("orden").notNull(),
    descripcion: text("descripcion").notNull(),
    /** Decimal canónico, como en el documento: se suma con `sumarDecimales`, sin coma flotante. */
    cantidad: text("cantidad").notNull(),
    unidad: text("unidad").notNull(),
    observacion: text("observacion"),
    itemCatalogoId: uuid("item_catalogo_id"),
    vinculadaPor: text("vinculada_por"),
    vinculadaEn: marcaDeTiempo("vinculada_en"),
    quitadaEn: marcaDeTiempo("quitada_en"),
  },
  (t) => [
    primaryKey({ columns: [t.levantamientoId, t.seccion, t.campo, t.linea] }),
    index("lineas_cantidad_item_idx").on(t.organizacionId, t.itemCatalogoId),
    aislamientoPorOrganizacion("lineas_cantidad"),
  ],
).enableRLS();
