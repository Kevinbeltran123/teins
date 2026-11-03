-- Acceso al portal por contacto, con código por correo (ADR-0053). El QR y la clave por cliente se retiran sin migrar
-- nada: no hay datos reales en ningún entorno (ADR-0021). Sus sesiones se cierran.
DELETE FROM portal.sesiones;--> statement-breakpoint
DELETE FROM portal.accesos;--> statement-breakpoint
CREATE TABLE "portal"."pedidos" (
	"acceso_id" uuid PRIMARY KEY NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"pedido_id" uuid NOT NULL,
	"navegador_huella" text NOT NULL,
	"expira_en" timestamp with time zone NOT NULL,
	"intentos" integer DEFAULT 0 NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "portal"."pedidos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "portal"."accesos" DROP CONSTRAINT "accesos_identificador_unique";--> statement-breakpoint
ALTER TABLE "portal"."accesos" DROP CONSTRAINT "accesos_uno_por_cliente";--> statement-breakpoint
ALTER TABLE "portal"."sesiones" DROP CONSTRAINT "sesiones_acceso_id_accesos_id_fk";
--> statement-breakpoint
ALTER TABLE "portal"."accesos" ADD COLUMN "contacto_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "portal"."accesos" ADD COLUMN "correo" text NOT NULL;--> statement-breakpoint
ALTER TABLE "portal"."accesos" ADD COLUMN "contacto_nombre" text NOT NULL;--> statement-breakpoint
ALTER TABLE "portal"."accesos" ADD COLUMN "organizacion_nombre" text NOT NULL;--> statement-breakpoint
ALTER TABLE "portal"."accesos" ADD COLUMN "ve_informes" boolean NOT NULL;--> statement-breakpoint
ALTER TABLE "portal"."accesos" ADD COLUMN "ve_cotizaciones" boolean NOT NULL;--> statement-breakpoint
ALTER TABLE "portal"."accesos" ADD COLUMN "ultimo_ingreso" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "portal"."pedidos" ADD CONSTRAINT "pedidos_acceso_id_accesos_id_fk" FOREIGN KEY ("acceso_id") REFERENCES "portal"."accesos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal"."sesiones" ADD CONSTRAINT "sesiones_acceso_id_accesos_id_fk" FOREIGN KEY ("acceso_id") REFERENCES "portal"."accesos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accesos_cliente_idx" ON "portal"."accesos" USING btree ("organizacion_id","cliente_id");--> statement-breakpoint
ALTER TABLE "portal"."accesos" DROP COLUMN "identificador";--> statement-breakpoint
ALTER TABLE "portal"."accesos" DROP COLUMN "clave_hash";--> statement-breakpoint
ALTER TABLE "portal"."accesos" DROP COLUMN "regenerado_en";--> statement-breakpoint
ALTER TABLE "portal"."accesos" ADD CONSTRAINT "accesos_uno_por_contacto" UNIQUE("organizacion_id","contacto_id");--> statement-breakpoint
ALTER TABLE "portal"."accesos" ADD CONSTRAINT "accesos_un_correo" UNIQUE("organizacion_id","correo");--> statement-breakpoint
CREATE POLICY "accesos_portal_ingreso" ON "portal"."accesos" AS PERMISSIVE FOR UPDATE TO "teins_portal" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "pedidos_aislamiento_organizacion" ON "portal"."pedidos" AS PERMISSIVE FOR ALL TO "teins_app" USING (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid) WITH CHECK (organizacion_id = nullif(current_setting('app.organizacion', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "pedidos_portal" ON "portal"."pedidos" AS PERMISSIVE FOR ALL TO "teins_portal" USING (true) WITH CHECK (true);--> statement-breakpoint

-- Rol de la aplicación: oficina da, cambia y quita accesos (borrar uno cierra sus sesiones y su pedido); el worker lee
-- el pedido para enviar el correo del código.
GRANT DELETE ON portal.accesos TO teins_app;--> statement-breakpoint
GRANT SELECT, DELETE ON portal.pedidos TO teins_app;--> statement-breakpoint

-- Rol del portal: maneja los pedidos de código y anota el último ingreso. Nada más del acceso cambia desde el portal.
GRANT SELECT, INSERT, UPDATE, DELETE ON portal.pedidos TO teins_portal;--> statement-breakpoint
GRANT UPDATE (ultimo_ingreso) ON portal.accesos TO teins_portal;--> statement-breakpoint

-- El portal encola el correo del código, y solo ese: no recibe la función general de la cola. La llave por acceso
-- reemplaza un correo anterior que no haya salido (el pedido nuevo reemplazó al anterior).
CREATE FUNCTION cola.encolar_correo_del_portal(organizacion uuid, acceso uuid, pedido uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT graphile_worker.add_job(
    'portal.correo',
    payload => json_build_object('organizacionId', organizacion, 'accesoId', acceso, 'tipo', 'codigo', 'pedidoId', pedido),
    job_key => 'portal.codigo:' || acceso::text,
    max_attempts => 3
  );
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION cola.encolar_correo_del_portal(uuid, uuid, uuid) FROM PUBLIC;--> statement-breakpoint
GRANT USAGE ON SCHEMA cola TO teins_portal;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION cola.encolar_correo_del_portal(uuid, uuid, uuid) TO teins_portal;
