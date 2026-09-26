CREATE SCHEMA "catalogo";
--> statement-breakpoint
CREATE TABLE "levantamientos"."lineas_cantidad" (
	"organizacion_id" uuid NOT NULL,
	"levantamiento_id" uuid NOT NULL,
	"seccion" text NOT NULL,
	"campo" text NOT NULL,
	"linea" text NOT NULL,
	"orden" integer NOT NULL,
	"descripcion" text NOT NULL,
	"cantidad" text NOT NULL,
	"unidad" text NOT NULL,
	"observacion" text,
	"item_catalogo_id" uuid,
	"vinculada_por" text,
	"vinculada_en" timestamp with time zone,
	"quitada_en" timestamp with time zone,
	CONSTRAINT "lineas_cantidad_levantamiento_id_seccion_campo_linea_pk" PRIMARY KEY("levantamiento_id","seccion","campo","linea")
);
--> statement-breakpoint
ALTER TABLE "levantamientos"."lineas_cantidad" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "catalogo"."items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"codigo" text NOT NULL,
	"descripcion" text NOT NULL,
	"unidad" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "items_codigo_por_organizacion" UNIQUE("organizacion_id","codigo")
);
--> statement-breakpoint
ALTER TABLE "catalogo"."items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "levantamientos"."lineas_cantidad" ADD CONSTRAINT "lineas_cantidad_levantamiento_id_levantamientos_id_fk" FOREIGN KEY ("levantamiento_id") REFERENCES "levantamientos"."levantamientos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lineas_cantidad_item_idx" ON "levantamientos"."lineas_cantidad" USING btree ("organizacion_id","item_catalogo_id");--> statement-breakpoint
CREATE INDEX "items_descripcion_idx" ON "catalogo"."items" USING btree ("organizacion_id","descripcion");--> statement-breakpoint
CREATE POLICY "lineas_cantidad_aislamiento_organizacion" ON "levantamientos"."lineas_cantidad" AS PERMISSIVE FOR ALL TO "teins_app" USING (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid) WITH CHECK (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "items_aislamiento_organizacion" ON "catalogo"."items" AS PERMISSIVE FOR ALL TO "teins_app" USING (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid) WITH CHECK (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid);