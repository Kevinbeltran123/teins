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

-- Rol exclusivo del portal del cliente (ADR-0009, parte 3): su conexión solo ve las versiones
-- publicadas del cliente de la sesión y las tablas del propio portal. Aunque el código del portal
-- tenga un error, la base no le devuelve datos de otro cliente ni nada que no esté publicado (QA-4).
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'teins_portal') THEN
    CREATE ROLE teins_portal LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
$$;
