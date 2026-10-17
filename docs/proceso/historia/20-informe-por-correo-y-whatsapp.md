[Plan de entrega](../plan-de-entrega.md) · Anterior: [Iteración 19 · Símbolos en el croquis](19-simbolos-en-el-croquis.md) · Siguiente: [Iteración 21 · Cotizaciones desde las cantidades](21-cotizaciones.md)

# Iteración 20 · Contactos del cliente e informe por correo y WhatsApp

**Estado en el mapa al 2026-10-16:** Terminada y desplegada en el entorno de pruebas; el correo sale de verdad por Resend, WhatsApp sigue simulado hasta tener el número de prueba de Meta

**Estado:** construida el 2026-09-27 con los envíos simulados y verificada en local (ver "Terminado cuando"). Maquetas aprobadas por Kevin en el lienzo (página "v1.0 · Informe por correo y WhatsApp", "Sí, aprobadas"). Kevin eligió construir sin las cuentas externas: el correo y el WhatsApp reales esperan la clave de Resend y el número de prueba de Meta.

**Para qué:** que el informe publicado le llegue al cliente por correo y WhatsApp con el PDF adjunto (P17), y que oficina vea qué llegó y qué no.

## Alcance

- **Contactos del cliente (ADR-0028, parte 5):** el cliente tiene su pantalla (Clientes → el cliente) con sus contactos y sus sitios. Cada contacto: nombre, cargo, correo, celular y por qué canal recibe el informe. WhatsApp exige la autorización, que queda con quién de oficina la confirmó y cuándo; cambiar el celular la borra. La lista de clientes dice cuántos reciben el informe y avisa "Nadie".
- **Publicar con destinatarios:** el diálogo de publicar marca por omisión a todos los que reciben el informe; se puede desmarcar. Sin contactos, avisa que el informe solo quedará en el portal y lleva a agregarlos.
- **Envíos (módulo `envios`, ADR-0028):** una fila por contacto y canal, "En cola" al publicar; salen cuando el PDF queda listo, en la misma transacción que lo marca. Correo por Resend (HTTPS, idempotente, con el PDF adjunto y el enlace al portal); WhatsApp por la Cloud API de Meta con la plantilla `informe_publicado` y el PDF en el encabezado.
- **Estado de cada envío:** En cola, Enviado, Entregado y No llegó, con el motivo. Los eventos firmados de Resend (Svix) y de Meta (`X-Hub-Signature-256`) llegan a `/api/envios/eventos/correo` y `/api/envios/eventos/whatsapp`. Un rebote marca el correo del contacto. Lo que no llega avisa por push a quien lo pidió y se marca en la bandeja de Informes ("Envío sin entregar").
- **Volver a enviar y enviar a otro contacto** desde el panel "Envíos de la versión N"; el intento anterior se conserva. Una versión cuyo PDF no se pudo generar no se envía: se publica una nueva (revisión de seguridad 4c).
- **Retirar del portal** dice a quién ya le llegó una copia, porque no se recupera.
- **Proveedores simulados** (`ENVIOS_SIMULADOS=true`) en desarrollo, en el extremo a extremo y en el entorno de pruebas: aceptan todo menos las direcciones con "rebota" (y los celulares que terminan en 000). El servidor no arranca con simulados en producción.

## Fuera de la iteración 20

| Qué | Dónde se resuelve |
|---|---|
| Correo real en el entorno de pruebas: cuenta de Resend, dominio verificado, `RESEND_CLAVE_API`, `RESEND_SECRETO_EVENTOS`, `CORREO_REMITENTE`, `CORREO_RESPONDER_A` y la dirección de eventos registrada | Cuando Kevin entregue la cuenta: variables en el worker (clave) y en `oficina` (secreto de eventos), y `ENVIOS_SIMULADOS` fuera |
| WhatsApp real: número de prueba de Meta, plantilla `informe_publicado` aprobada, `WHATSAPP_TOKEN`, `WHATSAPP_NUMERO_ID`, `WHATSAPP_SECRETO_APP`, `WHATSAPP_TOKEN_VERIFICACION` | Igual que el correo; producción con la cuenta de WhatsApp Business de TEINS (R10) |
| Producción: dominio de TEINS y su cuenta de WhatsApp Business | Al transferir producción (ADR-0021) |
| Un envío que se acepta y no se reenvía si el worker cae justo después de que Meta lo aceptó (Meta no tiene llave de idempotencia) | Aceptado: el riesgo es un WhatsApp repetido, no uno perdido |
| `bajada.spec.ts` "permiso local vencido" falla contra el entorno de pruebas incluso sola (2 de 2): al recargar sin conexión, el service worker no sirve la página (`ERR_INTERNET_DISCONNECTED`). En local pasa. La iteración no toca campo; ya había fallado una vez en la iteración 19 | Investigar antes de la prueba en iPhone: si el service worker controla la primera carga en el entorno (precarga terminada antes de quedar sin señal) |
| La corrida completa contra el entorno choca con el límite de 5 inicios de sesión por minuto (QA-7) y falla en cualquier archivo | Correr contra el entorno de a un archivo con un minuto entre ellos, o subir el límite solo en pruebas con `INICIOS_DE_SESION_POR_MINUTO` |
| `informes.test.ts` ("planos verificados") falló una vez en la corrida completa del servidor y pasó al repetirla: otro archivo verificó el plano antes de publicar | Ya existía la carrera: aislar la cola de verificación por archivo si vuelve a fallar |

## Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Kevin aprueba las maquetas | Hecho el 2026-09-27 |
| 2. Contactos: se crean, cambian y quitan (sin borrar la fila, ADR-0009); WhatsApp exige la autorización y la registra; el técnico no los ve | Hecho: `servidor/pruebas/envios.test.ts` |
| 3. Los envíos esperan el PDF y salen con el adjunto, el asunto, las etiquetas y las variables de la plantilla; lo rechazado queda "No llegó" con su motivo, se marca en la bandeja y se vuelve a enviar | Hecho: `servidor/pruebas/envios.test.ts` |
| 4. Nadie envía a un contacto de otro cliente, por un canal que no recibe, ni una versión retirada | Hecho: `servidor/pruebas/envios.test.ts` |
| 5. Eventos: sin firma válida o viejos se rechazan; entregado, rebote (marca al contacto) y fallo de WhatsApp cambian el estado | Hecho: `servidor/pruebas/envios.test.ts` |
| 6. Extremo a extremo: contactos desde oficina, publicar con destinatarios, "No llegó" con su motivo, "Envío sin entregar" en la bandeja, corregir el correo y volver a enviar | Hecho en Chromium y WebKit (`e2e/pruebas/informe-al-cliente.spec.ts`) |
| 7. Lo anterior sigue igual | Hecho el 2026-09-27: tipos, arquitectura, licencias y auditoría en verde; dominio 95, protocolo 18, oficina 4, campo 80, servidor 127; extremo a extremo 37 y 3 omitidas en Chromium y WebKit; campo sigue en 119,9 de 120 KB (la iteración no toca campo) |
| 8. Desplegada en el entorno de pruebas, el worker antes que la app, con los envíos simulados | Hecho el 2026-09-27: `ENVIOS_SIMULADOS` aplicado con `railway config apply`; el worker en `SUCCESS` antes de subir la app; campo (que aplicó `0024` y `0025`), oficina y portal en `SUCCESS`, salud en 200 y el contrato nuevo publicado. Extremo a extremo contra el entorno en Chromium: `informe-al-cliente.spec` en verde. La corrida completa tuvo 8 fallas por el límite de 5 inicios de sesión por minuto (429 en el inicio de sesión); repetidas de a una, con un minuto entre ellas, pasaron 7. La octava, `bajada.spec` (permiso vencido), falla sola: ver "Fuera" |
| 9. Correo y WhatsApp reales en el entorno de pruebas | Correo hecho el 2026-09-27: clave de solo envío limitada a `deportur.tech` y dirección de eventos creadas con el CLI de Resend (Kevin guardó los secretos en Railway por tubería); `informe-al-cliente.spec` contra el entorno en verde, con los envíos saliendo por Resend y tres eventos firmados aceptados (204). WhatsApp en espera: el 2026-09-27 Kevin avisó un problema con su cuenta de Meta y pidió seguir con la iteración 21; mientras tanto sigue simulado |

## Decisiones tomadas al construirlo

- **Quitar un contacto no borra la fila:** la aplicación no borra en ninguna tabla de negocio (ADR-0009, prueba de plataforma). Se borran su correo, su celular y su autorización, y queda el nombre.
- **La auditoría de contactos enmascara el correo y el celular** (`a•••@cliente.example`, `•••0117`; revisión de seguridad 4d): la auditoría no se borra, así que con los datos completos quitar el contacto no los borraba de verdad (regla 18). El registro sigue mostrando cuál cambió. Los envíos anteriores sí conservan su destino completo, como constancia de a dónde salió cada copia (ADR-0028).
- **Los eventos se aceptan solo con el id del mensaje que dio el proveedor** (o antes de guardarlo): un evento firmado de otro mensaje no cambia un envío.
- **El panel muestra el último intento por contacto y canal:** uno que no llegó y se volvió a enviar ya no pide nada; el historial completo queda en la base.
- **Publicar confirma con el botón de peligro**, como dice `DESIGN.md` para lo que no se deshace (antes usaba el principal).
- **Sin la configuración de un canal, sus envíos quedan "No llegó: … no está configurado en este entorno":** oficina lo ve, nunca se pierde en silencio.
- **Mientras la plantilla de WhatsApp no esté aprobada, Meta rechaza el envío** y queda "No llegó" con su motivo (la maqueta decía "En cola"): así oficina sabe que no salió.
- **La simulación se elige por canal** (`ENVIOS_SIMULADOS`: `true`, `correo` o `whatsapp`): en el entorno de pruebas el correo sale de verdad por Resend con el dominio verificado de Kevin (`deportur.tech`, elegido por él para pruebas; producción irá con el de TEINS) mientras WhatsApp sigue simulado.
- **El extremo a extremo usa las direcciones de prueba de Resend** (`delivered@resend.dev`, `bounced@resend.dev`): con Resend real no dañan la reputación del dominio, y simulado `bounced@resend.dev` también se rechaza, así la misma prueba sirve en local y en el entorno.
- **El panel de envíos se vuelve a leer cada 10 s durante 10 minutos** después de enviar: la entrega o el rebote llegan por evento, no al enviar.
- **En las pruebas del servidor, solo el archivo que trae sus proveedores procesa `envios.enviar`:** la cola es compartida entre archivos, como con los avisos.
