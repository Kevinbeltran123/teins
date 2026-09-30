import { sql } from "drizzle-orm";
import { pgPolicy, pgRole, timestamp, uuid } from "drizzle-orm/pg-core";

/** Rol con que corre la aplicación. Lo crea la infraestructura; las migraciones solo le dan permisos. */
export const rolApp = pgRole("teins_app").existing();
/** Rol exclusivo del portal del cliente (ADR-0009, parte 3). */
export const rolPortal = pgRole("teins_portal").existing();

export const conZona = { withTimezone: true, mode: "date" } as const;

/** Columna de organización: todo dato de negocio pertenece a una (regla 15). */
export const organizacionId = () => uuid("organizacion_id").notNull();

/**
 * Seguridad por fila (ADR-0009): la base solo devuelve y acepta filas de la organización
 * fijada en la transacción. Sin organización fijada, no devuelve nada.
 */
export const aislamientoPorOrganizacion = (tabla: string) =>
  pgPolicy(`${tabla}_aislamiento_organizacion`, {
    as: "permissive",
    to: rolApp,
    for: "all",
    using: sql`organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid`,
    withCheck: sql`organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid`,
  });

export const marcaDeTiempo = (nombre: string) => timestamp(nombre, conZona);

