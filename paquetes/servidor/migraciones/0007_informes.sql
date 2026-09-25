CREATE SCHEMA "informes";
--> statement-breakpoint
CREATE TABLE "informes"."informes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"visita_id" uuid NOT NULL,
	"introduccion" text DEFAULT '' NOT NULL,
	"conclusiones" text DEFAULT '' NOT NULL,
	"levantamientos" uuid[] DEFAULT '{}' NOT NULL,
	"planos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "informes_una_por_visita" UNIQUE("organizacion_id","visita_id")
);
--> statement-breakpoint
ALTER TABLE "informes"."informes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "informes"."versiones" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"informe_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"contenido" jsonb NOT NULL,
	"publicada_por" text NOT NULL,
	"publicada_en" timestamp with time zone NOT NULL,
	"pdf_estado" text DEFAULT 'generando' NOT NULL,
	"pdf_huella" text,
	"pdf_generado_en" timestamp with time zone,
	"pdf_error" text,
	CONSTRAINT "versiones_numero" UNIQUE("informe_id","numero")
);
--> statement-breakpoint
ALTER TABLE "informes"."versiones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "informes"."versiones" ADD CONSTRAINT "versiones_informe_id_informes_id_fk" FOREIGN KEY ("informe_id") REFERENCES "informes"."informes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "versiones_informe_idx" ON "informes"."versiones" USING btree ("informe_id");--> statement-breakpoint
CREATE POLICY "informes_aislamiento_organizacion" ON "informes"."informes" AS PERMISSIVE FOR ALL TO "teins_app" USING (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid) WITH CHECK (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "versiones_aislamiento_organizacion" ON "informes"."versiones" AS PERMISSIVE FOR ALL TO "teins_app" USING (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid) WITH CHECK (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid);