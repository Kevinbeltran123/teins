[Plan de entrega](../plan-de-entrega.md) · Anterior: [Iteración 25 · Usuarios y cuenta propia](25-usuarios-y-cuenta-propia.md) · Siguiente: [Iteración 27 · Flujos](27-flujos.md)

# Iteración 26 · Vista en vivo de los documentos

**Estado en el mapa al 2026-10-16:** Desplegada en el entorno de pruebas, aprobada por Kevin y en producción (2026-10-01)

**Estado:** prototipo aprobado por Kevin el 2026-10-01 (`prototipos/vista-en-vivo/prototipo.html`, https://claude.ai/artifact/KMNfFJPu6FkPF2SZx1zUud) con sus siete decisiones, construida y desplegada en el entorno de pruebas el mismo día, y **aprobada por Kevin en el entorno de pruebas** ("todo funciona bien"). En producción el 2026-10-01 desde el commit 820ebd4: respaldo `20261001T223347Z` antes, `campo` primero (aplicó la `0031`) y después `oficina`, `portal` y `worker`, los cuatro en `SUCCESS`. Verificado: salud 200 en las tres superficies, la misma compilación de oficina que la local (`index-B4boh-4V.js`), `/documentos/informe.css`, `cotizacion.css` y `geist.woff2`, `estadoDePlano` sin sesión 401, las cabeceras y `verificar-exposicion.sh`.

**Para qué (ADR-0031):** que oficina vea el documento que va a recibir el cliente mientras lo arma, y corrija antes de publicar, cuando todavía no es inmutable (QA-9). La vista y el PDF salen del mismo código, así que no pueden mostrar cosas distintas (QA-17).

## Alcance

- **`paquetes/documentos`:** las plantillas del informe y de la cotización, los mensajes de envío (correo, variables y texto de la plantilla de WhatsApp), `escapar`, el logo y los nombres de los PDF salen del servidor a un paquete que solo depende de `dominio`. Cada plantilla recibe la salida: `pdf` (estilos en `<style>` y Geist incrustada, como antes) o `vista` (enlaza `/documentos/informe.css` o `cotizacion.css`, servidos por oficina). El servidor imprime y envía con ellos; oficina los carga aparte, al abrir un documento.
- **Cotización:** el editor a la izquierda y la hoja a la derecha, a todo el alto; "Cotización" y "Correo" (lo que recibe cada contacto que recibe cotizaciones por correo, con el asunto y el adjunto). Una línea sin precio va como `[Precio]` y lo que cambia destella. Las acciones van a la barra superior y las versiones con sus envíos al final del editor.
- **Informe:** igual, con el documento completo en el orden del PDF: portada, introducción, capítulos con fotos (por sus URL firmadas), bocetos y firmas (en SVG, como el worker), conclusiones y los planos como fichas. Una franja marca dónde el PDF salta de página. Al pasar a una sección del editor, la hoja va hasta esa parte.
- **Revisión:** la pestaña "En el informe" del carril, que se ensancha a 560 px: el capítulo del levantamiento, con lo corregido resaltado y "Antes: …" debajo y, mientras se escribe una corrección, el valor nuevo enmarcado ("· sin guardar"). Desde la corrección, "Ver cómo queda en el informe" abre la pestaña.
- **Enviar a otro contacto:** pasa de diálogo a hoja lateral de 680 px, con lo que recibe cada contacto elegido por cada canal (el correo tal como sale; el WhatsApp con sus variables resaltadas) y, antes del botón, que lo enviado no se recupera.
- **Bajo 1280 px** la hoja no cabe al lado: "Vista previa" en la barra la abre en una hoja lateral ancha.
- **Estados:** mientras cargan las plantillas, la forma de una hoja; si no cargan o fallan al dibujar, "No se pudo mostrar la vista previa" con "Volver a intentar" (el trabajo no se afecta); sin conexión, la vista sigue al día y lo dice, y en el informe las fotos que no alcanzaron a cargar salen como `[FOTO]`.
- **La confirmación de publicar** ya no carga la vista previa del servidor (iteración 24): sus consecuencias dicen que es el documento de la vista previa. Salieron `/api/cotizaciones/{id}/vista-previa`, `rutaVistaPreviaCotizacion` y `registrarDocumento`.
- **La sesión trae `organizacion`:** su nombre, con el que firman el documento y el correo de la vista, y la dirección del portal (`PORTAL_URL`, nula si el entorno no la tiene), que lleva el botón del correo del informe igual que el que envía el servidor.
- **La ficha de cada plano dice cuántas páginas anexa.** Al verificar un plano, el servidor lo abre con pdf-lib con los mismos dos pasos con que lo anexa al imprimir (cargar y copiar sus páginas) y guarda el número (`archivos.paginas`, migración `0031`). Uno que pdf-lib no puede anexar queda marcado (0 páginas): la fila del plano lo dice en rojo, la ficha de la hoja también, y la confirmación de publicar lo lista como consecuencia, porque el PDF del informe fallaría y sus envíos no saldrían. Oficina lo lee con `estadoDePlano` (`GET /api/archivos/{huella}/plano`), también para los planos recién subidos, y vuelve a preguntar cada 2 s mientras se verifica.

## Fuera de la iteración 26

| Qué | Cuándo |
|---|---|
| Las páginas de los planos verificados antes de la migración `0031`: no se cuentan hacia atrás; su ficha dice "se anexa al final del PDF" sin el número | Al volver a subirlos, o si hace falta, con un comando que los recuente |
| Impedir publicar con un plano que no se puede anexar: hoy se avisa en la fila, la hoja y la confirmación, y el servidor lo sigue aceptando | Si TEINS lo pide: regla `plano_ilegible` al publicar (ADR nuevo, porque cambia lo que acepta publicar) |
| Campo ("Antes de enviar", lo que oficina va a recibir) | Cuando se decida; el paquete ya lo permite (ADR-0031) |
| El texto de la plantilla de WhatsApp en Meta | Al tener la cuenta de Meta: se registra el de `plantillaDeWhatsapp` |

## Terminado cuando

| Criterio | Evidencia |
|---|---|
| 1b. La ficha del plano | `servidor/pruebas/informes.test.ts`, "estado de un plano": "verificando" antes del worker, "listo" con 3 páginas después, "ilegible" el que empieza como PDF y pdf-lib no puede anexar, 403 para el técnico y 404 para otra organización o una huella desconocida. `informe.spec.ts` ve "1 página" en la fila y en la ficha; `informe-al-cliente.spec.ts`, el aviso del plano dañado en la fila, la ficha y la confirmación |
| 1. Una plantilla, dos salidas | `documentos/src/documentos.test.ts` (6 pruebas): las dos salidas solo difieren en cómo llegan estilos y fuente; la vista no lleva estilos en línea; la hoja de la vista contiene los estilos del PDF; anclas y `data-dato`; `[Precio]`; una marca de la plantilla de WhatsApp por variable. Regla `documentos-solo-dominio` en `.dependency-cruiser.cjs`, probada con una importación prohibida |
| 2. El PDF no cambia | Las pruebas del servidor que usan las plantillas y los mensajes pasan con el paquete (`informes`, `bocetos`, `firmas`, `repeticiones`, `cantidades`, `envios`, `cotizaciones`, `api`) |
| 3. Como el prototipo | Capturas de la cotización (documento, correo, confirmación, enviar a otro contacto y "Vista previa" a 1100 px), del informe y de la revisión, comparadas con el prototipo |
| 4. Funciona con la CSP de oficina | Oficina compilada y servida por el servidor real (con su CSP) en `localhost`: la hoja enlazada, Geist y las imágenes cargan en el marco en Chromium y WebKit, y los estilos del correo por CSSOM sin una sola violación. El extremo a extremo de cotización, informe, revisión y envíos pasó contra ese servidor |
| 5. Recorridos de punta a punta | `cotizaciones.spec.ts` (la hoja muestra `[Precio]`, cambia al escribir el precio y con AIU; "Correo"; la confirmación sin el PDF del servidor), `informe.spec.ts` (introducción, capítulo y la ficha del plano, y la introducción nueva al escribirla) y `revision.spec.ts` (el valor nuevo con "Antes: 10 kVA · sin guardar" antes de guardar, y resaltado después) |
| 6. Verificación completa en local | Typecheck, arquitectura, licencias, auditoría, pruebas de paquetes (servidor 197: salió la de la vista previa del servidor y entró la del estado de un plano; documentos 6, campo 84, protocolo 25, oficina 11, dominio 111), presupuesto de campo (126,7 de 135 KB, sin cambio) y el extremo a extremo completo: 97 pasan y 3 se saltan, en Chromium y WebKit. Con la ficha del plano terminada, otra vez la verificación completa: todo en verde y el extremo a extremo 97 pasan y 3 se saltan. Las pruebas de oficina usan Vitest con `--configLoader runner`, igual que Vite |
| 7. Desplegada en el entorno de pruebas | 2026-10-01, desde el commit 9cfc5a3. Kevin corrió los `railway up` (el control de permisos no me deja desplegar): `campo` primero (aplicó la `0031`) y después `oficina`, `portal` y `worker`, los cuatro en `SUCCESS`. Verificado: salud y las 7 cabeceras en las tres superficies, oficina sirve `/documentos/informe.css`, `cotizacion.css` y `geist.woff2`, la misma compilación que la local (`index-B1d3-3hK.js`), `estadoDePlano` sin sesión da 401 y la vista previa vieja 404, y `verificar-exposicion.sh`. Extremo a extremo allí en Chromium, un archivo por minuto: `cotizaciones.spec` (1), `informe.spec` (1), `revision.spec` (1) e `informe-al-cliente.spec` (2), los cinco a la primera; el entorno sí aplica la CSP de oficina |

## Decisiones tomadas al construirlo

- **La CSP de oficina no cambia.** El marco `srcdoc` hereda `style-src 'self'`: la vista enlaza su hoja de estilos (servida por oficina en `/documentos/`, generada por el plugin `teins-documentos` de `vite.config.ts` desde las mismas constantes del PDF) y la fuente por archivo. El correo trae sus estilos en atributos `style`, que la CSP bloquea en el HTML y también por `style.cssText` (Chromium lo trata como estilo en línea): se pasan a `data-estilo` y se aplican propiedad por propiedad con `style.setProperty`, lo mismo que hace React. Probado en Chromium y WebKit contra el servidor real.
- **El extremo a extremo no ve la CSP:** sirve las superficies con `vite preview`. La prueba con la CSP se hizo sirviendo la compilación de oficina con el servidor (`SUPERFICIE_OFICINA_HOST=localhost`) y `E2E_OFICINA_URL`; queda descrita aquí para repetirla si cambia la forma de dibujar.
- **El marco se arma una vez** y al escribir se reemplaza solo el cuerpo, en el siguiente cuadro (`HojaEnVivo`); lo que cambió destella comparando el texto de cada elemento antes y después. La hoja se mide por el cuerpo, no por el documento, para que pueda encogerse.
- **La revisión marca encima de la plantilla:** la plantilla pone `data-dato="sección/campo"` en cada fila (el PDF lo ignora) y oficina agrega la clase y el "Antes: …" (con `attr()` en CSS) después de pintar. Así la vista y el PDF siguen saliendo del mismo HTML.
- **La corrección en curso llega por contexto** (`CorreccionEnCurso` en `Detalle.tsx`): el editor de la fila avisa cada valor y el capítulo lo muestra sin guardar.
- **Lo que viene del borrador se arma como lo arma el servidor al publicar:** la cotización con `calcularTotales` del dominio (una cantidad a medio escribir no suma; un porcentaje a medio escribir deja el último que servía) y el informe con el capítulo de cada levantamiento (`capituloDe`) y sus recursos (`useRecursosDelInforme`).
- **El editor nunca baja de 660 px** para que la tabla de líneas quepa entera; la hoja se reduce con lo que queda. En la columna del editor, impuestos y totales van uno debajo del otro.
- **Vite carga su configuración con `--configLoader runner`:** el plugin importa `@teins/documentos`, que es TypeScript del monorepo y Node no lo resuelve sin transformarlo.
- **Un plano ilegible se avisa y no se bloquea:** publicar sigue aceptando lo mismo que antes (el servidor no cambia su regla), pero quien publica lo sabe antes. El conteo usa pdf-lib con los mismos pasos del worker, así que "ilegible" en pantalla y `PlanoIlegible` al imprimir no se pueden contradecir. 0 páginas se guarda como "no se puede anexar"; nulo, "no se contó" (otro tipo de archivo, o verificado antes de la `0031`).
- **Las plantillas pesan 29 KB comprimidas** (el logo en base64 es la mayor parte) y se cargan aparte; el resto de oficina no cambia de tamaño por ellas.

## Propuesta · Vista en vivo de los documentos

**Estado:** propuesta del 2026-09-29, a partir del prototipo de la base visual Precisión (https://claude.ai/artifact/MkRSHwecL2gXCZQ8zfHCrY). A Kevin le pareció "un diferencial grandísimo" y pidió plantearla como una sola función. Su ADR es el 0031, aceptado por Kevin el 2026-10-01: paquete `paquetes/documentos`, hoja continua aproximada y estilos servidos por oficina. Es la iteración 26, construida el 2026-10-01 (sección "Iteración 26").

**La idea:** mientras oficina trabaja, ve al lado el documento que va a recibir el cliente, tal como va a quedar, y se actualiza al escribir. Hoy solo se ve después de publicar, cuando ya no se puede cambiar.

**Dónde se usa:**

| Pantalla | Qué se ve en vivo |
|---|---|
| Cotización | La hoja de la cotización: cada precio, línea o cambio de impuestos se refleja al instante; pestaña "Correo" con el mensaje que recibe el contacto |
| Informe | El informe completo en el orden del PDF: introducción, un capítulo por levantamiento incluido, conclusiones y planos |
| Revisión de un levantamiento | Al corregir un dato, el capítulo del informe donde aparece, con el cambio resaltado y el valor anterior |
| Envíos | El correo y el WhatsApp que salen, con el adjunto |
| Campo (después) | En "Antes de enviar", lo que oficina va a recibir |

**Arquitectura propuesta (va al ADR):** las plantillas del informe y la cotización salen del servidor a un paquete nuevo, `paquetes/documentos`, que solo depende de `dominio` (hoy ya solo dependen de él y de una función de escape). El servidor las sigue usando para imprimir el PDF; oficina las usa para dibujar la vista en vivo sin ir al servidor en cada tecla. Así la vista previa y el PDF salen del mismo código y no se pueden separar. Los estilos de la plantilla pasan a un archivo servido por la misma superficie, para que la CSP de oficina (`style-src 'self'`) los admita en un marco `srcdoc`. Queda por decidir cómo paginar en pantalla (hojas carta fijas o continuo con marcas de salto).

**Lo que ya existe y se reemplaza:** la vista previa de la cotización de la iteración 24 (documento del servidor con la versión guardada), que pasaría a ser en vivo y sin guardar.
