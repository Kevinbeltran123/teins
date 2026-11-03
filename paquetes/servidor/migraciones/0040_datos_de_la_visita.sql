CREATE TABLE "visitas"."consecutivos_de_orden" (
	"organizacion_id" uuid NOT NULL,
	"ultimo" integer NOT NULL,
	CONSTRAINT "consecutivos_de_orden_organizacion_id_pk" PRIMARY KEY("organizacion_id")
);
--> statement-breakpoint
ALTER TABLE "visitas"."consecutivos_de_orden" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "identidad"."usuarios" ADD COLUMN "documento" text;--> statement-breakpoint
ALTER TABLE "clientes"."clientes" ADD COLUMN "nit" text;--> statement-breakpoint
ALTER TABLE "clientes"."sitios" ADD COLUMN "ciudad" text;--> statement-breakpoint
ALTER TABLE "visitas"."visitas" ADD COLUMN "solicitante_contacto_id" uuid;--> statement-breakpoint
ALTER TABLE "visitas"."visitas" ADD COLUMN "orden_de_servicio" integer;--> statement-breakpoint
ALTER TABLE "visitas"."visitas" ADD COLUMN "referencia_cliente" text;--> statement-breakpoint
ALTER TABLE "visitas"."visitas" ADD CONSTRAINT "visitas_orden_por_organizacion" UNIQUE("organizacion_id","orden_de_servicio");--> statement-breakpoint
CREATE POLICY "consecutivos_de_orden_aislamiento_organizacion" ON "visitas"."consecutivos_de_orden" AS PERMISSIVE FOR ALL TO "teins_app" USING (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid) WITH CHECK (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON visitas.consecutivos_de_orden TO teins_app;--> statement-breakpoint
GRANT UPDATE (nit) ON clientes.clientes TO teins_app;--> statement-breakpoint
GRANT UPDATE (ciudad) ON clientes.sitios TO teins_app;
