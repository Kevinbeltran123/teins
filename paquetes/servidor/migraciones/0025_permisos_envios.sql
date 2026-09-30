-- Permisos de la iteración 20, envío del informe al cliente (ADR-0028; ADR-0009).

-- Contactos del cliente: oficina los crea, los cambia y los quita (sin borrar la fila: se vacían sus datos).
GRANT SELECT, INSERT, UPDATE ON clientes.contactos TO teins_app;--> statement-breakpoint
-- Envíos: se crean y cambian de estado; nunca se borran, son constancia de a dónde salió cada copia.
GRANT USAGE ON SCHEMA envios TO teins_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON envios.envios TO teins_app;
