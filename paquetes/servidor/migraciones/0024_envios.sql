CREATE SCHEMA "envios";
--> statement-breakpoint
CREATE TABLE "clientes"."contactos" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"cargo" text DEFAULT '' NOT NULL,
	"correo" text,
	"celular" text,
	"recibe_correo" boolean DEFAULT false NOT NULL,
	"recibe_whatsapp" boolean DEFAULT false NOT NULL,
	"whatsapp_autorizado_por" text,
	"whatsapp_autorizado_en" timestamp with time zone,
	"correo_rebotado_en" timestamp with time zone,
	"correo_rebotado_motivo" text,
	"quitado_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clientes"."contactos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "envios"."envios" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"contacto_id" uuid NOT NULL,
	"contacto_nombre" text NOT NULL,
	"canal" text NOT NULL,
	"destino" text NOT NULL,
	"mensaje" jsonb NOT NULL,
	"estado" text DEFAULT 'en_cola' NOT NULL,
	"proveedor_id" text,
	"error" text,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"enviado_en" timestamp with time zone,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "envios"."envios" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "clientes"."contactos" ADD CONSTRAINT "contactos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "clientes"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contactos_cliente_idx" ON "clientes"."contactos" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "envios_version_idx" ON "envios"."envios" USING btree ("organizacion_id","version_id");--> statement-breakpoint
CREATE POLICY "contactos_aislamiento_organizacion" ON "clientes"."contactos" AS PERMISSIVE FOR ALL TO "teins_app" USING (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid) WITH CHECK (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "envios_aislamiento_organizacion" ON "envios"."envios" AS PERMISSIVE FOR ALL TO "teins_app" USING (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid) WITH CHECK (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid);