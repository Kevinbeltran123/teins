[Plan de entrega](../plan-de-entrega.md) · Anterior: [Corte 3 · Revisión](03-revision.md) · Siguiente: [Corte 5 · Portal del cliente](05-portal-del-cliente.md)

# Corte 4 · Informe

**Estado en el mapa al 2026-10-16:** Terminado y desplegado en el entorno de pruebas, con supuestos de P22, P23 y P26

**Estado:** construido y desplegado en el entorno de pruebas el 2026-09-25, con supuestos (Kevin pidió avanzar sin esperar a TEINS). Confirmado por Kevin: lo que recibe el cliente es un PDF.

**Para qué:** que oficina componga el informe de una visita con sus levantamientos revisados, lo publique como una versión que nunca cambia (QA-9) y que el PDF se genere en segundo plano y quede guardado tal como se entregó (QA-17, ADR-0013).

## Supuestos mientras TEINS responde

| Pregunta | Supuesto | Si la respuesta es distinta |
|---|---|---|
| P26: ¿informe por visita o varias? | Uno por visita, con sus levantamientos revisados (regla 9) | La regla pasa a "mismo cliente"; el modelo no cambia |
| P23: secciones, logo, firmas, datos legales | Portada (organización, cliente, sitio, visita, versión), introducción, un capítulo por levantamiento con sus datos y fotos, conclusiones y planos anexos. Logo, firma y datos legales como marcadores `[LOGO]`, `[FIRMA]`, `[DATOS LEGALES]` | Cambia la plantilla HTML, no el modelo |
| P22: informes de ejemplo | Plantilla propia con la dirección de `DESIGN.md` | Se ajusta la plantilla |
| Formato de los planos | PDF, anexado como páginas del mismo documento (ADR-0013) | Imágenes: se incrustan como una página cada una; DWG: TEINS exporta a PDF |

## Alcance

**Dominio:** informe (visita, levantamientos incluidos en orden, introducción, conclusiones, planos en orden, versión optimista); solo incluye levantamientos revisados de la misma visita (regla 9); publicar crea la versión n+1 con una copia congelada (regla 10).

**Protocolo:** listar informes, abrir el informe de una visita (lo crea si no existe), guardar el borrador, publicar y descargar el PDF de una versión. Los planos suben como PDF por el mismo camino que las fotos (ADR-0007), solo desde oficina.

**Servidor:** módulo `informes`. La versión publicada guarda la copia congelada; la aplicación no puede modificarla (solo puede escribir las columnas del PDF). Publicar encola `informes.generarPdf` en la misma transacción (ADR-0012), en la cola `pdf` de a uno. El trabajo arma el HTML desde la copia congelada (fotos incrustadas, fuente incrustada), lo imprime con Chromium, anexa los planos con pdf-lib, guarda el PDF por su huella y lo registra en la versión. Nunca se regenera un PDF listo. Publicación en la cadena de auditoría del informe.

**Oficina:** lista de informes; desde un levantamiento revisado con visita, "Abrir el informe de esta visita"; composición (textos, levantamientos incluidos y su orden, planos); publicar con confirmación; versiones con su estado ("Generando PDF", "Descargar PDF", "No se pudo generar").

**Imagen:** Chromium dentro de la imagen de despliegue, con su versión fijada por la de Alpine.

## Fuera del corte 4

| Qué | Dónde se resuelve |
|---|---|
| El cliente descarga el PDF | Corte 5 (portal) |
| Retirar una versión publicada | Cuando exista el rol administrador |
| Marca por organización en la plantilla (ADR-0020) | Iteración de administración; hoy usa los valores de TEINS |
| Miniaturas en resolución de impresión | Cuando el tamaño del PDF lo pida; hoy van las fotos recodificadas |
| Tablas de cantidades y bocetos en el PDF | Con sus iteraciones |
| Planos como imagen | Si TEINS no los tiene en PDF |

## Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Extremo a extremo: oficina compone el informe de una visita con un levantamiento revisado y un plano, lo publica y descarga el PDF | Cumplido en Chromium y WebKit, en local y contra el entorno (`e2e/pruebas/informe.spec.ts`) |
| 2. Publicar otra versión deja la anterior intacta y descargable (QA-9); la base no deja modificar una versión publicada | Cumplido en integración (permiso por columna) y en el extremo a extremo |
| 3. El PDF se genera en segundo plano, tiene los datos, las fotos y las páginas del plano, y no se vuelve a generar (QA-17) | Cumplido en integración con Chromium real (título, páginas del plano, huella estable) y en el worker de Railway |
| 4. Solo entran levantamientos revisados de la misma visita (regla 9) | Cumplido en dominio e integración |
| 5. Pantallas solo con componentes de `ui` y sus estados; reglas de arquitectura en verde | Cumplido |
| 6. Desplegado en el entorno de pruebas con el extremo a extremo en verde contra él | Cumplido el 2026-09-25, con la regresión de envío y revisión |

## Decisiones tomadas al construirlo

- **Falla del corte 2 encontrada aquí y corregida:** campo nunca mandaba `visitaId` en el envío, así que ningún levantamiento llegaba con su visita. Las pruebas del servidor armaban el comando a mano y las de campo no miraban su contenido. Ahora hay una prueba del comando en campo y el extremo a extremo del envío comprueba que oficina ve la visita. Los levantamientos ya recibidos sin visita siguen así: no se puede saber a qué visita pertenecían.
- **Uno por visita, abierto desde oficina:** "Abrir el informe de esta visita" crea el borrador si no existe (restricción única por organización y visita) y devuelve el mismo si ya existe.
- **Publicar reserva la versión del borrador:** el mismo `UPDATE … WHERE version = ?` del corte 3 evita que dos personas publiquen dos veces desde el mismo borrador. Lo que se publica es lo guardado; la pantalla guarda antes si hay cambios.
- **Copia congelada completa:** la versión guarda la definición del formato, las respuestas, los nombres de quien capturó y revisó, la visita, los textos y los planos. El PDF se arma solo desde ella.
- **Inmutabilidad en la base:** `informes.versiones` solo admite `INSERT` y `UPDATE` de las columnas del PDF (permiso por columna). Probado: modificar el contenido da "permission denied".
- **PDF en la cola `pdf`, de a uno, con 5 intentos:** al agotarlos queda "No se pudo generar el PDF" a la vista; un PDF listo nunca se vuelve a generar. La cola ahora le dice al manejador si es su último intento.
- **Plantilla:** HTML sin JavaScript ni red (Chromium con JavaScript apagado, sin conexión y con toda solicitud bloqueada), fuente Atkinson Hyperlegible Next y fotos incrustadas, tamaño carta, fechas en hora de Colombia fija. Marcadores `[LOGO]`, `[FIRMA]`, `[DATOS LEGALES]` y `[FOTO]` para lo que falta. Valores de marca de TEINS fijos hasta la configuración por organización (ADR-0020).
- **Planos:** solo PDF y solo desde oficina (campo solo sube JPEG), por el mismo camino de las fotos; el worker verifica que sea PDF. Se anexan con pdf-lib; la numeración "Página X de Y" del pie cuenta las páginas del informe, no las de los planos.
- **PDF guardado por su huella** junto a las fotos (`organizacion/sha256`), sin fila en `archivos.archivos`: la versión registra la huella.
- **Chromium en la imagen:** `apk add chromium` en Alpine, `CHROMIUM_RUTA=/usr/bin/chromium`. Probado dentro del contenedor (Chromium 152). La imagen pasa a 1,6 GB. En desarrollo y pruebas se usa el Chromium de Playwright 1.62.1, la misma versión del extremo a extremo.
- **`ui` crece:** `Casilla` y `SelectorDeArchivo`.
