[Plan de entrega](../plan-de-entrega.md) · Anterior: [Iteración 40 · Lo atendido no es la siguiente visita](40-lo-atendido-no-es-la-siguiente-visita.md) · Siguiente: [Iteración 42 · Lo que se ve sale de lo guardado](42-lo-que-se-ve-sale-de-lo-guardado.md)

# Iteración 41 · Nada queda a medias ni crece sin fin

**Estado en el mapa al 2026-10-16:** Desplegada en el entorno de pruebas y en producción con la migración `0038` (2026-10-06)

**Estado:** pedido de Kevin el 2026-10-06, después del fallo de la 40 («Que otro fallo de ese estilo puede haber? revisa»). Una revisión encontró fallos de la misma familia: estados que nadie actualiza, trabajo que se atasca para siempre y datos que nunca se borran. Kevin aprobó arreglarlos en cuatro tandas y desplegar una sola vez al final («despliega cuando ya termines todas las mejoras, con eso nos ahorramos algo de costos»). Aceptó 30 días de retención en el teléfono. Construida, verificada y desplegada en el entorno de pruebas el 2026-10-06 (ADR-0043 y ADR-0044, migración `0038`; `campo` primero, después `worker` y `oficina`). El worker desplegado arrancó con la tarea periódica registrada.

**Tanda 1 · Trabajo atascado para siempre**
- **Lo que espera la app nueva sale al actualizar.** Un envío en «requiere actualizar» no se reanudaba nunca y la pantalla decía «Enviando a oficina…» para siempre. Ahora, al abrir una versión nueva de la app, vuelve a la cola (`reanudarTrasActualizar`).
- **Una foto que el almacenamiento rechaza** ya no se reintenta cada 30 segundos sin fin: espera cada vez más y, al agotar los intentos, pasa a error con un mensaje para el técnico.
- **Un envío rechazado se puede descartar** desde su pantalla, a la papelera de 30 días (ADR-0035). Antes no tenía salida e inflaba para siempre lo «por enviar».
- **Los trabajos del worker que quedaron a medias se recuperan** (ADR-0043): una tarea cada hora (`mantenimiento.recuperar`, la primera periódica del proyecto) vuelve a encolar, con la misma llave, lo que lleva más de 12 horas a medias: PDF «generando», envíos «en cola» y archivos «subidos» sin verificar.

**Tanda 2 · Lo que crecía sin fin** (ADR-0044)
- **En el teléfono:** un levantamiento revisado que oficina recibió hace más de 30 días sale después de cada bajada, con sus fotos, su envío, su estado y su chat. Nunca sale lo que no se ha enviado ni revisado (regla 5).
- **En el servidor:** la tarea periódica borra las sesiones vencidas y compacta el registro de cambios (deja el último cambio de cada entidad por destinatario). La lista de teléfonos de Administración muestra los que tuvieron contacto en los últimos 90 días y los que tienen un borrado pendiente. Los teléfonos no se borran: la orden de borrado de un usuario revocado tiene que poder llegar.

**Tanda 3 · Estado que no se actualizaba**
- **Una visita ya atendida hoy no bloquea archivar el cliente** («primero cancele o reprograme»): «por hacer» excluye las terminadas, las cerradas y las que tienen levantamientos.
- **Campo y oficina se enteran del paso del tiempo** con la app abierta (`useMinuto` en `paquetes/ui`): cada minuto y al volver a la app, una visita pasa a «En curso», aparece «Terminar visita» y, después de medianoche, «Hoy» cambia.
- **«Terminar visita» también está en la fila** de una visita en curso, no solo en la tarjeta principal.
- **Una visita cancelada o reasignada con un borrador a medias** ya no sale como «Siguiente visita» encima de la de hoy: va con las atrasadas.
- **Al desactivar a quien revisa**, lo que tenía en revisión queda sin tomar (`revision_liberada` en el historial). Otra persona lo toma sin reasignar, y las respuestas del técnico le llegan a quien escribió el comentario, no a alguien sin acceso.
- **«Tomar el más antiguo» desde la búsqueda (⌘K)** avisa si otra persona lo tomó primero, en lugar de llevarlo como si fuera suyo.

