CREATE TABLE "identidad"."segundos_factores" (
	"id" text PRIMARY KEY NOT NULL,
	"secreto" text NOT NULL,
	"codigos_de_respaldo" text NOT NULL,
	"usuario_id" text NOT NULL,
	"verificado" boolean DEFAULT true NOT NULL,
	"intentos_fallidos" integer DEFAULT 0 NOT NULL,
	"bloqueado_hasta" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "identidad"."usuarios" ADD COLUMN "administrador" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "identidad"."usuarios" ADD COLUMN "segundo_factor" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "informes"."versiones" ADD COLUMN "retirada_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "informes"."versiones" ADD COLUMN "retirada_por" text;--> statement-breakpoint
ALTER TABLE "informes"."versiones" ADD COLUMN "motivo_retiro" text;--> statement-breakpoint
ALTER TABLE "identidad"."segundos_factores" ADD CONSTRAINT "segundos_factores_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "identidad"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "segundos_factores_usuario_idx" ON "identidad"."segundos_factores" USING btree ("usuario_id");--> statement-breakpoint
ALTER POLICY "versiones_portal_cliente" ON "informes"."versiones" TO teins_portal USING (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid
        and cliente_id = nullif(current_setting('app.cliente', true), '')::uuid
        and pdf_estado = 'listo'
        and retirada_en is null);