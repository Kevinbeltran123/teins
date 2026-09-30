-- Permisos de la iteración 19, símbolos de los bocetos (ADR-0027; ADR-0009).

-- Biblioteca de símbolos: se publica en bloque (crea, cambia y retira); nunca se borra, los bocetos lo llevan copiado.
GRANT USAGE ON SCHEMA simbolos TO teins_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON simbolos.simbolos TO teins_app;
