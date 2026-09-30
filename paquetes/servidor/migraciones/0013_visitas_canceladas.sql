ALTER TABLE "visitas"."visitas" ADD COLUMN "cancelada_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "visitas"."visitas" ADD COLUMN "cancelada_por" text;--> statement-breakpoint
ALTER TABLE "visitas"."visitas" ADD COLUMN "motivo_cancelacion" text;--> statement-breakpoint
CREATE INDEX "visitas_programada_idx" ON "visitas"."visitas" USING btree ("organizacion_id","programada_para");