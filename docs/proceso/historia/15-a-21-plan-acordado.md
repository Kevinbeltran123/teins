[Plan de entrega](../plan-de-entrega.md) · Anterior: [Iteración 14 · Interfaz con la dirección Consola](14-interfaz-consola.md) · Siguiente: [Iteración 15 · Avisos push e instalación guiada](15-avisos-push.md)

# Iteraciones 15 a 21 · Plan acordado el 2026-09-26

**Por qué estas:** Kevin pidió funciones útiles en la vida real de TEINS; se investigaron aplicaciones de campo comparables (SafetyCulture, CompanyCam, magicplan, Bluebeam, software de mantenimiento de UPS) y se descartaron las que la plataforma no permite (medir con la cámara o LiDAR y medidores por Bluetooth: Safari no tiene WebXR ni Web Bluetooth) o que el teléfono ya resuelve (dictado por voz, que el teclado ya hace). Kevin eligió siete.

**Orden:** campo primero, porque Kevin quiere la PWA terminada. La 15 cierra lo último que le faltaba a la PWA (la instalación guiada) y monta los avisos; la 17 va antes de la 21 porque las líneas que llegan vinculadas vuelven casi automática la cotización; la 20 va antes de la 21 para enviar las cotizaciones por los mismos canales. Cada iteración empieza con maquetas en el lienzo, luego el ADR, el código, las pruebas de extremo a extremo y el despliegue en el entorno de pruebas. La prueba en iPhone de las iteraciones 9 a 14 sigue pendiente y es la que más riesgo reduce: cada iteración de campo se suma a ella.

| # | Qué | Versión de la app | Qué hace falta de fuera |
|---|---|---|---|
| 15 | Avisos push (Web Push con VAPID y el formato declarativo de Safari 18.4) e instalación guiada | Sin cambio de protocolo | Nada |
| 16 | Firma del cliente: tipo de campo `firma`, guardado como documento de boceto de solo trazos | 7 | TEINS confirma el texto de la constancia |
| 17 | Catálogo en la bajada; sugerencias, frecuentes y recientes al escribir; la línea lleva el ítem | 8 | Catálogo real de TEINS (P28); con el de prueba se construye |
| 18 | Mantener para enderezar (línea, polilínea, rectángulo, elipse), ajuste de ángulos y extremos, mover, rotar, duplicar, cota y flecha; documento de boceto versión 2 | 9 | Nada |
| 19 | Símbolos como datos (trazado SVG, nombre, categoría, código de catálogo opcional), publicados como los formatos y copiados dentro del boceto que los usa | 10 | Lista de símbolos de TEINS |
| 20 | Contactos del cliente; el informe publicado sale por correo (Resend, por HTTPS) y WhatsApp (Cloud API de Meta, plantilla de utilidad con el PDF) con estado por envío | Sin cambio | Cuenta de Resend y número de prueba de Meta para el entorno de pruebas; dominio de TEINS y cuenta de WhatsApp Business a su nombre para producción (R10) |
| 21 | Módulo de cotizaciones: lista de precios con historia, cotización desde las cantidades revisadas, IVA o AIU por cotización, versiones inmutables, PDF y envío | Sin cambio | Precios, plantilla (P29), tratamiento tributario y numeración |

**Decisiones de Kevin (2026-09-26):**

- **El informe se envía con el PDF adjunto** y el enlace al portal, no solo con el enlace: es lo que el cliente espera (P17). Consecuencia aceptada: "Retirar del portal" no recupera las copias ya enviadas, y el diálogo de retiro lo dirá.
- **La firma del cliente certifica la visita, no el contenido técnico:** oficina puede corregir medidas sin invalidarla, y firmar no bloquea el levantamiento.
- **El orden de la tabla.**

**Hallazgos que cambian el diseño:**

