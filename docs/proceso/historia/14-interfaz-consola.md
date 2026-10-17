[Plan de entrega](../plan-de-entrega.md) · Anterior: [Iteración 13 · Llaves de acceso (passkeys)](13-llaves-de-acceso.md) · Siguiente: [Iteraciones 15 a 21 · Plan acordado el 2026-09-26](15-a-21-plan-acordado.md)

# Iteración 14 · Interfaz con la dirección Consola

**Estado en el mapa al 2026-10-16:** Terminada y desplegada en el entorno de pruebas; falta la prueba en iPhone

**Estado:** terminada el 2026-09-26, verificada en local (verificación completa en el orden de la integración continua, en verde) y desplegada en el entorno de pruebas (`campo`, `oficina`, `portal` y `worker`; extremo a extremo en Chromium contra el entorno, 13 de 13). Falta la prueba en iPhone.

**Para qué:** Kevin encontró la interfaz "básica y fea": botones de tamaños distintos, confirmaciones metidas en filas, resultados que aparecían lejos de la acción (el QR de un acceso salía arriba de la tabla), lo creado se perdía en el orden alfabético y no había diálogos, menús ni notificaciones. Se auditó el código pantalla por pantalla, se investigó cómo resuelven lo mismo Google, Microsoft, Apple, AWS, GitHub, Shopify e IBM (segundo factor, credenciales que se muestran una vez, QR, confirmaciones, creación, tablas, formularios de campo), se compararon tres direcciones en el lienzo (página "v0.3 · Direcciones") y Kevin eligió la A, Consola, con dos reglas: la jerarquía (el título es la sección del menú; las subsecciones, pestañas) y que todo lo que se muestra esté justificado.

## Alcance

- **`DESIGN.md` reescrito:** la regla de justificación, la jerarquía, los tokens de Consola, cuándo usar cada componente, qué se confirma y qué se deshace, crear en hoja lateral y lo nuevo primero y resaltado, lo que se entrega una sola vez y el flujo del segundo factor.
- **`paquetes/ui`:** juego de componentes nuevo (botones con variantes, tamaños, icono y estado de carga; diálogo sobre `<dialog>` centrado, lateral e inferior; confirmación; notificaciones; tabla; menú de acciones sobre el popover del navegador; encabezado de pantalla; insignias; estado vacío; esqueletos; búsqueda; copiar; visor de fotos) e iconos de Lucide. `Marquilla` se retiró.
- **Oficina:** menú lateral con iconos y la cuenta de lo que espera revisión; cada pantalla con su encabezado; tablas con "Más acciones"; crear y editar en hoja lateral con errores por campo; confirmaciones en diálogo; credenciales en un diálogo que no se cierra por accidente; segundo factor en pasos numerados con los códigos de respaldo después de verificar; revisión e informe en dos columnas con el panel de acción fijo; aviso al salir del informe con cambios sin guardar.
- **Campo:** barra superior con el estado de sincronización; la siguiente visita como tarjeta focal; barra de envío fija con lo que falta y resumen con enlaces; confirmaciones en hoja inferior; fotos a pantalla completa que se quitan con deshacer (`quitarFoto`); sin la línea "Datos de prueba" que se habría visto en producción; diagnóstico plegado.
- **Portal:** ingreso y lista de informes en la dirección nueva, sin el marcador `[LOGO]` a la vista del cliente.
- **Servidor:** el PDF se descarga como archivo con un nombre legible (`Content-Disposition: attachment`), en oficina y en el portal; "Revisados" va del más reciente al más antiguo; en Administración, los usuarios activos primero.
- **Columna "Visita" en la bandeja:** cada levantamiento dice de qué cliente y sitio es sin abrirlo. El resumen del levantamiento en `protocolo` trae la visita (nula para los de antes de las visitas); el servidor la lee por la interfaz del módulo de visitas (`resumenes`), en una consulta por página.

## Fuera de la iteración 14

| Qué | Dónde se resuelve |
|---|---|
| Nombre del formato en la bandeja (hoy muestra la clave) | `docs/diseno/pendientes.md` |
| Las demás pantallas de Consola en el lienzo, para revisarlas con TEINS | `docs/diseno/pendientes.md` |
| Borrar del almacenamiento una foto que ya había subido y el técnico quitó antes de enviar | Tarea de limpieza del worker, cuando el volumen lo justifique: hoy queda huérfana y no se entrega |
| Instalación guiada de la PWA en iPhone | Siguiente en código mientras TEINS responde |

## Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Kevin aprueba una dirección en el lienzo antes de programar | Hecho: dirección A, página "v0.3 · Direcciones" |
| 2. Ninguna pantalla define estilos propios; todas usan el juego de `ui` | Hecho: `Marquilla` retirada, tipos verificados en los siete paquetes |
| 3. Lo que tiene consecuencias se confirma; lo que se deshace ofrece "Deshacer" | Hecho: pruebas de extremo a extremo actualizadas a los diálogos (envío, revisión, publicación, retiro, cancelación, llaves, repeticiones) |
| 4. Lo creado aparece primero y resaltado, con notificación | Hecho: `programacion.spec.ts` y `administracion.spec.ts` lo comprueban |
| 5. El PDF se descarga sin salir de la pantalla | Hecho: `informe.spec.ts` y `portal.spec.ts` esperan la descarga; pruebas del servidor del encabezado |
| 6. Quitar una foto no rompe la sincronización ni pierde otra | Hecho: 4 pruebas nuevas de `quitarFoto` en `campo` |
| 6b. La bandeja dice de qué cliente y sitio es cada levantamiento | Hecho: `informes.test.ts` ("bandeja", en cualquier pestaña), `api.test.ts` (nulo sin visita) y `envio.spec.ts` |
| 7. Lo anterior sigue igual y el presupuesto de campo se respeta | Hecho: tipos, reglas de arquitectura, licencias y auditoría en verde; dominio 73, protocolo 18, oficina 4, campo 51, servidor 96; extremo a extremo 24 y 2 omitidas (Chromium y WebKit); campo 116,0 de 120 KB |
| 8. Desplegada en el entorno de pruebas | Hecho: los cuatro servicios en `SUCCESS`, salud en 200 y los 12 archivos del extremo a extremo contra el entorno en Chromium, 13 pruebas en verde |
| 9. Probada en el iPhone | Pendiente, con las fases 9 a 13 |

## Decisiones tomadas al construirlo

- **Componentes propios sobre el navegador, sin shadcn ni Radix:** `<dialog>` da el foco atrapado, el velo, Esc y el fondo inerte; el popover da los menús encima de todo, sin que una tabla con desplazamiento los recorte. Cero dependencias nuevas salvo Lucide, y el movimiento sigue en CSS (regla 10).
- **El amarillo dejó de pintar botones:** la acción principal va en el azul de la marca; el amarillo marca el foco y lo recién creado. Con un solo acento, el amarillo sigue llamando la atención donde importa.
- **El borde de los campos de texto es más oscuro que el de los botones** (`borde-control`, 3:1): el campo no tiene otra forma de verse, el botón tiene su texto.
- **Los avisos llevan el texto en negro y el tono en el icono:** el texto de color sobre fondo teñido no llegaba a 7:1.
- **Una acción principal por fila, el resto en "Más acciones":** los botones con el nombre del cliente o del usuario en cada fila (que variaban de ancho) pasaron a un texto corto con el nombre accesible completo, así las pruebas y el lector de pantalla siguen encontrando cada uno.
- **La captura de campo se carga aparte:** el juego de componentes nuevo llevaba el JavaScript inicial a 124 KB; con la captura fuera del arranque quedó en 116 KB (el service worker la guarda igual y abre sin conexión). `ui` declara `sideEffects` para que cada superficie empaquete solo lo que usa.
- **Quitar una foto borra el archivo solo si nada más lo usa:** las fotos se direccionan por contenido, así que otro campo u otro levantamiento pueden compartirla. Una subida en curso de la foto quitada termina sin efecto.
- **Las visitas siguen en orden de fecha al programar una nueva:** la agenda es cronológica, así que la nueva se resalta y se lleva a la vista en su lugar en vez de subir al principio; clientes, usuarios e ítems nuevos sí van primero.

## Al cerrarla

**Iteración 14 terminada el 2026-09-26:** la interfaz de campo, oficina y portal rehecha con la dirección Consola, elegida por Kevin entre tres comparadas en el lienzo, más la columna "Visita" en la bandeja. Desplegada en el entorno de pruebas y verificada allí con los 12 archivos del extremo a extremo en Chromium (13 pruebas, uno por minuto por el límite de inicios de sesión). Falta probarla en el iPhone junto con las fases 9 a 13.
