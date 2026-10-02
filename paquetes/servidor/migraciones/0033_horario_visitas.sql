ALTER TABLE "visitas"."visitas" ADD COLUMN "hora_inicio" time;--> statement-breakpoint
ALTER TABLE "visitas"."visitas" ADD COLUMN "hora_fin" time;--> statement-breakpoint
ALTER TABLE "visitas"."visitas" ADD COLUMN "terminada_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "visitas"."visitas" ADD COLUMN "terminada_por" text;--> statement-breakpoint
ALTER TABLE "visitas"."visitas" ADD CONSTRAINT "visitas_horario_valido" CHECK ("visitas"."visitas"."hora_fin" IS NULL OR ("visitas"."visitas"."hora_inicio" IS NOT NULL AND "visitas"."visitas"."hora_fin" > "visitas"."visitas"."hora_inicio"));