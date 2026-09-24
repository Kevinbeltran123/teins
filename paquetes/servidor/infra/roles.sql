-- Rol de la aplicación. Lo crea la infraestructura una vez por base (Docker Compose en local,
-- la consola del proveedor en pruebas y producción). La contraseña llega por variable, nunca en el repositorio.
-- Sin BYPASSRLS y sin ser dueño de las tablas: la seguridad por fila siempre le aplica.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'teins_app') THEN
    CREATE ROLE teins_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
$$;
