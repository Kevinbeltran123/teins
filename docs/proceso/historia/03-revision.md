[Plan de entrega](../plan-de-entrega.md) · Anterior: [Corte 2 · Bajada](02-bajada.md) · Siguiente: [Corte 4 · Informe](04-informe.md)

# Corte 3 · Revisión

**Estado en el mapa al 2026-10-16:** Terminado y desplegado en el entorno de pruebas; probado en iPhone el 2026-09-25

**Estado:** construido y desplegado en el entorno de pruebas el 2026-09-25. Kevin pidió continuar sin revisar el alcance antes; puede ajustarlo sobre esta sección.

**Para qué:** que oficina revise un levantamiento enviado sin pisarse entre personas (QA-25, I-1) y que cada corrección quede con quién, cuándo, qué campo, valor anterior y nuevo, verificable (QA-8, ADR-0008). El técnico ve el estado y los comentarios en su teléfono.

## Alcance

**Dominio:** estados enviado → en revisión → revisado. Corrección de un campo con el mismo validador de campo y de envío (reglas 3 y 5), que devuelve el cambio (ruta, anterior, nuevo). Marcar revisado exige respuestas válidas.

**Protocolo (tareas explícitas, ADR-0014):** tomar para revisar (con reasignación explícita si otra persona la tiene), corregir campos, marcar revisado, comentar, historial del levantamiento. Cada guardado lleva la versión que la persona tenía abierta; si otra guardó antes, se rechaza con `conflicto_de_version` (ADR-0005, patrón 2). La bandeja filtra por estado y muestra quién tiene la toma.

**Servidor:** estados y responsable de la revisión en `levantamientos`; comentarios como tabla propia (solo insertar y leer); auditoría por campo en la misma transacción (toma, reasignación, corrección, marca de revisado, comentario); historial legible con verificación de la cadena. Cambios de estado y comentarios bajan al técnico; una app anterior (versión 2) recibe "enviado" para no romper su contrato (ADR-0015, N-1).

**Oficina:** bandeja con "Esperando revisión", "En revisión" y "Revisados"; el punto focal es el más antiguo con "Tomar para revisar" (DESIGN.md). Pantalla de revisión: toma, corrección por campo con motivo opcional, aviso cuando otra persona guardó antes, marcar revisado, comentarios al técnico e historial de cambios.

**Campo:** estado según el servidor ("En revisión en oficina", "Revisado por oficina") y comentarios de oficina en el levantamiento enviado. `VERSION_APP` pasa a 3.

## Fuera del corte 3

| Qué | Dónde se resuelve |
|---|---|
| Reabrir un levantamiento revisado | Corte 4: depende de si ya está en un informe publicado |
| Corregir fotos desde oficina (quitar o agregar) | Iteración posterior; hoy solo texto, medida y "no se pudo obtener" |
| Devolución formal al técnico | Fuera de alcance del modelo de dominio; el comentario no reabre el borrador |
| Rol supervisor | Cuando TEINS defina qué hace |
| Verificación periódica de las cadenas en el worker | Iteración de operación; hoy la verificación es por levantamiento, bajo demanda |

## Preguntas a TEINS

P7, P8 y P9 (formatos prioritarios, obligatorios reales y errores frecuentes). No bloquean: el corte se construye con el formato de prueba.

## Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Extremo a extremo: oficina toma, corrige una medida, comenta y marca revisado; el técnico ve "Revisado por oficina" y el comentario | Cumplido en Chromium y WebKit, en local y contra el entorno (`e2e/pruebas/revision.spec.ts`) |
| 2. Dos personas de oficina: el segundo guardado sobre la misma versión se rechaza y se avisa, sin perder nada (QA-25), en integración y en extremo a extremo | Cumplido: guardados simultáneos en `servidor/pruebas/revision.test.ts` y reasignación con guardado en curso en el extremo a extremo |
| 3. Cada corrección queda en auditoría con ruta, valor anterior y nuevo, autor y correlación; la cadena del levantamiento verifica íntegra (QA-8) | Cumplido en integración y visible en el historial de oficina |
| 4. Solo quien tomó la revisión corrige y marca revisado; el técnico no; la reasignación queda registrada | Cumplido en integración y extremo a extremo |
| 5. Una app de campo versión 2 sigue leyendo la bajada | Cumplido en integración (recibe "enviado", sin comentarios) |
| 6. Pantallas solo con componentes de `ui`, con estados vacío, cargando, error y sin conexión; reglas de arquitectura en verde | Cumplido |
| 7. Desplegado en el entorno de pruebas con el extremo a extremo en verde contra él | Cumplido el 2026-09-25; la regresión de los cortes 1 y 2 también pasa contra el entorno |

## Decisiones tomadas al construirlo

- **Tareas explícitas con la versión vista en el cuerpo** (`tomar`, `correcciones`, `marcar-revisado`, `comentarios`, ADR-0014). El servidor compara la versión y actualiza con `WHERE version = ?`: el primer chequeo da un aviso claro y el `UPDATE` resuelve la carrera entre dos guardados simultáneos. El rechazo lleva `versionActual`.
- **Toma de revisión:** tomar lo propio otra vez responde el estado sin cambiar nada; quitársela a otra persona exige `reasignar` y queda como `revision_reasignada` con el responsable anterior y el nuevo. El rechazo `tomado_por_otro` dice quién la tiene.
- **Corrección:** mismas reglas del envío por campo (`validarCampo` de `dominio`); reescribir el mismo valor no es un cambio ni deja registro; las fotos no se corrigen desde oficina (`no_corregible`); un registro de auditoría por campo, todos con la correlación del guardado y el motivo opcional.
- **Marcar revisado** exige respuestas válidas contra su formato.
- **Comentarios:** cualquier persona de oficina comenta, aunque no tenga la revisión; no cambian la versión ni el estado; pueden apuntar a un campo, que se valida contra el formato. Tabla propia de solo insertar y leer, y evento `comentario_agregado` en la cadena.
- **N-1 en la bajada:** `APP_CON_REVISION = 3`. A una app de campo versión 2 se le manda "enviado" y sin comentarios, porque su contrato no conoce los estados nuevos y rechazaría la bajada entera. Probado en integración.
- **Campo sin versión nueva de Dexie:** estado y comentarios viven en `estadosServidor`, sin índices nuevos.
- **Historial legible:** oficina ve nombres, no identificadores, y la verificación de la cadena del levantamiento en cada consulta ("Historial íntegro").
- **`ui` crece:** `Pestanas` (patrón WAI-ARIA), `CampoTextoLargo` (acepta `ref`) y los tonos de marquilla "revision" y "revisado", que ya existían en los tokens.
- **Extremo a extremo remoto con reintentos:** `railway ssh` falla de vez en cuando; los comandos de administración de la prueba se repiten hasta tres veces (uno ya aplicado falla al repetirse, no duplica).
- **Una sola acción amarilla:** en la revisión es "Tomar para revisar" o "Marcar revisado"; "Guardar corrección" es secundaria. Los botones nombran el dato ("Corregir potencia nominal", "Comentar potencia nominal").
