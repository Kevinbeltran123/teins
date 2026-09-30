-- Iteración 17 (ADR-0025): el catálogo baja a los teléfonos. Los ítems que ya existían se registran una vez,
-- para toda su organización; los que se creen o cambien desde ahora los registra el módulo de catálogo.
INSERT INTO cambios.registro (organizacion_id, usuario_id, entidad, entidad_id, operacion)
SELECT organizacion_id, NULL, 'item_catalogo', id::text, 'cambio' FROM catalogo.items ORDER BY organizacion_id, codigo;
