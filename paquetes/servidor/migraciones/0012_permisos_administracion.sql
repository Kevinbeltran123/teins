-- Permisos de la iteración 6, administración (ADR-0009).

-- Segundo factor: la biblioteca de autenticación lo crea, lo verifica, cuenta intentos y lo borra.
GRANT SELECT, INSERT, UPDATE, DELETE ON identidad.segundos_factores TO teins_app;--> statement-breakpoint

-- Retirar una versión del portal solo escribe estas tres columnas: la copia congelada sigue intocable (regla 10).
GRANT UPDATE (retirada_en, retirada_por, motivo_retiro) ON informes.versiones TO teins_app;
