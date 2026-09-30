-- Avisos push (iteración 15, ADR-0023): la aplicación guarda, actualiza y borra suscripciones. Se borran de
-- verdad: no son datos del negocio sino la dirección de un navegador, y una muerta no debe quedar.
GRANT USAGE ON SCHEMA avisos TO teins_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON avisos.suscripciones TO teins_app;
