CREATE SCHEMA "asistente";
--> statement-breakpoint
CREATE TABLE "asistente"."ajustes" (
	"organizacion_id" uuid PRIMARY KEY NOT NULL,
	"nombre" text DEFAULT 'Chispa' NOT NULL,
	"tope_mensual_usd" numeric(10, 2) DEFAULT '5' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "asistente"."ajustes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "asistente"."conversaciones" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"usuario_id" text NOT NULL,
	"titulo" text NOT NULL,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"eliminada_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "asistente"."conversaciones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "asistente"."gastos" (
	"organizacion_id" uuid NOT NULL,
	"usuario_id" text NOT NULL,
	"mes" text NOT NULL,
	"preguntas" integer DEFAULT 0 NOT NULL,
	"gasto_usd" numeric(14, 9) DEFAULT '0' NOT NULL,
	CONSTRAINT "gastos_organizacion_id_usuario_id_mes_pk" PRIMARY KEY("organizacion_id","usuario_id","mes"),
	CONSTRAINT "gastos_mes_valido" CHECK ("asistente"."gastos"."mes" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
--> statement-breakpoint
ALTER TABLE "asistente"."gastos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "asistente"."intercambios" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"conversacion_id" uuid NOT NULL,
	"usuario_id" text NOT NULL,
	"llave" uuid NOT NULL,
	"pregunta" text NOT NULL,
	"estado" text DEFAULT 'en_curso' NOT NULL,
	"pasos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"respuesta" jsonb,
	"error" text,
	"detener_pedido" boolean DEFAULT false NOT NULL,
	"modelo" text NOT NULL,
	"tokens_entrada" integer DEFAULT 0 NOT NULL,
	"tokens_salida" integer DEFAULT 0 NOT NULL,
	"tokens_cache_leida" integer DEFAULT 0 NOT NULL,
	"tokens_cache_escrita" integer DEFAULT 0 NOT NULL,
	"costo_usd" numeric(14, 9) DEFAULT '0' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"iniciado_en" timestamp with time zone,
	"terminado_en" timestamp with time zone,
	CONSTRAINT "intercambios_estado_valido" CHECK ("asistente"."intercambios"."estado" in ('en_curso', 'lista', 'error', 'detenida'))
);
--> statement-breakpoint
ALTER TABLE "asistente"."intercambios" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "asistente"."intercambios" ADD CONSTRAINT "intercambios_conversacion_id_conversaciones_id_fk" FOREIGN KEY ("conversacion_id") REFERENCES "asistente"."conversaciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversaciones_usuario_idx" ON "asistente"."conversaciones" USING btree ("organizacion_id","usuario_id","actualizada_en");--> statement-breakpoint
CREATE UNIQUE INDEX "intercambios_llave_idx" ON "asistente"."intercambios" USING btree ("organizacion_id","llave");--> statement-breakpoint
CREATE INDEX "intercambios_conversacion_idx" ON "asistente"."intercambios" USING btree ("conversacion_id","creado_en");--> statement-breakpoint
CREATE INDEX "intercambios_mes_idx" ON "asistente"."intercambios" USING btree ("organizacion_id","creado_en");--> statement-breakpoint
CREATE UNIQUE INDEX "intercambios_uno_en_curso_idx" ON "asistente"."intercambios" USING btree ("conversacion_id") WHERE estado = 'en_curso';--> statement-breakpoint
CREATE POLICY "ajustes_aislamiento_organizacion" ON "asistente"."ajustes" AS PERMISSIVE FOR ALL TO "teins_app" USING (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid) WITH CHECK (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "conversaciones_aislamiento_organizacion" ON "asistente"."conversaciones" AS PERMISSIVE FOR ALL TO "teins_app" USING (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid) WITH CHECK (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "gastos_aislamiento_organizacion" ON "asistente"."gastos" AS PERMISSIVE FOR ALL TO "teins_app" USING (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid) WITH CHECK (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "intercambios_aislamiento_organizacion" ON "asistente"."intercambios" AS PERMISSIVE FOR ALL TO "teins_app" USING (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid) WITH CHECK (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid);--> statement-breakpoint
-- Permisos del asistente (iteración 53, ADR-0060). Borrar es solo de la purga de conservación (Ley 1581, temporalidad):
-- las conversaciones eliminadas y las inactivas se borran con sus intercambios. El gasto del mes está aparte y nunca se
-- borra; los ajustes se crean y cambian (el tope).
GRANT USAGE ON SCHEMA asistente TO teins_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON asistente.conversaciones TO teins_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON asistente.intercambios TO teins_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON asistente.ajustes TO teins_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON asistente.gastos TO teins_app;
