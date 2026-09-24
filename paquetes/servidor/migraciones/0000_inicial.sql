CREATE SCHEMA "identidad";
--> statement-breakpoint
CREATE SCHEMA "formatos";
--> statement-breakpoint
CREATE SCHEMA "archivos";
--> statement-breakpoint
CREATE SCHEMA "auditoria";
--> statement-breakpoint
CREATE SCHEMA "levantamientos";
--> statement-breakpoint
CREATE TABLE "identidad"."cuentas" (
	"id" text PRIMARY KEY NOT NULL,
	"cuenta_id" text NOT NULL,
	"proveedor_id" text NOT NULL,
	"usuario_id" text NOT NULL,
	"token_acceso" text,
	"token_renovacion" text,
	"token_id" text,
	"token_acceso_expira_en" timestamp with time zone,
	"token_renovacion_expira_en" timestamp with time zone,
	"alcance" text,
	"contrasena" text,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizada_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identidad"."limites_de_tasa" (
	"id" text PRIMARY KEY NOT NULL,
	"llave" text NOT NULL,
	"conteo" integer NOT NULL,
	"ultima_solicitud" bigint NOT NULL,
	CONSTRAINT "limites_de_tasa_llave_unique" UNIQUE("llave")
);
--> statement-breakpoint
CREATE TABLE "identidad"."organizaciones" (
	"id" uuid PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identidad"."sesiones" (
	"id" text PRIMARY KEY NOT NULL,
	"expira_en" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" text,
	"agente" text,
	"usuario_id" text NOT NULL,
	CONSTRAINT "sesiones_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "identidad"."usuarios" (
	"id" text PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"correo" text NOT NULL,
	"correo_verificado" boolean DEFAULT false NOT NULL,
	"imagen" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"usuario" text,
	"usuario_visible" text,
	"organizacion_id" uuid NOT NULL,
	"rol" text NOT NULL,
	CONSTRAINT "usuarios_correo_unique" UNIQUE("correo"),
	CONSTRAINT "usuarios_usuario_unique" UNIQUE("usuario"),
	CONSTRAINT "usuarios_rol_valido" CHECK ("identidad"."usuarios"."rol" in ('tecnico', 'oficina'))
);
--> statement-breakpoint
CREATE TABLE "identidad"."verificaciones" (
	"id" text PRIMARY KEY NOT NULL,
	"identificador" text NOT NULL,
	"valor" text NOT NULL,
	"expira_en" timestamp with time zone NOT NULL,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizada_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "formatos"."versiones" (
	"organizacion_id" uuid NOT NULL,
	"formato" text NOT NULL,
	"version" integer NOT NULL,
	"definicion" jsonb NOT NULL,
	"huella" text NOT NULL,
	"publicada_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "versiones_organizacion_id_formato_version_pk" PRIMARY KEY("organizacion_id","formato","version")
);
--> statement-breakpoint
ALTER TABLE "formatos"."versiones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "archivos"."archivos" (
	"organizacion_id" uuid NOT NULL,
	"huella" text NOT NULL,
	"tipo" text NOT NULL,
	"bytes" bigint NOT NULL,
	"estado" text NOT NULL,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"subido_en" timestamp with time zone,
	"verificado_en" timestamp with time zone,
	"motivo_rechazo" text,
	CONSTRAINT "archivos_organizacion_id_huella_pk" PRIMARY KEY("organizacion_id","huella"),
	CONSTRAINT "archivos_estado_valido" CHECK ("archivos"."archivos"."estado" in ('pendiente', 'subido', 'verificado', 'rechazado')),
	CONSTRAINT "archivos_huella_valida" CHECK ("archivos"."archivos"."huella" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "archivos"."archivos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "auditoria"."registros" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"agregado_tipo" text NOT NULL,
	"agregado_id" text NOT NULL,
	"secuencia" integer NOT NULL,
	"tipo_evento" text NOT NULL,
	"ruta_campo" text,
	"valor_anterior" jsonb,
	"valor_nuevo" jsonb,
	"autor_id" text NOT NULL,
	"hora_servidor" timestamp with time zone NOT NULL,
	"hora_dispositivo" timestamp with time zone,
	"correlacion" text NOT NULL,
	"motivo" text,
	"version_formato_registro" smallint NOT NULL,
	"hash_anterior" "bytea",
	"hash" "bytea" NOT NULL,
	CONSTRAINT "registros_cadena_unica" UNIQUE("organizacion_id","agregado_tipo","agregado_id","secuencia")
);
--> statement-breakpoint
ALTER TABLE "auditoria"."registros" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "levantamientos"."comandos_procesados" (
	"llave" text PRIMARY KEY NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"usuario_id" text NOT NULL,
	"tipo" text NOT NULL,
	"resultado" jsonb,
	"procesado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "levantamientos"."comandos_procesados" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "levantamientos"."levantamientos" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"tecnico_id" text NOT NULL,
	"formato" text NOT NULL,
	"version_formato" integer NOT NULL,
	"estado" text NOT NULL,
	"respuestas" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"creado_en_dispositivo" timestamp with time zone NOT NULL,
	"enviado_en_dispositivo" timestamp with time zone NOT NULL,
	"recibido_en" timestamp with time zone NOT NULL,
	CONSTRAINT "levantamientos_estado_valido" CHECK ("levantamientos"."levantamientos"."estado" in ('enviado'))
);
--> statement-breakpoint
ALTER TABLE "levantamientos"."levantamientos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "identidad"."cuentas" ADD CONSTRAINT "cuentas_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "identidad"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identidad"."sesiones" ADD CONSTRAINT "sesiones_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "identidad"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identidad"."usuarios" ADD CONSTRAINT "usuarios_organizacion_id_organizaciones_id_fk" FOREIGN KEY ("organizacion_id") REFERENCES "identidad"."organizaciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cuentas_usuario_idx" ON "identidad"."cuentas" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "sesiones_usuario_idx" ON "identidad"."sesiones" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "usuarios_organizacion_idx" ON "identidad"."usuarios" USING btree ("organizacion_id");--> statement-breakpoint
CREATE INDEX "verificaciones_identificador_idx" ON "identidad"."verificaciones" USING btree ("identificador");--> statement-breakpoint
CREATE INDEX "registros_correlacion_idx" ON "auditoria"."registros" USING btree ("correlacion");--> statement-breakpoint
CREATE INDEX "levantamientos_bandeja_idx" ON "levantamientos"."levantamientos" USING btree ("organizacion_id","estado","recibido_en","id");--> statement-breakpoint
CREATE POLICY "versiones_aislamiento_organizacion" ON "formatos"."versiones" AS PERMISSIVE FOR ALL TO "teins_app" USING (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid) WITH CHECK (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "archivos_aislamiento_organizacion" ON "archivos"."archivos" AS PERMISSIVE FOR ALL TO "teins_app" USING (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid) WITH CHECK (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "registros_aislamiento_organizacion" ON "auditoria"."registros" AS PERMISSIVE FOR ALL TO "teins_app" USING (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid) WITH CHECK (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "comandos_procesados_aislamiento_organizacion" ON "levantamientos"."comandos_procesados" AS PERMISSIVE FOR ALL TO "teins_app" USING (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid) WITH CHECK (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "levantamientos_aislamiento_organizacion" ON "levantamientos"."levantamientos" AS PERMISSIVE FOR ALL TO "teins_app" USING (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid) WITH CHECK (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid);