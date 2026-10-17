[Plan de entrega](../plan-de-entrega.md) · Anterior: [Iteración 18 · Croquis a pantalla completa, con hojas](18-croquis-a-pantalla-completa.md) · Siguiente: [Iteración 20 · Contactos del cliente e informe por correo y WhatsApp](20-informe-por-correo-y-whatsapp.md)

# Iteración 19 · Símbolos en el croquis

**Estado en el mapa al 2026-10-16:** Terminada y desplegada en el entorno de pruebas; falta la prueba en iPhone

**Estado:** terminada el 2026-09-26, verificada en local y desplegada en el entorno de pruebas (el worker primero, después campo, oficina y portal; la biblioteca de prueba publicada; los 17 archivos del extremo a extremo en verde contra el entorno). Falta la prueba en iPhone. Maquetas aprobadas por Kevin en el lienzo (página "v0.9 · Símbolos en el croquis", "Si, aprobado").

**Para qué:** que el técnico ponga tableros, UPS, tomas, luminarias o racks con un toque, iguales en todos los croquis, en vez de dibujarlos.

## Alcance

- **Biblioteca como datos (ADR-0027):** por organización, publicada completa desde un archivo JSON (`publicar-simbolos`); lo que sale se retira, nunca se borra. Baja a la app 10 como el catálogo (cambio `simbolo`) y queda en el teléfono sin sellar (base local versión 6).
- **Símbolo:** trazado SVG en una caja de 100 × 100, relleno y sigla opcionales, nombre, categoría y código de catálogo opcional. El trazado se valida como geometría y nada más.
- **Editor:** "Símbolos" abajo a la derecha abre la biblioteca (buscar sin tildes, recientes de este teléfono y todo por categoría, sin textos de ayuda); el símbolo cae en el centro de lo que se ve, elegido con "Mover", y se mueve, gira, cambia de tamaño y duplica como las formas.
- **En el boceto se copia el dibujo** (versión 2 del documento, elemento `simbolo`): oficina y el PDF lo dibujan igual aunque la biblioteca cambie.
- **Biblioteca de prueba ficticia** de 21 símbolos (`simbolos-prueba.json`), que `sembrar` publica, hasta tener la de TEINS.

## Fuera de la iteración 19

| Qué | Dónde se resuelve |
|---|---|
| La lista real de símbolos de TEINS | Cuando TEINS la entregue: se publica con `publicar-simbolos`, sin tocar la app |
| Pantalla de oficina para crear o editar símbolos | Si TEINS cambia su biblioteca a menudo (ADR-0027, opción C) |
| Contar los símbolos como cantidades | Iteración 21 o después: el código de catálogo ya viaja en cada símbolo puesto |
| Sacar la validación del boceto del arranque de campo (2,3 KB) | Si el presupuesto no alcanza: campo quedó en 119,9 de 120 KB |
| `bajada.spec` falló una vez contra el entorno en la corrida completa y pasó sola; sin el detalle guardado. Sospecha: el límite de 5 inicios de sesión por minuto con la prueba anterior | Mirar con `repeticiones.spec`: correr la suite completa guardando los rastros de cada archivo |

## Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Kevin aprueba las maquetas | Hecho el 2026-09-26 |
| 2. Un símbolo y una biblioteca se validan; el trazado solo admite geometría; en el boceto se copia, se serializa y se dibuja | Hecho: `dominio/src/simbolos.test.ts` |
| 3. La biblioteca se publica, baja solo a la app 10 con su orden, un cambio la vuelve a mandar, lo que sale se retira y cada organización tiene la suya | Hecho: `servidor/pruebas/simbolos.test.ts` |
| 4. El teléfono la guarda, la busca, la agrupa y recuerda los recientes (también sin almacenamiento) | Hecho: `campo/src/simbolos.test.ts` y `repositorio.test.ts`; mover, girar y escalar un símbolo en `transformar.test.ts` |
| 5. Extremo a extremo: buscar y poner una UPS, duplicarla, verla en recientes, enviar; oficina y el PDF la dibujan | Hecho en Chromium y WebKit (`e2e/pruebas/simbolos.spec.ts`) |
| 6. Lo anterior sigue igual y el presupuesto de campo se respeta | Hecho: tipos, arquitectura, licencias y auditoría en verde; dominio 95, protocolo 18, oficina 4, campo 80, servidor 118; extremo a extremo 35 y 3 omitidas en Chromium y WebKit; campo 119,9 de 120 KB |
| 7. Desplegada en el entorno de pruebas, el worker antes que la app, con la biblioteca de prueba publicada | Hecho el 2026-09-26: el worker en `SUCCESS` antes de subir la app; campo (que aplicó `0022` y `0023` antes de arrancar), oficina y portal en `SUCCESS`, salud en 200 y el mismo JavaScript que en local; `publicar-simbolos` publicó los 21 de prueba; los 17 archivos del extremo a extremo contra el entorno en Chromium, 19 pruebas en verde (`bajada.spec` falló una vez en la corrida y pasó al repetirla sola; ver "Fuera") |
| 8. Probada en el iPhone | Pendiente: fase 19 de [`verificacion-manual.md`](../verificacion-manual.md) |

## Decisiones tomadas al construirlo

- **La clave del símbolo es la organización y su id:** el archivo trae los ids, así que dos organizaciones pueden publicar la misma biblioteca.
- **Quitar un símbolo del medio vuelve a mandar los que siguen:** su orden cambió, y el orden es el de la pantalla. Son pocos bytes.
- **El símbolo cae del mismo tamaño en pantalla a cualquier acercamiento** (96 px), dentro de los límites de tamaño.
- **La biblioteca no abre el teclado:** el foco queda en el diálogo (`focoEnElDialogo`); lo normal es tocar un símbolo, no buscarlo.
- **Los símbolos los lee la captura y se los pasa al editor:** leerlos desde el editor partía el JavaScript inicial de campo en seis archivos y lo subía a 120,5 KB.
