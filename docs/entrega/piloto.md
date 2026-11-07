# Piloto

Cómo se prueba la versión 0.9.0 con trabajo real de TEINS y cuándo se da por aceptada. Al aceptarla, se publica como 1.0.0 y empieza la entrega.

## Objetivo

Comprobar, con técnicos y visitas reales, que la información se captura una sola vez en campo (con o sin señal), que oficina la revisa sin transcribir y que el cliente recibe su informe más rápido que hoy.

## Antes de empezar

| Condición | Quién | Estado |
|---|---|---|
| Participantes y visitas del piloto definidos | TEINS | Pendiente (punto 1 de [`pendientes-de-teins.md`](pendientes-de-teins.md)) |
| Autorización para cargar información real en el sistema actual, o el sistema ya a nombre de TEINS | TEINS | Pendiente (punto 5) |
| La dirección web definitiva de la app de los técnicos | TEINS y Kevin | Pendiente. Debe quedar decidida antes de instalar la app en el primer teléfono: cambiarla después obliga a reinstalarla en todos |
| Producción encendida con la versión 0.9.0, los formatos reales publicados y el simulacro de restauración hecho | Kevin | Pasos en [`../proceso/produccion.md`](../proceso/produccion.md), «Encender producción para el piloto» |
| Usuarios creados para cada participante | Kevin u oficina | Desde Administración, en oficina |
| Criterios de aceptación acordados | TEINS y Kevin | Propuesta abajo |

## Participantes y duración

- 2 o 3 técnicos, con su propio celular (iPhone o Android) y al menos uno que trabaje donde suele no haber señal.
- 1 o 2 personas de oficina.
- 2 a 4 semanas, con al menos 15 visitas reales entre los dos formatos (visita técnica y servicio de UPS).
- Clientes reales, con sus contactos dados de alta en el portal para recibir el informe.

## Capacitación (el día de la instalación)

1. Con oficina, 1 hora: el recorrido del [manual de oficina](../manual/oficina.md), programar una visita para cada técnico y crear sus usuarios.
2. Con los técnicos, 30 minutos, en grupos de máximo 5 personas por minuto si comparten el Wi-Fi de la oficina: el sistema frena más de 5 ingresos por minuto desde la misma red.
   - Instalar la app con señal y entrar.
   - Cambiar la contraseña temporal.
   - Hacer un levantamiento de práctica completo, también en modo avión, y enviarlo.
   - Usar el [manual de técnicos](../manual/tecnicos.md).
3. Oficina revisa ese levantamiento de práctica y publica su informe, para ver el recorrido completo.

## Criterios de aceptación (propuesta para acordar con TEINS)

| # | Criterio | Cómo se mide |
|---|---|---|
| 1 | Ningún levantamiento se pierde, aunque se haya hecho sin señal | Todo levantamiento iniciado en el piloto llega a oficina o está en la papelera del técnico. Meta: 100 % |
| 2 | Oficina no transcribe | Ningún informe del piloto se rehízo fuera del sistema. Meta: 100 % |
| 3 | El cliente recibe el informe más rápido que hoy | Tiempo de la visita al envío del informe, comparado con el de hoy (punto 2 de los pendientes). Meta: la mitad o menos |
| 4 | Un técnico nuevo lo usa sin ayuda | Completa una visita después de unos 15 minutos de explicación |
| 5 | Ninguna falla grave sin resolver | Una falla grave es perder información, mostrarle a un cliente algo que no es suyo o no poder enviar. Meta: cero abiertas al cierre |
| 6 | Los participantes lo prefieren al papel | Una encuesta corta al final, de 1 a 5. Meta: 4 o más en promedio |

## Cómo se reportan los problemas durante el piloto

- Cada problema se reporta por el canal que acuerden TEINS y Kevin, con:
  - qué se estaba haciendo;
  - en qué teléfono o computador;
  - la hora;
  - una captura de pantalla si se puede.
- Los arreglos se publican como versiones 0.9.1, 0.9.2 y siguientes. Al abrirla con señal, la app de los técnicos avisa que hay una versión nueva y se actualiza con un toque.
- Una falla grave se atiende el mismo día hábil. Las demás se agrupan y salen juntas.

## Al cierre

1. Revisar los criterios con TEINS, con las cifras del piloto.
2. Si se cumplen: publicar la versión 1.0.0 y seguir con la entrega (transferencia de las cuentas y del código, y acta de entrega).
3. Si no: acordar qué falta, arreglarlo y repetir solo lo que no se cumplió.
