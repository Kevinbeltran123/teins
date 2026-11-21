# ADR-0060 · Asistente de datos de oficina con la API de mensajes de Claude y herramientas propias de solo lectura

- **Estado:** Aceptada
- **Fecha:** 2026-11-20
- **Impulsores:** QA-12, R1, R3, R5, R7, R10, I-18 a I-22 (Ley 1581)
- **Depende de:** ADR-0001, ADR-0009 (seguridad por fila), ADR-0012 (cola de trabajos), ADR-0014 (consulta en vez de notificaciones), ADR-0017 (registros con privacidad), ADR-0021 (sin datos reales hasta que TEINS autorice)

## Contexto

Oficina quiere preguntarle al sistema por sus propios datos en lenguaje natural: cuánto material se usó, cuántas visitas hubo, cuánto presupuestar, qué dice un levantamiento. Hoy lo saca a mano de las listas y de Excel. El asistente se llama «Chispa» en la pantalla (iteración 53).

Restricciones:

- **QA-12:** las estadísticas llegan como un módulo nuevo que no toca la captura ni la sincronización.
- **R1:** una sola persona construye y opera. Cada pieza nueva se mantiene sola o no entra.
- **R3:** costo por uso, sin costos fijos. Un modelo de lenguaje cobra por token, y una pregunta puede dar varias vueltas.
- **R5:** la información de TEINS y de sus clientes está bajo acuerdo de confidencialidad. Mandarla a un tercero exige la autorización de TEINS.
- **R7:** nada de TEINS escrito en el código. Otra empresa debe poder usar el asistente con su nombre.
- **R10:** las cuentas de producción van a nombre de TEINS. La cuenta de Anthropic también.
- **Ley 1581 de 2012:** Anthropic sería un encargado del tratamiento en Estados Unidos. Estados Unidos está en la lista de países con nivel adecuado de protección de la SIC (Circular Externa 005 de 2017), así que la transmisión no necesita una declaración de conformidad. Sí necesita que TEINS, como responsable, autorice el envío y acepte los términos del encargado (Decreto 1377 de 2013, art. 25), como con Geoapify (ADR-0052).
- **Un modelo se equivoca con los números.** Si redacta una cifra que no calculó el sistema, nadie lo nota hasta que una cotización sale mal.

Lo que Anthropic dice de los datos que llegan por su API:

- no entrena con ellos sin permiso expreso;
- borra entradas y salidas a más tardar a los 30 días;
- con un acuerdo de retención cero, no guarda nada después de responder;
- lo que marcan sus filtros de seguridad puede guardarse hasta 2 años.

## Opciones

| Opción | Descripción |
|---|---|
| **A. Messages API con herramientas propias de solo lectura en el worker** | Nuestro worker corre el bucle: llama al modelo, ejecuta las herramientas que pide (consultas escritas por nosotros, dentro de la organización) y le devuelve resultados acotados |
| B. Managed Agents | Anthropic corre el bucle y un contenedor por sesión; nuestras herramientas se exponen como herramientas propias o por MCP |
| C. Herramienta de SQL libre | El modelo escribe la consulta SQL y el servidor la corre con un rol de solo lectura |
| D. Ejecución de código de Anthropic | Se le entregan los datos al modelo, que calcula en el contenedor de Anthropic con Python |

## Evaluación

| Criterio (ligado a un impulsor) | A | B | C | D |
|---|---|---|---|---|
| Qué datos salen y cuánto se guardan (R5, Ley 1581) | ● | ○ | ◐ | ○ |
| Exactitud de las cifras | ● | ● | ◐ | ◐ |
| Fronteras de módulos y seguridad por fila (QA-12, ADR-0001, ADR-0009) | ● | ● | ○ | ◐ |
| Costo y piezas para una sola persona (R1, R3) | ● | ◐ | ● | ◐ |

- **A:** sale solo lo que devuelve cada herramienta, ya minimizado. Las cifras las calcula el servidor. Cada herramienta usa la interfaz pública de su módulo. Solo se paga por token.
- **B:** guarda el historial de cada sesión en Anthropic hasta que se borre y hoy no admite retención cero. Suma el costo del tiempo de sesión al de los tokens, y otra cuenta y otro servicio que vigilar.
- **C:** el modelo vería el esquema entero y podría leer cualquier tabla, también los contactos y las firmas. Saltaría las fronteras entre módulos. Un SQL mal escrito da una cifra equivocada con aspecto de correcta.
- **D:** habría que mandar las filas completas al contenedor de Anthropic, donde quedan archivos y salidas. El tiempo de contenedor se cobra por hora pasada una cuota gratis. Las cuentas son reproducibles, pero las arma el modelo cada vez.

