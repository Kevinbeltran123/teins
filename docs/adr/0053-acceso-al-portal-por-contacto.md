# ADR-0053 · Acceso al portal por contacto, con código por correo

- **Estado:** Aceptada
- **Fecha:** 2026-11-03
- **Impulsores:** QA-4, QA-7, R3, R5, F8
- **Depende de:** ADR-0009 (reemplaza su parte 4), ADR-0028, ADR-0029, ADR-0034

## Contexto

Hoy el portal tiene un acceso por cliente: un identificador aleatorio y una clave que oficina crea en Administración y entrega a mano, con un QR que lleva al identificador (ADR-0009, parte 4). En la práctica:

- **La clave es de la empresa, no de la persona.** Quien entra y descarga queda registrado como «el cliente», no como alguien con nombre. Quitarle el acceso a una persona obliga a regenerar la clave de todos.
- **Hay que entregarla a mano** y por un medio distinto del QR. Se pierde, y pedir otra deja sin acceso al resto.
- **Solo hay informes.** Las cotizaciones (ADR-0029) le llegan al contacto por correo, pero no quedan en ningún lugar donde consultarlas después.
- Solo un administrador con segundo factor puede crear el acceso, aunque quien envía los documentos a ese cliente es cualquier persona de oficina.

El dueño de TEINS pidió un portal más intuitivo, que sirva de verdad, y que tenga las cotizaciones. Los contactos del cliente ya existen, con correo y con lo que reciben (informes, cotizaciones), desde ADR-0028 y ADR-0029.

Restricciones: el portal es la única superficie abierta a internet (QA-4, QA-7); sin costo fijo nuevo (R3); los correos salen por Resend (ADR-0028); Railway bloquea SMTP. Ninguno de los portales revisados (Jobber, Stripe, ServiceTitan, Housecall Pro) comparte una clave por empresa: todos identifican a la persona.

## Opciones

| Opción | Descripción |
|---|---|
| A. QR y clave por empresa | Lo de hoy |
| B. Enlace mágico por contacto | El contacto escribe su correo y recibe un enlace que inicia la sesión |
| C. Código por correo por contacto | El contacto escribe su correo y recibe un código de 6 dígitos que escribe en el portal |
| D. Enlaces firmados por documento | Cada correo lleva un enlace con un secreto que abre ese documento, sin sesión |
| E. Better Auth con `emailOTP` en una segunda instancia | Como C, pero con la biblioteca de identidad de oficina y campo |

## Evaluación

| Criterio (ligado a un impulsor) | A | B | C | D | E |
|---|---|---|---|---|---|
| Rastro por persona y quitar a una sin afectar a otras (QA-4, ADR-0008) | ○ | ● | ● | ◐ | ● |
| Nada que entregar a mano (F8) | ○ | ● | ● | ● | ● |
| Funciona detrás de filtros de correo corporativo (Defender Safe Links, Mimecast, Proofpoint) | ● | ○ | ● | ◐ | ● |
| Un secreto reenviado o filtrado no abre nada por sí solo (QA-4) | ◐ | ○ | ● | ○ | ● |
| Límite de intentos y aislamiento por fila que ya existen (QA-7, ADR-0009) | ● | ● | ● | ◐ | ○ |
| Sin costo fijo (R3) | ● | ● | ● | ● | ● |

B pierde por los filtros: abren el enlace antes que la persona y lo gastan (WorkOS dejó el enlace por el código por esa razón). D deja secretos en correos que se reenvían y no vencen (W3C, *capability URLs*). E obliga a una segunda población de usuarios en Better Auth, que no la soporta oficialmente, y deja fuera el rol de base y la seguridad por fila que el portal ya tiene.

## Decisión

**Un acceso por contacto, y se entra con un código de 6 dígitos que llega al correo del contacto.** Se construye en el módulo `portal` que ya existe, con su sesión, su rol de base y su seguridad por fila.

