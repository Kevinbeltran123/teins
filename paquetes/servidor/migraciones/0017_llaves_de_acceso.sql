CREATE TABLE "identidad"."llaves_de_acceso" (
	"id" text PRIMARY KEY NOT NULL,
	"nombre" text,
	"clave_publica" text NOT NULL,
	"usuario_id" text NOT NULL,
	"credencial" text NOT NULL,
	"contador" integer NOT NULL,
	"tipo_de_dispositivo" text NOT NULL,
	"respaldada" boolean NOT NULL,
	"transportes" text,
	"creada_en" timestamp with time zone,
	"aaguid" text,
	CONSTRAINT "llaves_de_acceso_credencial_unique" UNIQUE("credencial")
);
--> statement-breakpoint
ALTER TABLE "identidad"."llaves_de_acceso" ADD CONSTRAINT "llaves_de_acceso_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "identidad"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "llaves_de_acceso_usuario_idx" ON "identidad"."llaves_de_acceso" USING btree ("usuario_id");