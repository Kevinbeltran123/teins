# ADR-0058 · Campos condicionales: un campo o una sección aparece según una selección anterior

- **Estado:** Aceptada
- **Fecha:** 2026-11-07
- **Impulsores:** QA-2, QA-9, regla 6, regla 7
- **Depende de:** ADR-0006, ADR-0015, ADR-0050

## Contexto

Los formatos de TEINS tienen partes que solo aplican en un caso. «Causas del correctivo» solo aplica si el servicio es correctivo. La tabla de materiales de la visita técnica solo aplica si se respondió «Sí» a «¿Se emplearon materiales o equipos?». Hoy todo se muestra siempre, así que pasan dos cosas:

- El técnico recorre pasos que no le tocan.
- El informe muestra casillas vacías que el cliente no entiende. Si alguna de esas partes fuera obligatoria, no se podría enviar.

ADR-0050 dejó fuera la visibilidad condicional y pidió un ADR propio cuando un formato la necesitara (sus disparadores). Ese caso ya existe.

Lo que lo hace difícil:

- Los formatos son datos (regla 6): la condición se escribe en el formato, no en el código.
- Una versión publicada no cambia (regla 7).
- Una app anterior no sabe evaluar condiciones: mostraría todo y exigiría lo oculto (ADR-0015).
- Las condiciones encadenadas pueden formar ciclos.

## Opciones

| Opción | Descripción |
|---|---|
| A. Sin condiciones | Todo visible; el técnico salta lo que no aplica |
| B. `visibleSi` simple | Un campo o una sección aparece solo si una selección (`opcion`/`opciones`) anterior tiene alguna de unas opciones |
| C. Expresiones | Un pequeño lenguaje de condiciones (y, o, no, comparaciones de medidas) |

## Evaluación

| Criterio | A | B | C |
|---|---|---|---|
| El técnico solo ve lo que aplica (QA-2) | ○ | ● | ● |
| El informe sin casillas que no aplican | ○ | ● | ● |
| Se valida al publicar, sin ciclos | ● | ● | ◐ |
| Cubre los dos formatos de TEINS | ○ | ● | ● |
| Fácil de escribir a mano en el archivo del formato | ● | ● | ○ |

## Decisión

**B.**

- **Forma:** `visibleSi: { seccion?: string, campo: string, en: string[] }` en un campo o en una sección. Es visible si el valor de ese campo es una de las opciones de `en`; en `opciones`, si alguna elegida está en `en`. Sin `seccion`, el campo es de la misma sección y, en una sección repetible, de la misma repetición.
- **Al publicar** (`validarDefinicionFormato`) se exige que:
  - el campo referido exista, sea `opcion` u `opciones`, y **esté antes** en el formato (eso impide los ciclos);
  - la sección referida no sea repetible, salvo que la referencia sea a la propia sección;
  - `en` no esté vacío y solo tenga opciones del campo;
  - la condición de una sección nombre otra sección;
  - el formato tenga `appMinima` 17 o mayor.
- **Lo oculto** no se valida al enviar (no es obligatorio ni se revisa), no se muestra en campo, su paso sale del recorrido y no sale en el informe ni en la revisión. Lo que el técnico escribió antes de que se ocultara se conserva en el levantamiento: si vuelve a cambiar la selección, reaparece.
- **Campo 17:** primera versión que evalúa condiciones (`VERSION_APP_VISIBILIDAD`). La bajada no le entrega a una app anterior un formato que las use (ADR-0015, punto 4).

## Por qué gana a cada alternativa

- **Frente a A:** los dos formatos de TEINS tienen partes que dependen de una respuesta, y mostrarlas siempre llena el informe de casillas vacías.
- **Frente a C:** ningún caso conocido necesita combinar condiciones ni comparar números. Un lenguaje de expresiones agrega validación, errores y un editor que nadie pidió.

## Consecuencias

- **A favor:** menos pasos para el técnico y un informe que solo muestra lo que aplica. Se escribe en el JSON del formato, sin código.
- **En contra:** lo oculto queda guardado sin mostrarse. Mitigación: nunca sale en el informe, y si vuelve a ser visible el técnico lo ve.
- **En contra:** el JavaScript inicial de campo pasa de 136,0 a 136,1 KB: la condición entra al contrato y a la validación del formato, que la bajada usa antes de abrir la captura (como en ADR-0050). El presupuesto (ADR-0011, QA-16) sube a 137 KB.
- **En contra:** los teléfonos con la app 16 siguen con la versión anterior del formato hasta actualizarse. Mitigación: la app se actualiza sola al abrirla con señal.

## Cuándo revisarla

- Un formato necesita combinar dos condiciones o comparar una medida: ver si basta separar en dos campos antes de pensar en expresiones.
