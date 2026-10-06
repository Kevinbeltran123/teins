# ADR-0043 · Una tarea periódica recupera los trabajos que quedaron a medias

- **Estado:** Aceptada
- **Fecha:** 2026-10-06
- **Impulsores:** QA-17 (el mismo PDF siempre), ADR-0012 (cola de trabajos), ADR-0028 (envíos al cliente)
- **Depende de:** ADR-0012. Agrega su primera tarea periódica.

## Contexto

Los trabajos del worker (generar el PDF de un informe o una cotización, enviarlo al cliente, verificar un archivo subido) reintentan solos y, al agotar los intentos, dejan un estado final: «fallido» o «No llegó». Una revisión del 2026-10-06 encontró que, si el último intento falla justo al escribir ese estado final (la base no responde en ese instante), o si el trabajo se pierde, la fila queda a medias para siempre:
- un PDF en «generando», con sus envíos «en cola»;
- un envío «en cola» que ya salió o que nunca sale;
- un archivo «subido» sin verificar, con lo que publicar el informe que lo usa falla siempre.

El worker no tenía ninguna tarea periódica (`crontab: ""`).

## Opciones

| Opción | Descripción |
|---|---|
| A. Nada | Oficina lo ve atascado y se arregla a mano en la base |
| B. Tarea periódica que vuelve a encolar | Cada hora, lo que lleva más de 12 horas a medias se encola de nuevo con la misma llave del trabajo |
| C. Marcar fallido lo viejo | La tarea da por fallido lo atascado, sin volver a intentar |

## Decisión

**B.**
1. **`mantenimiento.recuperar`** corre cada hora (`crontab` del worker) y recorre las organizaciones. Cada módulo recupera lo suyo por su interfaz pública: informes y cotizaciones (PDF «generando» y envíos «en cola» de versiones con el PDF listo) y archivos («subido» sin verificar).
2. **Más de 12 horas a medias:** una ventana de reintentos de Graphile con 10 intentos dura unas 10 horas. Volver a encolar antes reiniciaría los intentos de un trabajo que todavía está reintentando, y nunca llegaría a su estado final.
3. **La misma llave del trabajo** (`informes.generarPdf:<id>`, `envios.enviar:<id>`, `archivos.verificar:<org>:<huella>`): si el trabajo todavía existe, Graphile lo reemplaza en vez de duplicarlo.
4. Los trabajos ya son idempotentes: un correo se repite con la misma llave y el proveedor lo descarta, y un WhatsApp que ya salió solo se marca enviado.

## Por qué gana a cada alternativa

- **Frente a A:** nadie de oficina sabe arreglar una fila en la base, y el informe queda sin poder publicarse.
- **Frente a C:** casi siempre lo atascado se resuelve con otro intento (fue un fallo momentáneo); darlo por fallido obligaría a publicar otra versión o a reenviar a mano.

## Consecuencias

- **A favor:** nada queda a medias para siempre; lo que se recupera termina en su estado final por el camino normal.
- **En contra:** una consulta por organización cada hora (pocas filas, por estado). Algo atascado tarda hasta 13 horas en recuperarse.

## Cuándo revisarla

- Aparece otra tarea periódica que necesite otro ritmo.
- Los clientes piden que un envío atascado se resuelva en minutos.
