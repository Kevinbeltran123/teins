[Plan de entrega](../plan-de-entrega.md) · Anterior: [Iteración 6 · Administración](06-administracion.md) · Siguiente: [Iteración 8 · Producción provisional, copias y simulacro](08-produccion-provisional.md)

# Iteración 7 · Gestión de visitas y clientes

**Estado en el mapa al 2026-10-16:** Terminada y desplegada en el entorno de pruebas; probada en iPhone el 2026-09-25 (el aviso de visita cancelada se corrigió y se confirmó ese día)

**Estado:** terminada y desplegada el 2026-09-25 (Kevin aceptó la recomendación: "Ok. Hazlo").

**Para qué:** que oficina programe el trabajo de campo sin comandos: clientes con sus sitios, visitas con fecha, motivo y técnicos, y los cambios de agenda (reasignar, reprogramar, cancelar) llegando solos a los teléfonos por la bajada del corte 2.

## Alcance

- **Quién:** cualquier persona de oficina (programar es trabajo de oficina, no de administración). Supuesto de P2 vigente: oficina programa y asigna; el técnico no crea visitas.
- **Clientes:** lista con sus sitios; crear un cliente con su primer sitio; agregar sitios. Datos mínimos (regla 18): nombre del cliente, nombre y dirección del sitio.
- **Visitas:** lista en tres vistas (próximas, anteriores, canceladas) con técnicos y avance deducido de sus levantamientos (modelo de dominio, sección 5); programar (cliente, sitio, motivo, fecha, técnicos); reasignar técnicos (regla 17); reprogramar fecha y motivo; cancelar con motivo, el único estado explícito.
- **Campo:** una visita cancelada sale del teléfono como una reasignada; si ya tenía levantamientos empezados, se conservan y se pueden enviar (regla 17), con el aviso "Oficina canceló esta visita".
- **Concurrencia:** cada cambio de una visita lleva la versión que se tenía abierta; si otra persona la cambió antes, se rechaza (QA-25).
- **Auditoría:** cliente creado, sitio agregado, visita creada, reasignada, reprogramada y cancelada.

## Fuera de la iteración 7

| Qué | Dónde se resuelve |
|---|---|
| Corregir el nombre de un cliente o la dirección de un sitio | Cuando TEINS lo pida; exige avisar a los teléfonos con visitas de ese sitio |
| Contactos del cliente | Cuando TEINS diga qué datos necesita el técnico (regla 18) |
| Calendario semanal o por técnico | Después del piloto, si la lista no alcanza |
| Visita no programada creada en campo | Solo si TEINS responde P2 distinto al supuesto |
| Aviso push de visitas nuevas | Después del piloto (ADR-0014) |

## Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Extremo a extremo: oficina crea un cliente con su sitio, programa una visita y el técnico la ve en su teléfono; la reprograma y el teléfono muestra la fecha nueva; la cancela y sale del teléfono | Cumplido en Chromium y WebKit en local y en Chromium contra el entorno (`e2e/pruebas/programacion.spec.ts`) |
| 2. Reasignar y cancelar conservan los levantamientos empezados, que se pueden enviar | Cumplido en integración (`pruebas/visitas.test.ts`: envío a una visita reasignada y cancelada) y en campo (`motor.test.ts`: la visita cancelada con algo empezado se queda con su motivo) |
| 3. Dos personas cambiando la misma visita: la segunda recibe "otra persona la cambió" | Cumplido en integración (409 `conflicto_de_version`) |
| 4. Técnicos no programan; nada cruza organizaciones; cada cambio queda en la auditoría | Cumplido en integración, con las cadenas de cliente y de visita verificadas |
| 5. Desplegado en el entorno de pruebas con el extremo a extremo en verde contra él | Cumplido el 2026-09-25 (migración 0013 aplicada por `campo`) |

## Decisiones tomadas al construirlo

- **Cancelar reutiliza la salida del alcance** del corte 2: el teléfono ya sabe retirar una visita y conservarla si tiene algo empezado. La bajada agrega `motivo` (`reasignada` o `cancelada`) a `fuera_de_alcance`, como expansión (ADR-0015): una app anterior no lo lee y muestra "se asignó a otra persona"; la nueva dice "Oficina canceló esta visita". La versión de la app no cambia (sigue en 3).
- **Una visita cancelada no vuelve a los teléfonos:** `asignadas` la excluye aunque luego llegue otro cambio, y no se puede reasignar, reprogramar ni volver a cancelar (`estado_invalido`). Cancelar es definitivo; si hace falta, se programa otra. Los levantamientos de una visita cancelada se siguen recibiendo (regla 17) y cuentan en su avance.
- **Reprogramar** cambia fecha y motivo y avisa a los técnicos asignados con un cambio de la visita; el teléfono la reemplaza en la siguiente bajada.
- **Concurrencia:** reasignar, reprogramar y cancelar llevan la versión de la visita (la columna ya existía); con otra versión, `conflicto_de_version` (409) con `versionActual`. El formulario queda abierto y reintenta con la versión recién leída. El comando `reasignar-visita` sigue sin versión.
- **Avance deducido** con un conteo por estado que aporta `levantamientos` (`conteosPorVisita`). `visitas` no importa `levantamientos` (sería un ciclo, porque `levantamientos` usa `visitas`): recibe esa función al componer el rol web en `app.ts`.
- **Técnicos asignables:** solo técnicos activos de la organización, validados en el servidor contra `identidad.tecnicosActivos`; nueva operación `listarTecnicos` para oficina.
- **Vistas:** "próximas" desde hoy (fecha del navegador, que envía oficina en la consulta: el servidor no supone zona horaria), completas y por fecha ascendente; "anteriores" y "canceladas", las 100 más recientes. Índice nuevo por organización y fecha.
- **Motivo:** en oficina, las tres opciones del lenguaje común (mantenimiento, cotización, modificación); el contrato lo sigue aceptando como texto, por las visitas que ya existían.
- **Componentes nuevos en `ui`:** `CampoSeleccion` (lista nativa, para clientes y sitios) y fecha en `CampoTexto`.
- **Auditoría:** `cliente_creado` y `sitio_agregado` en la cadena del cliente; `visita_reprogramada` (antes y después) y `visita_cancelada` (con su motivo) en la de la visita, junto a las que ya existían.

## Al cerrarlas (iteraciones 6 y 7)

**Iteraciones 6 (administración) y 7 (visitas y clientes) terminadas el 2026-09-25** y desplegadas. Con ellas, TEINS opera el piloto desde las pantallas: solo la primera persona administradora y la publicación de formatos siguen por comando. En el entorno de pruebas, `oficina.prueba` tiene la marca de administrador (activa su segundo factor la primera vez que abre "Administración").
