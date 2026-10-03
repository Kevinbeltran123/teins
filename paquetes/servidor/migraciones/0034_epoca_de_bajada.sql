CREATE TABLE "cambios"."epocas" (
	"organizacion_id" uuid NOT NULL,
	"epoca" text NOT NULL,
	CONSTRAINT "epocas_organizacion_id_pk" PRIMARY KEY("organizacion_id")
);
--> statement-breakpoint
ALTER TABLE "cambios"."epocas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "epocas_aislamiento_organizacion" ON "cambios"."epocas" AS PERMISSIVE FOR ALL TO "teins_app" USING (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid) WITH CHECK (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid);--> statement-breakpoint
-- La aplicación solo la lee (ADR-0038): la cambia el script que deja limpio un entorno, como dueño de la base.
GRANT SELECT ON cambios.epocas TO teins_app;