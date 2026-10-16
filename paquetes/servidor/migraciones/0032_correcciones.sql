ALTER TABLE "levantamientos"."comentarios" ADD COLUMN "editado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "levantamientos"."comentarios" ADD COLUMN "retirado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "levantamientos"."comentarios" ADD COLUMN "retirado_por" text;--> statement-breakpoint
ALTER TABLE "clientes"."clientes" ADD COLUMN "editado_por" text;--> statement-breakpoint
ALTER TABLE "clientes"."clientes" ADD COLUMN "editado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "clientes"."clientes" ADD COLUMN "archivado_por" text;--> statement-breakpoint
ALTER TABLE "clientes"."clientes" ADD COLUMN "archivado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "clientes"."sitios" ADD COLUMN "archivado_por" text;--> statement-breakpoint
ALTER TABLE "clientes"."sitios" ADD COLUMN "archivado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "envios"."envios" ADD COLUMN "cancelado_por" text;--> statement-breakpoint
ALTER TABLE "envios"."envios" ADD COLUMN "cancelado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cotizaciones"."versiones" ADD COLUMN "retirada_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cotizaciones"."versiones" ADD COLUMN "retirada_por" text;--> statement-breakpoint
ALTER TABLE "cotizaciones"."versiones" ADD COLUMN "motivo_retiro" text;--> statement-breakpoint
-- Permisos de la iteración 28 (ADR-0034, ADR-0035): cada corrección cambia solo sus columnas; nada se borra.
GRANT UPDATE (retirada_en, retirada_por, motivo_retiro) ON cotizaciones.versiones TO teins_app;--> statement-breakpoint
GRANT UPDATE (nombre, editado_por, editado_en, archivado_por, archivado_en) ON clientes.clientes TO teins_app;--> statement-breakpoint
GRANT UPDATE (nombre, direccion, archivado_por, archivado_en) ON clientes.sitios TO teins_app;--> statement-breakpoint
GRANT UPDATE (texto, editado_en, retirado_en, retirado_por) ON levantamientos.comentarios TO teins_app;
