# ADR-0037 · Visitas con horario: todo el día, de una hora a otra o hasta que el técnico la termine

- **Estado:** Aceptada
- **Fecha:** 2026-10-02
- **Impulsores:** QA-25 (cambios concurrentes), regla 4 (idempotencia), regla 9 (permisos en el servidor), ADR-0015 (expansión del protocolo)
- **Depende de:** ADR-0003, ADR-0005 (bajada), ADR-0023 (avisos)

## Contexto

Una visita era de un día entero (`programada_para date`). Oficina necesita decir "mantenimiento de 9 a 12, cotización de 4 a 5" y, a veces, "empieza a las 2 y no sé cuánto dura". Al programar, solo deben aparecer los técnicos libres a esa hora. Kevin precisó (2026-10-02): sin hora de fin, el técnico queda ocupado desde el inicio hasta que marque en su teléfono que terminó. Nadie marcaba una visita como terminada: su avance se deducía de los levantamientos.

## Opciones

| Opción | Descripción |
|---|---|
| A. Inicio y duración obligatorios | Toda visita con hora y fin |
| B. Horario opcional con tres formas | Todo el día, de una hora a otra, o desde una hora sin fin, que el técnico termina |
| C. Agenda por bloques de calendario | Calendario por técnico con arrastrar y soltar |

## Evaluación

| Criterio | A | B | C |
|---|---|---|---|
| Cubre lo que pidió oficina | ◐ | ● | ● |
| Lo ya programado sigue igual (expansión) | ○ | ● | ◐ |
| Funciona sin señal en campo | ● | ● | ● |
| Costo | ● | ◐ | ○ |

## Decisión

B, con estas reglas:

- **Datos:** `hora_inicio` y `hora_fin` (`time`, opcionales), `terminada_en` y `terminada_por` (migración `0033_horario_visitas`, solo agrega columnas). El fin exige el inicio y va después (restricción `visitas_horario_valido` y validación del contrato).
- **Lo que ocupa una visita ese día** (`intervaloDe` en el servidor, `intervalo` en oficina, el mismo criterio): sin inicio, todo el día; con fin, de inicio a fin; sin fin, de inicio hasta que la terminan o hasta el final del día. Tocar el borde no cruza (de 9 a 12 y de 12 a 1 conviven).
- **Cruces:** `programarVisita`, `reprogramarVisita` y `reasignarVisita` (solo los que entran) responden `tecnico_ocupado` (409, con `ocupados`) si un técnico ya tiene otra visita que se cruza, aunque se llame a la API sin pasar por la pantalla. Un bloqueo transaccional por organización y día (`pg_advisory_xact_lock`) serializa a quienes programan a la vez. El comando `crear-visita` no valida cruces (es una herramienta de administración).
- **Oficina:** `ocupacionDeTecnicos` (GET `/api/visitas/ocupacion?fecha=`) da lo que ocupa a cada técnico; "Programar visita" muestra solo los libres y aparte los ocupados con el motivo.
- **Terminar:** `terminarVisita` (POST `/api/visitas/{id}/terminar`, política técnico, con `llave` y la hora declarada por el teléfono, nunca futura). Solo un técnico asignado; repetirlo devuelve la primera. Queda en la auditoría (`visita_terminada`) y baja a los demás técnicos de la visita. Reprogramar a otro día u otra hora la deja otra vez por hacer.
- **Campo:** la visita baja con su horario y su terminación (campos opcionales, ADR-0015); la app pasa a la versión 12 para volver a bajar todo y recibir el horario de lo ya asignado. "Terminar visita" se guarda en el teléfono al instante y sale en la siguiente sincronización, con su llave.
- **Avisos:** dicen la hora cuando la hay ("Para el vie 2 oct, a las 9:00 a. m.") y avisan un cambio solo de hora.

## Por qué gana a cada alternativa

- **Frente a A:** obligaría a inventar una duración y rompería lo ya programado.
- **Frente a C:** es una agenda completa; hoy basta con elegir hora y ver quién está libre.

## Consecuencias

- **A favor:** "Terminada" es el primer estado explícito de la visita además de "Cancelada" (modelo de dominio, sección 5); la disponibilidad la decide el servidor.
- **En contra:** dos visitas de todo el día para el mismo técnico el mismo día ya no se pueden programar desde oficina (se mitiga: es justo lo que dice "todo el día"). Un técnico que olvida terminar una visita sin fin queda ocupado hasta el final de ese día.

## Cuándo revisarla

Si oficina pide ver la agenda de cada técnico como calendario, o visitas de varios días.
