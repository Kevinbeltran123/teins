CREATE SCHEMA "avisos";
--> statement-breakpoint
CREATE TABLE "avisos"."suscripciones" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"usuario_id" text NOT NULL,
	"superficie" text NOT NULL,
	"origen" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"ultimo_envio_en" timestamp with time zone,
	"ultimo_error" text,
	CONSTRAINT "suscripciones_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
ALTER TABLE "avisos"."suscripciones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "suscripciones_usuario_idx" ON "avisos"."suscripciones" USING btree ("organizacion_id","usuario_id");--> statement-breakpoint
CREATE INDEX "suscripciones_superficie_idx" ON "avisos"."suscripciones" USING btree ("organizacion_id","superficie");--> statement-breakpoint
CREATE POLICY "suscripciones_aislamiento_organizacion" ON "avisos"."suscripciones" AS PERMISSIVE FOR ALL TO "teins_app" USING (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid) WITH CHECK (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid);