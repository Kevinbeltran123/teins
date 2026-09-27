CREATE SCHEMA "simbolos";
--> statement-breakpoint
CREATE TABLE "simbolos"."simbolos" (
	"organizacion_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"categoria" text NOT NULL,
	"trazado" text NOT NULL,
	"relleno" text,
	"texto" text,
	"codigo" text,
	"orden" integer NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "simbolos_pkey" PRIMARY KEY("organizacion_id","id")
);
--> statement-breakpoint
ALTER TABLE "simbolos"."simbolos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "simbolos_aislamiento_organizacion" ON "simbolos"."simbolos" AS PERMISSIVE FOR ALL TO "teins_app" USING (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid) WITH CHECK (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid);