[Plan de entrega](../plan-de-entrega.md) · Anterior: [Iteración 11 · Cantidades con catálogo](11-cantidades-con-catalogo.md) · Siguiente: [Iteración 13 · Llaves de acceso (passkeys)](13-llaves-de-acceso.md)

# Iteración 12 · Cifrado local en campo

**Estado en el mapa al 2026-10-16:** Terminada y desplegada en el entorno de pruebas; falta la prueba en iPhone

**Estado:** terminada el 2026-09-25 y desplegada en el entorno de pruebas (`cifrado.spec.ts` en Chromium contra el entorno, verde). Falta la prueba en iPhone (fase 12 de la guía), en espera con las de las iteraciones 9 a 11.

**Para qué:** que un teléfono perdido o copiado no entregue datos de clientes, y que la orden de borrado de un técnico revocado vuelva ilegible todo lo suyo al instante, aunque borrar cientos de fotos se interrumpa (ADR-0009, parte 5; QA-5; I-15).

## Alcance

- **Clave:** AES-GCM de 256 bits, no extraíble, una por técnico en el teléfono.
- **Sellado:** respuestas y repeticiones, fotos y bocetos, el comando del outbox, las visitas y los comentarios de oficina (ADR-0022, punto 1).
- **Migración sin pérdida:** lo guardado antes del cifrado se sella en segundo plano, registro por registro (regla 5).
- **Borrado por revocación:** primero la clave, después los registros; si se interrumpe, se termina antes de confirmarlo al servidor.
- **Diagnóstico:** "Datos cifrados: Todos" o cuántos faltan.

## Fuera de la iteración 12

| Qué | Dónde se resuelve |
|---|---|
| Cifrado en `oficina` y en el portal | No aplica: no guardan datos en el dispositivo |
| Clave ligada a la biometría del teléfono | Cuando la web lo permita (ADR-0022, "Cuándo revisarla") |
| Passkeys | Iteración 13 |

## Terminado cuando

| Criterio | Estado |
|---|---|
| 1. En la base del teléfono no se lee nada de lo capturado ni de la visita, en Chromium y WebKit, y todo se lee igual al volver a abrir y se envía | Hecho: `e2e/pruebas/cifrado.spec.ts` lee IndexedDB directamente; `campo/src/datos/cifrado.test.ts` recorre todas las tablas |
| 2. La clave no se puede exportar y un sellado copiado a otro registro no abre | Hecho: `cifrado.test.ts` |
| 3. Un teléfono con datos de la iteración 11 conserva todo: se cifra lo que tiene responsable, con su estado de subida y su envío; lo del corte 0 espera a su responsable | Hecho: `cifrado.test.ts`, migración de la versión 3 a la 4 |
| 4. La orden de borrado destruye primero la clave; interrumpida, deja todo ilegible y se termina; no le quita a otro técnico una foto compartida | Hecho: `cifrado.test.ts` y las pruebas de revocación del motor |
| 5. Escrituras seguidas o desde dos pestañas no se pisan y la última tecla es la que queda | Hecho: `cifrado.test.ts` |
| 6. Lo anterior sigue igual y el presupuesto de campo se respeta | Hecho: verificación completa en el orden de la integración continua (dominio 73, protocolo 18, oficina 4, campo 47, servidor 89, extremo a extremo 23 y 1 omitida); campo 117,2 de 120 KB |

## Decisiones tomadas al construirlo

- **Sellar fuera de la transacción y escribir con comprobación optimista** (ADR-0022): WebCrypto no cabe en una transacción de IndexedDB. Se descartaron `Dexie.waitFor` (consultas de relleno, frágil en Safari) y el cifrado síncrono en JavaScript (la clave quedaría legible en la base).
- **Las escrituras de un levantamiento van en fila dentro de la pestaña.** Solo con la comprobación optimista, ocho escrituras a la vez se estorbaban hasta agotar los reintentos, y una tecla vieja podía guardarse después de una nueva. La fila las pone en orden; entre pestañas decide la comprobación.
- **Las huellas de los archivos de cada levantamiento quedan a la vista**, junto al sellado: subir, borrar y decidir si otro usa una foto no exige abrir nada, y eso sí cabe en una transacción.
- **Índice `cifrado` en los archivos:** saber qué fotos faltan por sellar sin cargar los bytes de todas en memoria.
- **La migración no está en `upgrade` de Dexie** (no admite WebCrypto): la versión 4 solo agrega la tabla y el índice, y el sellado corre al abrir la app y al iniciar sesión. Se puede interrumpir y repetir.
- **Una foto compartida por dos técnicos pasa a la clave del otro** antes de destruir la del revocado: el borrado de uno nunca le quita datos al otro, como antes del cifrado.
- **Quedan 2,8 KB del presupuesto de campo** (117,2 de 120): la próxima iteración que toque campo empieza por revisar qué se puede cargar aparte, como ya se hizo con el editor de bocetos.
- **Las pantallas no saben del cifrado:** leen por el repositorio y por `datos/lecturas.ts`, que abren lo sellado dentro de `useLiveQuery`.

## Al cerrarla

**Iteración 12 terminada el 2026-09-25:** cifrado local en campo (ADR-0022), desplegado en el entorno de pruebas y verificado allí con `cifrado.spec.ts`. Lo guardado antes se cifra solo al abrir la app nueva, sin perder nada. La prueba en iPhone (fase 12 de la guía, antes de aceptar la actualización) queda en espera con las de las iteraciones 9 a 11.