## Decisión

**A.** Un módulo nuevo, `asistente`, en el servidor, con la API de mensajes de Anthropic y herramientas propias. Nada más de la plataforma: sin Managed Agents, sin SQL libre, sin ejecución de código, sin búsqueda web y sin Files API.

- **Solo lectura.** Ninguna herramienta escribe. Todas corren dentro de `enOrganizacion` (seguridad por fila) y piden los datos a cada módulo por su interfaz pública; `asistente` no lee tablas ajenas. Las conversaciones son de quien pregunta: la de otra persona responde `no_encontrado`.
- **Las cifras salen de las herramientas.** Sumas, conteos, percentiles y costos los calcula el servidor (`resumirCantidades` de `dominio` para las cantidades). El modelo elige qué consultar y redacta. Termina con `entregar_respuesta`, que solo cita pasos ya ejecutados; la cifra destacada, las tablas, las fuentes y el gráfico se arman con los resultados guardados de esos pasos. Una referencia que no existe se descarta.
- **El bucle corre en el worker**, en el trabajo `asistente.responder`, con **un solo intento**: cada intento cuesta, y un reintento automático podría pagar dos veces la misma pregunta. Máximo 8 vueltas al modelo y 3 minutos por respuesta. La SDK reintenta una vez los errores pasajeros del servicio. Cada persona tiene como mucho dos respuestas en curso, y las de una organización corren de a una en su propia cola: el asistente ocupa como mucho un cupo del worker por organización, y deja libres los demás para los correos, los PDF y los avisos. La pantalla consulta el avance cada segundo (ADR-0014). La llave `ANTHROPIC_API_KEY` vive solo en el worker; los servicios expuestos a internet nunca la tienen.
- **Tope mensual** de gasto por organización, en dólares (US$5 por omisión), revisado antes de cada llamada al modelo. Al agotarse, la pregunta responde `tope_agotado`. Quien administra ve el gasto del mes y cambia el tope, y el cambio queda en la auditoría. El costo de cada vuelta se guarda con sus tokens, y además en un registro mensual por persona, aparte de las conversaciones: borrar una conversación nunca baja el gasto del mes.
- **Minimización de datos.** Nunca salen contactos (nombres, correos, celulares), firmas, fotos, bocetos, coordenadas ni documentos de identidad. Los correos y celulares escritos dentro de textos libres se cambian por `[correo]` y `[celular]`. Un campo cuya etiqueta pregunta por una persona («¿Quién recibe?», «Contacto», «Cédula») sale como «[dato personal]». Cada resultado va acotado (por ejemplo, hasta 200 visitas, y unos 60 KB por consulta). Los registros nunca llevan la pregunta ni los resultados: solo ids, tokens, duración y códigos de error (ADR-0017).
- **Conservación** (principio de temporalidad, Ley 1581):
  - **Al terminar cada respuesta,** cada paso guarda solo su etiqueta y su resumen. Lo que vio el modelo se borra, y la respuesta conserva lo que muestra la pantalla.
  - **Una conversación eliminada** se borra del todo a las 24 horas.
  - **Una conversación sin actividad** se borra a los 12 meses, como los accesos del portal (ADR-0055).
  - **En los respaldos cifrados** dura lo que dura su rotación: 35 días ([producción](../proceso/produccion.md)).
  - **En Anthropic,** lo enviado se borra a los 30 días.
