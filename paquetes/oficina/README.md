# oficina

Aplicación de oficina: bandeja, revisión, informes, administración.

**Dependencias:** Depende de `dominio`, `protocolo` y `ui`.

**ADR relevantes:** 0002, 0011, 0014

- Corte 1: inicio de sesión y bandeja (enviados, detalle y fotos).
- Corte 3: bandeja por estado ("Esperando revisión", "En revisión", "Revisados") con "Tomar para revisar" sobre el más antiguo; pantalla de revisión con toma y reasignación explícita, corrección por campo con motivo, aviso cuando otra persona guardó antes (QA-25), marcar revisado, comentarios al técnico e historial con la verificación de su cadena. Acciones en `src/revision.ts`, textos en `src/mensajes.ts` (se trata de usted).
- Corte 4: "Informes" en la navegación; desde un levantamiento revisado, "Abrir el informe de esta visita"; composición (levantamientos revisados y su orden, introducción, conclusiones, planos en PDF), publicación con confirmación y versiones con su PDF. Acciones y subida de planos en `src/informes.ts`.
- Iteración 7: "Visitas" y "Clientes" en la navegación, para toda persona de oficina. Visitas en tres pestañas (próximas, anteriores, canceladas) con técnicos y avance según sus levantamientos; programar (cliente, sitio, motivo, fecha y técnicos), reasignar, reprogramar y cancelar con motivo, y abrir el informe cuando ya hay levantamientos revisados. Clientes con sus sitios; crear un cliente con su primer sitio y agregar sitios. Consultas y textos en `src/programacion.ts`.
- Iteración 6: ingreso en dos pasos cuando la persona tiene segundo factor (código de la app autenticadora o de respaldo). "Administración" en la navegación para quien tiene la marca: si le falta el segundo factor, la pantalla guía su activación (QR, clave para escribir a mano, códigos de respaldo y confirmación); con él, pestañas de usuarios (crear con contraseña temporal, restablecer, desactivar, dar o quitar administración), teléfonos de campo (salud y alerta de pendientes de más de un día) y accesos de clientes (crear o regenerar, con clave y QR descargable). Lo que se entrega una sola vez se muestra en el bloque azul hasta "Ya la entregué". En la pantalla del informe, quien administra puede retirar una versión del portal con motivo. Consultas y textos en `src/administracion.ts`; el QR lo genera `qrcode` (MIT) en un fragmento que solo se carga al necesitarlo.

 TanStack Query para el estado del servidor y TanStack Router para las rutas (ADR-0011). Sin service worker. Usa la escala de oficina de los tokens con `data-superficie="oficina"`.
