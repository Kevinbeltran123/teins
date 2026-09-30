-- Permisos del corte 3 (ADR-0008, ADR-0009): los comentarios de oficina solo se insertan y se leen.
-- Corregir un comentario sería escribir otro; nada se borra (regla 14).
GRANT SELECT, INSERT ON levantamientos.comentarios TO teins_app;
