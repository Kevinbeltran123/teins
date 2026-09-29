import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgSchema, primaryKey, text, uuid } from "drizzle-orm/pg-core";
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
 * Comentarios de oficina al técnico (modelo de dominio: no modifican datos). La aplicación solo
 * inserta y lee; bajan al técnico con el estado de su levantamiento.
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
  },
  (t) => [index("comentarios_levantamiento_idx").on(t.levantamientoId, t.creadoEn), aislamientoPorOrganizacion("comentarios")],
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
