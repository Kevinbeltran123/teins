-- Permisos del corte 2 (ADR-0008, ADR-0009): mínimo privilegio y nada se borra físicamente (regla 14).
-- La prueba de permisos recorre estos esquemas y falla si una tabla queda sin seguridad por fila o con borrado.

GRANT USAGE ON SCHEMA cambios, clientes, visitas TO teins_app;--> statement-breakpoint

-- Dispositivos: se registran y actualizan su salud; nunca se borran, para conservar la orden de borrado y su confirmación.
GRANT SELECT, INSERT, UPDATE ON identidad.dispositivos TO teins_app;--> statement-breakpoint

-- Registro de cambios: solo insertar y leer, como la auditoría.
GRANT SELECT, INSERT ON cambios.registro TO teins_app;--> statement-breakpoint
GRANT USAGE ON SEQUENCE cambios.registro_secuencia_seq TO teins_app;--> statement-breakpoint

-- Clientes y sitios: por ahora solo se crean.
GRANT SELECT, INSERT ON clientes.clientes, clientes.sitios TO teins_app;--> statement-breakpoint

-- Visitas: se crean y se reasignan.
GRANT SELECT, INSERT, UPDATE ON visitas.visitas TO teins_app;--> statement-breakpoint

-- Lo que existía antes del registro de cambios también debe bajar: los formatos publicados, para toda
-- la organización, y el estado de cada levantamiento recibido, para su técnico.
INSERT INTO cambios.registro (organizacion_id, usuario_id, entidad, entidad_id, operacion)
SELECT organizacion_id, NULL, 'formato', formato || '@' || version, 'cambio'
FROM formatos.versiones
ORDER BY publicada_en, formato, version;--> statement-breakpoint

INSERT INTO cambios.registro (organizacion_id, usuario_id, entidad, entidad_id, operacion)
SELECT organizacion_id, tecnico_id, 'levantamiento', id::text, 'cambio'
FROM levantamientos.levantamientos
ORDER BY recibido_en, id;
