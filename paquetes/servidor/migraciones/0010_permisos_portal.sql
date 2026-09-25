-- Permisos del corte 5 (ADR-0009, partes 3 y 4).

-- La versión publicada guarda su cliente: la barrera del portal filtra por él (QA-4).
-- Las publicadas antes de este corte lo toman de su visita.
UPDATE informes.versiones v
SET cliente_id = vi.cliente_id
FROM informes.informes i
JOIN visitas.visitas vi ON vi.id = i.visita_id
WHERE v.informe_id = i.id AND v.cliente_id IS NULL;--> statement-breakpoint

-- Rol de la aplicación: crea y regenera accesos (comandos de administración) y cierra sus sesiones.
GRANT USAGE ON SCHEMA portal TO teins_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON portal.accesos TO teins_app;--> statement-breakpoint
GRANT SELECT, DELETE ON portal.sesiones TO teins_app;--> statement-breakpoint

-- Rol del portal: lo mínimo. Lee accesos para el ingreso; maneja sus sesiones y su límite de intentos;
-- registra ingresos y descargas en la auditoría; lee versiones publicadas, que la seguridad por fila
-- restringe al cliente de la sesión y al PDF listo. Nada de levantamientos, usuarios, visitas ni clientes.
GRANT USAGE ON SCHEMA portal, informes, auditoria TO teins_portal;--> statement-breakpoint
GRANT SELECT ON portal.accesos TO teins_portal;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON portal.sesiones TO teins_portal;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON portal.intentos TO teins_portal;--> statement-breakpoint
GRANT SELECT ON informes.versiones TO teins_portal;--> statement-breakpoint
GRANT SELECT, INSERT ON auditoria.registros TO teins_portal;
