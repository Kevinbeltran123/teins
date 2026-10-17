# ADR-0048 · Los archivos de campo que nadie usa se borran a los 120 días

- **Estado:** Aceptada
- **Fecha:** 2026-10-16
- **Impulsores:** QA-10 y QA-19 (costo por GB y copias), I-29 (copias coherentes), regla 7 (lo publicado es inmutable), regla 18 (minimización)
- **Depende de:** ADR-0007 (parte 4, la regla de limpieza), ADR-0043 (tarea periódica), ADR-0044 (poda). Amplía 0007 y 0044.

## Contexto

ADR-0007 fijó la regla («un archivo sin referencias se borra después de un plazo mayor que la retención de las copias de la base; uno referenciado por una versión publicada nunca se borra») pero nadie la cumplía. Las fotos de un envío que el servidor rechazó (ADR-0045) y que el técnico descartó (ADR-0046) quedan en el almacenamiento para siempre, con su fila.

Hechos que acotan la decisión:
- Las copias de la base duran a lo sumo 3 meses: las mensuales del volumen (plan de TEINS); los volcados, 35 días (`docs/proceso/produccion.md`).
- Un levantamiento recibido nunca se borra en el servidor, y sus fotos, bocetos y firmas no se corrigen (`no_corregible`). Una versión publicada solo incluye levantamientos revisados, ya sin cambios. Lo que usa un levantamiento, lo usa para siempre.
- Los planos (PDF de oficina) los usan borradores y versiones de informes; los PDF generados ni siquiera tienen fila.
- Si el servidor no tiene un archivo, el teléfono lo vuelve a subir al enviar (`archivos_faltantes`), y no borra nada sin enviar (regla 5).

## Opciones

| Opción | Descripción |
|---|---|
| A. Nada | Lo que nadie usa se queda en el almacenamiento |
| B. Por filas, solo lo de campo, con marca | La tarea periódica mira las filas de fotos, bocetos y firmas sin actividad en 120 días: borra las que ningún levantamiento usa y marca las demás para no volver a mirarlas |
| C. Recorrer el almacenamiento | Listar los objetos y borrar los que no tienen fila ni uso |

## Decisión

**B.**

1. **Qué se borra:** la fila y el objeto de una foto, un boceto o una firma que ningún levantamiento del servidor usa y que no tiene actividad (creado, subido o verificado) en **120 días**: 3 meses de la copia más vieja con un mes de margen. Restaurar cualquier copia encuentra los archivos que esa base usaba.
2. **Qué no:** los planos y los PDF generados (los usan informes y cotizaciones; nunca entran), lo reciente y lo que usa un levantamiento. Así se cumple que lo de una versión publicada nunca se borra.
3. **Uso:** `levantamientos.archivosEnUso` busca las huellas en las respuestas de los levantamientos de la organización. Lo usado queda marcado (`archivos.en_uso_comprobado_en`, migración `0039`) y no se vuelve a mirar.
4. **Cuándo:** en la tarea periódica de cada hora (ADR-0043), 500 archivos por organización y pasada, con la conexión del dueño: la aplicación sigue sin poder borrar archivos.
5. **Sin carreras con un envío:** la limpieza bloquea las filas antes de preguntar por su uso (`for update skip locked`) y el envío las lee con `for share`. O la limpieza salta las que un envío está leyendo, o el envío espera, ya no las encuentra y el teléfono las vuelve a subir.
6. **Primero la fila, después el objeto.** Si borrar el objeto falla, queda un objeto sin fila, que una subida del mismo contenido adopta (como tras restaurar la base), y la tarea lo registra como error.
7. **Objetos sin fila** no se buscan: el almacenamiento no distingue uno perdido de un PDF generado, y recorrerlo entero cuesta. Solo aparecen si falla el paso 6 o tras restaurar una base vieja.

## Por qué gana a cada alternativa

- **Frente a A:** las fotos son el único volumen grande (ADR-0007) y lo descartado crece sin fin.
- **Frente a C:** listar el almacenamiento cada hora cuesta, y un objeto sin fila puede ser el PDF de una versión publicada; borrarlo rompería la regla 7.

## Consecuencias

- **A favor:** se cumple la limpieza de ADR-0007 sin tocar nada publicado. Cada archivo se mira una vez, al cumplir el plazo.
- **En contra:**
  - Un envío rechazado que se reenvía después de 120 días vuelve a subir sus fotos (el teléfono las tiene).
  - Los planos que oficina quitó de un borrador se quedan.
  - Cada pasada con archivos por mirar lee las respuestas de todos los levantamientos de la organización.

## Cuándo revisarla

- Las copias de la base pasan a durar más de 3 meses (el plazo sube con ellas).
- Los planos sin uso pesan en el almacenamiento.
- Leer las respuestas de todos los levantamientos se vuelve lento: un índice de huellas por levantamiento.
- Un levantamiento del servidor se puede borrar o corregir sus fotos.

## Dónde vive

- `paquetes/servidor/src/modulos/mantenimiento/index.ts`: `limpiarArchivosSinUso`, `SIN_USO_DESPUES_DE_MS`.
- `paquetes/servidor/src/modulos/archivos/index.ts`: `borrarArchivosSinUso`; `estados` con `for share`.
- `paquetes/servidor/src/modulos/levantamientos/index.ts`: `archivosEnUso`.
- `paquetes/servidor/migraciones/0039_archivos_sin_uso.sql`.
- Prueba: `paquetes/servidor/pruebas/mantenimiento.test.ts`, «archivos sin uso».
