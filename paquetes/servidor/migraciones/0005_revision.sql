CREATE TABLE "levantamientos"."comentarios" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"levantamiento_id" uuid NOT NULL,
	"autor_id" text NOT NULL,
	"texto" text NOT NULL,
	"seccion" text,
	"campo" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "levantamientos"."comentarios" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "levantamientos"."levantamientos" DROP CONSTRAINT "levantamientos_estado_valido";--> statement-breakpoint
ALTER TABLE "levantamientos"."levantamientos" ADD COLUMN "revisor_id" text;--> statement-breakpoint
ALTER TABLE "levantamientos"."levantamientos" ADD COLUMN "tomado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "levantamientos"."levantamientos" ADD COLUMN "revisado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "levantamientos"."comentarios" ADD CONSTRAINT "comentarios_levantamiento_id_levantamientos_id_fk" FOREIGN KEY ("levantamiento_id") REFERENCES "levantamientos"."levantamientos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comentarios_levantamiento_idx" ON "levantamientos"."comentarios" USING btree ("levantamiento_id","creado_en");--> statement-breakpoint
ALTER TABLE "levantamientos"."levantamientos" ADD CONSTRAINT "levantamientos_estado_valido" CHECK ("levantamientos"."levantamientos"."estado" in ('enviado', 'en_revision', 'revisado'));--> statement-breakpoint
CREATE POLICY "comentarios_aislamiento_organizacion" ON "levantamientos"."comentarios" AS PERMISSIVE FOR ALL TO "teins_app" USING (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid) WITH CHECK (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid);