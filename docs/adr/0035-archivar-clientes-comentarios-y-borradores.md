# ADR-0035 · Editar y archivar clientes, sitios y comentarios, y descartar borradores en campo

- **Estado:** Aceptada (Kevin, 2026-10-01)
- **Fecha:** 2026-10-01
- **Impulsores:** QA-1, QA-8, QA-13, I-3, I-20
- **Depende de:** ADR-0004 (almacenamiento local), ADR-0003 (sincronización); modelo de dominio, reglas 4, 14 y 18

## Contexto

Faltan cuatro acciones de corrección de datos:

1. **Editar o quitar un cliente o un sitio.** Hoy se crean pero no se corrigen: un nombre mal escrito queda así en cada informe nuevo. Un cliente que dejó de serlo sigue en todas las listas.
2. **Editar o borrar un comentario.** Un comentario de oficina sobre un dato, mal escrito o dirigido al dato equivocado, queda para siempre y el técnico lo ve en su teléfono.
3. **Descartar un borrador en campo.** Un levantamiento iniciado por error (otra visita, un formato equivocado) queda en el teléfono y en "Mis visitas" para siempre: no se puede enviar sin datos ni quitar.

Restricciones: nada se borra en el servidor; se anula o se retira (regla 14). Las versiones publicadas son copias y no cambian (QA-9). Los borradores solo existen en el teléfono (AGENTS.md, regla 5), así que descartarlos borra lo único que hay. Un cliente pertenece a una organización (QA-13).

## Opciones

| Opción | Descripción |
|---|---|
| A. Editar en su lugar y archivar | Se edita con registro; "quitar" es archivar: sale de las listas y de programar, y la historia lo conserva |
| B. Borrar de verdad | Quitar elimina la fila |
| C. Descartar con papelera en el teléfono | El borrador descartado se oculta y se borra a los 30 días |
| D. Descartar al instante con "Deshacer" | Se borra del teléfono al pasar los segundos del "Deshacer" |

## Evaluación

| Criterio (ligado a un impulsor) | A | B |
|---|---|---|
| Los informes y visitas pasados conservan a su cliente (regla 14) | ● | ○ |
| Un nombre corregido se ve en lo nuevo, no en lo publicado (QA-9) | ● | ● |

| Criterio (ligado a un impulsor) | C | D |
|---|---|---|
| Un descarte por error se recupera (QA-1) | ● | ◐ |
| No ocupa el teléfono sin fin | ◐ | ● |

## Decisión

**A para clientes, sitios y comentarios; C para descartar borradores.**

1. **Clientes y sitios:**
   - Se editan en una hoja lateral, con registro de quién cambió qué.
   - Lo publicado conserva el nombre que tenía, porque es una copia.
   - "Archivar cliente" (y sitio) es una confirmación con consecuencias: sale de las listas, de la búsqueda y de "Programar visita", y deja de recibir envíos.
   - Lo archivado se ve en una pestaña "Archivados", de donde se recupera.
   - No se puede archivar un cliente con visitas programadas por hacer: primero se cancelan o reprograman, y la app lo dice.
2. **Comentarios:**
   - Su autor los edita o borra mientras el levantamiento no esté Revisado.
   - Borrar es anular: el comentario sale de la vista del técnico y en oficina queda "Comentario retirado por …", con "Deshacer".
   - Editar deja la marca "editado" con la hora. El técnico ve la última versión en la siguiente sincronización.
3. **Descartar un borrador:**
   - En campo, "Descartar levantamiento" en un borrador nunca enviado. Es una confirmación irreversible, porque es lo único que hay del trabajo.
   - El borrador pasa a una papelera en el teléfono, visible en la cuenta del técnico ("Descartados"), de donde se recupera durante 30 días.
   - Después se borra con sus fotos, si nada más las usa (ADR-0004).
   - El servidor no se entera, porque el borrador nunca subió. Si tenía visita, la visita sigue sin levantamiento.

## Por qué gana a cada alternativa

- **Frente a B:** borrar un cliente deja informes, visitas y envíos apuntando a nada, y rompe la regla 14.
- **Frente a D:** un descarte por error en campo, con el teléfono en una mano, no se nota en diez segundos. Lo descartado es trabajo de horas que solo existe ahí (QA-1).

## Consecuencias

- **A favor:** oficina corrige datos maestros sin tocar lo publicado y sin perder historia. El técnico limpia su teléfono sin miedo a perder algo.
- **En contra:** la papelera ocupa espacio en el teléfono durante 30 días (mitigación: se vacía antes si el diagnóstico avisa de poco espacio, preguntando). Archivar suma un filtro a listas y búsquedas (mitigación: el servidor filtra por defecto; la pestaña "Archivados" pide los archivados aparte).

## Cuándo revisarla

- Si TEINS necesita fusionar clientes duplicados: es otra operación, con su ADR.
- Si la papelera se llena porque los técnicos descartan como costumbre: el problema está en cómo se inicia un levantamiento.
