# ADR-0046 · Descartar un envío en error

- **Estado:** Aceptada (Kevin, 2026-10-16)
- **Fecha:** 2026-10-16
- **Impulsores:** QA-1 (cero pérdida de lo ingresado), QA-3 (sin conflictos de edición), I-3 (borrados que deben sincronizarse), regla 5 (nunca borrar lo que no se ha enviado)
- **Depende de:** ADR-0003 (sincronización), ADR-0035 (descartar borradores), ADR-0045 (volver a borrador). Amplía 0035.

## Contexto

ADR-0035 solo permite descartar en campo un borrador que nunca se envió. ADR-0045 (punto 3) puso «Descartar levantamiento» también en la pantalla del envío rechazado, y el código ya lo hace, pero ningún ADR lo decidió.

Hay rechazos que el técnico no puede corregir volviendo a borrador: otra persona ya envió ese levantamiento (`conflicto`) o el identificador ya existe. Sin descartar, el levantamiento queda para siempre en Mis visitas como «No se pudo enviar».

Un envío en `error` es un rechazo permanente: el servidor revirtió la transacción y no guardó nada con esa llave (ADR-0045). Mientras el teléfono no tenga estado del servidor para ese levantamiento, oficina nunca lo recibió y lo único que existe es lo del teléfono.

## Opciones

| Opción | Descripción |
|---|---|
| A. Descartar a la papelera | El envío en error se descarta igual que un borrador: 30 días en Descartados y después se borra |
| B. Borrar al instante | Se borra del teléfono con su envío y sus fotos al confirmar |
| C. No descartar | Solo reintentar o volver a borrador |

## Decisión

**A.**

1. **Qué se descarta:** un borrador nunca enviado (ADR-0035) o un levantamiento enviado cuyo envío está en `error`. Nada más: ni uno con el envío en cola, enviando, esperando sesión o actualización, ni uno recibido.
2. **Dónde:** en la pantalla del envío rechazado, junto a «Reintentar envío» y «Volver a borrador para corregir», solo si oficina no lo recibió (sin estado del servidor). Es una confirmación irreversible que dice que oficina nunca lo recibió y que no queda otra copia.
3. **Papelera:** la misma de ADR-0035. Sale de Mis visitas y queda 30 días en Descartados. Recuperarlo lo devuelve tal como estaba, con su envío en `error`.
4. **El envío:** sigue en la cola local en `error`, que no se reintenta solo. Mientras está en la papelera no cuenta como pendiente en el inicio ni en la salud del teléfono. Al vaciar la papelera se borra con el levantamiento.
5. **Los archivos:** en el teléfono, se borran al vaciar la papelera si ningún otro levantamiento los usa; mientras tanto la limpieza de archivos sin uso los respeta. Las fotos que ya subieron al servidor quedan ahí sin referencia, como cualquier archivo sin uso (ADR-0007).
6. **El servidor no se entera:** no hay nada suyo que anular. Si tenía visita, la visita sigue sin levantamiento.

## Por qué gana a cada alternativa

- **Frente a B:** un descarte por error borraría trabajo que solo existe en el teléfono (QA-1), igual que en ADR-0035.
- **Frente a C:** un `conflicto` vuelve a fallar después de corregir, y el levantamiento quedaría atascado en Mis visitas.

## Consecuencias

- **A favor:** ningún rechazo deja un levantamiento atascado. El técnico decide entre corregir (ADR-0045) y descartar, y puede deshacer el descarte durante 30 días.
- **En contra:** un técnico podría descartar un rechazo que se corregía volviendo a borrador (mitigación: las dos opciones salen juntas y la confirmación dice que no queda otra copia). Las fotos subidas quedan sin referencia en el servidor hasta que se implemente la limpieza de ADR-0007.

## Dónde vive

- `paquetes/campo/src/datos/dexie.ts`: `descartar`, `recuperar`, `vaciarPapelera`, `limpiarArchivosSinUso`, `volverABorrador`.
- `paquetes/campo/src/datos/modelo.ts`: `EstadoEnvio` (`error`), `DIAS_EN_LA_PAPELERA`.
- `paquetes/campo/src/pantallas/Captura.tsx`: `Enviado` (las acciones del envío rechazado).
- `paquetes/campo/src/sincronizacion/almacen.ts`: `salud`; `paquetes/campo/src/pantallas/Inicio.tsx` (lo descartado no está por enviar).
- Pruebas: `paquetes/campo/src/datos/repositorio.test.ts`, «uno enviado que oficina rechazó para siempre sí se descarta…».

## Cuándo revisarla

- Si oficina necesita ver los envíos rechazados que se descartaron.
- Si aparece un `error` después de que oficina ya recibió el levantamiento: ahí no se descarta, porque edita oficina.
