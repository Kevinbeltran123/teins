# ADR-0044 · Retención en el teléfono y poda en el servidor

- **Estado:** Aceptada
- **Fecha:** 2026-10-06
- **Impulsores:** regla 5 (nunca borrar lo que no se ha enviado), regla 18 (minimización), QA-5 (ciclo de vida de los teléfonos), ADR-0002 (Safari puede borrar el almacenamiento)
- **Depende de:** ADR-0003, ADR-0022, ADR-0043 (tarea periódica). Amplía 0003.

## Contexto

Una revisión del 2026-10-06 encontró que casi nada se borra nunca:
- **En el teléfono**, un levantamiento revisado se queda para siempre con sus fotos (de 0,3 a 0,5 MB cada una), su envío, su estado y su chat. Con unas 15 fotos por levantamiento, en tres meses son alrededor de 1 GB. Eso arriesga que Safari borre el almacenamiento, borradores sin enviar incluidos, y el inicio descifra todo cada vez que se dibuja.
- **En el servidor**, el registro de cambios crece sin fin (un teléfono nuevo baja toda la historia), las sesiones vencidas se quedan y la lista de teléfonos de Administración muestra todos los que alguna vez se registraron.

## Decisión

1. **Retención en el teléfono:** un levantamiento revisado que oficina recibió hace más de 30 días sale del teléfono después de cada bajada, junto con:
   - sus fotos y bocetos, salvo los que use otro levantamiento;
   - su envío, su estado, su chat y lo leído.

   Nunca sale lo que no se ha enviado, no ha llegado o no está revisado (regla 5). Oficina lo conserva completo.
2. **Sesiones vencidas:** la tarea periódica (ADR-0043) borra las sesiones de oficina y campo, las verificaciones y las sesiones del portal vencidas hace más de un día.
3. **Teléfonos:** no se borran. Si se borra un teléfono sin contacto y después se revoca a su usuario, la orden de borrado no llegaría cuando el teléfono vuelva (QA-5). Lo que se acota es la lista de Administración: los teléfonos con contacto en los últimos 90 días y los que tienen una orden de borrado sin confirmar.
4. **Registro de cambios:**
   - un índice por organización, destinatario y secuencia;
   - la tarea periódica borra las filas que ya tienen una más nueva para la misma entidad y el mismo destinatario. La bajada solo usa el último cambio de cada entidad, así que ningún teléfono pierde nada.
   - Lo hace con la conexión del dueño de la base, como la limpieza de un entorno (ADR-0038): la aplicación sigue sin poder borrar en el registro.

## Por qué así

- **30 días** alcanzan para consultar lo enviado y responder comentarios recientes. Lo revisado y viejo no se vuelve a necesitar en el teléfono, y oficina lo tiene completo.
- **No borrar teléfonos** cuesta unas filas pequeñas; borrarlos arriesga datos de un usuario revocado en un teléfono perdido.
- **Compactar en vez de cortar por antigüedad:** cortar por fecha haría que un teléfono nuevo no bajara una visita vigente programada hace meses; compactar conserva siempre lo último de cada cosa.

## Consecuencias

- **A favor:** el teléfono guarda unas semanas de trabajo y no meses; la bajada desde cero baja lo vigente y no la historia; Administración muestra lo que importa.
- **En contra:** lo revisado de hace más de 30 días ya no se ve en el teléfono (se ve en oficina). La tarea periódica usa la conexión del dueño para compactar.

## Cuándo revisarla

- Los técnicos piden consultar en el teléfono levantamientos de hace más de 30 días.
- El registro compactado sigue creciendo de forma que la bajada desde cero se vuelve lenta.
