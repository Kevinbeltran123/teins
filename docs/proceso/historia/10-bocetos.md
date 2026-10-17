[Plan de entrega](../plan-de-entrega.md) · Anterior: [Iteración 9 · Secciones repetibles](09-secciones-repetibles.md) · Siguiente: [Iteración 11 · Cantidades con catálogo](11-cantidades-con-catalogo.md)

# Iteración 10 · Bocetos

**Estado en el mapa al 2026-10-16:** Terminada y desplegada en el entorno de pruebas; falta la prueba en iPhone

**Estado:** terminada y desplegada en el entorno de pruebas el 2026-09-25 (Kevin: "We can have the validation on stand by. Continue with the next step"); la prueba en iPhone, de esta y de la iteración 9, queda en espera. Producción sigue con la versión anterior.

**Para qué:** que el técnico dibuje en el teléfono, sobre cuadrícula, el croquis que hoy hace en papel (P14, F3), y que llegue nítido a oficina y al PDF. Las decisiones grandes ya están en ADR-0019: trazos vectoriales propios con perfect-freehand, seis herramientas, y subida al enviar.

## Alcance

- **Formato:** tipo de campo `boceto` (ADR-0006). Exige app 5 (`appMinima` 5).
- **Campo (app 5):** el campo muestra la miniatura y abre el editor a pantalla completa: trazo libre, línea recta, texto, borrador por trazo, deshacer y rehacer, cuadrícula; lápiz con presión y rechazo de la palma; zoom y desplazamiento con dos dedos. Cada trazo se guarda al terminarlo, sin conexión.
- **Archivo:** el boceto es un documento JSON (trazos, líneas y textos) guardado como archivo inmutable direccionado por su huella (ADR-0007), igual que una foto. La respuesta guarda `{ boceto: huella }`. A diferencia de las fotos, sube solo cuando el levantamiento se envía (ADR-0019, parte 3).
- **Servidor:** acepta el tipo de archivo del boceto, verifica su estructura en el worker y lo exige completo antes de registrar el envío (QA-2).
- **Oficina y PDF:** el boceto se ve como imagen vectorial; no se corrige desde oficina (como las fotos).

## Fuera de la iteración 10

| Qué | Dónde se resuelve |
|---|---|
| Formas, capas, escalas y medición | Fuera de alcance por ADR-0019 (terreno del plano de oficina) |
| Dibujar sobre una foto | Cuando TEINS lo pida |
| Probar el lápiz en tabletas reales | Prueba en dispositivo, junto con la del iPhone |

## Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Extremo a extremo: el técnico dibuja un trazo, una línea y un texto, deshace y rehace, envía; oficina ve el boceto y el PDF lo incluye | Cumplido el 2026-09-25 en Chromium y WebKit en local y en Chromium contra el entorno (`e2e/pruebas/bocetos.spec.ts`, hasta publicar el informe) |
| 2. El boceto no sube mientras es borrador; sube al enviar y el envío espera a que esté verificado | Cumplido en campo (`repositorio.test.ts`, `motor.test.ts`) y en integración (`pruebas/bocetos.test.ts`) |
| 3. El servidor rechaza un boceto con estructura inválida y un formato con bocetos sin `appMinima` 5 | Cumplido en integración |
| 4. Lo anterior sigue igual: toda la suite en verde y el presupuesto de campo respetado | Cumplido: 19 de 19 en el extremo a extremo (más el salto conocido); campo en 114,1 KB de 120 |
| 5. Probado en el iPhone (y con lápiz, si hay una tableta) | Pendiente: fase 10 de [`verificacion-manual.md`](../verificacion-manual.md), en espera por decisión de Kevin |

## Decisiones tomadas al construirlo

- **El boceto es un archivo, como una foto:** documento JSON (`formato: "teins-boceto"`, versión 1) con lienzo lógico de 1000 × 750 (4:3), cuadrícula de 25 y tres clases de elemento: trazo, línea y texto. La respuesta guarda `{ boceto: huella }`; el documento vive en el archivo, direccionado por su huella (ADR-0007). La serialización es canónica (orden de claves fijo, un decimal), así que el mismo dibujo da siempre la misma huella.
- **El contorno se calcula en campo:** cada trazo guarda sus puntos (con presión) y el contorno que calcula perfect-freehand (MIT) al terminarlo. Así el SVG sale de una función pura de `dominio` (`bocetoASvg`) y oficina, el PDF y el componente `Boceto` de `ui` lo dibujan sin la biblioteca de dibujo; solo `campo` la usa.
- **Sube al enviar (ADR-0019, parte 3):** cada cambio guarda una versión nueva del archivo en el teléfono y borra la anterior si nada la usa; la cola de subidas solo toma los bocetos de levantamientos ya enviados. El envío espera, como con las fotos, a que el boceto llegue y se verifique (QA-2).
- **Verificación en el worker:** un boceto no tiene firma de tipo; se lee completo (hasta 2 MB) y se valida con `validarBoceto` de `dominio`. Solo campo sube bocetos (oficina, no); un contenido inválido se rechaza y se borra, como cualquier archivo.
- **Oficina lo pide al servidor ya verificado** (`GET /api/archivos/{huella}/boceto`) en vez de descargarlo del almacenamiento: no hace falta abrir CORS de lectura al bucket y nunca se dibuja algo sin validar. Un boceto no se corrige desde oficina, como las fotos.
- **Editor cargado aparte:** el editor (con perfect-freehand) es un fragmento propio de 4,5 KB comprimidos que se carga al tocar "Dibujar boceto"; el JavaScript inicial de campo quedó en 114,1 KB de 120.
- **Entrada:** trazo, línea, texto (se toca la hoja y se escribe), borrador por elemento (toque o arrastre), deshacer y rehacer (en memoria, durante la edición), zoom de 1× a 4× y desplazamiento con dos dedos. Rechazo de la palma: desde que aparece un lápiz, el dedo no dibuja.
- **App 5:** `campo` sube a `VERSION_APP = 5` y el meta-esquema exige `appMinima` 5 a un formato con bocetos. Formato de prueba v5: v4 más "Croquis del cuarto" (opcional).
- **Un error encontrado al probar:** el motor de sincronización pedía subir todo archivo como `image/jpeg`; el worker rechazaba el boceto (con razón) y el envío quedaba esperando. Ahora cada archivo sube con su tipo; lo cubre una prueba del motor.

## Al cerrarla

**Iteración 10 terminada el 2026-09-25:** bocetos de campo al PDF, desplegados en el entorno de pruebas con el formato de prueba v5 ("Croquis del cuarto"). La prueba en iPhone de las iteraciones 9 y 10 está en espera (fases 9 y 10 de la guía).
