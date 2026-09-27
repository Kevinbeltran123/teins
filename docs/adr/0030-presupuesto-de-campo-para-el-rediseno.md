# ADR-0030 · El presupuesto de JavaScript inicial de campo sube a 135 KB para el rediseño Recorrido

- **Estado:** Aceptada
- **Fecha:** 2026-09-27
- **Impulsores:** QA-16
- **Depende de:** ADR-0011

## Contexto

ADR-0011 fija un límite de JavaScript inicial comprimido para `campo`, que la integración continua hace cumplir (`scripts/presupuesto-campo.mjs`). Al empezar el rediseño de campo (dirección Recorrido, `DESIGN.md`), el límite era de 120 KB y la medición daba 119,9 KB: cualquier pantalla nueva lo rompía.

Kevin juzgó la interfaz de campo "demasiado fea" y aceptó sacrificar algo de rendimiento para entregar algo más elaborado. Pidió no complicarse: "no va a pasar nada gravísimo si se sube un poco el límite".

## Opciones

| Opción | Descripción |
|---|---|
| A. Mantener 120 KB | Dividir más el código antes de cada cambio de pantalla |
| B. Subir a 135 KB | Un margen de 15 KB para el rediseño, que sigue midiéndose en cada compilación |
| C. Quitar el límite | Confiar en la revisión manual |

## Evaluación

| Criterio (ligado a un impulsor) | A | B | C |
|---|---|---|---|
| Tiempo de respuesta en el celular de referencia (QA-16) | ● | ◐ | ○ |
| Permite el rediseño sin frenar cada pantalla | ○ | ● | ● |
| El peso sigue siendo una regla automática | ● | ● | ○ |

## Decisión

**B.** El límite pasa a **135 KB** comprimidos. Las reglas que lo acompañan:

- La animación sigue siendo CSS (regla 10). Las transiciones entre pasos usan View Transitions del navegador, que no suman JavaScript.
- Lo que solo usa la captura se carga con la captura, no en el arranque.

## Por qué gana a cada alternativa

- **Frente a A:** con 0,1 KB de margen, cada pantalla del rediseño obligaba a reorganizar el código antes de poder verla.
- **Frente a C:** sin límite, el peso crece sin que nadie lo note. Una regla automática cuesta poco y lo evita.

## Consecuencias

- **A favor:** el rediseño avanza sin reorganizar el código a cada paso, y el peso sigue medido en cada compilación.
- **En contra:** el arranque puede tardar un poco más en un celular de gama baja. Se mitiga con la prueba en iPhone del plan de entrega y con la regla de CSS para el movimiento.

## Cuándo revisarla

Revisarla si en la prueba en el celular de referencia el arranque supera QA-16, o si el rediseño necesita pasar de 135 KB.
