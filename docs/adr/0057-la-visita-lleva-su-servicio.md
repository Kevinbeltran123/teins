# ADR-0057 · La visita lleva su servicio: oficina elige el formato al programar

- **Estado:** Aceptada
- **Fecha:** 2026-11-07
- **Impulsores:** QA-2, R5, regla 6, regla 7
- **Depende de:** ADR-0006, ADR-0015, ADR-0037, ADR-0042, ADR-0054

## Contexto

Al programar, oficina elige un «motivo» de una lista fija en el código: Mantenimiento, Cotización o Modificación. Esa lista se escribió antes de tener los formatos de TEINS, y no coincide con sus palabras. TEINS tiene dos servicios, cada uno con su formato en papel: el servicio de UPS y la visita técnica. El formato de UPS ya pregunta «Tipo de servicio» (preventivo, correctivo, instalación…) y «Clasificación» (garantía, contrato…). Un motivo «Mantenimiento» en el encabezado del informe puede contradecir un «Correctivo» marcado más abajo.

En campo, la visita ofrece un botón por cada formato vigente, y el técnico elige al llegar. Desde ADR-0054, una visita tiene un levantamiento por técnico, así que «otro servicio es otra visita». Nada impide que el técnico llene el formato equivocado.

Lo que lo hace difícil:

- Los teléfonos con la app anterior deben seguir funcionando (ADR-0015, N-1).
- El motivo se muestra en muchos lugares: el informe, el correo, el portal, la ocupación de los técnicos y la búsqueda.
- Un formato tiene versiones, y el teléfono elige la vigente que su app puede mostrar.
- El borrador nace sin conexión: el servidor no sabe si ya existe.

## Opciones

| Opción | Descripción |
|---|---|
| A. Motivos con las palabras de TEINS | Cambiar la lista fija por Preventivo, Correctivo, Instalación y Cotización |
| B. La visita lleva el formato | Oficina elige el servicio, es decir uno de los formatos vigentes de la organización. La visita guarda su clave; campo ofrece solo ese |
| C. B, guardando la versión | Como B, pero la visita apunta a una versión concreta del formato |

## Evaluación

| Criterio | A | B | C |
|---|---|---|---|
| El técnico no puede llenar el formato equivocado (QA-2) | ○ | ● | ● |
| Sin datos repetidos que se contradigan en el informe | ○ | ● | ● |
| Un formato nuevo no exige código (regla 6) | ○ | ● | ● |
| El teléfono sigue eligiendo la versión que puede mostrar (ADR-0015) | ● | ● | ○ |
| App anterior sin cambios | ● | ● | ● |

## Decisión

**B.**

- **Visita:** columna `formato` (texto, nula), con la **clave** del formato, no su versión. Las visitas anteriores quedan con `null`.
- **Programar y reprogramar:** oficina elige entre los formatos vigentes de la organización (operación nueva `formatosVigentes`, de la interfaz pública de `formatos`). El servidor valida que exista, guarda la clave y **copia el nombre del formato en `motivo`**. El informe, el correo, el portal, la ocupación y la búsqueda siguen leyendo `motivo` sin cambios. La copia no sigue un cambio de nombre posterior del formato, igual que una versión publicada.
- **Cambiar el servicio:** se puede mientras la visita no tenga ningún levantamiento recibido. Después, el servidor lo rechaza con un error que lo explica. Como el motivo hoy, cambiarlo no reabre una visita cerrada (ADR-0042).
- **Campo:** si la visita trae `formato`, ofrece un solo botón con ese formato; si no lo trae, todos los vigentes, como antes. Un borrador ya empezado se sigue con su formato: nunca se borra nada (regla 5).
- **Compatibilidad (ADR-0015):** `formato` es opcional en la bajada; una app anterior lo ignora y sigue ofreciendo todos. El servidor **no** rechaza un levantamiento con otro formato que el de la visita: rompería la app anterior y el borrador empezado antes de cambiar el servicio. Oficina lo ve al revisar.
- **Lenguaje común:** la visita es un desplazamiento a un sitio **para prestar un servicio**; el servicio es el formato que se llena.

## Por qué gana a cada alternativa

- **Frente a A:** el «Tipo de servicio» ya lo marca el técnico en el formato, que es quien sabe qué encontró. Repetirlo en la visita duplica el dato, y la lista fija vuelve a quedar en el código.
- **Frente a C:** la visita quedaría atada a una versión vieja cuando se publica otra, y un teléfono con una app que no puede mostrar esa versión no tendría con qué empezar.

## Consecuencias

- **A favor:** el técnico llega con el formato correcto. El informe nombra el servicio de TEINS. Un tercer formato aparece solo al programar.
- **En contra:** el nombre del servicio se guarda dos veces (la clave y la copia en `motivo`). Mitigación: la copia solo se muestra y se escribe en el mismo comando que la clave.
- **En contra:** si una organización no tiene formatos publicados, no se puede programar. Mitigación: la pantalla lo dice y nombra el comando `publicar-formato`.

## Cuándo revisarla

- Una visita necesita dos servicios a la vez: volver a ADR-0054 antes de permitir dos formatos.
- Se pueden retirar formatos: decidir qué pasa con las visitas programadas que lo usan.
