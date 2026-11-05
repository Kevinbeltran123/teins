# ADR-0054 · Un levantamiento por técnico y visita

- **Estado:** Aceptada
- **Fecha:** 2026-11-04
- **Impulsores:** QA-2, P4, regla 3, regla 4
- **Depende de:** ADR-0003, ADR-0035, ADR-0041

## Contexto

El modelo de dominio dice que una visita contiene varios levantamientos, cada uno con un técnico y un formato. Con eso, en campo, la visita atendida quedaba en «Atendidas hoy» y seguía ofreciendo «Iniciar levantamiento», también con el mismo formato y sin ningún aviso. En la prueba en pruebas del 2026-11-04, un técnico envió un levantamiento y, con el primero ya en revisión, empezó otro igual para la misma visita. Oficina habría recibido dos levantamientos de la misma visita, y el informe podía mezclarlos.

Lo que lo hace difícil:

- El levantamiento nace en el teléfono, con su propio id, también sin señal. La llave de idempotencia (regla 4) evita repetir un envío, no crear un segundo levantamiento.
- Después del envío solo edita el revisor (regla 3): un técnico que repite la captura no corrige nada, la duplica.
- Ya hay datos en los entornos: una restricción única en la base podría no aplicarse sin borrar datos.

## Opciones

| Opción | Descripción |
|---|---|
| A. Un levantamiento por técnico y visita | Con uno enviado, el teléfono ya no ofrece otro y el servidor rechaza un segundo |
| B. Un formato una vez por técnico y visita | Se puede agregar otro formato, nunca repetir el mismo |
| C. Permitir y confirmar | Como antes, con una hoja que avisa que ya hay uno enviado |

## Evaluación

| Criterio (ligado a un impulsor) | A | B | C |
|---|---|---|---|
| Ningún duplicado llega a oficina (QA-2) | ● | ◐ | ○ |
| Una regla que el técnico entiende sin explicársela | ● | ◐ | ◐ |
| Una visita con dos servicios (P4) | ◐ | ● | ● |

## Decisión

1. **Cada técnico envía un solo levantamiento por visita.** Una visita sigue pudiendo tener varios, de técnicos distintos (P4).
2. **El teléfono lo bloquea antes de crearlo.** `accionDeVisita` (`paquetes/campo/src/visitas.ts`): con un borrador, «Continuar levantamiento»; con uno enviado, en cualquier estado, «Ver lo que enviaste» y ningún botón para iniciar; sin ninguno, «Iniciar levantamiento». Un descartado no cuenta: nunca llegó a oficina (ADR-0035).
3. **El servidor lo rechaza como respaldo**, en la misma transacción del envío: si el técnico ya tiene en la visita un levantamiento con otro id, responde `estado_invalido` con «Ya enviaste un levantamiento de esta visita». Cubre la app anterior y un segundo teléfono. La consulta es sobre la tabla del propio módulo de levantamientos. El reintento del mismo envío (el mismo id) sigue respondiendo igual que la primera vez.
4. **Sin restricción única en la base:** se valida en el caso de uso. Así la migración no depende de que los entornos no tengan duplicados de antes.
5. **Un borrador de antes de esta regla** se sigue pudiendo continuar, sin borrar nada (regla 5). Si ya había uno enviado, el servidor lo rechaza al enviarlo: el teléfono dice «Ya enviaste un levantamiento de esta visita» y el técnico lo descarta. En «Teléfonos de campo» se lee «ya envió un levantamiento de esta visita».

## Por qué gana a cada alternativa

- **Frente a B:** se decidió (2026-11-04) que otro servicio es otra visita. B sigue dejando dos levantamientos del mismo técnico en una visita, que es lo que confundió en la prueba, y un formato mal elegido se arreglaría agregando el otro en vez de corregirlo.
- **Frente a C:** una confirmación se acepta sin leerla, y el duplicado llega igual a oficina.

## Consecuencias

- **A favor:** el informe de la visita no mezcla dos capturas del mismo técnico; el técnico ve lo que envió en lugar de un botón que lo invita a repetir.
- **En contra:** si el técnico eligió mal el formato o la visita necesitaba los dos, no puede agregar otro. Los datos equivocados los corrige oficina en la revisión (regla 3); otro servicio se programa como otra visita.
- **En contra:** dos envíos simultáneos del mismo técnico desde dos teléfonos podrían pasar los dos la consulta. Es improbable (una sesión, un teléfono) y oficina lo vería en la bandeja.

## Cuándo revisarla

Si TEINS necesita a menudo dos formatos en una misma visita, o rehacer una captura completa: entonces, un permiso explícito de oficina («Permitir otro levantamiento») que baje al teléfono, con su lienzo antes.

### Leyenda de las matrices de evaluación

**●** cumple bien · **◐** cumple con costo o condiciones · **○** no cumple

### Principio que rige todas las decisiones

> ¿Qué escenario de calidad se rompe si quito esta pieza? Si la respuesta es "ninguno", la pieza sale.
