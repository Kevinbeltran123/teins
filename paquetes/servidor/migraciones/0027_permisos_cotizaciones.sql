-- Permisos de la iteración 21, cotizaciones (ADR-0029; ADR-0009).

-- Lista de precios con historia: cada cambio agrega una fila; nunca se cambia ni se borra una.
GRANT SELECT, INSERT ON catalogo.precios TO teins_app;--> statement-breakpoint
-- Cotizaciones: el borrador se edita; el consecutivo solo sube.
GRANT USAGE ON SCHEMA cotizaciones TO teins_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON cotizaciones.cotizaciones TO teins_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON cotizaciones.consecutivos TO teins_app;--> statement-breakpoint
-- Versiones publicadas: inmutables; solo cambia el estado de su PDF (como las del informe, QA-9).
GRANT SELECT, INSERT ON cotizaciones.versiones TO teins_app;--> statement-breakpoint
GRANT UPDATE (pdf_estado, pdf_huella, pdf_generado_en, pdf_error) ON cotizaciones.versiones TO teins_app;
