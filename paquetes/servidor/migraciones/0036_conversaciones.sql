CREATE TABLE "levantamientos"."lecturas" (
	"organizacion_id" uuid NOT NULL,
	"usuario_id" text NOT NULL,
	"levantamiento_id" uuid NOT NULL,
	"leido_hasta" timestamp with time zone NOT NULL,
	CONSTRAINT "lecturas_usuario_id_levantamiento_id_pk" PRIMARY KEY("usuario_id","levantamiento_id")
);
--> statement-breakpoint
ALTER TABLE "levantamientos"."lecturas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "levantamientos"."comentarios" ADD COLUMN "en_respuesta_a" uuid;--> statement-breakpoint
ALTER TABLE "levantamientos"."comentarios" ADD COLUMN "de" text DEFAULT 'oficina' NOT NULL;--> statement-breakpoint
ALTER TABLE "levantamientos"."comentarios" ADD COLUMN "llave" uuid;--> statement-breakpoint
ALTER TABLE "levantamientos"."lecturas" ADD CONSTRAINT "lecturas_levantamiento_id_levantamientos_id_fk" FOREIGN KEY ("levantamiento_id") REFERENCES "levantamientos"."levantamientos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lecturas_levantamiento_idx" ON "levantamientos"."lecturas" USING btree ("levantamiento_id");--> statement-breakpoint
ALTER TABLE "levantamientos"."comentarios" ADD CONSTRAINT "comentarios_en_respuesta_a_comentarios_id_fk" FOREIGN KEY ("en_respuesta_a") REFERENCES "levantamientos"."comentarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "levantamientos"."comentarios" ADD CONSTRAINT "comentarios_llave_unique" UNIQUE("llave");--> statement-breakpoint
ALTER TABLE "levantamientos"."comentarios" ADD CONSTRAINT "comentarios_de_valido" CHECK ("levantamientos"."comentarios"."de" in ('oficina', 'tecnico'));--> statement-breakpoint
CREATE POLICY "lecturas_aislamiento_organizacion" ON "levantamientos"."lecturas" AS PERMISSIVE FOR ALL TO "teins_app" USING (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid) WITH CHECK (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid);--> statement-breakpoint
-- Permisos de la iteración 39 (ADR-0040): las respuestas son comentarios nuevos (INSERT, que ya tenía); lo leído se
-- inserta y solo cambia su hora. Nada se borra.
GRANT SELECT, INSERT ON levantamientos.lecturas TO teins_app;--> statement-breakpoint
GRANT UPDATE (leido_hasta) ON levantamientos.lecturas TO teins_app;
