# oficina

Aplicación de oficina: bandeja, revisión, informes, administración.

**Dependencias:** Depende de `dominio`, `protocolo` y `ui`.

**ADR relevantes:** 0002, 0011, 0014

- Corte 1: inicio de sesión y bandeja (enviados, detalle y fotos).
- Corte 3: bandeja por estado ("Esperando revisión", "En revisión", "Revisados") con "Tomar para revisar" sobre el más antiguo; pantalla de revisión con toma y reasignación explícita, corrección por campo con motivo, aviso cuando otra persona guardó antes (QA-25), marcar revisado, comentarios al técnico e historial con la verificación de su cadena. Acciones en `src/revision.ts`, textos en `src/mensajes.ts` (se trata de usted).

 TanStack Query para el estado del servidor y TanStack Router para las rutas (ADR-0011). Sin service worker. Usa la escala de oficina de los tokens con `data-superficie="oficina"`.
