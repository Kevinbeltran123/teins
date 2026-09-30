CREATE SCHEMA "cotizaciones";
--> statement-breakpoint
CREATE TABLE "catalogo"."precios" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"valor" integer NOT NULL,
	"desde" timestamp with time zone DEFAULT now() NOT NULL,
	"por" text NOT NULL,
	"origen" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "catalogo"."precios" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cotizaciones"."consecutivos" (
	"organizacion_id" uuid NOT NULL,
	"anio" integer NOT NULL,
	"ultimo" integer NOT NULL,
	CONSTRAINT "consecutivos_organizacion_id_anio_pk" PRIMARY KEY("organizacion_id","anio")
);
--> statement-breakpoint
ALTER TABLE "cotizaciones"."consecutivos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cotizaciones"."cotizaciones" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"visita_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"lineas" jsonb NOT NULL,
	"impuestos" jsonb NOT NULL,
	"condiciones" jsonb NOT NULL,
	"creada_por" text NOT NULL,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cotizaciones_numero_por_organizacion" UNIQUE("organizacion_id","numero")
);
--> statement-breakpoint
ALTER TABLE "cotizaciones"."cotizaciones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cotizaciones"."versiones" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"cotizacion_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"contenido" jsonb NOT NULL,
	"total" bigint NOT NULL,
	"publicada_por" text NOT NULL,
	"publicada_en" timestamp with time zone NOT NULL,
	"pdf_estado" text DEFAULT 'generando' NOT NULL,
	"pdf_huella" text,
	"pdf_generado_en" timestamp with time zone,
	"pdf_error" text,
	CONSTRAINT "versiones_numero_por_cotizacion" UNIQUE("cotizacion_id","numero")
);
--> statement-breakpoint
ALTER TABLE "cotizaciones"."versiones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "clientes"."contactos" ADD COLUMN "recibe_informes" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "clientes"."contactos" ADD COLUMN "recibe_cotizaciones" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "catalogo"."precios" ADD CONSTRAINT "precios_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "catalogo"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotizaciones"."versiones" ADD CONSTRAINT "versiones_cotizacion_id_cotizaciones_id_fk" FOREIGN KEY ("cotizacion_id") REFERENCES "cotizaciones"."cotizaciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "precios_item_idx" ON "catalogo"."precios" USING btree ("organizacion_id","item_id","desde");--> statement-breakpoint
CREATE INDEX "cotizaciones_visita_idx" ON "cotizaciones"."cotizaciones" USING btree ("organizacion_id","visita_id");--> statement-breakpoint
CREATE POLICY "precios_aislamiento_organizacion" ON "catalogo"."precios" AS PERMISSIVE FOR ALL TO "teins_app" USING (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid) WITH CHECK (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "consecutivos_aislamiento_organizacion" ON "cotizaciones"."consecutivos" AS PERMISSIVE FOR ALL TO "teins_app" USING (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid) WITH CHECK (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "cotizaciones_aislamiento_organizacion" ON "cotizaciones"."cotizaciones" AS PERMISSIVE FOR ALL TO "teins_app" USING (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid) WITH CHECK (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "versiones_aislamiento_organizacion" ON "cotizaciones"."versiones" AS PERMISSIVE FOR ALL TO "teins_app" USING (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid) WITH CHECK (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid);