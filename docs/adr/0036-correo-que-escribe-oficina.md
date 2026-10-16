# ADR-0036 · El correo de un envío lo puede escribir oficina, sobre la vista previa

- **Estado:** Aceptada
- **Fecha:** 2026-10-02
- **Impulsores:** QA-9 (lo publicado no cambia), regla 8 (todo cambio queda registrado), R5
- **Depende de:** ADR-0028 (envío del informe al cliente), ADR-0029 (cotizaciones), ADR-0031 (vista en vivo)

## Contexto

El correo que acompaña un informe o una cotización lo arma la plantilla (`paquetes/documentos`, `htmlDeCorreo`): saludo, una frase fija, el adjunto y el pie. Kevin pidió (2026-10-02, `prototipos/ajustes-oficina`) que la persona de oficina pueda darle su toque: cambiar el asunto y el texto, y hacerlo escribiendo sobre la vista previa del correo, no en un formulario aparte. WhatsApp no admite texto libre: Meta solo deja enviar plantillas aprobadas.

## Opciones

| Opción | Descripción |
|---|---|
| A. Texto por organización | Una plantilla editable en la configuración, la misma para todos los envíos |
| B. Texto por envío | Asunto y texto escritos al enviar o al publicar; cada envío guarda el suyo |
| C. Editor libre del HTML | Todo el correo editable, también el saludo y el pie |

## Evaluación

| Criterio | A | B | C |
|---|---|---|---|
| Lo que pidió oficina (su toque en cada envío) | ○ | ● | ● |
| El pie legal y el adjunto no se pierden | ● | ● | ○ |
| El registro dice lo que recibió cada uno (regla 8) | ◐ | ● | ● |
| Costo | ◐ | ● | ○ |

## Decisión

B. Al publicar (pestaña "Correo" de la vista en vivo) y al enviar a otro contacto ("Ver cómo llega" o el formulario), oficina puede cambiar el **asunto** y el **texto** que va entre el saludo y el pie. Reglas:

- El contrato acepta `mensaje: { asunto, texto }` (`TextoDeCorreoPropio`, ambos obligatorios y recortados, 200 y 5.000 caracteres) en `publicarInforme`, `publicarCotizacion`, `enviarVersion` y `enviarCotizacion`. Sin él, sale el texto de TEINS (expansión: los clientes anteriores siguen igual).
- El saludo con el primer nombre de cada contacto, el adjunto, el botón del portal (informes) y el pie los pone siempre la plantilla. Si el PDF no cabe en el correo, el aviso se agrega aunque el texto sea propio.
- El texto se copia en `envios.mensaje.personal` (jsonb) de cada envío **por correo**; el worker usa ese asunto y ese texto. Sin migración. La respuesta marca `personalizado` en el envío.
- WhatsApp sigue con su plantilla aprobada; la pantalla lo dice.
- En la pantalla, `null` es el texto de TEINS; dejarlo igual al de TEINS vuelve a `null`. "Volver al texto de TEINS" lo restablece. El texto escrito en la pestaña "Correo" vive en la pantalla hasta publicar (no se guarda en el borrador).

## Por qué gana a cada alternativa

- **Frente a A:** no deja personalizar un envío puntual, que es lo que se pidió; se puede agregar después como texto por omisión.
- **Frente a C:** permitiría borrar el pie que explica por qué recibe el correo y cómo dejar de recibirlo, y el adjunto.

## Consecuencias

- **A favor:** cada envío dice lo que salió; nada cambia en la base de datos.
- **En contra:** el texto escrito antes de publicar se pierde si se sale de la pantalla sin publicar (se mitiga: es corto y "Volver al texto de TEINS" siempre está). Lo escrito no admite negritas: es texto plano en párrafos.

## Cuándo revisarla

Si oficina pide un texto propio por omisión para todos los envíos, o guardar el texto en el borrador.
