-- Permisos del rol de la aplicación (ADR-0008, ADR-0009). Principio de mínimo privilegio:
-- cada tabla recibe solo lo que su módulo necesita. Toda tabla nueva declara aquí sus permisos
-- en su propia migración; la prueba de permisos falla si una tabla de negocio queda sin revisar.

GRANT USAGE ON SCHEMA identidad, formatos, archivos, auditoria, levantamientos TO teins_app;--> statement-breakpoint

-- Identidad: la biblioteca de autenticación crea y revoca sesiones y cuentas.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA identidad TO teins_app;--> statement-breakpoint

-- Formatos: versiones inmutables (regla 8).
GRANT SELECT, INSERT ON formatos.versiones TO teins_app;--> statement-breakpoint

-- Archivos: cambian de estado, nunca se borran desde la aplicación (ADR-0007).
GRANT SELECT, INSERT, UPDATE ON archivos.archivos TO teins_app;--> statement-breakpoint

-- Auditoría: solo insertar y leer (nivel 1 de ADR-0008).
GRANT SELECT, INSERT ON auditoria.registros TO teins_app;--> statement-breakpoint

-- Levantamientos: nada se borra físicamente (regla 14).
GRANT SELECT, INSERT, UPDATE ON levantamientos.levantamientos TO teins_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON levantamientos.comandos_procesados TO teins_app;--> statement-breakpoint

-- Cola de trabajos (ADR-0012). graphile_worker.add_job exige privilegios de dueño: la aplicación
-- encola a través de esta función, que corre con los permisos de quien la creó.
CREATE SCHEMA cola;--> statement-breakpoint
CREATE FUNCTION cola.encolar(identificador text, datos jsonb, nombre_cola text, llave text, intentos_maximos integer)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT graphile_worker.add_job(
    identificador,
    payload => datos::json,
    queue_name => nombre_cola,
    job_key => llave,
    max_attempts => intentos_maximos
  );
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION cola.encolar(text, jsonb, text, text, integer) FROM PUBLIC;--> statement-breakpoint
GRANT USAGE ON SCHEMA cola TO teins_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION cola.encolar(text, jsonb, text, text, integer) TO teins_app;
