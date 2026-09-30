-- Permisos del corte 4 (ADR-0008, ADR-0009, ADR-0013).
GRANT USAGE ON SCHEMA informes TO teins_app;--> statement-breakpoint

-- El borrador se compone y se guarda; nada se borra (regla 14).
GRANT SELECT, INSERT, UPDATE ON informes.informes TO teins_app;--> statement-breakpoint

-- Versión publicada inmutable (regla 10, QA-9): la aplicación inserta y lee, y solo puede escribir
-- las columnas del PDF, que genera el worker después de publicar. La copia congelada no se puede tocar.
GRANT SELECT, INSERT ON informes.versiones TO teins_app;--> statement-breakpoint
GRANT UPDATE (pdf_estado, pdf_huella, pdf_generado_en, pdf_error) ON informes.versiones TO teins_app;
