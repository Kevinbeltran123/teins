# ADR-0023 · Avisos push con Web Push estándar, un trabajo por suscripción y texto sin datos del cliente

- **Estado:** Aceptada
- **Fecha:** 2026-09-26
- **Impulsores:** QA-5, QA-19, R3, R4, R5, R9
- **Depende de:** ADR-0002, ADR-0009, ADR-0012, ADR-0014

## Contexto

ADR-0014 (parte 2) dejó el aviso push para después del piloto: el técnico se enteraba de una visita nueva al sincronizar y oficina, de un levantamiento nuevo, al consultar su bandeja. Kevin lo pidió dentro del plan de las iteraciones 15 a 21 (2026-09-26): el técnico debe saber de una visita asignada, cambiada o cancelada, de un comentario o de una revisión sin abrir la app, y oficina, de un levantamiento nuevo aunque la pestaña esté cerrada.

Hechos que condicionan la decisión:

- **iPhone:** desde iOS 16.4 una web instalada en la pantalla de inicio recibe avisos; una pestaña de Safari no. Desde Safari 18.4 existe el formato declarativo (`"web_push": 8030`), que muestra el aviso sin ejecutar código. La app instalada tampoco comparte almacenamiento con Safari.
- **Android y escritorio:** Web Push estándar con service worker.
- **`campo`** tiene un service worker generado por `vite-plugin-pwa`; **`oficina`** no tiene ninguno (ADR-0002).
- **Los momentos ya existen:** cada caso de uso escribe su auditoría y su cambio para la bajada en la misma transacción, y la cola de trabajos es el outbox (ADR-0012).
- **El aviso se ve con el teléfono bloqueado,** a veces un teléfono compartido (R5).
- **Una persona desactivada pierde el acceso de inmediato** (QA-5): también sus avisos.

## Parte 1 · Canal

| Opción | Descripción |
|---|---|
| **A. Web Push estándar con VAPID, enviado por el servidor** | Claves propias; la biblioteca `web-push` cifra y firma; el navegador entrega por su servicio de avisos |
| B. Servicio de terceros (OneSignal, SDK de Firebase) | El proveedor guarda las suscripciones y envía |
| C. Seguir sin push | Consulta periódica en oficina y avisos al sincronizar en campo |
| D. SMS o WhatsApp al técnico | Mensaje al número del técnico |

| Criterio | A | B | C | D |
|---|---|---|---|---|
| iPhone instalado y Android con el mismo código (R4, R9) | ● | ● | ○ | ● |
| Sin costo fijo ni por aviso (R3, QA-19) | ● | ◐ | ● | ○ |
| Ningún tercero recibe datos de TEINS (R5) | ● | ○ | ● | ○ |
| Peso en el JavaScript de campo (ADR-0011) | ● | ○ | ● | ● |
| Se revoca con la persona (QA-5) | ● | ◐ | ● | ○ |

**Decisión: A.** `web-push` (MPL-2.0, copyleft débil por archivo, ya admitida por la verificación de licencias) solo corre en el servidor.

- **Frente a B:** agrega un SDK al teléfono y un tercero con la lista de personas de TEINS, para resolver lo mismo que el estándar.
- **Frente a C:** el técnico no abre la app para ver si le asignaron algo; se entera tarde.
- **Frente a D:** cuesta por mensaje, exige los números de los técnicos y no se retira al desactivar a la persona.

## Parte 2 · Entrega

