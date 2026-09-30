# ADR-0022 · Cifrado local en campo: qué se sella, cómo se escribe y cómo se migra

- **Estado:** Aceptada
- **Fecha:** 2026-09-25
- **Impulsores:** QA-5, QA-1, QA-22, R5, I-15, Ley 1581
- **Depende de:** ADR-0009, parte 5 (la concreta; no la reemplaza), ADR-0004

## Contexto

ADR-0009 decidió cifrar los datos locales con AES-GCM y una clave no extraíble por usuario y dispositivo, sobre todo para poder borrar de un golpe: destruir la clave vuelve ilegible lo del usuario revocado aunque borrar cientos de fotos tarde o se interrumpa. Quedó por decidir cómo encaja eso en `campo`, y la dificultad es técnica:

- WebCrypto es asíncrono y una transacción de IndexedDB se cierra sola cuando espera algo que no es de IndexedDB. Hoy las escrituras de `campo` leen, cambian y guardan dentro de una transacción (guardar una respuesta, una foto con su referencia, enviar y encolar el comando juntos).
- La migración de Dexie corre dentro de una transacción de ese tipo: no puede cifrar lo que ya está guardado.
- Regla 5: nunca se borran datos locales para resolver una migración. Hay teléfonos con borradores sin enviar de antes del cifrado.
- Un teléfono puede compartirse entre técnicos y los archivos se direccionan por contenido: dos levantamientos pueden apuntar a la misma foto.

## Opciones

| Opción | Descripción |
|---|---|
| A. Cifrar dentro de la transacción con `Dexie.waitFor` | Mantiene viva la transacción con consultas de relleno mientras WebCrypto trabaja |
| B. Cifrado síncrono en JavaScript (por ejemplo, @noble/ciphers) | La clave vive como bytes en la base y el cifrado cabe en la transacción |
| **C. Sellar fuera de la transacción, escribir con comprobación optimista** | Se abre, se calcula y se sella antes; la transacción solo comprueba que nadie escribió entre tanto y guarda |

## Evaluación

| Criterio | A | B | C |
|---|---|---|---|
| Clave no extraíble, protegida por el sistema en iOS (ADR-0009, I-15) | ● | ○ | ● |
| Atomicidad de "foto y referencia" y de "enviar y encolar" (QA-1, ADR-0018 nivel 3) | ● | ● | ● |
| Sin trucos frágiles en Safari (ADR-0002) | ○ | ● | ● |
| Costo en el código que ya existe | ● | ◐ | ◐ |

## Decisión

1. **Qué se sella:** respuestas y repeticiones del levantamiento, los bytes de fotos y bocetos, el comando del outbox, los datos de la visita (cliente, sitio, dirección, motivo, fecha) y los comentarios de oficina. **Queda a la vista** lo que usan los índices y las transacciones: ids, responsable, estados, fechas, el estado de subida y las huellas de los archivos de cada levantamiento. También los formatos (no son datos de clientes) y el nombre del técnico con sesión.
2. **La clave:** AES-GCM de 256 bits, `extractable: false`, una por técnico en la tabla `claves` (versión 4 de la base). Se crea la primera vez que hace falta; si dos pestañas la crean a la vez, gana la primera. Cada sellado lleva como dato adicional autenticado el tipo y el id del registro (`levantamiento:<id>`): un sellado copiado a otro registro no abre.
3. **Escritura:** se abre, se calcula y se sella fuera de la transacción; dentro solo se compara `rev` (sube con cada escritura) y se guarda todo junto. Si otra pestaña escribió entre tanto, se repite sobre lo nuevo. En la misma pestaña, las escrituras de un levantamiento van en fila y en orden: la última tecla escrita es la que queda.
4. **Lectura:** el repositorio y el almacén abren lo sellado antes de entregarlo; las pantallas usan lecturas que abren (`datos/lecturas.ts`). Dentro de `useLiveQuery`, toda promesa de WebCrypto va envuelta en `Promise.resolve` (regla de Dexie).
5. **Migración:** la versión 4 solo agrega la tabla `claves` y el índice `cifrado` de los archivos. Lo de antes se sella después, registro por registro, al abrir la app y al iniciar sesión, con la misma comprobación optimista; se puede interrumpir y repetir. Nada se borra. Lo que no tiene responsable (borradores del corte 0) queda a la vista hasta que alguien inicia sesión y lo recibe. Las fotos se sellan de a una: no caben todas en memoria.
6. **Borrado por revocación (QA-5):** primero, un archivo sellado con la clave del revocado que también usa otro técnico pasa a la clave de ese otro. Después, en una transacción, se destruyen la clave y la sesión y se marca el borrado pendiente: desde ahí nada de lo suyo se lee. Por último se borran los registros. Si la app se cierra en medio, lo que quedó es ilegible y el motor lo termina (`completarBorrados`) antes de confirmarle el borrado al servidor.

## Por qué gana a cada alternativa

- **Frente a A:** `Dexie.waitFor` mantiene la transacción viva con consultas de relleno; su propia documentación advierte el costo en CPU, y un error en Safari se pagaría con borradores. Sellar fuera no depende de ese mecanismo.
- **Frente a B:** la clave quedaría como bytes legibles en la base. En iOS, una `CryptoKey` guardada en IndexedDB la envuelve el sistema con una llave del llavero del dispositivo: copiar los archivos del navegador no basta para leerla. Eso es justamente lo que pide ADR-0009.

## Consecuencias

- **A favor:** lo capturado nunca queda legible en los archivos del navegador; el borrado por revocación vuelve todo ilegible en una transacción pequeña, aunque haya cientos de fotos. El resto de la app no sabe que el cifrado existe.
- **En contra:** cada escritura abre y sella el levantamiento completo (unos kilobytes: menos de un milisegundo en un teléfono); se mitiga con la fila por levantamiento. Las huellas de las fotos quedan a la vista: permiten confirmar que una foto conocida está en el teléfono, no ver su contenido.
- **Límite que no cambia (ADR-0009):** no protege contra alguien con el teléfono desbloqueado y la app abierta, ni borra físicamente lo que el navegador ya escribió en disco; la defensa principal sigue siendo el bloqueo del teléfono y el permiso de trabajo local.

## Cuándo revisarla

- Si el cifrado de fotos grandes se nota al capturar en un teléfono de gama media (medirlo en la prueba en iPhone pendiente).
- Si se agrega una tabla con datos de clientes: entra en el punto 1 o se justifica por qué no.
- Si el navegador ofrece claves ligadas a la biometría del dispositivo desde la web: permitiría cerrar el límite del teléfono desbloqueado.
