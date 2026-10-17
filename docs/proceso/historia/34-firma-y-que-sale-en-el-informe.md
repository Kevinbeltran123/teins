[Plan de entrega](../plan-de-entrega.md) · Anterior: [Iteraciones 32 y 33 · Ajustes de campo y la época de la bajada](32-ajustes-de-campo-y-epoca-de-la-bajada.md) · Siguiente: [Iteración 36 · Usabilidad de oficina](36-usabilidad-de-oficina.md)

# Iteraciones 34 y 35 · Firma en una pantalla y qué sale en el informe

**Estado en el mapa al 2026-10-16:**

- Iteración 34: Desplegada en el entorno de pruebas (2026-10-04); falta probarla en el iPhone
- Iteración 35: Desplegada en el entorno de pruebas con la migración `0035` y el formato de prueba v9 (2026-10-04); falta que Kevin la pruebe

**Estado:** prototipo `prototipos/informe-y-firma/prototipo.html` (https://claude.ai/artifact/4BgK3s9xXkizCK3x7exodN) aprobado por Kevin el 2026-10-04 con sus cinco decisiones; construidas, verificadas y desplegadas en el entorno de pruebas el mismo día.

**Para qué:** que el cliente firme sin pasar por una pantalla de bienvenida casi vacía, y que el informe sea fiel a lo que TEINS entrega: sin las fotos de llegada (son para que la empresa verifique la visita) ni el croquis de campo (oficina adjunta su plano), con libertad para poner o quitar lo demás.

## Alcance

**Iteración 34 · firma (solo campo, sin migración):** `HojaDeFirma` en una pantalla: el logo y «Cancelar»; «Constancia de visita · cliente» y «Confirme la visita de …» (de usted, ADR-0024); la declaración exacta; «Su nombre» y «Cargo (opcional)» en una fila; el recuadro (4:3) con «×», la línea, «Firme aquí con el dedo» y «Borrar» dentro; «Firmar» con lo que falta debajo. Sin la pantalla de bienvenida ni la lista de sitio, fecha y motivo (ya están en la declaración).

**Iteración 35 · qué sale en el informe (ADR-0039, migración `0035_seleccion_del_informe`):** `paquetes/dominio/src/seleccion.ts` (claves, lo de por omisión, `elegir`, `mostrarTodo`, `ocultosDe`, `aplicarSeleccion`); `DefinicionSeccion.soloEmpresa`; la columna `seleccion` del borrador, en `guardarInforme` (opcional) y `obtenerInforme`; al publicar, la copia congelada va sin lo oculto y con `ocultos`; la plantilla salta lo oculto en el PDF y en la vista lo dibuja rayado con «Mostrar» y pone «Ocultar» en lo que sale. En oficina, «Qué sale en el informe» bajo cada levantamiento incluido (`QueSaleEnElInforme.tsx`) y «Ocultar» sobre la hoja (`HojaEnVivo` con `botones`: una capa que pregunta qué hay bajo el puntero, porque la hoja no ejecuta scripts y Safari no entrega sus eventos). Formato de prueba v9: v8 con la Llegada `soloEmpresa`.

## Fuera de las iteraciones 34 y 35

| Qué | Cuándo |
|---|---|
| Ocultar datos sueltos de una sección que sale | Si oficina lo pide (ADR-0039, "Cuándo revisarla") |
| La pestaña «En el informe» de la revisión sigue mostrando el capítulo completo | Si confunde a oficina |
| «Ocultar» sobre la hoja con el teclado: hoy se hace con los interruptores del panel, que sí lo admiten | Con la próxima revisión de accesibilidad de oficina |
| Los formatos reales de TEINS con sus secciones «solo para la empresa» | Cuando TEINS los entregue |

## Terminado cuando

| Criterio | Evidencia |
|---|---|
| 1. Como el prototipo | Capturas en WebKit de la firma (vacía y firmada) y de la composición con la llegada oculta y una foto oculta desde la hoja; corregido: la hoja tomaba el nombre del título; el texto bajo «Firmar» repetía el error; tres «Ocultar» a la vez al pasar sobre una foto |
| 2. Pruebas de paquetes | dominio 116 (`seleccion.test.ts`, 5 nuevas), documentos 11 (2 nuevas: PDF sin rastro de lo oculto, vista con sus claves), protocolo 25, oficina 18, campo 107, servidor `informes.test.ts` 11 (nueva: la selección se guarda, una pestaña anterior no la borra y la versión sale sin la foto) |
| 3. Extremo a extremo | `informe.spec.ts` (la llegada no sale y una foto se oculta sobre la hoja), `firma.spec.ts`, `proteccion-campo.spec.ts`, `informe-al-cliente.spec.ts` y `portal.spec.ts` en Chromium y WebKit, más `revision.spec.ts` en WebKit: 15 de 15 en WebKit |
| 3b. Reglas | `pnpm typecheck`, `pnpm arquitectura` sin violaciones, `pnpm licencias`, `pnpm audit` sin vulnerabilidades, servidor 215 de 215; presupuesto de campo 132,0 de 135 KB |
| 4. Desplegada | Entorno de pruebas el 2026-10-04 desde el commit 2ab48c2 (subido a GitHub): `campo` primero ("Migraciones aplicadas", la `0035`), después `oficina`, `portal` y `worker`, los cuatro en `SUCCESS`; el formato de prueba v9 publicado con `publicar-formato`. Verificado: salud 200 en las tres superficies, las mismas compilaciones que las locales (campo `index-Drn8BtBi.js`, oficina `index-BOC_leX_.js`), la hoja de estilos de la vista con lo nuevo y `verificar-exposicion.sh`. Falta que Kevin la pruebe (en el iPhone, la firma) |

## Decisiones tomadas al construirlo

- **«Ocultar» sobre la hoja funciona con una capa encima** (`elementFromPoint`) y no con eventos dentro del marco: WebKit no los entrega desde un marco sin scripts (comprobado con una página mínima), y abrir los scripts del marco quitaría su aislamiento.
- **Al pasar el puntero se marca solo la parte más cercana**, para que no aparezcan varios «Ocultar» a la vez.
- **Safari y la hoja en vivo (arreglado el 2026-10-04, a pedido de Kevin):** WebKit no le entrega a la pantalla los eventos de un marco sin scripts. El correo editable de la iteración 30 escuchaba "input", así que en Safari lo escrito sobre el correo no se guardaba (`cotizaciones.spec.ts` lo reprodujo en WebKit antes del arreglo); ahora un `MutationObserver` lee el bloque. La hoja volvía a medirse con el evento "load" de cada foto; ahora con un `ResizeObserver`, para que en Safari no quede cortada cuando una foto tarda.
- **El nombre accesible de la constancia es fijo** («Constancia de visita»), no el título que cambia con el técnico.
- **`formatoContenido` sigue en 1**: `ocultos` es opcional y las versiones anteriores se dibujan igual.

## Al cerrarlas

**Iteraciones 34 y 35 construidas, verificadas y desplegadas en el entorno de pruebas el 2026-10-04** (sección "Iteraciones 34 y 35"), con el formato de prueba v9 publicado allí. Kevin aprobó el prototipo `prototipos/informe-y-firma/prototipo.html` (https://claude.ai/artifact/4BgK3s9xXkizCK3x7exodN): "perfecto. Empieza la implementacion". Sigue: que Kevin lo pruebe (la firma en el iPhone; el informe en oficina con una visita nueva, que use el formato v9), el arreglo propuesto del correo editable en Safari, y producción de la 29 a la 35 (respaldo antes, `campo` primero por la `0033` a la `0035`, y publicar el formato que corresponda).
