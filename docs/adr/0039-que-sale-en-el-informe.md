# ADR-0039 · Qué sale en el informe: oficina oculta partes de cada levantamiento

- **Estado:** Aceptada
- **Fecha:** 2026-10-04
- **Impulsores:** regla 6 (los formatos son datos), regla 7 y QA-9 (versiones inmutables), regla 18 (minimización), QA-17 (el mismo PDF siempre)
- **Depende de:** ADR-0013 (PDF desde la copia congelada), ADR-0031 (vista en vivo)

## Contexto

El informe incluía todo lo que trae cada levantamiento revisado: oficina solo elegía qué levantamientos entraban. Kevin explicó (2026-10-04) que eso no es fiel a cómo trabaja TEINS:
- las fotos de llegada sirven para que la empresa verifique la visita, no para el cliente;
- el croquis de campo es un borrador: oficina lo pasa a un plano y lo adjunta en PDF, y el croquis solo va si no hay que corregirle nada;
- en general, oficina debe poder poner o quitar partes con libertad.

La versión publicada es una copia congelada (ADR-0013) y el PDF se arma solo desde ella.

## Opciones

| Opción | Descripción |
|---|---|
| A. Lista de lo que sale | El borrador guarda todo lo que entra; lo nuevo no entra hasta elegirlo |
| B. Elecciones sobre lo de por omisión | El borrador guarda lo que oficina ocultó y lo que volvió a mostrar; lo demás sigue la regla de por omisión (formato y croquis) |
| C. Ocultar en la plantilla | La versión lleva todo y la plantilla salta lo oculto |

## Evaluación

| Criterio | A | B | C |
|---|---|---|---|
| Lo que entra después (otra foto corregida) no exige volver a elegir | ○ | ● | ● |
| Lo oculto no queda en la versión (regla 18) | ● | ● | ○ |
| El formato decide lo de por omisión, sin código (regla 6) | ◐ | ● | ● |
| Versiones ya publicadas iguales (QA-9, QA-17) | ● | ● | ● |

## Decisión

B, con estas reglas:

- **Qué se puede ocultar:** un bloque (una sección o una repetición), un campo con bloque propio (fotos, croquis, cantidades, firma) y cada foto. Un dato suelto no: si no debe salir, va en una sección «solo para la empresa». Lo de adentro hereda lo de afuera.
- **Por omisión no salen:** las secciones con `soloEmpresa: true` en el formato (dato del formato, opcional; una app anterior lo ignora) y los campos `boceto` (el croquis de campo).
- **Borrador:** columna `informes.informes.seleccion` (migración `0035_seleccion_del_informe`) con `{ocultos, mostrados}`. Claves `"<levantamiento>|<bloque>"`, `"…|<campo>"` y `"…|<campo>|<huella>"`; hasta 2.000 claves de 300 caracteres. `guardarInforme` la recibe opcional: una pestaña anterior al despliegue no la borra.
- **Al publicar:** `aplicarSeleccion` (`paquetes/dominio`) quita de la copia lo oculto, valores y fotos, así que el PDF tampoco lo incrusta. La copia lleva `ocultos` (bloques y campos) para que la plantilla los salte. `formatoContenido` sigue en 1: el campo es opcional y las versiones anteriores no lo tienen.
- **Oficina:** bajo cada levantamiento incluido, «Qué sale en el informe» con un interruptor por bloque, «Elegir fotos» y «Mostrar todo». Sobre la hoja en vivo, «Ocultar» al pasar por encima; lo oculto queda rayado con «Mostrar». La hoja no ejecuta scripts y Safari no entrega sus eventos a la pantalla: una capa encima pregunta qué hay bajo el puntero (`elementFromPoint`) y la pantalla atiende el botón.
- **Lo oculto sigue en el levantamiento:** oficina lo ve en la revisión.

## Por qué gana a cada alternativa

- **Frente a A:** una foto agregada al corregir, o una repetición nueva, quedaría fuera sin que nadie lo decida.
- **Frente a C:** la versión del cliente guardaría lo que oficina decidió no entregar, contra la regla 18.

## Consecuencias

- **A favor:** el informe sale como lo entrega TEINS sin quitar cosas a mano en cada uno; el formato marca lo interno una vez.
- **En contra:** una clave que ya no corresponde (una foto quitada en la revisión) queda en la selección sin efecto; el límite de claves la acota.
- **Sin cambio:** la pestaña «En el informe» de la revisión muestra el capítulo completo; lo que sale se decide en el informe.

## Cuándo revisarla

- Si oficina necesita ocultar datos sueltos de una sección que el cliente sí ve.
- Si TEINS quiere plantillas de informe por tipo de cliente con selecciones distintas por omisión.