1. **Suscripción por persona y navegador:** `avisos.suscripciones` guarda el `endpoint` (único), sus claves, la persona, la superficie (`campo` u `oficina`, según el rol, nunca según lo que diga el cliente) y el origen desde el que se suscribió. Si otra persona inicia sesión en un teléfono compartido, el mismo `endpoint` pasa a ella.
2. **Un trabajo por suscripción, encolado en la transacción del hecho** (`avisos.enviar`, ADR-0012): si el hecho se revierte, no hay aviso; si un teléfono falla, su reintento no repite el aviso en los demás.
3. **El texto se arma al encolar y nunca lleva datos del cliente:** "Visita nueva, para el jue 3 oct", "Oficina revisó tu levantamiento del mié 2 oct", "Carlos Rojas envió un levantamiento". El nombre del técnico no es dato del cliente; el cliente, el sitio y la dirección se ven al abrir la app.
4. **Formato declarativo** (`web_push: 8030`, con `title`, `body`, `navigate`, `tag`, `lang`): Safari 18.4 o posterior lo muestra solo; en los demás navegadores, el service worker lee los mismos campos. `navigate` es el inicio de la superficie (el origen guardado), que ya muestra lo nuevo primero. `tag` agrupa por entidad: un segundo aviso de la misma visita reemplaza al primero.
5. **Fallos:** 404 o 410 del servicio de avisos borran la suscripción; 429, 5xx o un error de red reintentan (hasta 5 veces, con la espera de la cola); cualquier otro 4xx se registra y no se reintenta.
6. **Ciclo de vida (QA-5):** desactivar o restablecer a una persona borra sus suscripciones en el servidor (desactivar, en la misma transacción); cerrar sesión quita la de ese navegador. La orden de borrado del teléfono no necesita hacer nada más: cuando llega, desactivar ya las borró.
7. **Solo servicios de avisos conocidos:** el servidor acepta un `endpoint` https de FCM, Apple, Mozilla o Microsoft. Un `endpoint` cualquiera convertiría al worker en un cliente HTTP al servicio de quien lo registre.
8. **Claves VAPID por variables de entorno** (`AVISOS_VAPID_PUBLICA`, `AVISOS_VAPID_PRIVADA`, `AVISOS_CONTACTO`), generadas con `pnpm --filter @teins/servidor generar-claves-avisos`. Sin claves, los avisos están apagados: la API lo dice y las superficies no ofrecen activarlos.
9. **Oficina tiene un service worker solo de avisos:** sin manejador `fetch` y sin caché. Oficina sigue siendo una app en línea; el alcance sin conexión de ADR-0002 no cambia.

**Qué se avisa:**

| A quién | Cuándo |
|---|---|
| Técnico | Visita asignada, reprogramada, cancelada o pasada a otra persona; comentario de oficina; levantamiento revisado |
| Oficina (quien activa los avisos) | Levantamiento nuevo |

No se avisa lo que no pide una acción (por ejemplo, que alguien tomó la revisión).

## Parte 3 · Permiso e instalación

- **El permiso se pide solo al tocar "Activar avisos":** iPhone lo exige, y los navegadores castigan a los sitios que lo piden al cargar.
- **En un teléfono sin la app instalada, la instalación va antes de iniciar sesión:** en iPhone lo capturado en Safari no pasa a la app instalada, y ahí es el único lugar donde llegan los avisos. Se puede seguir en el navegador (tabletas, pruebas).
- **Quien sigue sin instalarla** ve en el inicio el recordatorio de instalar, que ahora menciona los avisos y abre la misma guía; la tarjeta de avisos no aparece, para no decir lo mismo dos veces.

## Consecuencias

- **A favor:** sin costo ni terceros con datos; el mismo mecanismo en iPhone, Android y escritorio; los avisos nacen del mismo hecho que la auditoría, así que no hay aviso de algo que no pasó; revocar a una persona apaga sus avisos.
- **En contra:** en iPhone solo con la app instalada (se mitiga con la instalación guiada); el servicio de avisos de cada navegador puede demorar o descartar un aviso (el dato sigue llegando por la bajada, que es la fuente de verdad); una suscripción de alguien que cerró sesión sin conexión puede recibir un aviso genérico hasta que otra persona use ese teléfono o el servicio la dé por muerta.

## Cuándo revisarla

Una persona pide apagar un tipo de aviso (preferencias por tipo); los técnicos necesitan abrir la visita exacta desde el aviso; aparece un canal que exija entrega garantizada (el push no la da).