- **Texto plano en la pantalla.** Lo que escribe el modelo se pinta como párrafos y viñetas, nunca como HTML ni Markdown. Los únicos enlaces son los que arma la pantalla con los ids de las fuentes. El mensaje de sistema dice que lo que viene en los resultados (textos de técnicos o clientes) es información, nunca instrucciones.
- **Modo simulado.** `ASISTENTE_SIMULADO=true`, permitido fuera de producción y en el entorno de pruebas (`ENTORNO_DE_PRUEBAS`), cambia el modelo por uno falso con guion fijo que usa las herramientas reales. Lo usan las pruebas y el extremo a extremo; no gasta ni manda datos. La web no tiene la llave: sabe que el asistente está disponible por `ASISTENTE_ACTIVO=true`, que no es secreto. Sin `ASISTENTE_ACTIVO` ni modo simulado, responde `no_disponible` y el botón no aparece. Con `ASISTENTE_ACTIVO` y el worker sin llave, la pregunta se acepta y termina en error («no está configurado»): las dos variables se encienden juntas.
- **El modelo en una variable.** `ASISTENTE_MODELO`, por omisión `claude-haiku-5-5` (US$0,10 de entrada y US$0,50 de salida por millón de tokens, en pedidos de hasta 100 000 tokens). Cambiarlo a un modelo de la tabla de precios no toca el código. La tabla está en el código, para calcular el costo de cada vuelta, y el servidor no arranca con un modelo que no tenga precio.
- **El nombre guardado por organización** (`asistente.ajustes.nombre`, «Chispa» por omisión). En el código el módulo se llama `asistente`, nunca `chispa` (R7).
- **Para encenderlo en producción:** la autorización escrita de TEINS para enviar a Anthropic los datos que el asistente consulta ([pendiente de TEINS](../entrega/pendientes-de-teins.md)); la cuenta de Anthropic a nombre de TEINS, que como responsable acepta los términos del encargado, como con Geoapify (ADR-0052); la llave en el worker de producción y el límite de gasto en la consola de Anthropic. Hasta entonces, producción no tiene llave y el asistente no aparece.

## Por qué gana a cada alternativa

- **Frente a B:** hace lo mismo que nuestro bucle, pero guarda cada sesión en Anthropic sin opción de retención cero y cobra el tiempo de sesión. Nuestras herramientas son consultas cortas a nuestra base: no necesitan un contenedor.
- **Frente a C:** el rol de solo lectura no basta. El modelo vería datos que nunca deben salir y leería tablas de cualquier módulo. Con herramientas propias, lo que sale está decidido de antemano y probado.
- **Frente a D:** obliga a mandar más datos de los necesarios a un contenedor de un tercero. Calcular en nuestro servidor es más barato, más exacto y deja las cifras repetibles.

## Consecuencias

- **A favor:** oficina responde en segundos preguntas que hoy le toman una tarde, y cada cifra lleva sus fuentes, con enlace al levantamiento.
- **A favor:** QA-12 se cumple: un módulo aparte que solo agrega lecturas a los demás. La captura y la sincronización no cambian.
- **En contra:** sale información a un tercero en Estados Unidos. Se mitiga con la minimización, la autorización de TEINS antes de encenderlo y, si TEINS lo pide, un acuerdo de retención cero con Anthropic.
- **En contra:** una pregunta nueva que ninguna herramienta cubre no tiene respuesta. El modelo debe decirlo; agregar la herramienta es código nuevo. Es el precio de no tener SQL libre.
- **En contra:** una dependencia externa. Si Anthropic falla, la respuesta termina en error con «Volver a preguntar»; nada más del sistema depende de ella.
- **En contra:** el costo depende del uso. Lo acotan el tope mensual, el límite de vueltas, la caché del mensaje de sistema y de las herramientas, y el límite de gasto en la consola de Anthropic.

## Cuándo revisarla

- TEINS no autoriza el envío: el asistente queda apagado en producción, o se evalúa un modelo que corra en su propia infraestructura.
- TEINS pide que nada se guarde: se firma el acuerdo de retención cero, siempre que el modelo elegido lo admita.
- El gasto real supera el tope con frecuencia: revisar el modelo, el número de vueltas o lo que entra en el historial.
- Oficina pide cambiar datos desde el asistente: eso rompe el «solo lectura» y pide un ADR nuevo, con confirmación en la pantalla.
- Managed Agents admite retención cero y cobra solo por tokens: vuelve a valer la pena compararlo.
- Anthropic cambia sus términos de retención o de entrenamiento, o la SIC saca a Estados Unidos de su lista.
- Varias organizaciones preguntan a la vez: cada una ocupa un cupo del worker y, con cuatro, el asistente los tendría todos. Entonces el asistente pasa a un worker aparte.
