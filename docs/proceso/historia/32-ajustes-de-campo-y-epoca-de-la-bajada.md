[Plan de entrega](../plan-de-entrega.md) · Anterior: [Iteraciones 29 a 31 · Ajustes de oficina, el correo que escribe oficina y visitas con horario](29-ajustes-de-oficina-correo-y-horario.md) · Siguiente: [Iteraciones 34 y 35 · Firma en una pantalla y qué sale en el informe](34-firma-y-que-sale-en-el-informe.md)

# Iteraciones 32 y 33 · Ajustes de campo y la época de la bajada

**Estado en el mapa al 2026-10-16:**

- Iteración 32: Desplegada en el entorno de pruebas (2026-10-03); falta que Kevin la pruebe en su iPhone
- Iteración 33: Desplegada en el entorno de pruebas con la migración `0034` y la app 13 (2026-10-03)

**Estado:** prototipo `prototipos/ajustes-campo/prototipo.html` (https://claude.ai/artifact/ALQohRzdD6UgBLW1bYmDDX) aprobado por Kevin el 2026-10-03 con sus diez decisiones: "Si, apruebo. pero la animacion puede ser un poquito mas rapida, a esta velocidad da la sensacion de que esta lageada". Construidas y verificadas en local el mismo día; desplegadas en el entorno de pruebas el mismo día.

**Para qué:** Kevin revisó la app del técnico y pidió lo mismo que en oficina: que nada se abra de golpe, Tu cuenta mejor distribuida, los tableros con «Quitar» en otro lugar, un botón del catálogo que no confunda, el «Listo» del croquis, una entrega del teléfono menos extraña, la firma usando el espacio, un repaso antes de enviar con contenido y una lista de enviados que no se rompa. Y que el teléfono deje de mostrar datos que el servidor ya borró, sin reinstalar la app y sin romper el trabajo sin conexión.

## Alcance

**Iteración 32 · pantallas de campo (sin migración):**
- **Movimiento** (`paquetes/ui`): las hojas de campo (`Dialogo` inferior y hoja) entran desde el borde en 260 ms con una curva que frena al final (`--t-duracion-hoja`, `--t-curva-hoja`) y el velo se funde a la vez; salen en 200 ms. El paso siguiente entra 24 px con fundido en 220 ms (antes un cuarto del ancho en 280 ms). El croquis sube una sola vez, también mientras carga (antes un fondo vacío y después el editor). `DESIGN.md` tiene los valores nuevos.
- **Tu cuenta:** la persona y el estado de la sincronización sin caja; una lista con líneas (`GrupoDeAjustes`, `FilaDeAjuste`, `FilaDeTema` en `paquetes/ui`): el tema como tres iconos, Cambiar contraseña, Descartados con su número y Diagnóstico; «Cerrar sesión» sola al final y la versión de la app. Contraseña, Descartados y Diagnóstico se abren dentro de la misma hoja, con «‹ Cuenta» (`Dialogo` con `volver`).
- **Tableros:** una fila por tablero con su primera foto, lo que lo identifica y la barra de avance (`FilaDeRepeticion`, `ListaDeRepeticiones`); "N de M completos". Dentro, el nombre es el título; «Cambiar nombre» y «Quitar tablero» van en el menú ⋯ (`MenuAcciones`); abajo, «Siguiente: Tablero 2» y «Volver a la lista», o «Listo, ver los N» en el último.
- **Catálogo:** "Agregar del catálogo", buscador de borde fino y lista con líneas; abajo nada hasta agregar algo, y entonces "N agregados · En Materiales: …" con «Ver materiales».
- **Croquis:** una barra fija abajo, fuera del lienzo: hojas, símbolos y «Listo» a la derecha.
- **Entregar el teléfono:** la pantalla le habla a quien recibe ("Cliente, confirme la visita de …", de usted como la constancia, ADR-0024) con el logo, sitio, fecha, hora y motivo, y «Revisar y firmar», que funde a la firma. Sin «Ya lo tiene» ni «Todavía no».
- **Firma tomada:** una constancia grande con la firma sobre su línea, quién firmó con cargo y cliente, la declaración tal como sale en el informe y «Repetir» (con confirmación).
- **Revisa y envía:** cliente, sitio y formato; tres cifras (fotos, repeticiones, materiales); cada paso con lo que lleva (datos, miniaturas de fotos, nombres de tableros, materiales, la firma) y un visto, el dato que falta en ámbar o un círculo vacío si no tiene datos; toda la fila edita (`FilaDeRepaso`, `CifrasDeRepaso`). La consecuencia va bajo «Enviar a oficina».
- **Enviados:** dos líneas: cliente y sitio con la hora; el estado corto con su icono (`estadoCorto`: "No se pudo enviar", "Se envía al tener señal", "En revisión", "Revisado"…) y el formato. Lo que no entró sale aparte, arriba, en "Necesita atención".

**Iteración 33 · época de la bajada (ADR-0038, migración `0034_epoca_de_bajada`, app 13):** tabla `cambios.epocas` que la aplicación solo lee; la bajada trae `epoca`; `dejar-limpio.sql` la cambia al borrar. El teléfono guarda la última; si llega otra, quita las visitas sin trabajo, los estados y el catálogo, baja todo desde cero y al final quita lo enviado y recibido que el servidor ya no conoce. Borradores, lo que falta por enviar, formatos y símbolos no se tocan.

## Fuera de las iteraciones 32 y 33

| Qué | Cuándo |
|---|---|
| La prueba en el iPhone de las pantallas nuevas (movimiento, hojas, firma, croquis) | Al desplegar en el entorno de pruebas |
| Teléfonos con la app 12 o anterior: no conocen la época y siguen necesitando reinstalar tras una limpieza | Se resuelve solo al actualizar a la 13 |
| "Hora" de la visita en la entrega del teléfono solo cuando la visita tiene horario (ADR-0037) | Ya es así: sin horario no se muestra |

## Terminado cuando

| Criterio | Evidencia |
|---|---|
| 1. Como el prototipo | Capturas en WebKit (iPhone 13) de Tu cuenta, Descartados, tableros, un tablero con su menú, el catálogo, la entrega, la constancia firmada y el repaso, comparadas con el prototipo, y el inicio con «Necesita atención»; corregidos el pie del catálogo (se partía en dos líneas) y el visto de un paso sin datos |
| 2. Pruebas de paquetes | dominio 111, documentos 9, protocolo 25, oficina 18, campo 107 y servidor 214 (una de informes falló una vez por tiempos de la verificación de un plano y pasa 10 de 10 al repetirla dos veces; no toca estas iteraciones). Nuevas: campo con `mensajes.test.ts` (estados cortos) y tres de la época en `motor.test.ts` (la primera no borra; otra quita lo viejo y conserva borrador y visita con trabajo; lo recibido después de limpiar se queda); servidor con la época por organización en `bajada.test.ts` |
| 3. Reglas | `pnpm typecheck`, `pnpm arquitectura` sin violaciones, `pnpm licencias`, `pnpm audit` sin vulnerabilidades; presupuesto de campo 132,0 de 135 KB |
| 4. Extremo a extremo | Chromium, los 9 archivos que tocan campo: 20 de 20 (con los textos nuevos: «Revisa y envía», «Revisar y firmar», «Repetir», el menú del tablero, «Ver materiales», "Contraseña" dentro de la cuenta, "Recibido" y "Revisado") |
| 4b. Extremo a extremo en WebKit | Los mismos archivos más `revision` y `cotizaciones`: 21 de 21 |
| 5. Desplegada | Entorno de pruebas el 2026-10-03 desde el commit 30e5981 (subido a GitHub): `campo` primero ("Migraciones aplicadas", la `0034`), después `oficina`, `portal` y `worker`, los cuatro en `SUCCESS`. Verificado: salud 200 en las tres superficies, la misma compilación de campo que la local (`index-HT6rm2Bt.js`), la bajada sin cabeceras de sincronización responde 426 y `verificar-exposicion.sh`. Falta que Kevin la pruebe en su iPhone y producción |

## Decisiones tomadas al construirlo

- **Las hojas entran en 260 ms y los pasos en 220 ms**, más rápido que el primer prototipo (380 ms): Kevin dijo que así se sentía con retraso.
- **La entrega del teléfono trata de usted** ("confirme"), como la constancia (ADR-0024), aunque el prototipo decía "confirma": quien la lee es el cliente.
- **Lo enviado se quita al terminar de bajar todo, no al cambiar la época**: un levantamiento que el servidor recibió después de la limpieza baja con su estado y se queda; solo sale lo que el servidor ya no conoce.
- **El catálogo se vacía al cambiar la época** aunque haya otra persona en el mismo teléfono: es de la organización y vuelve con la bajada.
- **La app de campo pasa a la versión 13**: vuelve a bajar todo (ADR-0015) y adopta la época sin borrar nada.

## Al cerrarlas

**Iteraciones 32 y 33 construidas, verificadas y desplegadas en el entorno de pruebas el 2026-10-03** (sección "Iteraciones 32 y 33"). Kevin aprobó el prototipo `prototipos/ajustes-campo/prototipo.html` (https://claude.ai/artifact/ALQohRzdD6UgBLW1bYmDDX) con un cambio: "la animacion puede ser un poquito mas rapida". Sigue: que Kevin la pruebe en su iPhone (el teléfono se actualiza a la app 13 y baja todo de nuevo) y producción de la 29 a la 33 cuando lo apruebe (respaldo antes y `campo` primero por la `0033` y la `0034`).