- **Railway bloquea SMTP en los planes Hobby y Free:** el correo sale por la API HTTPS del proveedor, no por SMTP.
- **El portal oculta una versión hasta que su PDF está listo:** el envío al cliente se encola cuando el PDF queda listo, no al publicar.
- **Los clientes no tienen contactos en ninguna parte** (solo `nombre`): la iteración 20 empieza por ellos. Para la SIC, los datos de contacto corporativos quedan fuera de la Ley 1581; Meta igual exige la autorización para WhatsApp, que se registra con quién y cuándo.
- **El AIU no aplica a la instalación ni al mantenimiento de redes eléctricas** según la doctrina de la DIAN: la cotización admite IVA sobre el subtotal o AIU con IVA sobre la utilidad, y el contador de TEINS decide en cada caso.
- **En iPhone, la app instalada no comparte datos con Safari** y los avisos solo llegan a la app instalada: la instalación va antes de iniciar sesión.
- **La biblioteca `web-push` es MPL-2.0,** que la verificación de licencias ya admite.

## Al cerrarlas

**Plan acordado con Kevin el 2026-09-26: iteraciones 15 a 21** (sección "Iteraciones 15 a 21"). Kevin eligió siete funciones después de una investigación de producto (envío del informe por WhatsApp y correo, firma del cliente, símbolos y enderezado en los bocetos, ítems frecuentes en cantidades, avisos push y cotizaciones) y pidió terminar primero la PWA de campo. **Iteración 15 terminada y desplegada en el entorno de pruebas el 2026-09-26** (avisos push, ADR-0023, e instalación guiada; maquetas en el lienzo, página "v0.4 · Avisos e instalación"). Falta la prueba en iPhone (fase 15 de la guía, junto con las fases 9 a 14). **Iteración 16 (firma del cliente, ADR-0024) terminada y desplegada en el entorno de pruebas el 2026-09-26**, con el formato de prueba v7; falta la prueba en iPhone (fase 16 de la guía). **Iteración 17 (catálogo en el teléfono, ADR-0025) terminada y desplegada en el entorno de pruebas el 2026-09-26**; falta la prueba en iPhone (fase 17 de la guía). **Iteración 18 (croquis a pantalla completa con hojas, ADR-0026) terminada y desplegada en el entorno de pruebas el 2026-09-26** (maquetas aprobadas en la página "v0.8 · Croquis a pantalla completa"); falta la prueba en iPhone (fase 18 de la guía). **Iteración 19 (símbolos en el croquis, ADR-0027) terminada y desplegada en el entorno de pruebas el 2026-09-26**, con la biblioteca de prueba publicada; falta la prueba en iPhone (fase 19 de la guía) y la lista de símbolos de TEINS. **Iteración 20 (contactos del cliente e informe por correo y WhatsApp, ADR-0028) construida el 2026-09-27** con maquetas aprobadas (página "v1.0 · Informe por correo y WhatsApp"), y desplegada en el entorno de pruebas: el correo sale de verdad por Resend (dominio de pruebas `deportur.tech`) y WhatsApp sigue simulado hasta tener el número de prueba de Meta con la plantilla `informe_publicado` aprobada (sección "Iteración 20", "Fuera"). WhatsApp queda en espera: el 2026-09-27 Kevin avisó un problema con su cuenta de Meta. **Iteración 21 (cotizaciones desde las cantidades, ADR-0029) construida el 2026-09-27** con maquetas aprobadas (página "v1.1 · Cotizaciones") y precios de prueba: con ella se cierra el plan de las iteraciones 15 a 21. Siguiente: la prueba en iPhone de las fases 9 a 19 (antes, revisar por qué `bajada.spec` falla contra el entorno), la cuenta de Meta para WhatsApp, y lo que TEINS entregue: lista de precios, plantilla de la cotización (P29), tratamiento tributario, numeración y lista de símbolos. Pendiente menor: las fallas intermitentes de `repeticiones.spec` (WebKit, local) y `bajada.spec` (entorno). El JavaScript inicial de campo está en 119,9 de 120 KB: cualquier cosa nueva de campo debe cargarse aparte.