**Tanda 4 · Menores**
- Un informe con todas sus versiones retiradas dice «Retirado del portal» en la lista de Informes, no «Borrador» (`todasRetiradas`, como en Cotizaciones).
- «Enviar a otro contacto» ofrece el canal por el que el contacto todavía no la recibió (correo o WhatsApp), y manda el canal explícito.
- En Administración, un teléfono con orden de borrado ya no dice «Llame al técnico»; uno ya borrado no muestra lo que tenía pendiente ni su último error.
- Una visita cancelada no aparece en «Visitas para cotizar», y no abre un informe nuevo (`estado_invalido`); el que ya tenía se sigue consultando.
- Mientras el PDF de la vigente se genera, o si falló, oficina dice qué versión ve el cliente («Mientras, el cliente ve la versión 2»).
- La franja de campo ya no cuenta como «subiendo» un envío con error permanente; la pregunta al cerrar sesión sí lo cuenta, porque sigue sin enviar.

**Decisiones tomadas al construirla**
- **Una tarea por hora y no una por organización al bajar:** recuperar trabajos no depende de que un técnico pregunte (ADR-0043). La ventana de 12 horas deja terminar los 10 reintentos de Graphile antes de volver a encolar.
- **Compactar el registro en vez de cortarlo por fecha:** cortar por fecha haría que un teléfono nuevo no bajara una visita vigente programada hace meses (ADR-0044).
- **La tarea periódica se declara como objeto** (`periodicas()` en `servidor/src/tareas.ts`, con `parsedCronItems`). La primera versión usaba el crontab de texto, que no acepta el punto de `mantenimiento.recuperar`: el worker no arrancaba. Las pruebas del servidor no lo vieron porque procesan la cola sin el crontab; lo encontró la e2e, que se quedó en «El servidor está verificando las fotos». Nunca llegó al entorno de pruebas.
- **Fallas intermitentes de WebKit en la e2e:** venían de `conversaciones.spec.ts` (iteración 39), que dejaba abierto su contexto de oficina. La página seguía consultando y redibujando el resto de la corrida, y en WebKit cada clic de campo tardaba hasta 30 s. Fallaba una prueba distinta en cada corrida, y sola pasaba. Ahora los contextos se cierran en un `afterEach`, también si la prueba falla.
- **Desactivar llama a `levantamientos` desde la composición** (`crearIdentidad(…, { alDesactivar })` en `app.ts` y en el comando `desactivar-usuario`), en la misma transacción: identidad no conoce las tablas de otro módulo.
- **Sin cambio, después de revisarlos:**
  - en una visita con dos técnicos, el segundo teléfono la sigue mostrando hasta que alguno la termine, porque puede necesitar su propio levantamiento; «Terminar visita» ya les llega a todos;
  - una visita de todo el día ocupa al técnico todo el día aunque la terminen temprano: así lo decidió el ADR-0037, que lo deja como consecuencia aceptada.

**Evidencia:** `pnpm typecheck`, `arquitectura` (366 módulos), `licencias` (325 paquetes), `audit` sin vulnerabilidades y `presupuesto` (133,6 KB de 135). Pruebas: dominio 116, protocolo 29, documentos 11, oficina 34, campo 128 (agenda con cancelada y borrador, reanudar al actualizar, foto rechazada, descartar el rechazado, retención de 30 días) y servidor 231. Las del servidor cubren la recuperación de trabajos a medias, la poda y compactación, la tarea periódica, «por hacer» sin lo atendido, desactivar a quien revisa, informe retirado, visita cancelada sin informe nuevo ni cotización. Extremo a extremo en Chromium y WebKit: 119 pasan, 3 omitidas y ninguna falla (24,7 min).

## Al cerrarla

**Siguiente: que Kevin pruebe las iteraciones 38 a 41, y la 39 a la 41 también en su iPhone (campo, app 15).** La 41 (sección "Iteración 41") cierra los fallos de la misma familia que el de la 40: trabajo que se atascaba para siempre, datos que crecían sin fin y estado que no se actualizaba. Después: lo que entregue TEINS (precios, plantilla P29, tributario, numeración, símbolos y formatos).

**Producción al día (2026-10-06):** las iteraciones 29 a 41 están en producción. Antes se sacó un respaldo (`20261006T224752Z`); después se desplegó `campo`, que aplicó las migraciones `0033` a `0038`, y luego `worker`, `oficina` y `portal`. El worker arrancó con la tarea periódica y las tres superficies responden. Producción sigue sin formatos publicados hasta que TEINS entregue los suyos.

**Producción apagada (2026-10-10):** sin datos reales costaba lo mismo que el entorno de pruebas y el gasto iba a pasar el límite de USD 10 del mes. Sus servicios no tienen despliegue activo, con la base y la configuración intactas; cómo encenderla está en `docs/proceso/produccion.md`. El entorno de pruebas sigue igual.
