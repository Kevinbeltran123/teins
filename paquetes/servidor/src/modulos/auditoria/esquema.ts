import { customType, index, integer, jsonb, pgSchema, smallint, text, unique, uuid } from "drizzle-orm/pg-core";
import { aislamientoDelPortal, aislamientoPorOrganizacion, marcaDeTiempo, organizacionId } from "../../plataforma/esquema-comun";

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

export const auditoria = pgSchema("auditoria");

/**
 * Registro semántico con cadena de hashes por agregado (ADR-0008). La aplicación solo inserta
 * y lee: no tiene permiso de actualizar ni borrar (nivel 1), y la cadena detecta alteraciones (nivel 2b).
 */
export const registros = auditoria.table(
  "registros",
  {
    id: uuid("id").primaryKey(),
    organizacionId: organizacionId(),
    agregadoTipo: text("agregado_tipo").notNull(),
    agregadoId: text("agregado_id").notNull(),
    secuencia: integer("secuencia").notNull(),
    tipoEvento: text("tipo_evento").notNull(),
    rutaCampo: text("ruta_campo"),
    valorAnterior: jsonb("valor_anterior"),
    valorNuevo: jsonb("valor_nuevo"),
    autorId: text("autor_id").notNull(),
    horaServidor: marcaDeTiempo("hora_servidor").notNull(),
    horaDispositivo: marcaDeTiempo("hora_dispositivo"),
    correlacion: text("correlacion").notNull(),
    motivo: text("motivo"),
    versionFormatoRegistro: smallint("version_formato_registro").notNull(),
    hashAnterior: bytea("hash_anterior"),
    hash: bytea("hash").notNull(),
  },
  (t) => [
    unique("registros_cadena_unica").on(t.organizacionId, t.agregadoTipo, t.agregadoId, t.secuencia),
    index("registros_correlacion_idx").on(t.correlacion),
    aislamientoPorOrganizacion("registros"),
    aislamientoDelPortal("registros"),
  ],
).enableRLS();
