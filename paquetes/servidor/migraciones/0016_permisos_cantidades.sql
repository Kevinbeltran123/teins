-- Permisos de la iteración 11, cantidades con catálogo (ADR-0006, parte 2; ADR-0009).

-- Líneas de cantidad: la proyección se inserta y se actualiza; una línea que sale del documento se marca
-- como quitada, nunca se borra (regla 14).
GRANT SELECT, INSERT, UPDATE ON levantamientos.lineas_cantidad TO teins_app;--> statement-breakpoint

-- Catálogo: oficina crea, edita y desactiva ítems; nunca se borran (hay líneas vinculadas).
GRANT USAGE ON SCHEMA catalogo TO teins_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON catalogo.items TO teins_app;
