# ADR-0032 · Soltar, reabrir y devolver una revisión

- **Estado:** Propuesta, aplazada (Kevin, 2026-10-01: no es prioridad). Hoy cada caso tiene una salida, aunque torpe: otra persona se quita la toma, oficina corrige un revisado con la toma y lo que solo se captura en sitio se pide con un comentario. Se retoma si en el piloto aparece una toma abandonada o un dato que solo el técnico puede traer
- **Fecha:** 2026-10-01
- **Impulsores:** QA-8, QA-25, QA-3, I-1
- **Depende de:** ADR-0005 (concurrencia optimista); modelo de dominio, ciclo de vida del levantamiento y reglas 2, 4 y 14

## Contexto

El ciclo de vida del levantamiento (modelo de dominio, sección 5) solo avanza: Enviado → En revisión → Revisado. Las auditorías de la iteración 24 encontraron tres salidas que oficina necesita y que hoy no existen:

1. **Soltar una revisión.** Quien la tomó por error, o se va de vacaciones, no puede dejarla: otra persona tiene que quitársela, y eso queda registrado como si se la hubiera quitado.
2. **Reabrir un revisado.** Si después de marcarlo revisado aparece un error, no hay forma de volver a corregirlo con su toma. La tabla del modelo dice que un Revisado lo edita "oficina, con toma y registro de cambios", pero la app no lo ofrece.
3. **Devolver al técnico.** Cuando falta algo que solo el técnico puede capturar (una foto, una medida en sitio), oficina solo puede comentar. La regla 4 dice que tras el envío el técnico no edita: devolverle el levantamiento cambia esa regla.

Restricciones: cada cambio posterior al envío queda con autor, campo, valor anterior y nuevo (regla 8, QA-8). Nada se borra (regla 14). Un editor por estado (AGENTS.md, regla 3). Un informe publicado es una copia, así que reabrir un levantamiento no cambia lo ya publicado (QA-9).

## Opciones

| Opción | Descripción |
|---|---|
| A. Solo soltar y reabrir | Oficina suelta su toma y reabre un revisado; al técnico se le sigue pidiendo lo que falta por comentarios |
| B. A, más devolver al técnico a borrador | El levantamiento vuelve a Borrador y el técnico lo edita como antes de enviar |
| C. A, más devolver con un estado propio | Estado nuevo, "Devuelto": el técnico completa lo que oficina pidió y lo vuelve a enviar; cada cambio suyo queda registrado como corrección |

## Evaluación

| Criterio (ligado a un impulsor) | A | B | C |
|---|---|---|---|
| Cada cambio posterior al envío queda atribuido (QA-8) | ● | ○ | ● |
| Un solo editor por estado (AGENTS.md, regla 3; QA-3) | ● | ● | ● |
| Resuelve lo que solo el técnico puede capturar | ○ | ● | ● |
| Cambio acotado en la sincronización (QA-20) | ● | ◐ | ◐ |

## Decisión

**C, en dos entregas: primero soltar y reabrir; después devolver con el estado "Devuelto".**

1. **Soltar:** quien tiene la toma la deja con "Soltar la revisión". El levantamiento vuelve a Enviado, sin responsable, con un evento registrado. Se hace al instante con "Deshacer" (DESIGN.md: se revierte tomándola otra vez).
2. **Reabrir:** un Revisado vuelve a En revisión al tomarlo, con motivo obligatorio y registro. Es una confirmación con consecuencias. Si el levantamiento ya está en una versión publicada de un informe, la confirmación lo dice: esa versión no cambia y el arreglo sale en la siguiente.
3. **Devolver al técnico (segunda entrega):**
   - Desde En revisión, con lo que falta escrito (obligatorio) y marcado en los datos a completar.
   - El levantamiento pasa a **Devuelto**, el único estado posterior al envío en que edita el técnico, y solo los datos marcados.
   - En campo aparece arriba de "Mis visitas", con un aviso push (ADR-0023), y se vuelve a enviar con el flujo de siempre.
   - El servidor registra cada cambio del técnico como corrección suya, con valor anterior y nuevo (regla 8), y el levantamiento vuelve a En revisión con el mismo revisor.
   - La regla 4 pasa a decir: "Tras el envío, el técnico no edita, salvo lo que oficina le devuelve".
4. El modelo de dominio y el documento de permisos se actualizan con los estados y transiciones nuevos. El comando de sincronización de "devuelto" lleva su llave de idempotencia (regla 4 de AGENTS.md).

## Por qué gana a cada alternativa

- **Frente a A:** deja sin resolver lo que solo se captura en sitio. Oficina terminaría pidiéndolo por WhatsApp y el dato llegaría fuera del levantamiento, sin registro.
- **Frente a B:** volver a Borrador borra la frontera del envío: lo que el técnico cambie ya no queda como corrección con valor anterior, y se pierde la trazabilidad que exige QA-8.

## Consecuencias

- **A favor:** oficina sale de los callejones de hoy (una toma que nadie suelta, un revisado que no se corrige) sin perder el registro. Devolver trae el dato de vuelta por el canal que lo registra.
- **En contra:** un estado nuevo toca dominio, protocolo, servidor y campo (mitigación: segunda entrega, con pruebas de sincronización como en el corte 3). Campo debe guardar un levantamiento devuelto sin mezclarlo con sus borradores (mitigación: mismo almacén, con su estado; ADR-0004).

## Cuándo revisarla

- Si en el piloto se devuelve casi todo: el problema está en el formato o en la captura, no en la revisión.
- Si TEINS prefiere que oficina corrija siempre y nunca devuelva: la segunda entrega no se construye.