1. **El acceso es del contacto.** Cualquier persona de oficina activa o quita «Acceso al portal» en un contacto que tenga correo. Un correo tiene un solo acceso por organización: activar el segundo responde `conflicto`.
2. **Ve lo que ya recibe:** Informes si tiene «Recibe informes», Cotizaciones si tiene «Recibe cotizaciones». Si cambia lo que recibe, cambia lo que ve. Si cambia su correo, se quita el contacto o se archiva el cliente, sus sesiones se cierran.
3. **El código:**
   - 6 dígitos con `crypto.randomInt`, vence a los 10 minutos y sirve una sola vez;
   - un solo código vigente por acceso (pedir otro reemplaza el anterior);
   - no se guarda: se deriva con HMAC-SHA-256 del id aleatorio del pedido y un secreto del servidor (derivado de `AUTH_SECRETO` con HKDF y una etiqueta propia). La base solo tiene el id del pedido, así que un respaldo filtrado no permite calcularlo; el worker que envía el correo llega al mismo código sin que pase por la cola, y un reintento envía el mismo;
   - 5 intentos por código; pedir códigos tiene límite por correo (5 por hora) y por origen;
   - está atado al navegador que lo pidió: una cookie `HttpOnly`, `SameSite=Strict`, de 10 minutos, cuya huella se guarda con el código;
   - pedirlo responde siempre igual, exista o no el acceso, y el correo sale en segundo plano (Graphile Worker): ni la respuesta ni su tiempo dicen si el correo tiene acceso;
   - el portal solo puede encolar ese correo, con una función propia de la cola (`cola.encolar_correo_del_portal`), no la general;
   - un código incorrecto, vencido, ya usado o agotado responde lo mismo: «El código no es correcto o venció. Pida uno nuevo.».
4. **Los enlaces de los correos no llevan secretos.** Apuntan a `/informes/<id>` o `/cotizaciones/<id>`; sin sesión, el portal pide el correo y el código y llega ahí.
5. **Cotizaciones en el portal: ver y descargar** la versión vigente de cada una, con la misma seguridad por fila de los informes (cliente de la sesión, PDF listo, sin retirar).
6. **Sesión del portal:** sigue en 30 minutos desde el último uso (ADR-0009, parte 4), y queda atada al contacto.
7. **Registro (ADR-0008):** activar y quitar el acceso, cada ingreso y cada descarga, con el contacto.
8. **Se retiran el QR y la clave por cliente**, sin migrar nada: producción no tiene datos reales (ADR-0021).
9. **Por ahora solo correo.** Un contacto sin correo no puede tener acceso; la pantalla lo dice.

## Por qué gana a cada alternativa

- **Frente a A:** identifica a la persona, no hay nada que entregar y quitar a una no afecta a las demás.
- **Frente a B:** un filtro de correo que abre el mensaje no gasta nada: el código hay que escribirlo, y además está atado al navegador que lo pidió.
- **Frente a D:** los correos se pueden reenviar sin riesgo, porque el enlace solo lleva al documento y pide entrar.
- **Frente a E:** usa la sesión, el rol de base y la seguridad por fila que el portal ya tiene, sin una segunda población de usuarios en Better Auth.

## Consecuencias

- **A favor:** rastro por persona; oficina da y quita accesos sin administración; el cliente encuentra sus cotizaciones; nada de claves que se pierden.
- **En contra:** quien controla el buzón entra. Se mitiga con códigos cortos y de un solo uso, el registro por persona y la revisión de contactos.
- **En contra:** el correo puede llegar tarde o a correo no deseado. Se mitiga con SPF, DKIM y DMARC del dominio de Resend y con «Reenviar código» a los 60 s.
- **En contra:** entrar cuesta un correo cada vez que la sesión vence (30 minutos). Se acepta: los clientes entran pocas veces al año.
- **Buzones compartidos** (compras@): sirven para ver. Si algún día se aceptan cotizaciones en línea, aceptar exigirá identificar a la persona.
- **Rotar `AUTH_SECRETO`** invalida los códigos vivos (10 minutos como máximo).

## Cuándo revisarla

- WhatsApp deja de estar simulado: el código por WhatsApp como respaldo (revisar la tarifa de plantillas de autenticación).
- TEINS define cómo aceptar una cotización o pedir cambios en línea.
- Un cliente exige entrar con su propio proveedor de identidad.
- Aparecen accesos sin uso por mucho tiempo: desactivarlos solos.
