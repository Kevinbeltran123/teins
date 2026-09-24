# oficina

Aplicación de oficina: bandeja, revisión, informes, administración.

**Dependencias:** Depende de `dominio`, `protocolo` y `ui`.

**ADR relevantes:** 0002, 0011, 0014

Corte 1: inicio de sesión y bandeja de solo lectura (enviados, detalle y fotos). TanStack Query para el estado del servidor y TanStack Router para las rutas (ADR-0011). Sin service worker. Usa la escala de oficina de los tokens con `data-superficie="oficina"`.
