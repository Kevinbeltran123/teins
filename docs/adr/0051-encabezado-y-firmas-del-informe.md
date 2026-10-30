# ADR-0051 · El encabezado y las firmas del informe salen de la visita y de las cuentas

- **Estado:** Aceptada
- **Fecha:** 2026-10-29
- **Impulsores:** QA-15, QA-16, R2, I-2 (doble hora), I-20 (minimización)
- **Depende de:** ADR-0006, ADR-0020, ADR-0024, ADR-0029, ADR-0031, ADR-0037, ADR-0050

## Contexto

Los dos formatos de papel de TEINS abren con un encabezado (cliente, NIT, orden de servicio, dirección, ciudad, sede, solicitante, teléfono, fecha, referencia) y cierran con una fila de firmas (quien atendió, quien acompañó, quien supervisó). Casi nada de eso se debe escribir en campo: ya lo sabe la visita, el cliente o la cuenta. Hoy faltan en la base: el NIT del cliente, la ciudad del sitio, el solicitante, la orden de servicio, la referencia del cliente y la cédula de las cuentas.

Condiciones: las versiones publicadas son inmutables (regla 7); los datos personales de las versiones son los mínimos necesarios (regla 18); y el Decreto 2364 de 2012 da efecto de firma a un mecanismo que identifica a la persona con su usuario.

## Opciones

| Opción | Descripción |
|---|---|
| **A. Datos en la visita y las cuentas; el informe los copia al publicar** | Campos nuevos en cliente, sitio, visita y usuario; la versión publicada copia lo que usa |
| B. Escribirlos en el formato, en campo | Campos de texto en la primera sección |
| C. Una firma dibujada guardada en la cuenta | El técnico firma una vez y se reutiliza |

## Evaluación

| Criterio (ligado a un impulsor) | A | B | C |
|---|---|---|---|
| El técnico no vuelve a escribir lo que oficina ya sabe | ● | ○ | ● |
| La versión publicada no cambia aunque cambie el cliente (regla 7) | ● | ● | ◐ |
| Identifica a quien firmó y cuándo (I-2) | ● | ○ | ◐ |
| Datos personales mínimos (I-20) | ◐ | ● | ○ |

## Decisión

**A.**

- **Datos nuevos en la base:**
  - en el cliente, `nit`;
  - en el sitio, `ciudad`;
  - en la visita, `solicitante` (un contacto del mismo cliente), `ordenDeServicio` (consecutivo por organización, asignado al programar, nunca reutilizado y conservado al reprogramar o reasignar) y `referencia` (la del cliente: el «Ticket No.»);
  - en la cuenta, `documento` (cédula), que pone un administrador y solo un administrador ve.
- **El número de orden** se escribe con una sola función (`numeroDeOrden`, con 4 dígitos por ahora). Un comando fija desde qué número sigue la organización y se niega a bajarlo.
- **Firmas electrónicas:**
  - el técnico, al enviar: nombre, cédula y la hora en que oficina recibió el envío (la oficial, I-2);
  - el revisor, al marcar revisado: nombre, cédula y hora;
  - quien acompaña dibuja su firma (ADR-0024) y escribe su cédula si el formato la pide.
- **Todo se copia en la versión publicada** (regla 7): lo que cambie después en el cliente o en la cuenta no cambia un informe ya publicado.
- **Minimización (regla 18):** de las personas de TEINS sale solo nombre y cédula, y solo en el informe: nunca en registros, listas ni exportaciones. El cambio de la cédula queda en la auditoría sin el valor.
- **Excepción acotada a la regla 18:** el encabezado del papel pide el teléfono del solicitante. Sale solo si oficina lo escribió en el contacto; es el dato que el cliente mismo puso como contacto de la visita. Si TEINS prefiere cumplir la regla al pie de la letra, basta quitar el teléfono de la plantilla del encabezado.

## Por qué gana a cada alternativa

- **Frente a B:** el técnico escribiría en cada visita lo que oficina ya capturó, y un NIT mal escrito en campo no se corregiría una vez para todas.
- **Frente a C:** guarda un dato biométrico-gráfico por persona sin necesidad; la firma electrónica por usuario, hora y cédula cumple el decreto y no lo pide.

## Consecuencias

- **A favor:** el informe sale con la estructura del papel sin que campo capture nada de más.
- **A favor:** el número de orden es único y consecutivo; las visitas anteriores quedan sin número y el informe dice «[N.º de orden]».
- **En contra:** la cédula es un dato personal nuevo en la base. Se mitiga con que solo la ve un administrador, no sale en listas y su cambio se audita sin el valor.
- **En contra:** hay un consecutivo más. Usa el mismo patrón de ADR-0029, ya probado.
- **Pendiente de TEINS:** cómo se escribe el número de orden, desde cuál sigue y qué es el «Ticket No.». Solo cambia la función que lo presenta y el comando.

## Cuándo revisarla

- TEINS responde con otro formato de número (letras, año, talonario de CDP): cambia `numeroDeOrden` y, si hay series, el consecutivo.
- Se necesita firma con certificado digital (un cliente que la exija): ADR nuevo.
