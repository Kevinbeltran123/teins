CREATE SCHEMA "cambios";
--> statement-breakpoint
CREATE SCHEMA "clientes";
--> statement-breakpoint
CREATE SCHEMA "visitas";
--> statement-breakpoint
CREATE TABLE "identidad"."dispositivos" (
	"id" uuid NOT NULL,
	"usuario_id" text NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"secreto_huella" text NOT NULL,
	"salud" jsonb,
	"registrado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"ultimo_contacto" timestamp with time zone NOT NULL,
	"orden_de_borrado_en" timestamp with time zone,
	"borrado_confirmado_en" timestamp with time zone,
	CONSTRAINT "dispositivos_id_usuario_id_pk" PRIMARY KEY("id","usuario_id")
);
--> statement-breakpoint
CREATE TABLE "cambios"."registro" (
	"secuencia" bigserial PRIMARY KEY NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"usuario_id" text,
	"entidad" text NOT NULL,
	"entidad_id" text NOT NULL,
	"operacion" text NOT NULL,
	"registrado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cambios"."registro" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "clientes"."clientes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clientes"."clientes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "clientes"."sitios" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"direccion" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clientes"."sitios" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "visitas"."visitas" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"sitio_id" uuid NOT NULL,
	"motivo" text NOT NULL,
	"programada_para" date NOT NULL,
	"tecnicos" text[] NOT NULL,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "visitas"."visitas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "identidad"."usuarios" ADD COLUMN "desactivado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "levantamientos"."levantamientos" ADD COLUMN "visita_id" uuid;--> statement-breakpoint
ALTER TABLE "identidad"."dispositivos" ADD CONSTRAINT "dispositivos_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "identidad"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes"."sitios" ADD CONSTRAINT "sitios_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "clientes"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dispositivos_usuario_idx" ON "identidad"."dispositivos" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "registro_bajada_idx" ON "cambios"."registro" USING btree ("organizacion_id","secuencia");--> statement-breakpoint
CREATE INDEX "sitios_cliente_idx" ON "clientes"."sitios" USING btree ("cliente_id");--> statement-breakpoint
CREATE POLICY "registro_aislamiento_organizacion" ON "cambios"."registro" AS PERMISSIVE FOR ALL TO "teins_app" USING (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid) WITH CHECK (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "clientes_aislamiento_organizacion" ON "clientes"."clientes" AS PERMISSIVE FOR ALL TO "teins_app" USING (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid) WITH CHECK (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "sitios_aislamiento_organizacion" ON "clientes"."sitios" AS PERMISSIVE FOR ALL TO "teins_app" USING (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid) WITH CHECK (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "visitas_aislamiento_organizacion" ON "visitas"."visitas" AS PERMISSIVE FOR ALL TO "teins_app" USING (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid) WITH CHECK (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid);