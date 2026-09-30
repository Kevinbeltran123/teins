CREATE SCHEMA "portal";
--> statement-breakpoint
CREATE TABLE "portal"."accesos" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"cliente_nombre" text NOT NULL,
	"identificador" text NOT NULL,
	"clave_hash" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"regenerado_en" timestamp with time zone,
	CONSTRAINT "accesos_identificador_unique" UNIQUE("identificador"),
	CONSTRAINT "accesos_uno_por_cliente" UNIQUE("organizacion_id","cliente_id")
);
--> statement-breakpoint
ALTER TABLE "portal"."accesos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "portal"."intentos" (
	"llave" text PRIMARY KEY NOT NULL,
	"fallos" integer NOT NULL,
	"ultimo_fallo" timestamp with time zone NOT NULL,
	"bloqueado_hasta" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "portal"."sesiones" (
	"token_huella" text PRIMARY KEY NOT NULL,
	"acceso_id" uuid NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"expira_en" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "portal"."sesiones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "informes"."versiones" ADD COLUMN "cliente_id" uuid;--> statement-breakpoint
ALTER TABLE "portal"."sesiones" ADD CONSTRAINT "sesiones_acceso_id_accesos_id_fk" FOREIGN KEY ("acceso_id") REFERENCES "portal"."accesos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sesiones_acceso_idx" ON "portal"."sesiones" USING btree ("acceso_id");--> statement-breakpoint
CREATE POLICY "registros_portal_organizacion" ON "auditoria"."registros" AS PERMISSIVE FOR ALL TO "teins_portal" USING (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid) WITH CHECK (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "versiones_portal_cliente" ON "informes"."versiones" AS PERMISSIVE FOR SELECT TO "teins_portal" USING (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid
        and cliente_id = nullif(current_setting('app.cliente', true), '')::uuid
        and pdf_estado = 'listo');--> statement-breakpoint
CREATE POLICY "accesos_aislamiento_organizacion" ON "portal"."accesos" AS PERMISSIVE FOR ALL TO "teins_app" USING (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid) WITH CHECK (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "accesos_portal_lectura" ON "portal"."accesos" AS PERMISSIVE FOR SELECT TO "teins_portal" USING (true);--> statement-breakpoint
CREATE POLICY "sesiones_aislamiento_organizacion" ON "portal"."sesiones" AS PERMISSIVE FOR ALL TO "teins_app" USING (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid) WITH CHECK (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "sesiones_portal" ON "portal"."sesiones" AS PERMISSIVE FOR ALL TO "teins_portal" USING (true) WITH CHECK (true);