# ADR-0028 · Envío del informe al cliente por correo y WhatsApp, con contactos del cliente y estado por envío

- **Estado:** Aceptada
- **Fecha:** 2026-09-27
- **Impulsores:** P17, QA-9, QA-17, R3, R5, R10
- **Depende de:** ADR-0009, ADR-0012, ADR-0013, ADR-0023

## Contexto

Hasta la iteración 19 el cliente solo recibía el informe entrando al portal con su QR y su clave (ADR-0009, parte 4), y alguien de TEINS le avisaba por fuera del sistema. Kevin eligió en el plan de las iteraciones 15 a 21 (2026-09-26) que el informe publicado le llegue al cliente por correo y por WhatsApp, **con el PDF adjunto** además del enlace al portal (P17: el PDF es lo que el cliente espera).

Hechos que condicionan la decisión:

- **Los clientes no tenían contactos:** solo `nombre` (regla 18, minimización). Para la SIC, los datos de contacto corporativos quedan fuera de la Ley 1581; Meta igual exige que el destinatario autorice los mensajes de WhatsApp.
- **Railway bloquea SMTP** en los planes Hobby y Free: el correo sale por la API HTTPS de un proveedor.
- **El portal oculta una versión hasta que su PDF está listo** (ADR-0013): el envío no puede salir al publicar, sino cuando el PDF existe.
- **WhatsApp Business solo permite iniciar la conversación con una plantilla aprobada** por Meta (categoría utilidad para un documento transaccional), con el documento en el encabezado.
- **Lo enviado no se recupera:** retirar una versión del portal (regla 10) no borra el correo ni el WhatsApp.
- **Producción es de TEINS (R10):** el dominio del remitente y la cuenta de WhatsApp Business deben estar a su nombre; el entorno de pruebas usa cuentas de prueba de Kevin.

## Parte 1 · Dónde viven los contactos y los envíos

| Opción | Descripción |
|---|---|
| **A. Contactos en `clientes`, envíos en un módulo `envios` nuevo** | `clientes.contactos` con sus canales y la autorización de WhatsApp; `envios.envios`, una fila por destinatario y canal |
| B. Todo en `informes` | Los contactos y los envíos como parte del informe |
| C. Un módulo de mensajería que también envía los avisos push | Un solo módulo para avisos y envíos |

**Decisión: A.**

- **Frente a B:** los contactos son del cliente y servirán a las cotizaciones (iteración 21); en `informes` quedarían donde no se buscan.
- **Frente a C:** las suscripciones de avisos son de personas con sesión y se revocan con ellas (ADR-0023); los contactos tienen otro ciclo (autorización, rebotes). Lo que comparten, el trabajo encolado en la transacción del hecho, ya lo da la cola (ADR-0012).

Dependencias entre módulos (por su interfaz pública): `informes` llama a `envios`; `envios` llama a `clientes` (validar destinatarios, marcar un rebote) y a `avisos` (avisar a quien publicó). Ninguno lee tablas de otro.

## Parte 2 · Proveedores

| Opción | Correo | WhatsApp |
|---|---|---|
| **A. Resend (API HTTPS) y la Cloud API de Meta, llamados con `fetch`** | Plan gratuito de 3.000 al mes, adjuntos, idempotencia, eventos firmados (Svix) | Directo con Meta: sin intermediario que vea el PDF |
| B. SMTP propio o de Google Workspace | Bloqueado por Railway | · |
| C. Un intermediario (Twilio, 360dialog) para WhatsApp | · | Cobra por mensaje encima de Meta y recibe el PDF |
| D. SDK oficiales (`resend`, bibliotecas de Meta) | Más dependencias para dos llamadas HTTP | · |

**Decisión: A**, cada proveedor detrás de un puerto (`ProveedorDeCorreo`, `ProveedorDeWhatsApp`) como el enviador de avisos (ADR-0023). Sin dependencias nuevas.

- **Configuración** por variables de entorno (`RESEND_*`, `CORREO_*`, `WHATSAPP_*`, `.env.example`). Sin la configuración de un canal, sus envíos quedan "No llegó" con el motivo "no está configurado": oficina lo ve, nunca se pierde en silencio.
- **Proveedores simulados** (`ENVIOS_SIMULADOS=true`) para desarrollo, pruebas de extremo a extremo y el entorno de pruebas mientras no haya cuentas: aceptan todo menos las direcciones que contienen `rebota`, que rechazan. El servidor no arranca con simulados en producción real.

## Parte 3 · Cuándo y cómo sale

