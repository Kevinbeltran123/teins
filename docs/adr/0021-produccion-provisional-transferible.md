# ADR-0021 · Producción provisional en un proyecto transferible, sin datos reales hasta que pase a TEINS

- **Estado:** Aceptada
- **Fecha:** 2026-09-25
- **Impulsores:** QA-10, QA-18, R5, R10, Ley 1581
- **Depende de:** ADR-0016 (la complementa mientras TEINS no tenga cuenta; no la reemplaza)

## Contexto

ADR-0016 pide que producción viva en cuentas a nombre de TEINS (R10), con copias en varios niveles y un simulacro de restauración antes de operar. Hoy TEINS no tiene cuenta en la plataforma ni dominio propio, y Kevin quiere producción montada y desplegada ya, para no depender de eso cuando llegue el piloto.

Montar producción no es solo desplegar: es tener el entorno recreable desde el repositorio, las copias funcionando y el simulacro hecho. Todo eso se puede preparar sin datos reales. Lo que no se puede, sin la cuenta de TEINS, es guardar información de sus clientes: el acuerdo de confidencialidad (R5) y la Ley 1581 ponen esa responsabilidad en TEINS, no en la cuenta personal de un desarrollador.

## Opciones

| Opción | Descripción |
|---|---|
| A. Esperar la cuenta de TEINS | Preparar copias y simulacro en el entorno de pruebas; producción se monta el día que TEINS tenga cuenta |
| **B. Proyecto aparte y transferible, sin datos reales** | Proyecto `teins-produccion` en el espacio de trabajo de Kevin, separado de pruebas, que se transfiere al de TEINS cuando exista |
| C. Proyecto aparte con datos reales desde ya | Igual que B, pero operando con información real en la cuenta de Kevin |

## Evaluación

| Criterio | A | B | C |
|---|---|---|---|
| Producción lista cuando TEINS llegue (QA-18) | ○ | ● | ● |
| Datos reales solo bajo la responsabilidad de TEINS (R5, R10, Ley 1581) | ● | ● | ○ |
| Copias y simulacro probados en el entorno donde se va a operar (QA-10) | ○ | ● | ● |

## Decisión

**B.** Un proyecto de Railway `teins-produccion`, distinto de `teins-pruebas`, con su propia base, su propio almacenamiento y sus propios secretos, en el espacio de trabajo de Kevin mientras TEINS no tenga el suyo.

- **Sin datos reales** hasta que ocurra una de dos cosas: el proyecto se transfiere al espacio de trabajo de TEINS (Railway lo permite; exige que el destino tenga plan Hobby o Pro), o TEINS autoriza por escrito operar temporalmente en la cuenta de Kevin. Mientras tanto, producción solo tiene la primera persona administradora y datos de verificación.
- **Sin el modo de pruebas:** `ENTORNO_DE_PRUEBAS` no existe en producción, así que `sembrar` se niega a correr.
- **Dominios gratuitos de Railway** (`*.up.railway.app`), uno por superficie, con HTTPS. Un dominio propio se agrega después junto a ellos; no hay QR entregados que se rompan, porque no hay clientes reales todavía.
- **Recreable desde el repositorio:** `.railway/railway.ts` (infraestructura como código de Railway) describe servicios, base, almacenamiento y variables, y se aplica igual a pruebas y a producción; los secretos nunca están en el archivo (`preserve()`), los genera un comando de montaje sin mostrarlos.
- **Copias, en los niveles de ADR-0016:** recuperación a un punto en el tiempo y copias diarias del volumen de Postgres (nivel 1); volcado lógico diario y copia de los archivos fuera del proyecto (nivel 2); objetos inmutables (nivel 3); simulacro documentado antes de la primera transferencia y después de forma periódica (nivel 4).

## Por qué gana a cada alternativa

- **Frente a A:** el día que TEINS tenga cuenta, producción estaría por construir y el simulacro por hacer. Con B solo falta transferir.
- **Frente a C:** pondría información de clientes de TEINS bajo la cuenta personal de un desarrollador, sin la autorización de quien responde por ella.

## Consecuencias

- **A favor:** el entorno, las copias y el simulacro quedan probados antes del piloto; transferir es un trámite, no una migración.
- **En contra:** Kevin paga producción mientras tanto (se mitiga con la alerta de gasto del espacio de trabajo y con la base casi vacía). El volcado fuera del proyecto queda, por ahora, en otro proyecto de Railway: sobrevive a que se borre el de producción, pero no a perder la cuenta. Cumplir del todo el nivel 2 exige un almacenamiento de otro proveedor, que se configura en cuanto TEINS o Kevin abran esa cuenta (solo cambian variables).

## Cuándo revisarla

- TEINS crea su espacio de trabajo: se transfiere el proyecto y esta decisión se da por cumplida.
- TEINS autoriza por escrito operar en la cuenta de Kevin: se registra la autorización y la fecha en que se transferirá.
- El piloto tiene fecha y TEINS aún no tiene cuenta: se escala, porque operar sin ella contradice R10.
