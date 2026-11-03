ALTER TABLE "cotizaciones"."versiones" ADD COLUMN "cliente_id" uuid;--> statement-breakpoint
CREATE POLICY "versiones_cotizacion_portal_cliente" ON "cotizaciones"."versiones" AS PERMISSIVE FOR SELECT TO "teins_portal" USING (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid
        and cliente_id = nullif(current_setting('app.cliente', true), '')::uuid
        and pdf_estado = 'listo'
        and retirada_en is null);--> statement-breakpoint

-- Cotizaciones en el portal (ADR-0053). Las publicadas antes toman el cliente de su cotización.
UPDATE cotizaciones.versiones v
SET cliente_id = c.cliente_id
FROM cotizaciones.cotizaciones c
WHERE v.cotizacion_id = c.id AND v.cliente_id IS NULL;--> statement-breakpoint

-- Rol del portal: solo las versiones publicadas, que la seguridad por fila restringe al cliente de la sesión, al PDF
-- listo y a lo no retirado. Nada del borrador (cotizaciones.cotizaciones) ni de los consecutivos.
GRANT USAGE ON SCHEMA cotizaciones TO teins_portal;--> statement-breakpoint
GRANT SELECT ON cotizaciones.versiones TO teins_portal;
