[Plan de entrega](../plan-de-entrega.md) · Anterior: [Iteraciones 15 a 21 · Plan acordado el 2026-09-26](15-a-21-plan-acordado.md) · Siguiente: [Iteración 16 · Firma del cliente](16-firma-del-cliente.md)

# Iteración 15 · Avisos push e instalación guiada

**Estado en el mapa al 2026-10-16:** Terminada y desplegada en el entorno de pruebas; falta la prueba en iPhone

**Estado:** terminada el 2026-09-26, verificada en local y desplegada en el entorno de pruebas (los cuatro servicios; extremo a extremo contra el entorno en Chromium, 13 archivos y 15 pruebas en verde). Falta la prueba en iPhone. Maquetas aprobadas en el lienzo (página "v0.4 · Avisos e instalación").

**Para qué:** que el técnico sepa de una visita nueva, cambiada o cancelada, de un comentario o de una revisión sin abrir la app, y que oficina sepa de un levantamiento nuevo con la pestaña cerrada. En iPhone los avisos exigen la app instalada, así que la instalación guiada (pendiente desde la iteración 14) entra aquí.

## Alcance

- **Módulo `avisos` en el servidor (ADR-0023):** suscripciones por persona y dispositivo; un trabajo por suscripción, encolado en la misma transacción del hecho que avisa; envío con VAPID; la suscripción que el servicio de avisos da por muerta (404 o 410) se borra; desactivar o restablecer a una persona borra las suyas (QA-5).
- **Qué se avisa:** al técnico, visita asignada, reprogramada, cancelada o pasada a otra persona, comentario de oficina y levantamiento revisado; a oficina (quien lo active), levantamiento nuevo. El texto nunca lleva datos del cliente: se ve con el teléfono bloqueado (R5).
- **Campo:** el service worker generado importa un manejador de avisos; tarjeta "Avisos en este teléfono" bajo la siguiente visita; estado de los avisos en el diagnóstico; al cerrar sesión o borrar por revocación se quita la suscripción.
- **Instalación guiada:** en un teléfono sin la app instalada, antes de iniciar sesión, los pasos de iPhone o el botón de Android; "Seguir en Safari" o "Seguir en el navegador" deja continuar.
- **Oficina:** service worker solo de avisos (sin caché, sigue siendo una app en línea) y la sección "Avisos en este navegador" en Mi cuenta.

## Fuera de la iteración 15

| Qué | Dónde se resuelve |
|---|---|
| Avisos de envíos al cliente que fallan | Iteración 20 |
| Abrir el levantamiento o la visita exacta al tocar el aviso | Se abre el inicio de cada superficie, que ya muestra lo nuevo primero; se revisa si la prueba con técnicos lo pide |
| Preferencias por tipo de aviso | Cuando alguien pida apagar uno solo; hoy son pocos y todos piden una acción |
| Quitar la suscripción del navegador al ejecutar la orden de borrado | No hace falta: desactivar ya borró las suscripciones en el servidor, así que no llega ningún aviso |

## Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Kevin aprueba las maquetas en el lienzo antes de programar | Hecho el 2026-09-26 ("i like the hierarchy"), con un cambio: la app se llama "TEINS" en los avisos y bajo el ícono |
| 2. Cada hecho avisa a quien corresponde, en la transacción del hecho, y un hecho revertido no avisa | Hecho: `servidor/pruebas/avisos.test.ts` (visita asignada, reprogramada, cancelada y reasignada; comentario, revisado y levantamiento nuevo; una reasignación rechazada no avisa; otra organización no recibe nada) |
| 3. Ningún aviso lleva datos del cliente | Hecho: la misma prueba busca el nombre del cliente y del sitio en todo lo enviado |
| 4. Solo se aceptan servicios de avisos conocidos, por https y desde una superficie propia | Hecho: `avisos.test.ts` (dirección interna, host desconocido, http y origen ajeno rechazados) |
| 5. Suscripciones muertas se borran; desactivar o restablecer a una persona apaga sus avisos; 5xx reintenta | Hecho: `avisos.test.ts` (410, 400, 503, desactivar, restablecer, teléfono compartido) |
| 6. Cada envío va cifrado y firmado con VAPID | Hecho: `avisos.test.ts` con las opciones reales del enviador |
| 7. Campo guía la instalación antes de iniciar sesión; el técnico activa los avisos y oficina en su navegador | Hecho: `e2e/pruebas/avisos.spec.ts` (guía en Chromium y WebKit; activar en Chromium con el servicio de avisos simulado en el navegador) |
| 8. Lo anterior sigue igual y el presupuesto de campo se respeta | Hecho: tipos, arquitectura, licencias y auditoría en verde; dominio 73, protocolo 18, oficina 4, campo 51, servidor 108; extremo a extremo 27 y 3 omitidas (Chromium y WebKit); campo 117,0 de 120 KB |
| 9. Desplegada en el entorno de pruebas | Hecho el 2026-09-26: claves VAPID generadas sin mostrarlas y guardadas en el `worker`; `railway config apply` (la pública por referencia en `campo` y `oficina`, el contacto en el `worker`) y el plan sin diferencias después; los cuatro servicios en `SUCCESS`, salud en 200 y los 13 archivos del extremo a extremo contra el entorno en verde |
| 10. Probada en el iPhone: instalar, activar y recibir una visita nueva con el teléfono bloqueado | Pendiente: fase 15 de [`verificacion-manual.md`](../verificacion-manual.md) |

## Decisiones tomadas al construirlo

- **Avisos a personas y envíos al cliente en módulos distintos:** el plan hablaba de un solo módulo de mensajería, pero las suscripciones son de personas con sesión (se revocan con ellas) y los contactos del cliente tendrán otro ciclo (autorización de WhatsApp, rebotes de correo). Lo que comparten, el trabajo encolado en la transacción del hecho, ya lo da la cola (ADR-0012). `envios` llega en la iteración 20.
- **Un trabajo por suscripción, con el texto armado al encolar:** si un teléfono falla, su reintento no repite el aviso en los demás; el trabajo no necesita leer otros módulos.
- **`tag` y `Topic`:** un segundo aviso de la misma visita reemplaza al primero en el teléfono y en el servicio de avisos si todavía no se entregó.
- **El aviso abre el inicio de la superficie, tomado del origen desde el que se suscribió** (la operación recibe ahora la cabecera `Origin`, que el servidor ya valida): sin variables nuevas por superficie.
- **El nombre del técnico se lee antes de la transacción del envío:** leído adentro pedía una segunda conexión mientras la primera esperaba, y la prueba de diez envíos simultáneos agotó el pool.
- **Campo conserva el service worker generado** y le suma el manejador con `importScripts`; pasar a `injectManifest` habría obligado a escribir a mano la caché que hoy da `vite-plugin-pwa`.
- **Sin instalar, el recordatorio del inicio habla de los avisos y abre la misma guía;** la tarjeta de avisos no aparece (en la maqueta era otro estado de la tarjeta: decía lo mismo dos veces).
- **"Seguir en Safari" y "Ahora no" se recuerdan en `localStorage`,** por teléfono, como la propuesta de la llave de acceso: son comodidades, no datos del negocio.
- **En el extremo a extremo el servicio de avisos se simula en el navegador** (permiso y `PushManager`): no hay servicio de avisos en las pruebas ni worker corriendo. La entrega real se prueba en el servidor y en el iPhone.
- **La clave pública del extremo a extremo vive en `playwright.config.ts`:** no es un secreto; la privada no existe ahí.