1. **Al publicar, oficina elige los destinatarios** entre los contactos del cliente que reciben el informe (todos marcados por omisión). Se crea una fila por contacto y canal, "En cola", en la transacción de la publicación.
2. **Cuando el PDF queda listo**, el worker encola un trabajo `envios.enviar` por fila, en la misma transacción que marca el PDF listo (ADR-0012). Si el PDF falla, los envíos siguen "En cola" y el panel lo explica.
3. **Después de publicar**, "Volver a enviar" (una fila que no llegó) y "Enviar a otro contacto" crean filas nuevas; con el PDF listo se encolan de inmediato. La fila anterior se conserva: el historial muestra cada intento.
4. **Lo que sale:**
   - **Correo:** asunto "Informe de la visita del {fecha} · {sitio}" (con la versión desde la 2), el PDF adjunto, el enlace al portal, `Responder a` el correo de oficina de TEINS y la etiqueta con la organización y el envío. Llave de idempotencia = id del envío. Si el PDF pesa más de 30 MB, sale sin adjunto y el texto lo dice (Resend admite 40 MB después de codificar).
   - **WhatsApp:** plantilla de utilidad `informe_publicado` (español) con el PDF subido a Meta en el encabezado, cuatro variables (nombre, fecha, sitio, versión) y el botón fijo "Ver en el portal". `biz_opaque_callback_data` lleva la organización y el envío.
5. **Los mensajes no llevan más datos del cliente que los del propio informe,** y solo al destinatario que el cliente registró.

## Parte 4 · Estado de cada envío

| Estado | Cuándo |
|---|---|
| En cola | Esperando el PDF, la cola o un reintento |
| Enviado | El proveedor lo aceptó |
| Entregado | El proveedor confirmó que llegó (correo: `email.delivered`; WhatsApp: `delivered` o `read`) |
| No llegó | Rebote (`email.bounced`, `email.failed`), `failed` de Meta, un rechazo definitivo al enviar (4xx) o los reintentos agotados |

- **Eventos de los proveedores en `/api/envios/eventos/correo` y `/api/envios/eventos/whatsapp`**, rutas públicas que verifican la firma (Svix con `RESEND_WEBHOOK_SECRETO`; `X-Hub-Signature-256` con `WHATSAPP_SECRETO_APP`) sobre el cuerpo crudo y rechazan lo demás. El estado solo avanza (no vuelve de "Entregado" a "Enviado"); un rebote después de "Entregado" sí pasa a "No llegó".
- **Un rebote de correo marca al contacto** ("El correo rebotó el …") hasta que oficina cambia la dirección.
- **Un envío que no llegó avisa a quien publicó** (aviso push de oficina, sin datos del cliente: "Un envío del informe no llegó") y la bandeja de Informes lo muestra hasta que se vuelve a enviar.
- **429, 5xx o error de red reintentan** (5 intentos); cualquier otro 4xx es definitivo.

## Parte 5 · Contactos y autorización de WhatsApp

- **Contacto:** nombre, cargo opcional, correo, celular (E.164), y por qué canal recibe el informe. Recibir por correo exige correo; por WhatsApp, celular y la autorización.
- **La autorización queda registrada con quién y cuándo** (la persona de oficina que la confirmó y la fecha). Cambiar el celular la borra: hay que volver a confirmarla.
- **Quitar un contacto borra sus datos de contacto** (regla 18) y deja solo el nombre, sin borrar la fila: la aplicación no borra en ninguna tabla de negocio (ADR-0009). Sus envíos anteriores conservan el nombre y el destino copiados, como constancia de a dónde salió cada copia. La auditoría registra crear, editar y quitar.

## Consecuencias

- **Positivas:** el informe llega por donde el cliente lo espera, con el PDF; oficina ve qué llegó y qué no, junto a lo que lo causó; nada de esto toca `campo` (su presupuesto de JavaScript no cambia).
- **Negativas:** dos proveedores externos reciben el PDF (Resend y Meta); se acepta porque es el propósito del envío y lo decidió Kevin. Lo enviado no se recupera: el diálogo de retiro lo dice. La plantilla de WhatsApp depende de la aprobación de Meta: mientras tanto, Meta rechaza el envío y queda "No llegó" con su motivo.
- **Pendiente para producción (R10):** dominio verificado de TEINS en Resend, cuenta de WhatsApp Business y número a nombre de TEINS, la plantilla aprobada y las direcciones de los eventos registradas en cada proveedor (`docs/proceso/produccion.md`).
