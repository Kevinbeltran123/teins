# Plan de entrega

Cortes verticales ordenados por riesgo (`forma-de-trabajo.md`). Cada corte termina completo: esquema en `protocolo`, endpoint, política, auditoría, pantalla, estados y pruebas. Lo que un corte deja fuera queda escrito en su sección, con el corte que lo resuelve.

## Mapa

| Corte | Entregable demostrable | Riesgo que cierra | Estado |
|---|---|---|---|
| 0 | Captura sin conexión con fotos, instalada en iPhone | Durabilidad de la PWA en Safari (QA-1, ADR-0002) | Terminado |
| 1 | El técnico inicia sesión, envía el levantamiento y oficina lo ve en su bandeja | Entrega completa, sin duplicados y con archivos verificados (QA-2), idempotencia, aislamiento por organización | Terminado y desplegado en el entorno de pruebas; probado en iPhone el 2026-09-25 |
| 2 | Bajada: formatos como datos, visitas asignadas, estado de mis levantamientos, permiso de trabajo local, revocación con borrado | Punto de control seguro (ADR-0005), revocación sin conexión (QA-5), formatos sin publicar la app (QA-11) | Terminado y desplegado en el entorno de pruebas; probado en iPhone el 2026-09-25 |
| 3 | Revisión: tomar, corregir con trazabilidad por campo, comentar al técnico, marcar revisado | Concurrencia en oficina (QA-25), trazabilidad (QA-8) | Terminado y desplegado en el entorno de pruebas; probado en iPhone el 2026-09-25 |
| 4 | Informe: composición mínima, publicación inmutable y PDF | Versiones inmutables (QA-9), PDF reproducible en segundo plano (QA-17) | Terminado y desplegado en el entorno de pruebas, con supuestos de P22, P23 y P26 |
| 5 | Portal: acceso con QR y clave, descarga del informe vigente | Cero accesos cruzados entre clientes (QA-4, QA-7) | Terminado y desplegado en el entorno de pruebas |
| Iteración 6 | Administración con segundo factor: usuarios, teléfonos, accesos de clientes, retiro de versiones | Cuenta de mayor impacto protegida (ADR-0009), operar el piloto sin comandos | Terminada y desplegada en el entorno de pruebas |
| Iteración 7 | Gestión de visitas y clientes desde oficina | Operar el piloto sin comandos; cambios de agenda que llegan solos a los teléfonos | Terminada y desplegada en el entorno de pruebas; probada en iPhone el 2026-09-25 (el aviso de visita cancelada se corrigió y se confirmó ese día) |
| Iteración 8 | Producción provisional (transferible), respaldos diarios y simulacro | Copias probadas y entorno recreable antes del piloto (QA-10, QA-18) | Terminada; producción sin datos reales hasta transferirla a TEINS (ADR-0021) |
| Iteración 9 | Secciones repetibles (pisos, áreas, tableros) | Formatos reales de TEINS como datos, no código (F2, QA-11) | Terminada y desplegada en el entorno de pruebas; falta la prueba en iPhone |
| Iteración 10 | Bocetos sobre cuadrícula (ADR-0019) | El croquis en papel pasa al teléfono, nítido en oficina y en el PDF (F3, P14) | Terminada y desplegada en el entorno de pruebas; falta la prueba en iPhone |
| Iteración 11 | Cantidades con catálogo y exportación a Excel | Los materiales anotados en campo no se vuelven a digitar para cotizar (F9, P27 a P29) | Terminada y desplegada en el entorno de pruebas; falta la prueba en iPhone |
| Iteración 12 | Cifrado local en campo (ADR-0022) | Un teléfono perdido no entrega datos de clientes y el borrado por revocación es instantáneo (QA-5, I-15) | Terminada y desplegada en el entorno de pruebas; falta la prueba en iPhone |
| Iteración 13 | Llaves de acceso (passkeys) | Entrar con Face ID, huella o PIN, sin contraseñas que se puedan suplantar (ADR-0009) | Terminada y desplegada en el entorno de pruebas; falta la prueba en iPhone |
| Iteración 14 | Interfaz rehecha con la dirección Consola (`DESIGN.md`) | Una herramienta que la gente quiera usar: jerarquía clara, confirmaciones donde hay consecuencias, resultados junto a la acción | Terminada y desplegada en el entorno de pruebas; falta la prueba en iPhone |
| Iteración 15 | Avisos push (técnicos y oficina) e instalación guiada de la app | El técnico se entera de su visita sin abrir la app; nadie captura en Safari lo que la app instalada no ve (ADR-0002) | Terminada y desplegada en el entorno de pruebas; falta la prueba en iPhone |
| Iteración 16 | Firma del cliente en sitio | Constancia de la visita firmada en el teléfono, íntegra (Ley 527) | Terminada y desplegada en el entorno de pruebas; falta la prueba en iPhone |
| Iteración 17 | Catálogo en el teléfono al anotar cantidades | Líneas que llegan vinculadas: menos digitación y cotización casi automática (P28) | Terminada y desplegada en el entorno de pruebas; falta la prueba en iPhone |
| Iteración 18 | Bocetos: pantalla completa, hojas con nombre, enderezar trazos, formas, mover, cotas | Croquis limpios y grandes, un piso por hoja (F3) | Terminada y desplegada en el entorno de pruebas; falta la prueba en iPhone |
| Iteración 19 | Biblioteca de símbolos en los bocetos | Tableros, UPS, tomas y demás con un toque, iguales en todo croquis | Terminada y desplegada en el entorno de pruebas; falta la prueba en iPhone |
| Iteración 20 | Contactos del cliente e informe por correo y WhatsApp | El informe le llega al cliente por donde lo espera, con PDF adjunto (P17) | Terminada y desplegada en el entorno de pruebas; el correo sale de verdad por Resend, WhatsApp sigue simulado hasta tener el número de prueba de Meta |
| Iteración 21 | Cotizaciones desde las cantidades | De la visita a la cotización sin volver a digitar (P27, QA-12) | Terminada y desplegada en el entorno de pruebas (precios de prueba; faltan los de TEINS) |
| Iteración 22 | Campo rehecho con la dirección Recorrido (`DESIGN.md`) | Una app que los técnicos quieran usar: la captura sigue la visita paso a paso en vez de una lista interminable | Terminada, desplegada en el entorno de pruebas y aprobada por Kevin en su iPhone |
| Iteración 23 | Oficina con la identidad Recorrido (`DESIGN.md`) | Oficina clara y sin recuadros: cada pantalla ordenada por lo que hace la persona, con búsqueda en las listas | Construida y desplegada en el entorno de pruebas (con la ronda de revisión, 2026-09-29); falta que Kevin la apruebe |
| Iteración 24 | Robustez y protección: nada se pierde ni se hace sin querer | Borradores que se borran solos, dobles envíos, errores invisibles y acciones con consecuencias sin confirmar | 24a, 24b y 24c desplegadas en pruebas; 24d pasó a ADR (0031 a 0035) y a las iteraciones 25 a 28 |
| Iteración 25 | Usuarios y cuenta propia (ADR-0033): contraseña temporal obligatoria, cambiar la propia, quitar el propio segundo factor, reactivar | Una contraseña temporal que se usa para siempre y nadie que pueda cambiar la suya | Terminada, desplegada en el entorno de pruebas y en producción (2026-10-01) |
| Iteración 26 | Vista en vivo de los documentos (ADR-0031): la cotización, el informe, el capítulo en la revisión y lo que recibe cada contacto, al lado mientras se escribe | Oficina publica sin ver lo que recibe el cliente, y una versión publicada no se cambia | Desplegada en el entorno de pruebas, aprobada por Kevin y en producción (2026-10-01) |
| Iteración 27 | Flujos: View Transitions en campo y oficina, sin Motion; revisar en serie, el avance de publicar en su lugar, «Ver la siguiente visita» y notificaciones con su siguiente paso | Flujos que saltan, animan de más o terminan sin decir qué sigue | Desplegada en el entorno de pruebas y en producción (2026-10-01), a pedido de Kevin; falta que la pruebe |
| Iteración 28 | Datos que se corrigen (ADR-0034 y ADR-0035): cancelar un envío en cola, retirar una versión de cotización, editar y archivar clientes y sitios, corregir comentarios y descartar levantamientos en campo | Un error que no se puede corregir sin borrar historia o tocar lo publicado | Desplegada en el entorno de pruebas y en producción (2026-10-02); falta que Kevin la pruebe |
| Iteración 29 | Ajustes de oficina: formularios cortos en diálogo, Mi cuenta centrada, la cotización que no se corta, enviar solo a quien falta, nuevo cliente con su contacto, la revisión (materiales en tabla, informe legible, «Marcar revisado» arriba) y el fallo de «Regenerar acceso» | Formularios con media pantalla en blanco, una página que se corta al bajar y una clave regenerada que nunca se mostraba | Desplegada en el entorno de pruebas (2026-10-02) y aprobada por Kevin ("la aplicación de oficina ya quedó bien", 2026-10-03) |
| Iteración 30 | El correo que escribe oficina (ADR-0036): asunto y texto editables al publicar y al enviar, sobre la vista previa del correo | El correo al cliente siempre igual, sin el toque de quien lo envía | Desplegada en el entorno de pruebas (2026-10-02) y aprobada por Kevin ("la aplicación de oficina ya quedó bien", 2026-10-03) |
| Iteración 32 | Ajustes de campo: movimiento más rápido y desde el borde, Tu cuenta en una lista, tableros en filas con su menú, el pie del catálogo, la barra del croquis, la entrega del teléfono al cliente, la constancia firmada, «Revisa y envía» con contenido y Enviados en dos líneas | Pantallas que se abrían de golpe, botones que confundían y una lista que se desbordaba con un error largo | Desplegada en el entorno de pruebas (2026-10-03); falta que Kevin la pruebe en su iPhone |
| Iteración 33 | Época de la bajada (ADR-0038): el teléfono se entera de que el servidor se dejó limpio | Después de limpiar un entorno, los teléfonos mostraban visitas y enviados que ya no existían hasta reinstalar la app | Desplegada en el entorno de pruebas con la migración `0034` y la app 13 (2026-10-03) |
| Iteración 34 | Firma en una sola pantalla: la constancia, el nombre y el recuadro juntos | Una pantalla de bienvenida con media pantalla en blanco antes de poder firmar | Desplegada en el entorno de pruebas (2026-10-04); falta probarla en el iPhone |
| Iteración 35 | Qué sale en el informe (ADR-0039): oficina oculta secciones, fotos y croquis; no salen por omisión el croquis de campo ni lo «solo para la empresa» | El cliente recibía las fotos de llegada y el croquis de campo, que son para la empresa | Desplegada en el entorno de pruebas con la migración `0035` y el formato de prueba v9 (2026-10-04); falta que Kevin la pruebe |
| Iteración 31 | Visitas con horario (ADR-0037): todo el día, de una hora a otra o hasta que el técnico la termine; solo técnicos libres al programar | Una visita ocupaba el día entero y se podía asignar a quien ya estaba ocupado | Desplegada en el entorno de pruebas con la migración `0033` y la app 12 (2026-10-02); oficina aprobada por Kevin el 2026-10-03, falta la prueba en el iPhone |
| Iteración 36 | Usabilidad de oficina: la vista previa que se oculta, se amplía y cambia de ancho; el guardado automático; el menú plegable; lo que se recuerda de cada persona; ordenar arrastrando; atajos en Mac y Windows | Trabajo que se perdía sin «Guardar borrador», la hoja fija en la mitad, el menú siempre abierto y cada lista que volvía a empezar | Desplegada en el entorno de pruebas (2026-10-04) |
| Iteración 37 | Buscar en todo con ⌘K / Ctrl + K (recientes, acciones, secciones y resultados por grupo) y revisar en serie con el teclado (J, K, Enter, T, R, S, Esc y «?») | Cada lista buscaba solo lo suyo y revisar varios exigía ir y volver con el ratón | Desplegada en el entorno de pruebas (2026-10-04) |
| Iteración 38 | La revisión armada como el informe: datos a la izquierda; a la derecha, un panel a todo el alto con «En el informe», «Comentarios» e «Historial»; el estado en la barra | El capítulo en una caja de 520 px dentro de un carril de tarjetas | Desplegada en el entorno de pruebas (2026-10-06); falta que Kevin la pruebe |
| Iteración 39 | Conversaciones entre oficina y campo: el técnico responde los comentarios desde un chat en el teléfono, con o sin señal; oficina responde en hilos; «sin leer», avisos y «Leído» (ADR-0040) | El técnico no podía contestar un comentario; las aclaraciones iban por llamada o WhatsApp y no quedaban en el levantamiento | Desplegada en el entorno de pruebas con la migración `0036` y la app 14 (2026-10-06); falta que Kevin la pruebe en su iPhone |
| Iteración 40 | Lo atendido no es la siguiente visita (ADR-0041 y ADR-0042) | Una visita ya hecha seguía como «Siguiente visita» y se acumulaba en el teléfono | Desplegada en el entorno de pruebas con la migración `0037` y la app 15 (2026-10-06) |
| Iteración 41 | Nada queda a medias ni crece sin fin (ADR-0043 y ADR-0044): lo que espera la app nueva, la foto rechazada, el envío sin salida, los trabajos a medias, la retención de 30 días, la poda del servidor y el estado que no se actualizaba | Trabajo atascado para siempre, un teléfono que se llena y pantallas que no se enteran del paso del tiempo | Desplegada en el entorno de pruebas y en producción con la migración `0038` (2026-10-06) |
| Iteración 42 | Lo que se ve sale de lo guardado (ADR-0045): el tablero quitado que se seguía pidiendo, los pasos que volvían vacíos y borraban materiales, lo que llegaba tarde a un tablero quitado, el croquis grande, el envío rechazado que vuelve a borrador, y la misma familia en oficina y servidor | Un tablero quitado bloqueaba el envío, lo capturado se perdía al volver a un paso y oficina podía escribir un documento sobre otro | Desplegada en el entorno de pruebas y fusionada a `master` (2026-10-15); producción sigue apagada |

Con el corte 5 queda el **recorrido delgado** completo. Después, iteraciones por riesgo: secciones repetibles, bocetos (ADR-0019), cantidades con catálogo y exportación, passkeys y segundo factor, cifrado local, gestión de visitas y clientes, administración de usuarios y dispositivos, salud de dispositivos (ADR-0017), entorno de producción y simulacro de restauración (ADR-0016).

## Próximo paso

**Iteración 42 desplegada en el entorno de pruebas (2026-10-15).** Kevin encontró en producción que un tablero quitado se seguía pidiendo al enviar. La investigación lo reprodujo y encontró la misma familia de fallos en campo, oficina y servidor, todos arreglados (sección "Iteración 42", ADR-0045). Una quinta tanda cerró lo menor que dejaron las revisiones, y todo `corte-0` pasó a `master` con un pull request el mismo día. Siguiente: que Kevin pruebe la 42 en su iPhone (agregar y quitar tableros, volver a pasos ya capturados, materiales, croquis) y en oficina. Después, producción cuando la vuelva a encender: respaldo antes, y `campo`, `oficina`, `portal` y `worker`, sin migración. Pendiente de antes: probar de la 38 a la 41 y lo que entregue TEINS.

**Producción apagada (2026-10-10):** sin datos reales costaba lo mismo que el entorno de pruebas y el gasto iba a pasar el límite de USD 10 del mes. Sus servicios no tienen despliegue activo, con la base y la configuración intactas; cómo encenderla está en `docs/proceso/produccion.md`. El entorno de pruebas sigue igual.

**Producción al día (2026-10-06):** las iteraciones 29 a 41 están en producción. Antes se sacó un respaldo (`20261006T224752Z`); después se desplegó `campo`, que aplicó las migraciones `0033` a `0038`, y luego `worker`, `oficina` y `portal`. El worker arrancó con la tarea periódica y las tres superficies responden. Producción sigue sin formatos publicados hasta que TEINS entregue los suyos.

**Siguiente: que Kevin pruebe las iteraciones 38 a 41, y la 39 a la 41 también en su iPhone (campo, app 15).** La 41 (sección "Iteración 41") cierra los fallos de la misma familia que el de la 40: trabajo que se atascaba para siempre, datos que crecían sin fin y estado que no se actualizaba. Después: lo que entregue TEINS (precios, plantilla P29, tributario, numeración, símbolos y formatos).

**Antes (iteración 40):** que Kevin pruebe las iteraciones 38, 39 y 40 en el entorno de pruebas, la 39 y la 40 también en su iPhone (campo, app 15). La 40 arregla que lo atendido siguiera como «Siguiente visita» (sección "Iteración 40"). Las dos están construidas, verificadas y desplegadas en el entorno de pruebas (2026-10-06); el detalle, las decisiones y la evidencia están en la sección "Iteraciones 38 y 39". Después: producción de la 29 a la 39 (`campo` primero) y lo que entregue TEINS.

**Iteración 37 (buscar en todo y revisar con el teclado) construida, verificada y desplegada en el entorno de pruebas el 2026-10-04** (sección "Iteración 37"), sin operación nueva en el servidor. Sigue: que Kevin pruebe la 36 y la 37, en Mac y, si puede, en Windows.

**Iteración 36 (usabilidad de oficina) construida, verificada y desplegada en el entorno de pruebas el 2026-10-04** (sección "Iteración 36"). Kevin aprobó el prototipo `prototipos/usabilidad-oficina/prototipo.html` (https://claude.ai/artifact/EQDmHRyzPDiWvDmdsQdBDw) pidiendo que los atajos se entiendan en Windows (versión 2). Sigue: que Kevin la pruebe (en Mac y, si puede, en un equipo con Windows), y la iteración 37 (⌘K / Ctrl + K y los atajos para revisar en serie, con la operación nueva `buscar`).

**Iteraciones 34 y 35 construidas, verificadas y desplegadas en el entorno de pruebas el 2026-10-04** (sección "Iteraciones 34 y 35"), con el formato de prueba v9 publicado allí. Kevin aprobó el prototipo `prototipos/informe-y-firma/prototipo.html` (https://claude.ai/artifact/4BgK3s9xXkizCK3x7exodN): "perfecto. Empieza la implementacion". Sigue: que Kevin lo pruebe (la firma en el iPhone; el informe en oficina con una visita nueva, que use el formato v9), el arreglo propuesto del correo editable en Safari, y producción de la 29 a la 35 (respaldo antes, `campo` primero por la `0033` a la `0035`, y publicar el formato que corresponda).

**Iteraciones 32 y 33 construidas, verificadas y desplegadas en el entorno de pruebas el 2026-10-03** (sección "Iteraciones 32 y 33"). Kevin aprobó el prototipo `prototipos/ajustes-campo/prototipo.html` (https://claude.ai/artifact/ALQohRzdD6UgBLW1bYmDDX) con un cambio: "la animacion puede ser un poquito mas rapida". Sigue: que Kevin la pruebe en su iPhone (el teléfono se actualiza a la app 13 y baja todo de nuevo) y producción de la 29 a la 33 cuando lo apruebe (respaldo antes y `campo` primero por la `0033` y la `0034`).

**Iteraciones 29 a 31 construidas, verificadas y desplegadas en el entorno de pruebas el 2026-10-02** (sección "Iteraciones 29 a 31"). Kevin aprobó el prototipo `prototipos/ajustes-oficina/prototipo.html` (https://claude.ai/artifact/Ms1PjHDXDjL1YhsDCdbSqu) con sus cambios ("Si, empieza. Deja todo tal cual me lo mostraste en el artifact"). Sigue: que Kevin compare cada pantalla con el prototipo; la prueba en el iPhone de «Terminar visita» (toca campo); y producción cuando Kevin lo apruebe (respaldo antes y `campo` primero por la `0033`).

**Base visual Precisión en la app, desplegada en el entorno de pruebas y aprobada por Kevin el 2026-09-30. Siguiente: iteración 24c sobre la base nueva.** Kevin dijo que la app "parece de juguete" y eligió la dirección Precisión entre tres comparadas. El prototipo aprobado es `prototipos/base-visual/prototipo.html` (https://claude.ai/artifact/MkRSHwecL2gXCZQ8zfHCrY): sus bloques `.app[data-tema=…]` son los valores de los tokens en claro, oscuro y del sistema, y sus seis pantallas (bandeja, detalle con confirmación, cotización, inicio de sesión y campo) son la referencia visual. Orden acordado: 1) prototipo (hecho) → 2) base en la app → 3) prueba de campo al sol en el iPhone → 4) iteración 24c sobre la base nueva → 5) flujos (Motion en oficina, View Transitions en campo). La vista en vivo de los documentos es una propuesta aparte (sección "Propuesta · Vista en vivo de los documentos"), para después de 24c.

El paso 2, en este orden y comparando cada pantalla con el prototipo en capturas del mismo tamaño:

1. `DESIGN.md`: la identidad Precisión reemplaza a Recorrido (color, tipografía, forma, iconos, logo, confirmaciones sin icono), y la regla del nombre público (abajo).
2. `paquetes/ui`: Geist por `@fontsource-variable/geist` en lugar de Atkinson; tokens de `tema.css`/`tokens.css` y `oficina.css` con los valores del prototipo; pesos de 400 a 600, escala de 12 a 22 px en oficina, radios de 7 a 12 px, bordes de 1 px, iconos Lucide con trazo 1,6; tema claro, oscuro y del sistema con un selector que se recuerda en el equipo (por omisión, el del sistema).
3. El logo oficial (`prototipos/base-visual/logo-teins.png`, PNG de 292 × 90) en el inicio de sesión, el menú y los PDF; en oscuro, en blanco por filtro hasta tener de TEINS la versión en negativo y el vector.
4. Nombre público: solo "TEINS". Campo, oficina y portal son nombres internos que no se muestran: corregir `oficina/index.html` ("TEINS Oficina"), `campo/index.html` ("TEINS Campo"), `portal/index.html` ("TEINS · Informes"), la etiqueta "Abriendo TEINS Oficina" de `oficina/src/rutas.tsx` y el archivo de códigos de respaldo de `Administracion.tsx`. No repetir "TEINS" junto al logo.
5. Pantallas: inicio de sesión de oficina y campo como el prototipo (logo arriba, tarjeta de borde fino, campos de 46 px, degradado vertical con los azules de TEINS), marco de oficina (menú con el logo, barra superior de 48 px), bandeja, detalle, confirmación, cotización (solo la forma; la hoja en vivo es la propuesta aparte), campo y portal.
6. Verificación completa, despliegue en el entorno de pruebas y prueba de Kevin en el iPhone al sol.

**Avance del paso 2 (2026-09-30):**

- Hechos 1 a 4, más el inicio de sesión del 5. `DESIGN.md` describe Precisión.
- Tokens: una sola paleta con `light-dark()`, así que el tema lo elige `color-scheme` y una isla `data-tema="claro"` (croquis, firma, hoja) se ve clara sin repetir valores. `oficina.css` toma sus papeles de los tokens y pierde el amarillo. Pesos de 400 a 600 (las clases de más peso caen en 600 desde `tema.css`).
- Geist en la interfaz y en los PDF. Selector de tema ("Del sistema", "Claro", "Oscuro") en la cuenta de campo y en "Mi cuenta" de oficina, recordado en el equipo (`teins-tema`); el portal sigue al sistema.
- Logo oficial en el menú de oficina, los dos inicios de sesión y los PDF (portada del informe en blanco, encabezado de la cotización). Nombre público "TEINS" en los títulos, la etiqueta de carga y el archivo de códigos de respaldo.
- Inicio de sesión de oficina, campo y portal igual al prototipo, con piezas compartidas en `paquetes/ui/src/Ingreso.tsx`. "¿La olvidó?" dice qué hacer al tocarlo. Los campos de ingreso miden 16 px de letra (15 en el prototipo) para que el iPhone no acerque la pantalla al escribir.
- Marco de oficina: menú de 208 px con el grupo "Documentos" y barra superior de 48 px con la ubicación; `EncabezadoPagina` la pone ahí por un portal (`DestinoBarraSuperior`), sin tocar las pantallas.
- Bandeja en filas de una línea, como el prototipo: cliente · sitio, formato en gris, el técnico con sus iniciales, "Recibido" y "Lleva esperando" aparte. El número de fotos sale: no está en el prototipo aprobado.
- `Confirmacion` sin icono, con la lista `consecuencias` y los atajos Esc y ↵ en oficina. Decisión: con consecuencias y nada que escribir, el foco empieza en la acción (↵ confirma); lo irreversible deja el foco en "Cancelar" y no lleva ↵ (`DESIGN.md`). "Marcar revisado" ya usa la lista.
- Detalle y cotización conservan su estructura con la forma de Precisión: carril de paneles de borde fino, filas de datos con líneas, impuestos como opciones con borde (una debajo de otra) y totales a 18 px.
- Campo: tarjeta de la siguiente visita y lista de visitas como el prototipo; en claro, las tarjetas llevan borde de 1 px (blanco sobre casi blanco no se veía). Barra de paso de 3 px, botón de abajo de 50 px, "Agregar" punteado fino.
- Arreglado de paso: la notificación en oscuro ponía texto blanco sobre fondo casi blanco.
- Verificado: typecheck, arquitectura, pruebas de paquetes, presupuesto (125,2 de 135 KB) y el extremo a extremo completo en local. Capturas en claro y oscuro comparadas con el prototipo.
- Visitas, clientes (lista y detalle), catálogo, informes, cotizaciones y administración (con el segundo factor) comparadas en claro y oscuro: las pastillas de filtro y de motivo pasan a borde fino con la marca al elegirlas, los técnicos de "Programar visita" van en una lista con líneas y las etiquetas de los campos pesan 500. El cambio de tema desde el selector se probó con foco y cursor encima.
- Pantallas angostas de oficina arregladas: bajo 1100 px el logo queda en sus anillos y el conteo es una pastilla; bajo 640 px el menú pasa a una franja arriba (antes quedaba como columna a todo lo alto, porque la regla angosta estaba antes que la del menú).
- **Desplegado en el entorno de pruebas el 2026-09-30** (commit 6d6c4e1: campo, oficina, portal y worker, sin variables ni migraciones nuevas). Verificado allí: salud de las tres superficies, cada una con la versión nueva (`<title>TEINS</title>`), las cabeceras de seguridad, `verificar-exposicion.sh` y el extremo a extremo en Chromium, un archivo por minuto: 22 de 23 a la primera; en `borradores.spec.ts` la quinta prueba no pasó del ingreso (el límite de 5 por minuto dentro del mismo archivo) y sola pasó.
- **Aprobado por Kevin el 2026-09-30:** campo, oficina y portal en el entorno de pruebas, y las tres decisiones (sin el número de fotos en la bandeja, ↵ solo en lo que no es irreversible y sin nada que escribir, letra de 16 px en los campos de ingreso). El tema sigue por omisión al del sistema; cada técnico lo cambia en "Tu cuenta › Tema".
- **ADR del 2026-10-01, decididos por Kevin el mismo día:**
  - **Aceptados:** 0031 (vista en vivo de los documentos), 0034 (cancelar envíos en cola y retirar cotizaciones; reemplaza a 0029 en ese punto) y 0035 (editar y archivar clientes, sitios y comentarios; descartar borradores en campo). Falta darles iteración y orden frente a los flujos.
  - **0033 (usuarios y cuenta propia), aceptado después:** Kevin lo pasó de aplazado a primordial el mismo día. Hoy una contraseña temporal se queda para siempre y nadie cambia la suya.
  - **Aplazado:** 0032 (soltar, reabrir y devolver una revisión), porque hoy cada caso tiene una salida, aunque torpe.
  - **Iteración 25, prototipo aprobado por Kevin el 2026-10-01** (`prototipos/cuenta/prototipo.html`, https://claude.ai/artifact/97Z8ofejry715dkhVd64Ww). Kevin pidió no bajar la seguridad: el prototipo empieza por una tabla de cada regla con lo que ve la persona y lo que exige el servidor aunque se llame a la API sin pasar por la pantalla. **Construida, verificada y desplegada en el entorno de pruebas el 2026-10-01** (sección "Iteración 25"). **En producción desde el mismo día** (respaldo antes de la 0030; Kevin corrió las escrituras). Sigue: la iteración 26, con su prototipo en Precisión primero. **Prototipo de la iteración 26 hecho y aprobado por Kevin el 2026-10-01** (`prototipos/vista-en-vivo/prototipo.html`, https://claude.ai/artifact/KMNfFJPu6FkPF2SZx1zUud), con sus siete decisiones: versiones y envíos al final del editor; bajo 1280 px, «Vista previa» en hoja lateral; pestaña «En el informe» en el carril de la revisión, que se ensancha; «Enviar a otro contacto» como hoja lateral con lo que recibe cada uno; los saltos de página forzados como una franja; la confirmación de publicar sin el PDF del servidor; y `[Precio]` en la hoja para una línea sin precio. Detalles técnicos que el prototipo ya resuelve: el marco se arma una vez y al escribir se reemplaza solo el cuerpo; la revisión marca el dato por `data-dato` en la fila (el PDF lo ignora) en lugar de cambiar la plantilla. **Construida y desplegada en el entorno de pruebas el mismo día** (sección "Iteración 26"). **Aprobada por Kevin en el entorno de pruebas el mismo día.** Sigue: llevarla a producción (con la migración `0031`: respaldo antes y `campo` primero) y la iteración 27 (flujos), con su prototipo primero. **Prototipo de la iteración 27 hecho el 2026-10-01** (`prototipos/flujos/prototipo.html`, https://claude.ai/artifact/EH56tcLrrRmHoBbsTrNg8X), a partir de un inventario de los flujos de campo y oficina (dónde saltan, qué se anima de más, qué termina sin decir qué sigue) y referencias de Mobbin (Jobber, Linear, Stripe). Kevin aprobó el prototipo y sus seis decisiones el mismo día: View Transitions en las dos superficies y sin Motion; revisar en serie con «Siguiente»; el avance de publicar en su lugar; «Ver la siguiente visita»; notificaciones con su siguiente paso; y que Administración avise como las demás. **Construida, verificada en local y desplegada en el entorno de pruebas el mismo día** (sección "Iteración 27"). **En producción con la 26 el mismo día** (respaldo antes y `campo` primero por la `0031`). Sigue: que Kevin pruebe la 27; después, la iteración 28 (ADR-0034 y ADR-0035), con su prototipo primero. **Prototipo de la iteración 28 hecho el 2026-10-02** (`prototipos/correcciones/prototipo.html`, https://claude.ai/artifact/5zrTMQo97hoNsoWUmxKwyN), con referencias de Mobbin (Notion Mail, Customer.io y Wrangle para cancelar lo que espera salir; Journal y Apple Notes para la papelera con plazo; Campsite para el menú del comentario). Kevin aprobó el prototipo y sus seis decisiones el mismo día: cancelar sin confirmar y con «Deshacer»; «Retirar versión» solo en la vigente y para quien administra, con motivo; el cambio de un cliente visible en su encabezado y el registro completo en la auditoría; archivar bloqueado con visitas por hacer y la pestaña «Archivados»; borrar un comentario sin confirmar, con «Deshacer», solo su autor y hasta Revisado; y «Descartar levantamiento» al final del recorrido, con la papelera en «Tu cuenta». **Construida, verificada en local y desplegada en el entorno de pruebas el mismo día** (sección "Iteración 28"), con una decisión más: no se archiva el único sitio activo de un cliente. **En producción el mismo día** (respaldo `20261002T174223Z` antes y `campo` primero por la `0032`). Sigue: que Kevin pruebe la 27 y la 28.
  - **Orden acordado:** iteración 25, usuarios y cuenta propia (0033); 26, vista en vivo de los documentos (0031), empezando por la cotización; 27, flujos (Motion en oficina, View Transitions en campo); 28, datos que se corrigen (0034 y 0035). Cada una con su prototipo en Precisión antes del código.
- **Producción actualizada el 2026-10-01** a la base Precisión y la iteración 24 (24a, 24b y 24c), desde el commit 2bee250. Kevin corrió las escrituras: `railway config plan` sin diferencias (no hizo falta `apply`), un respaldo antes de la migración (`ahora.sh`, `20261001T021546Z`, listo), `campo` (aplicó la 0029) y después `oficina`, `portal` y `worker`. Verificado: salud y las 7 cabeceras en las tres superficies, cada una con el código nuevo (título "TEINS"; "Guardar y salir" en oficina y el botón atrás en campo), `verificar-exposicion.sh` y el worker sin errores. En producción no se corre el extremo a extremo (ADR-0021).
- **Iteración 24c construida y desplegada en el entorno de pruebas el 2026-09-30** (sección "Iteración 24", decisiones "En 24c"; commits 6d93824..60bac54). Verificada en local con el extremo a extremo completo (93 pasan, 3 se saltan) y en el entorno con sus archivos en Chromium, uno por minuto: pasaron todos; cuatro que chocaron con el límite de ingresos o con un `railway ssh` lento pasaron solos. Sigue: 24d (la propuesta de funciones que faltan, con ADR nuevos) o los flujos (Motion en oficina, View Transitions en campo), cuando Kevin decida.
- Antes: **Prototipo de 24c hecho el 2026-09-30** (`prototipos/proteccion/prototipo.html`, https://claude.ai/artifact/EoVS2kxrxDJCoBGZoHTN7G), esperando el visto bueno de Kevin: el resumen clasifica cada acción y nueve casos se prueban en la pantalla. Propone, entre otras cosas: desactivar un ítem y quitar un tablero al instante con «Deshacer»; «Guardar y salir» primero al salir con cambios; el motivo obligatorio al corregir un dato; la hoja de reasignar dice quién deja de ver la visita y quién la recibe; restablecer contraseña lista las cuatro consecuencias (incluido el segundo factor) y no se ofrece para uno mismo; quitar la propia llave pasa a azul.

Estado del repositorio al cerrar la sesión del 2026-09-29: el repositorio de GitHub se recreó con el historial sin coautor (PR #1 en borrador, abierto de nuevo) y `corte-0` está subida. 24a y 24b están desplegadas en el entorno de pruebas.

**Iteración 24, robustez y protección (2026-09-29).** Aprobada por Kevin antes del rediseño visual (sección "Iteración 24"). 24a (los 12 fallos del grupo A) hecha y desplegada en el entorno de pruebas el 2026-09-29, con sus 17 pruebas en verde allí. 24b (piezas compartidas) hecha y desplegada en el entorno de pruebas el 2026-09-29, con sus pruebas en verde allí. Siguiente: 24c, aplicar la regla de `DESIGN.md` a las acciones de los grupos B, C y E con esas piezas. Producción se actualizó el 2026-09-29 en otra sesión (`README.md`, `produccion.md`).

**Revisión de seguridad por áreas (2026-09-29).** Las correcciones de 4a a 4d están hechas, desplegadas en el entorno de pruebas y verificadas allí el 2026-09-29: salud de las tres superficies, cabeceras de seguridad, `verificar-exposicion.sh`, la IP real del cliente en el registro también con un `X-Forwarded-For` falso, respaldo cifrado con simulacro correcto (177 cadenas, 27 archivos) y los 22 del extremo a extremo en Chromium (un archivo por minuto: la suite seguida choca con el límite de ingresos por IP, `entorno-de-pruebas.md`). Las de 4e (campo y portal) están hechas, desplegadas en el entorno de pruebas y verificadas allí el 2026-09-29 con `e2e/pruebas/cierre-de-sesion.spec.ts` (2 de 2 en Chromium): sin otra clave para un técnico con borrado pendiente, cierre de sesión sin señal completado en el servidor al volver la señal, "Salir" del portal que dice si no llegó al servidor, diagnóstico solo con las fotos propias y avisos que solo abren la propia app. Tres hallazgos de 4e no eran errores: el motivo de la visita que ve el cliente se elige de la lista del lenguaje común (Mantenimiento, Cotización, Modificación), las huellas de los archivos a la vista las acepta ADR-0022 y el código del QR no es secreto (ADR-0009, parte 4). **Producción actualizada el 2026-09-29** a esta versión (iteraciones 9 a 23, migraciones 0014 a 0028 y la revisión de seguridad), en este orden: `railway config plan` (7 cambios y 2 borrados, los previstos); `infra/railway/claves-avisos.sh`, nuevo: producción se montó antes de la iteración 15 y su `worker` no tenía el par VAPID, sin el cual `campo` y `oficina` reciben la pública vacía por referencia y la configuración no las deja arrancar ni migrar; `infra/respaldos/clave.sh teins-produccion`; `railway config apply --yes --confirm-destructive` (después, el plan sin diferencias; el redespliegue de la imagen anterior falló en `oficina` y `portal` sin la variable del dueño y Railway dejó la versión que corría, como en pruebas); el despliegue de `campo`, que migró, y después `oficina`, `portal`, `worker` y `respaldos`. Verificado: los cinco en `SUCCESS`, cada superficie con el paquete recién compilado, salud y las 7 cabeceras de seguridad en las tres, `verificar-exposicion.sh`, la IP real en el registro también con `X-Forwarded-For: 203.0.113.77`, el primer respaldo cifrado (los volcados en claro pasaron a `cifrado/`) y el simulacro correcto (`produccion.md`). Los secretos, el `apply` y los despliegues los corrió Kevin: el clasificador de permisos no deja que un agente escriba en producción. En producción no se corre el extremo a extremo (ADR-0021); falta que Kevin entre a oficina con `administracion` y su segundo factor. Siguiente en la ronda de revisión: `/code-review max paquetes/campo`.

**Oficina con la identidad Recorrido (iteración 23, 2026-09-27).** Kevin pidió llevar a oficina la identidad de campo. Se hizo el prototipo (`prototipos/oficina/prototipo.html`); Kevin rechazó la primera versión por agobiante (todo en recuadros) y se rehízo ordenando primero la información de cada pantalla. Aprobado el prototipo, la app quedó igual a él, pantalla por pantalla, sin tocar funciones: solo se agregó al servidor la búsqueda opcional de la bandeja y el nombre del formato en la lista. Desplegada en el entorno de pruebas el 2026-09-29 con la ronda de revisión de código. Siguiente: que Kevin la revise.

**Rediseño de campo (iteración 22, 2026-09-27).** Kevin dijo que todo funciona pero que la app es "demasiado fea". Se hizo una línea base con 21 problemas, una crítica con impeccable, referencias de Mobbin y un prototipo navegable (`prototipos/campo/prototipo.html`). Kevin aprobó la dirección Recorrido y quedó construida en campo y desplegada en el entorno de pruebas. Kevin la probó en el iPhone y aprobó el resultado. La identidad visual quedó anotada en `DESIGN.md` ("Identidad visual Recorrido") para llevarla a oficina más adelante; oficina no se toca hasta que Kevin lo pida. Siguiente: oficina con el mismo método, empezando por cotizaciones, cuando Kevin lo decida.

**Plan acordado con Kevin el 2026-09-26: iteraciones 15 a 21** (sección "Iteraciones 15 a 21"). Kevin eligió siete funciones después de una investigación de producto (envío del informe por WhatsApp y correo, firma del cliente, símbolos y enderezado en los bocetos, ítems frecuentes en cantidades, avisos push y cotizaciones) y pidió terminar primero la PWA de campo. **Iteración 15 terminada y desplegada en el entorno de pruebas el 2026-09-26** (avisos push, ADR-0023, e instalación guiada; maquetas en el lienzo, página "v0.4 · Avisos e instalación"). Falta la prueba en iPhone (fase 15 de la guía, junto con las fases 9 a 14). **Iteración 16 (firma del cliente, ADR-0024) terminada y desplegada en el entorno de pruebas el 2026-09-26**, con el formato de prueba v7; falta la prueba en iPhone (fase 16 de la guía). **Iteración 17 (catálogo en el teléfono, ADR-0025) terminada y desplegada en el entorno de pruebas el 2026-09-26**; falta la prueba en iPhone (fase 17 de la guía). **Iteración 18 (croquis a pantalla completa con hojas, ADR-0026) terminada y desplegada en el entorno de pruebas el 2026-09-26** (maquetas aprobadas en la página "v0.8 · Croquis a pantalla completa"); falta la prueba en iPhone (fase 18 de la guía). **Iteración 19 (símbolos en el croquis, ADR-0027) terminada y desplegada en el entorno de pruebas el 2026-09-26**, con la biblioteca de prueba publicada; falta la prueba en iPhone (fase 19 de la guía) y la lista de símbolos de TEINS. **Iteración 20 (contactos del cliente e informe por correo y WhatsApp, ADR-0028) construida el 2026-09-27** con maquetas aprobadas (página "v1.0 · Informe por correo y WhatsApp"), y desplegada en el entorno de pruebas: el correo sale de verdad por Resend (dominio de pruebas `deportur.tech`) y WhatsApp sigue simulado hasta tener el número de prueba de Meta con la plantilla `informe_publicado` aprobada (sección "Iteración 20", "Fuera"). WhatsApp queda en espera: el 2026-09-27 Kevin avisó un problema con su cuenta de Meta. **Iteración 21 (cotizaciones desde las cantidades, ADR-0029) construida el 2026-09-27** con maquetas aprobadas (página "v1.1 · Cotizaciones") y precios de prueba: con ella se cierra el plan de las iteraciones 15 a 21. Siguiente: la prueba en iPhone de las fases 9 a 19 (antes, revisar por qué `bajada.spec` falla contra el entorno), la cuenta de Meta para WhatsApp, y lo que TEINS entregue: lista de precios, plantilla de la cotización (P29), tratamiento tributario, numeración y lista de símbolos. Pendiente menor: las fallas intermitentes de `repeticiones.spec` (WebKit, local) y `bajada.spec` (entorno). El JavaScript inicial de campo está en 119,9 de 120 KB: cualquier cosa nueva de campo debe cargarse aparte.

**El recorrido delgado está completo (cortes 0 a 5, 2026-09-25)** y desplegado en el entorno de pruebas. Antes de la primera demostración a TEINS:

1. **Verificación manual hecha por Kevin el 2026-09-25** en un iPhone 15 Pro con iOS 26.6.1 (fases 1 a 7 de [`verificacion-manual.md`](verificacion-manual.md); producción quedó para después). Todo funcionó salvo dos avisos que no aparecían, corregidos con su prueba de extremo a extremo y confirmados por Kevin en el iPhone el mismo día: "Oficina canceló esta visita" en el bloque azul de campo y "Su sesión se cerró" en el portal. Falta la fase 8 (producción), que Kevin dejó para después.
2. **Respuestas de TEINS** para ajustar el informe (P22, P23, P26, formato de los planos) y las preguntas P2, P5, P7, P8 y P9.

**Iteración 14 terminada el 2026-09-26:** la interfaz de campo, oficina y portal rehecha con la dirección Consola, elegida por Kevin entre tres comparadas en el lienzo, más la columna "Visita" en la bandeja. Desplegada en el entorno de pruebas y verificada allí con los 12 archivos del extremo a extremo en Chromium (13 pruebas, uno por minuto por el límite de inicios de sesión). Falta probarla en el iPhone junto con las fases 9 a 13.

**Iteración 13 terminada el 2026-09-25:** llaves de acceso en campo y oficina, desplegadas en el entorno de pruebas y verificadas allí con `llaves.spec.ts` (cada superficie con su dominio). Con ella se completa la lista de iteraciones por riesgo que se trazó al cerrar el corte 5. La prueba en iPhone (fase 13 de la guía) queda en espera con las de las iteraciones 9 a 12.

**Iteración 12 terminada el 2026-09-25:** cifrado local en campo (ADR-0022), desplegado en el entorno de pruebas y verificado allí con `cifrado.spec.ts`. Lo guardado antes se cifra solo al abrir la app nueva, sin perder nada. La prueba en iPhone (fase 12 de la guía, antes de aceptar la actualización) queda en espera con las de las iteraciones 9 a 11.

**Iteración 11 terminada el 2026-09-25:** cantidades con catálogo de campo a Excel, desplegadas en el entorno de pruebas con el formato de prueba v6 ("Materiales"). Las columnas del catálogo y de los CSV son supuestas (P28, P29) hasta que TEINS responda. La prueba en iPhone de las iteraciones 9 a 11 está en espera (fases 9 a 11 de la guía).

**Iteración 10 terminada el 2026-09-25:** bocetos de campo al PDF, desplegados en el entorno de pruebas con el formato de prueba v5 ("Croquis del cuarto"). La prueba en iPhone de las iteraciones 9 y 10 está en espera (fases 9 y 10 de la guía).

**Iteración 9 terminada el 2026-09-25:** secciones repetibles de campo al PDF, desplegadas en el entorno de pruebas con el formato de prueba v4 ("Tableros"). Falta probarlas en el iPhone (fase 9 de la guía). Producción sigue con la versión anterior.

**Iteración 8 terminada el 2026-09-25:** producción provisional montada en `teins-produccion` con dominios gratuitos, recreable desde el repositorio, con respaldo diario y simulacro verificado; sin datos reales hasta transferirla a TEINS (ADR-0021, [`produccion.md`](produccion.md)). La rama está en GitHub (pull request #1, en borrador) con la integración continua en verde.

**Iteraciones 6 (administración) y 7 (visitas y clientes) terminadas el 2026-09-25** y desplegadas. Con ellas, TEINS opera el piloto desde las pantallas: solo la primera persona administradora y la publicación de formatos siguen por comando. En el entorno de pruebas, `oficina.prueba` tiene la marca de administrador (activa su segundo factor la primera vez que abre "Administración").

Siguiente, por riesgo (recomendación, a decidir con Kevin): lo que falta para el piloto no es código sino TEINS: su cuenta en Railway (para transferir producción), sus formatos reales (P7, P8), el formato del informe (P22, P23, P26) y su catálogo y columnas de Excel (P28, P29). Secciones repetibles, bocetos y cantidades ya están. Las iteraciones por riesgo que se trazaron están completas (6 a 13). Lo que más reduce el riesgo ahora no es código nuevo: **la prueba en iPhone de las fases 9 a 13** (en espera por Kevin) y **actualizar producción** a esta versión (también en espera). Mientras TEINS responde, lo siguiente en código es la **instalación guiada de la PWA en iPhone** (`docs/diseno/pendientes.md`, punto 4): hoy es un aviso con pasos, y es lo primero que ve un técnico nuevo.

**Entorno local, tal como quedó:** Docker Compose con PostgreSQL y S3Mock (`docker compose up -d --wait`); `paquetes/servidor/.env` creado a partir de `.env.example` (no versionado); base migrada y sembrada con la organización de desarrollo, los formatos de prueba v1, v2 y v3, los usuarios `tecnico.prueba` y `oficina.prueba`, y un cliente de prueba con una visita para `tecnico.prueba`. Las fotos subidas antes del 2026-09-24 se perdieron en local (S3Mock no guardaba en su volumen; ver decisiones del corte 2): la base las da por verificadas, así que esos levantamientos viejos muestran fotos rotas en oficina. Sus contraseñas no están en el repositorio: se fijan con `TEINS_CONTRASENA=... pnpm --filter @teins/servidor restablecer-contrasena --usuario <usuario>`. Docker corre sobre Colima; si las pruebas del servidor dicen "Could not find a working container runtime strategy", ejecutar `colima start`.

**Observado en la verificación del 2026-09-25:** una vez, en la corrida completa del extremo a extremo, `envio.spec.ts` en WebKit falló con "Falta 1 dato por completar" después de llenar todo; no se reprodujo (12 de 12 con 4 trabajadores en paralelo, y verde en todas las corridas completas antes y después). Se vigila; la integración continua reintenta una vez. Las pruebas de oficina ahora cargan más páginas de la bandeja hasta encontrar su levantamiento (`filaDeLaBandeja`): en un entorno con datos de corridas anteriores, el recién enviado quedaba fuera de la primera página de 50.

**Pendientes que no bloquean el cierre del corte 2:**

- Completar la fila de resultados del corte 0 (modelo de iPhone, versión de iOS, persistente, fotos íntegras) y repetir esa prueba en Android.
- Medir el presupuesto de JavaScript de campo en un celular de gama media (ADR-0011).
- La rama `corte-0` tiene los cortes 0, 1 y 2 sin fusionar ni subir: al subirla corre por primera vez la integración continua de GitHub Actions.

**Preguntas a TEINS antes del corte 3:** P7 y P8 (formatos y campos obligatorios reales), P9 (errores frecuentes). **Antes del corte 4:** P22, P23 y P26 (informe). **Antes del piloto:** P40 a P43.

---

## Corte 0 · Captura sin conexión y prueba de durabilidad en iPhone

**Para qué:** validar QA-1 con el almacenamiento real de `campo` antes de construir encima (ADR-0002, ADR-0004).

**Alcance:** formato ficticio de una sección con campos `texto`, `medida` y `foto`; levantamiento en borrador con guardado automático; fotos recodificadas sin metadatos con huella SHA-256 en la misma transacción que su referencia; IndexedDB con Dexie detrás de un puerto; PWA instalable con actualización ofrecida; panel de diagnóstico.

**Procedimiento de la prueba (ADR-0002):**

1. Instalar la app en la pantalla de inicio y abrirla desde ahí. Confirmar en el diagnóstico que el almacenamiento es persistente.
2. Activar modo avión.
3. Crear levantamientos y capturar unas 50 fotos repartidas entre ellos durante varias horas, con texto y medidas.
4. Cerrar la app desde el selector de apps. Reiniciar el teléfono.
5. Abrir la app sin conexión. En el diagnóstico, "Verificar fotos" debe informar todas las fotos íntegras y los textos deben estar completos.

**Resultados:**

| Fecha | Dispositivo | Sistema | Persistente | Fotos | Íntegras | Resultado |
|---|---|---|---|---|---|---|
| 2026-09-24 | iPhone [modelo por registrar] | iOS [versión por registrar] | [por registrar] | [N] | [N] | Sin pérdida, según Kevin |
| 2026-09-25 | iPhone 15 Pro | iOS 26.6.1 | Sí | 3 | 3 | Sin pérdida tras reiniciar el teléfono sin señal (verificación manual, fase 1) |

**Decisión:** se mantiene la PWA (ADR-0002); Capacitor no es necesario. Pendiente: completar la fila con los datos exactos y repetir en Android.

---

## Corte 1 · Envío a oficina

**Para qué:** que un levantamiento capturado sin conexión llegue al servidor **completo, una sola vez y con sus fotos verificadas**, aunque la señal se corte a mitad (QA-2), y que oficina lo vea. Es el primer corte con servidor, así que también deja la base de toda la arquitectura del servidor.

### Alcance

**Servidor, base de la arquitectura (ADR-0001, ADR-0010, ADR-0017)**

- Monolito modular con módulos `identidad`, `formatos`, `levantamientos`, `archivos` y `auditoria`. Cada módulo expone solo su interfaz pública; los núcleos (`levantamientos`, `formatos`) son hexagonales.
- Un código y dos roles de ejecución: `web` (API) y `worker` (trabajos).
- Configuración por variables de entorno validada al arrancar; el proceso no arranca con configuración inválida.
- Registros JSON con id de correlación por solicitud; nunca contenido de levantamientos ni secretos.
- Errores en formato Problem Details (RFC 9457) con códigos del dominio.
- Apagado ordenado: termina las solicitudes y trabajos en curso antes de salir.

**Base de datos (ADR-0005, ADR-0009)**

- PostgreSQL con un esquema por módulo y migraciones de Drizzle, siempre de expansión (ADR-0015).
- Organización en todas las tablas de negocio, con seguridad por fila: cada transacción fija la organización con `SET LOCAL` y la base filtra.
- El rol de la aplicación solo inserta y lee en auditoría; nunca actualiza ni borra.

**Identidad y autorización (ADR-0009)**

- Better Auth con usuario y contraseña; sesiones opacas en cookie `HttpOnly`, `Secure`, `SameSite`; revocar es borrar la sesión.
- Roles técnico y oficina; usuarios creados por un comando de administración (la pantalla llega en una iteración posterior).
- Módulo central de políticas. Toda ruta declara su política o no responde; una prueba recorre el registro de rutas y falla si alguna no la declara.

**Protocolo (ADR-0003, ADR-0014, ADR-0015)**

- Esquemas Zod versionados en `protocolo`: `EnviarLevantamiento`, autorización de subida y respuestas. La versión viaja en una cabecera; el servidor acepta la actual y la anterior.
- Especificación OpenAPI generada desde los esquemas.

**Archivos (ADR-0007)**

- Autorización de subida: URL firmada de corta duración, limitada en tamaño y tipo, para la clave `organizacion/sha256`.
- Carga directa desde el dispositivo al almacenamiento.
- Verificación en el `worker`: firma interna del archivo, tamaño y huella. Estados pendiente, subido y verificado.

**Recepción del envío (ADR-0003, ADR-0005, ADR-0008, ADR-0012)**

- `POST /api/sync/comandos` con `EnviarLevantamiento`, en una sola transacción: política, versión del protocolo, validación completa con el mismo validador de `dominio`, presencia y verificación de todos los archivos, guardado del agregado (columnas relacionales más documento JSONB) y auditoría de creación y envío con cadena de hashes. `LevantamientoEnviado` todavía no encola trabajos: su única reacción hoy es la bandeja, que es una consulta; el primer consumidor asíncrono (métricas del piloto) lo encolará con el puerto de la cola ya probado.
- Idempotencia completa: llave única derivada del levantamiento y resultado guardado; un reintento, incluso días después, recibe la misma respuesta.
- Si falta un archivo, la respuesta dice cuáles y el dispositivo los sube antes de reintentar.

**Dominio**

- Validador de respuestas contra la versión de formato: obligatorios (regla 3) y unidades (regla 5). El mismo código valida en el dispositivo y en el servidor.
- Marca "no se pudo obtener" con motivo para datos obligatorios (regla 3): sin ella, un técnico que no pudo medir no podría enviar.
- Transición borrador → enviado.

**Campo (ADR-0003, ADR-0004, ADR-0015)**

- Inicio de sesión (requiere conexión, como toda primera instalación).
- Outbox en Dexie con una migración a la versión 2 probada sobre borradores pendientes.
- Fotos que suben por adelantado cuando hay señal.
- "Enviar a oficina" con validación local previa; el levantamiento enviado queda de solo lectura.
- Estado de sincronización siempre visible: pendiente de enviar, enviando, recibido, error.
- Reintentos con espera exponencial y aleatoria al abrir la app y al recuperar señal; un error permanente se muestra al técnico y no se reintenta.

**Oficina**

- Inicio de sesión y bandeja de solo lectura "Esperando revisión", con el detalle del levantamiento y sus fotos. La revisión llega en el corte 3.

**Desarrollo local (ADR-0016)**

- Docker Compose con PostgreSQL y un almacenamiento compatible con S3 de licencia permisiva.
- Datos de prueba ficticios con un comando.

**Pruebas (ADR-0018)**

- Dominio: validador con casos de conformidad y máquina de estados con pruebas basadas en propiedades.
- Integración con PostgreSQL real en contenedores: dos envíos simultáneos del mismo levantamiento se procesan una vez; envío con archivo faltante; aislamiento entre organizaciones; auditoría que no se puede modificar; cadena de hashes que detecta una alteración; trabajo que no existe si la transacción se revierte.
- Arnés de fallas del cliente de sincronización: corte a mitad de una carga, respuesta perdida después de confirmar, entrega duplicada, cierre de la app entre guardar y encolar.
- Extremo a extremo con Playwright: capturar sin conexión, recuperar señal, enviar y verlo en la bandeja de oficina.

**Reglas de arquitectura en integración continua (ADR-0018)**

- Tipos, pruebas, dependencias entre paquetes y módulos (dependency-cruiser), cobertura de políticas en rutas y licencias sin AGPL, en GitHub Actions.

### Fuera del corte 1

| Qué | Dónde se resuelve |
|---|---|
| Bajada: formatos desde el servidor, visitas, estado de mis levantamientos | Corte 2. Mientras tanto, el formato ficticio se siembra en el servidor y `campo` lo trae incluido, con la misma versión |
| Permiso de trabajo local y borrado por revocación | Corte 2 (viajan con la bajada) |
| Passkeys y segundo factor | Segundo factor en la iteración 6; passkeys en la iteración 13 |
| Cifrado local (ADR-0009, parte 5) | Iteración 12 (ADR-0022) |
| Miniaturas | Corte 4, cuando el PDF las necesite |
| Informe de salud del dispositivo | Corte 2, con la bajada (ADR-0017) |
| Seguimiento de errores con servicio externo | Antes del piloto, con la decisión de TEINS sobre terceros |
| Entorno de pruebas con servidor desplegado | Al cerrar el corte 1: requiere elegir proveedor según la lista de ADR-0016 |

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. El recorrido extremo a extremo pasa en Chromium y WebKit | Cumplido en local |
| 2. Pasan las pruebas de los cuatro niveles y las reglas de arquitectura en integración continua | Cumplido en local; el flujo de GitHub Actions corre al subir la rama |
| 3. Pantallas solo con componentes de `ui` y estados vacío, cargando, error y sin conexión | Cumplido |
| 4. Probado en un iPhone real: captura sin conexión, recuperar señal, enviar con fotos y verlo en oficina | Cumplido el 2026-09-25 en un iPhone 15 Pro con iOS 26.6.1 (verificación manual, fase 1) |

### Entorno de pruebas (propuesta original; lo montado está en `entorno-de-pruebas.md`)

Datos ficticios, cuentas de Kevin, región en Estados Unidos (Ley 1581). Verificado contra la lista de ADR-0016 el 2026-09-24:

| Pieza | Propuesta | Costo estimado | Por qué |
|---|---|---|---|
| Rol web, rol worker y PostgreSQL | Railway, plan Hobby, región US East (Virginia) | USD 5 a 8 al mes: el plan cuesta USD 5 e incluye USD 5 de uso; web, worker y base en reposo usan poco | Corre la misma imagen para ambos roles; PostgreSQL en la misma red privada con conexión directa (LISTEN/NOTIFY para la cola) y sin apagarse |
| Archivos | Cloudflare R2 | USD 0: 10 GB, 1 millón de escrituras y 10 millones de lecturas gratis al mes; sin cargo por salida | Compatible con S3, URL firmadas, CORS |
| Superficies | Dos servicios web con la misma imagen (uno por host), o un dominio propio con subdominios `campo.` y `oficina.` | Unos USD 1 a 2 más con dos servicios | ADR-0016 exige un host por superficie; no se confirmó en la documentación de Railway cuántos dominios admite un servicio |

**Descartados al verificar:**

- **Neon, plan gratuito:** apaga la base a los 5 minutos sin actividad y no se puede desactivar en ese plan; al apagarse termina las conexiones LISTEN de la cola, y el sondeo del worker agotaría las 100 horas de cómputo del mes.
- **Cloudflare R2 para exigir la huella en la subida:** R2 no admite `x-amz-checksum-sha256` en PutObject (solo `Content-MD5`, que el navegador no calcula). ADR-0007 lo contempla: exigir la huella en la carga es opcional "si el proveedor lo permite"; la garantía es la verificación del worker (firma interna, tamaño y huella; lo inválido se rechaza y se elimina). Con R2 hace falta una opción de configuración para no firmar esa cabecera. Si se prefiere exigirla también en la carga, la alternativa es Amazon S3 en `us-east-1`, con costo de centavos al mes a este volumen.

**Pasos al aprobar:** la guía completa está en [`entorno-de-pruebas.md`](entorno-de-pruebas.md). Hecho en código (2026-09-24): `S3_EXIGIR_HUELLA` para no firmar la huella con R2, cliente S3 sin sumas de verificación propias en las URL firmadas (el SDK agregaba un CRC32 del cuerpo vacío), y `ENTORNO_DE_PRUEBAS` para sembrar aunque el entorno corra con `NODE_ENV=production`, con sus pruebas. Falta: subir la rama, crear las cuentas (Kevin), seguir la guía y repetir el extremo a extremo contra el entorno (hay que parametrizar sus URL).

### Decisiones tomadas al construirlo

- **Almacenamiento S3 local: S3Mock (Apache-2.0).** MinIO se descartó por AGPL (regla 12). S3Mock rechaza un contenido distinto a la huella firmada, igual que un proveedor real; no admite configurar CORS (ya permite todo), por eso `S3_CONFIGURAR_CORS=false` en local.
- **TypeScript 6.** TypeScript 7 aún no publica la API de compilador que usan las reglas de arquitectura; con él, dependency-cruiser no analizaba ningún archivo. Se revisa cuando la publique.
- **Formatos de prueba v1 y v2.** v2 agrega obligatorios; los borradores del corte 0 terminan con v1 (ADR-0006, regla 3).
- **Responsable local del levantamiento.** Un teléfono compartido solo envía y sube fotos con la sesión de quien creó cada levantamiento (regla 1). Los borradores del corte 0 pasan a quien inicia sesión primero.
- **Conexión real, no solo `navigator.onLine`.** El motor registra si el servidor respondió; la interfaz dice "sin conexión" aunque el navegador diga lo contrario (red sin internet, portal cautivo).
- **Presupuesto de campo: 120 KB de JavaScript inicial comprimido,** medido en 108 KB. El código de red se carga después del primer dibujo; el service worker lo guarda para usarlo sin señal. Falta confirmarlo con una medición en un celular de gama media (ADR-0011).
- **WebKit de Playwright** bloquea las URL `blob:` sin red (Safari real no); en WebKit la prueba corta la red después de la foto. La captura completa sin red la cubren Chromium y el iPhone real.
- **Tokens neutros por superficie.** Oficina redefine tamaños con `data-superficie`, sin duplicar componentes.

---

## Corte 2 · Bajada

**Estado:** Kevin pidió empezar el 2026-09-24 sin responder las tres decisiones abiertas; se tomaron las propuestas por defecto (visitas por comando, secreto de dispositivo, un solo corte), que puede revisar. Construido y verificado en local el mismo día; falta cerrar los puntos de "Próximo paso".

**Para qué:** que el dispositivo reciba del servidor lo que necesita para trabajar (formatos como datos, visitas asignadas, estado de mis levantamientos) con un punto de control que nunca se salta un cambio (ADR-0005, patrón 3), que pueda trabajar sin conexión solo mientras su permiso local esté vigente, y que un usuario revocado pierda sus datos en el dispositivo al siguiente contacto (QA-5). Cierra también QA-11: un formato nuevo llega a campo sin publicar la app.

**Punto de partida:** hoy no existen visitas, clientes, sitios ni dispositivos en ningún paquete; el levantamiento no tiene visita y `campo` trae los formatos v1 y v2 incluidos en el código.

### Alcance

**Protocolo (contrato primero; ADR-0003, ADR-0014, ADR-0015)**

- `GET /api/sync/cambios?desde=<punto>`: cambios del alcance del usuario, marcas de borrado, salidas del alcance, nuevo punto de control, `hayMas` para paginar, vencimiento del permiso de trabajo local y versión mínima del protocolo.
- `POST /api/sync/salud`: informe de salud del dispositivo, enviado en el mismo ciclo que la bajada. ADR-0014 fija la bajada como `GET` y ADR-0017 pide que la salud viaje con ella; un `GET` no lleva cuerpo, así que van en dos llamadas del mismo ciclo, sin tocar ninguno de los dos ADR.
- `EnviarLevantamiento` agrega `visitaId` **opcional** (expansión, ADR-0015): los borradores de los cortes 0 y 1 no tienen visita y se siguen enviando. La versión del protocolo no cambia.
- Identificación del dispositivo y consulta de su orden de borrado (ver "Revocación").

**Dominio**

- Visita: cliente, sitio, motivo, fecha programada, técnicos asignados. Su avance se deduce; solo "cancelada" es explícito (modelo de dominio, sección 5).
- Levantamiento con `visitaId`. Regla 17: reasignar una visita no invalida levantamientos ya iniciados.
- Versión de formato con `appMinima` opcional en el meta-esquema (ADR-0015, punto 4).
- Permiso de trabajo local: vigente, vencido. Vencer bloquea la captura, nunca borra (ADR-0009, parte 2).

**Servidor**

- Módulos nuevos `clientes` (clientes y sitios, datos mínimos) y `visitas`, de capas simples. Módulo `sincronizacion` con el registro de cambios: inserción serializada con `pg_advisory_xact_lock` para que el orden de la secuencia coincida con el de confirmación (ADR-0005, patrón 3). Los demás módulos registran cambios por su interfaz pública, en su misma transacción.
- Alcance por técnico: sus visitas asignadas con su cliente y sitio, versiones de formato compatibles con su app y estado de sus levantamientos. Al reasignar una visita, el técnico anterior recibe su salida del alcance.
- Entidad Dispositivo en `identidad`: usuario, última sincronización, informe de salud y orden de borrado.
- Desactivar usuario (regla 13): no autentica, se borran sus sesiones, sus dispositivos quedan marcados para borrado y sus envíos pendientes se rechazan (P36). Su autoría se conserva.
- Comandos de administración, como en el corte 1 con los usuarios: `crear-cliente`, `crear-visita`, `reasignar-visita`, `publicar-formato <archivo>`, `desactivar-usuario`. Las pantallas de oficina para esto llegan con "gestión de visitas y clientes".

**Campo**

- Dexie versión 3: formatos, visitas, estado de mis levantamientos, punto de control, permiso y dispositivo. La migración copia los formatos incluidos a la tabla nueva, para que ningún borrador pierda su formato. Se prueba sobre borradores y envíos pendientes.
- Bajada al abrir la app, al recuperar señal y después de enviar, con la misma espera exponencial del outbox.
- Inicio con "Mis visitas": cada visita muestra cliente, sitio, fecha y sus levantamientos; desde ella se inicia un levantamiento con un formato bajado.
- Estado de mis levantamientos según el servidor (hoy "recibido por oficina"; el corte 3 agrega "en revisión" y "revisado").
- Permiso vencido: aviso que bloquea crear y editar, conserva todo y pide iniciar sesión.
- Revocación: pantalla de acceso cerrado; se borran solo los datos del usuario revocado (fotos, borradores, envíos, visitas), no los de otro usuario del mismo teléfono.

### Revocación: cómo se entera el dispositivo

Revocar borra las sesiones, así que el siguiente contacto responde "no autenticado", igual que una sesión que simplemente venció. Para distinguirlos, el dispositivo se registra al iniciar sesión y recibe un **secreto de dispositivo** propio (guardado en IndexedDB, solo su huella en el servidor). Ante "no autenticado", el dispositivo consulta con ese secreto si tiene orden de borrado: si la tiene, borra; si no, pide iniciar sesión. Sin esto, un exempleado nunca volvería a iniciar sesión y la orden nunca llegaría.

### Fuera del corte 2

| Qué | Dónde se resuelve |
|---|---|
| Comentarios de oficina al técnico | Corte 3, viajan por esta misma bajada |
| Catálogo de ítems y unidades en la bajada | Iteración de cantidades con catálogo |
| Visita no programada creada en campo | Solo si TEINS responde P2 distinto al supuesto |
| Pantallas de oficina para clientes, sitios y visitas | Iteración de gestión de visitas y clientes |
| Panel de salud de dispositivos | Iteración de administración de usuarios y dispositivos; en este corte se guarda y se prueba |
| Cifrado local: el borrado por revocación elimina los registros, no destruye una clave | Resuelto en la iteración 12: primero se destruye la clave (ADR-0022) |
| Aviso push de visitas nuevas | Después del piloto (ADR-0014) |
| Cancelar una visita | Iteración de gestión de visitas y clientes |
| Oficina ve la visita (cliente y sitio) de cada levantamiento | Corte 3 (revisión) o corte 4 (el informe es por visita) |
| Crear un levantamiento sin visita | Solo si P2 lo pide; los que ya existían sin visita se siguen enviando |
| Un teléfono que se revoca antes de registrarse (nunca bajó después de actualizar) no recibe la orden: sus datos quedan bloqueados al vencer el permiso | Riesgo residual declarado en ADR-0009. Desde la iteración 12 están cifrados, pero la clave sigue en ese teléfono: protege contra la copia de los archivos del navegador, no contra quien lo tenga desbloqueado |

### Preguntas a TEINS

- **P2** (quién asigna las visitas y si se programan con fecha). Supuesto mientras tanto: oficina programa y asigna; el técnico no crea visitas.
- **P5** (visitas repetidas al mismo sitio). Supuesto: el sitio es entidad; con otra respuesta se vuelve opcional sin cambiar la bajada.

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Extremo a extremo en Chromium y WebKit: se asigna una visita por comando, el técnico la ve, captura con un formato bajado, envía y ve "recibido por oficina" | Cumplido en local (`e2e/pruebas/envio.spec.ts`) |
| 2. Un formato publicado por comando llega a campo sin publicar la app; uno con `appMinima` mayor no llega a una app vieja | Cumplido en integración (`servidor/pruebas/bajada.test.ts`) y en el motor (`campo`, app actualizada baja desde cero). Sin extremo a extremo: cada corrida dejaría un formato de más en la base de desarrollo |
| 3. Punto de control seguro: con dos transacciones que confirman fuera de orden, ningún cambio se pierde (integración con PostgreSQL real) | Cumplido (`servidor/pruebas/plataforma.test.ts`) |
| 4. Revocación: el siguiente contacto borra los datos del usuario revocado y conserva los de otro usuario del mismo teléfono; sus envíos pendientes se rechazan | Cumplido: integración del servidor, motor con teléfono compartido y extremo a extremo en Chromium y WebKit (`e2e/pruebas/bajada.spec.ts`) |
| 5. Permiso vencido: bloquea la captura, conserva los datos y se reanuda al iniciar sesión | Cumplido en extremo a extremo en Chromium, en local y contra el entorno de pruebas. WebKit de Playwright no recarga sin red, y en el iPhone exigiría 7 días sin señal: no se prueba ahí |
| 6. La migración de Dexie a la versión 3 conserva borradores, envíos pendientes y formatos | Cumplido (`campo/src/datos/repositorio.test.ts`) |
| 7. El informe de salud se guarda en el dispositivo del servidor | Cumplido (integración del servidor y motor de campo) |
| 8. Pantallas solo con componentes de `ui` y estados vacío, cargando, error y sin conexión; reglas de arquitectura en verde | Cumplido |
| 9. Entorno de pruebas desplegado y prueba en iPhone de los cortes 1 y 2 (decisión del 2026-09-24) | Entorno desplegado en Railway el 2026-09-25 y extremo a extremo en verde contra él (Chromium 3 de 3, WebKit 2 de 2 más el salto conocido). Prueba en iPhone cumplida el 2026-09-25: bajada, estado según el servidor y revocación con borrado confirmado por el teléfono (verificación manual, fases 1 y 2) |

### Orden de construcción

1. Protocolo y dominio (contrato, visita, `appMinima`, permiso).
2. Servidor: registro de cambios con su prueba de orden de confirmación, clientes y visitas, bajada, dispositivos y salud.
3. Servidor: desactivación y orden de borrado.
4. Campo: migración a Dexie 3, bajada, formatos como datos, "Mis visitas", estado de mis levantamientos.
5. Campo: permiso vencido y revocación con borrado.
6. Extremo a extremo, cierre de documentación, entorno de pruebas e iPhone.

### Decisiones tomadas al construirlo

- **Bajada `GET` e informe de salud en `POST` aparte.** ADR-0014 fija `GET /sync/cambios` y ADR-0017 pide que la salud viaje con la bajada; van en dos llamadas del mismo ciclo. `POST /api/sync/dispositivo` también registra el dispositivo, así un teléfono que venía del corte 1 queda registrado en su primera bajada.
- **Dos módulos para la bajada.** `cambios` guarda qué cambió y para quién (como `auditoria`, lo usan los demás); `sincronizacion` arma la bajada leyendo el contenido actual de cada módulo por su interfaz. En un solo módulo habría un ciclo con `visitas`.
- **Bloqueo consultivo por organización** hasta el final de la transacción: el orden de la secuencia es el de confirmación y otra organización no espera. Por eso el cambio se registra al final de cada transacción.
- **El último cambio de cada entidad manda:** varios cambios de la misma visita bajan una sola vez con su estado actual. Una visita que ya no está asignada al técnico baja como "fuera de alcance".
- **La migración rellena el registro** con los formatos ya publicados y los levantamientos ya recibidos; sin eso, nunca bajarían.
- **Técnicos asignados como lista en la visita**, que se reemplaza al reasignar; la auditoría guarda el antes y el después. Una tabla de asignaciones obligaría a borrar filas (regla 14).
- **`appMinima` y app actualizada:** la bajada no entrega lo que la app no sabe mostrar, y el punto de control avanza igual. Por eso campo guarda con qué versión bajó y, si cambia, baja desde cero. `VERSION_APP` es un entero en `campo/src/version.ts`.
- **Visita reasignada con algo empezado** se conserva en el teléfono, marcada, para terminar y enviar (regla 17); sin nada empezado, se retira.
- **Revocación:** el secreto del dispositivo (32 bytes, el servidor guarda su huella) autentica `POST /api/sync/dispositivo/ordenes` con la política `secreto_de_dispositivo`. Campo consulta cuando el servidor rechaza la sesión; borra en una transacción solo lo del usuario revocado (un archivo que usa otra persona se conserva) y confirma el borrado, que queda en auditoría. Desactivar marca al usuario, borra sus sesiones y ordena el borrado en una sola transacción.
- **Un usuario desactivado que intenta entrar** recibe la misma respuesta que una contraseña equivocada.
- **Cadencia de la bajada:** al abrir, al recuperar señal, al volver a la app, al iniciar sesión y después de un envío recibido; si no, cada 5 minutos. Con la sesión vencida no insiste en cada ciclo.
- **Permiso local:** lo renueva cada bajada y el inicio de sesión (`Sesion.permisoLocalHasta`). La migración a Dexie 3 da 7 días a quien ya tenía sesión, para no bloquearlo si actualiza sin señal. Vencido, los borradores se ven en solo lectura.
- **Formatos con nombre:** `nombre` es opcional porque v1 y v2 no se pueden modificar; se publicó la v3 de prueba con nombre y campo toma el nombre de cualquier versión del mismo formato.
- **Orden de "Mis visitas"** (`campo/src/visitas.ts`; Kevin pidió la recomendación y que se implementara, 2026-09-24; puede ajustarse cuando TEINS responda P2): primero la visita con un borrador a medias, aunque sea de otro día; después las de hoy, las atrasadas y las futuras sin atender, cada grupo por fecha; al final las atendidas (algo enviado y nada a medias), para que el foco pase a la siguiente visita. La primera es el punto focal.
- **Solo se crean levantamientos desde una visita** (supuesto de P2). Los que no tienen visita aparecen en "Otros levantamientos en este teléfono".
- **El estado según el servidor manda** sobre el de envío del teléfono en la lista; en el corte 3 agrega "en revisión" y "revisado".
- **Salud sin contenido:** el último error viaja solo como código.
- **Entorno local, corregido:** S3Mock guardaba en `/tmp` del contenedor y no en su volumen; al recrearlo se perdían las fotos que la base daba por verificadas. `docker-compose.yml` ahora fija `COM_ADOBE_TESTING_S3MOCK_STORE_ROOT`. La foto del extremo a extremo es única por corrida: una repetida no se vuelve a subir y la prueba no ejercitaba la carga.
- **Presupuesto de campo:** 110 KB de JavaScript inicial comprimido (antes 108).
- **Entorno de pruebas en Railway, sin Cloudflare** (2026-09-25, a pedido de Kevin, todo desde la CLI): el almacenamiento de Railway exige la huella y el tamaño firmados y acepta CORS por API, así que reemplaza a R2 y conserva la garantía completa de ADR-0007. Se despliega con `railway up` desde la carpeta local, sin conectar GitHub todavía.
- **Cliente S3 sin sumas propias:** con la configuración por defecto, el SDK de AWS agregaba a la URL firmada un CRC32 del cuerpo vacío; ahora solo calcula sumas cuando la operación las exige. `S3_EXIGIR_HUELLA=false` queda para proveedores sin la huella (R2).
- **`ENTORNO_DE_PRUEBAS`:** permite sembrar con `NODE_ENV=production` en un entorno ficticio; producción real nunca la tiene.
- **La imagen incluye todo `src/cli/`:** los comandos del corte 2 no estaban en la lista fija de `compilar.mjs` y faltaban en la imagen.
- **Railway prueba la salud en `PORT`:** los servicios web fijan `PORT=3000`.
- **Extremo a extremo contra un entorno:** con `E2E_CAMPO_URL` y `E2E_OFICINA_URL`, usa esas direcciones y corre los comandos de administración con `railway ssh`.

---

## Corte 3 · Revisión

**Estado:** construido y desplegado en el entorno de pruebas el 2026-09-25. Kevin pidió continuar sin revisar el alcance antes; puede ajustarlo sobre esta sección.

**Para qué:** que oficina revise un levantamiento enviado sin pisarse entre personas (QA-25, I-1) y que cada corrección quede con quién, cuándo, qué campo, valor anterior y nuevo, verificable (QA-8, ADR-0008). El técnico ve el estado y los comentarios en su teléfono.

### Alcance

**Dominio:** estados enviado → en revisión → revisado. Corrección de un campo con el mismo validador de campo y de envío (reglas 3 y 5), que devuelve el cambio (ruta, anterior, nuevo). Marcar revisado exige respuestas válidas.

**Protocolo (tareas explícitas, ADR-0014):** tomar para revisar (con reasignación explícita si otra persona la tiene), corregir campos, marcar revisado, comentar, historial del levantamiento. Cada guardado lleva la versión que la persona tenía abierta; si otra guardó antes, se rechaza con `conflicto_de_version` (ADR-0005, patrón 2). La bandeja filtra por estado y muestra quién tiene la toma.

**Servidor:** estados y responsable de la revisión en `levantamientos`; comentarios como tabla propia (solo insertar y leer); auditoría por campo en la misma transacción (toma, reasignación, corrección, marca de revisado, comentario); historial legible con verificación de la cadena. Cambios de estado y comentarios bajan al técnico; una app anterior (versión 2) recibe "enviado" para no romper su contrato (ADR-0015, N-1).

**Oficina:** bandeja con "Esperando revisión", "En revisión" y "Revisados"; el punto focal es el más antiguo con "Tomar para revisar" (DESIGN.md). Pantalla de revisión: toma, corrección por campo con motivo opcional, aviso cuando otra persona guardó antes, marcar revisado, comentarios al técnico e historial de cambios.

**Campo:** estado según el servidor ("En revisión en oficina", "Revisado por oficina") y comentarios de oficina en el levantamiento enviado. `VERSION_APP` pasa a 3.

### Fuera del corte 3

| Qué | Dónde se resuelve |
|---|---|
| Reabrir un levantamiento revisado | Corte 4: depende de si ya está en un informe publicado |
| Corregir fotos desde oficina (quitar o agregar) | Iteración posterior; hoy solo texto, medida y "no se pudo obtener" |
| Devolución formal al técnico | Fuera de alcance del modelo de dominio; el comentario no reabre el borrador |
| Rol supervisor | Cuando TEINS defina qué hace |
| Verificación periódica de las cadenas en el worker | Iteración de operación; hoy la verificación es por levantamiento, bajo demanda |

### Preguntas a TEINS

P7, P8 y P9 (formatos prioritarios, obligatorios reales y errores frecuentes). No bloquean: el corte se construye con el formato de prueba.

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Extremo a extremo: oficina toma, corrige una medida, comenta y marca revisado; el técnico ve "Revisado por oficina" y el comentario | Cumplido en Chromium y WebKit, en local y contra el entorno (`e2e/pruebas/revision.spec.ts`) |
| 2. Dos personas de oficina: el segundo guardado sobre la misma versión se rechaza y se avisa, sin perder nada (QA-25), en integración y en extremo a extremo | Cumplido: guardados simultáneos en `servidor/pruebas/revision.test.ts` y reasignación con guardado en curso en el extremo a extremo |
| 3. Cada corrección queda en auditoría con ruta, valor anterior y nuevo, autor y correlación; la cadena del levantamiento verifica íntegra (QA-8) | Cumplido en integración y visible en el historial de oficina |
| 4. Solo quien tomó la revisión corrige y marca revisado; el técnico no; la reasignación queda registrada | Cumplido en integración y extremo a extremo |
| 5. Una app de campo versión 2 sigue leyendo la bajada | Cumplido en integración (recibe "enviado", sin comentarios) |
| 6. Pantallas solo con componentes de `ui`, con estados vacío, cargando, error y sin conexión; reglas de arquitectura en verde | Cumplido |
| 7. Desplegado en el entorno de pruebas con el extremo a extremo en verde contra él | Cumplido el 2026-09-25; la regresión de los cortes 1 y 2 también pasa contra el entorno |

### Decisiones tomadas al construirlo

- **Tareas explícitas con la versión vista en el cuerpo** (`tomar`, `correcciones`, `marcar-revisado`, `comentarios`, ADR-0014). El servidor compara la versión y actualiza con `WHERE version = ?`: el primer chequeo da un aviso claro y el `UPDATE` resuelve la carrera entre dos guardados simultáneos. El rechazo lleva `versionActual`.
- **Toma de revisión:** tomar lo propio otra vez responde el estado sin cambiar nada; quitársela a otra persona exige `reasignar` y queda como `revision_reasignada` con el responsable anterior y el nuevo. El rechazo `tomado_por_otro` dice quién la tiene.
- **Corrección:** mismas reglas del envío por campo (`validarCampo` de `dominio`); reescribir el mismo valor no es un cambio ni deja registro; las fotos no se corrigen desde oficina (`no_corregible`); un registro de auditoría por campo, todos con la correlación del guardado y el motivo opcional.
- **Marcar revisado** exige respuestas válidas contra su formato.
- **Comentarios:** cualquier persona de oficina comenta, aunque no tenga la revisión; no cambian la versión ni el estado; pueden apuntar a un campo, que se valida contra el formato. Tabla propia de solo insertar y leer, y evento `comentario_agregado` en la cadena.
- **N-1 en la bajada:** `APP_CON_REVISION = 3`. A una app de campo versión 2 se le manda "enviado" y sin comentarios, porque su contrato no conoce los estados nuevos y rechazaría la bajada entera. Probado en integración.
- **Campo sin versión nueva de Dexie:** estado y comentarios viven en `estadosServidor`, sin índices nuevos.
- **Historial legible:** oficina ve nombres, no identificadores, y la verificación de la cadena del levantamiento en cada consulta ("Historial íntegro").
- **`ui` crece:** `Pestanas` (patrón WAI-ARIA), `CampoTextoLargo` (acepta `ref`) y los tonos de marquilla "revision" y "revisado", que ya existían en los tokens.
- **Extremo a extremo remoto con reintentos:** `railway ssh` falla de vez en cuando; los comandos de administración de la prueba se repiten hasta tres veces (uno ya aplicado falla al repetirse, no duplica).
- **Una sola acción amarilla:** en la revisión es "Tomar para revisar" o "Marcar revisado"; "Guardar corrección" es secundaria. Los botones nombran el dato ("Corregir potencia nominal", "Comentar potencia nominal").

---

## Corte 4 · Informe

**Estado:** construido y desplegado en el entorno de pruebas el 2026-09-25, con supuestos (Kevin pidió avanzar sin esperar a TEINS). Confirmado por Kevin: lo que recibe el cliente es un PDF.

**Para qué:** que oficina componga el informe de una visita con sus levantamientos revisados, lo publique como una versión que nunca cambia (QA-9) y que el PDF se genere en segundo plano y quede guardado tal como se entregó (QA-17, ADR-0013).

### Supuestos mientras TEINS responde

| Pregunta | Supuesto | Si la respuesta es distinta |
|---|---|---|
| P26: ¿informe por visita o varias? | Uno por visita, con sus levantamientos revisados (regla 9) | La regla pasa a "mismo cliente"; el modelo no cambia |
| P23: secciones, logo, firmas, datos legales | Portada (organización, cliente, sitio, visita, versión), introducción, un capítulo por levantamiento con sus datos y fotos, conclusiones y planos anexos. Logo, firma y datos legales como marcadores `[LOGO]`, `[FIRMA]`, `[DATOS LEGALES]` | Cambia la plantilla HTML, no el modelo |
| P22: informes de ejemplo | Plantilla propia con la dirección de `DESIGN.md` | Se ajusta la plantilla |
| Formato de los planos | PDF, anexado como páginas del mismo documento (ADR-0013) | Imágenes: se incrustan como una página cada una; DWG: TEINS exporta a PDF |

### Alcance

**Dominio:** informe (visita, levantamientos incluidos en orden, introducción, conclusiones, planos en orden, versión optimista); solo incluye levantamientos revisados de la misma visita (regla 9); publicar crea la versión n+1 con una copia congelada (regla 10).

**Protocolo:** listar informes, abrir el informe de una visita (lo crea si no existe), guardar el borrador, publicar y descargar el PDF de una versión. Los planos suben como PDF por el mismo camino que las fotos (ADR-0007), solo desde oficina.

**Servidor:** módulo `informes`. La versión publicada guarda la copia congelada; la aplicación no puede modificarla (solo puede escribir las columnas del PDF). Publicar encola `informes.generarPdf` en la misma transacción (ADR-0012), en la cola `pdf` de a uno. El trabajo arma el HTML desde la copia congelada (fotos incrustadas, fuente incrustada), lo imprime con Chromium, anexa los planos con pdf-lib, guarda el PDF por su huella y lo registra en la versión. Nunca se regenera un PDF listo. Publicación en la cadena de auditoría del informe.

**Oficina:** lista de informes; desde un levantamiento revisado con visita, "Abrir el informe de esta visita"; composición (textos, levantamientos incluidos y su orden, planos); publicar con confirmación; versiones con su estado ("Generando PDF", "Descargar PDF", "No se pudo generar").

**Imagen:** Chromium dentro de la imagen de despliegue, con su versión fijada por la de Alpine.

### Fuera del corte 4

| Qué | Dónde se resuelve |
|---|---|
| El cliente descarga el PDF | Corte 5 (portal) |
| Retirar una versión publicada | Cuando exista el rol administrador |
| Marca por organización en la plantilla (ADR-0020) | Iteración de administración; hoy usa los valores de TEINS |
| Miniaturas en resolución de impresión | Cuando el tamaño del PDF lo pida; hoy van las fotos recodificadas |
| Tablas de cantidades y bocetos en el PDF | Con sus iteraciones |
| Planos como imagen | Si TEINS no los tiene en PDF |

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Extremo a extremo: oficina compone el informe de una visita con un levantamiento revisado y un plano, lo publica y descarga el PDF | Cumplido en Chromium y WebKit, en local y contra el entorno (`e2e/pruebas/informe.spec.ts`) |
| 2. Publicar otra versión deja la anterior intacta y descargable (QA-9); la base no deja modificar una versión publicada | Cumplido en integración (permiso por columna) y en el extremo a extremo |
| 3. El PDF se genera en segundo plano, tiene los datos, las fotos y las páginas del plano, y no se vuelve a generar (QA-17) | Cumplido en integración con Chromium real (título, páginas del plano, huella estable) y en el worker de Railway |
| 4. Solo entran levantamientos revisados de la misma visita (regla 9) | Cumplido en dominio e integración |
| 5. Pantallas solo con componentes de `ui` y sus estados; reglas de arquitectura en verde | Cumplido |
| 6. Desplegado en el entorno de pruebas con el extremo a extremo en verde contra él | Cumplido el 2026-09-25, con la regresión de envío y revisión |

### Decisiones tomadas al construirlo

- **Falla del corte 2 encontrada aquí y corregida:** campo nunca mandaba `visitaId` en el envío, así que ningún levantamiento llegaba con su visita. Las pruebas del servidor armaban el comando a mano y las de campo no miraban su contenido. Ahora hay una prueba del comando en campo y el extremo a extremo del envío comprueba que oficina ve la visita. Los levantamientos ya recibidos sin visita siguen así: no se puede saber a qué visita pertenecían.
- **Uno por visita, abierto desde oficina:** "Abrir el informe de esta visita" crea el borrador si no existe (restricción única por organización y visita) y devuelve el mismo si ya existe.
- **Publicar reserva la versión del borrador:** el mismo `UPDATE … WHERE version = ?` del corte 3 evita que dos personas publiquen dos veces desde el mismo borrador. Lo que se publica es lo guardado; la pantalla guarda antes si hay cambios.
- **Copia congelada completa:** la versión guarda la definición del formato, las respuestas, los nombres de quien capturó y revisó, la visita, los textos y los planos. El PDF se arma solo desde ella.
- **Inmutabilidad en la base:** `informes.versiones` solo admite `INSERT` y `UPDATE` de las columnas del PDF (permiso por columna). Probado: modificar el contenido da "permission denied".
- **PDF en la cola `pdf`, de a uno, con 5 intentos:** al agotarlos queda "No se pudo generar el PDF" a la vista; un PDF listo nunca se vuelve a generar. La cola ahora le dice al manejador si es su último intento.
- **Plantilla:** HTML sin JavaScript ni red (Chromium con JavaScript apagado, sin conexión y con toda solicitud bloqueada), fuente Atkinson Hyperlegible Next y fotos incrustadas, tamaño carta, fechas en hora de Colombia fija. Marcadores `[LOGO]`, `[FIRMA]`, `[DATOS LEGALES]` y `[FOTO]` para lo que falta. Valores de marca de TEINS fijos hasta la configuración por organización (ADR-0020).
- **Planos:** solo PDF y solo desde oficina (campo solo sube JPEG), por el mismo camino de las fotos; el worker verifica que sea PDF. Se anexan con pdf-lib; la numeración "Página X de Y" del pie cuenta las páginas del informe, no las de los planos.
- **PDF guardado por su huella** junto a las fotos (`organizacion/sha256`), sin fila en `archivos.archivos`: la versión registra la huella.
- **Chromium en la imagen:** `apk add chromium` en Alpine, `CHROMIUM_RUTA=/usr/bin/chromium`. Probado dentro del contenedor (Chromium 152). La imagen pasa a 1,6 GB. En desarrollo y pruebas se usa el Chromium de Playwright 1.62.1, la misma versión del extremo a extremo.
- **`ui` crece:** `Casilla` y `SelectorDeArchivo`.

---

## Corte 5 · Portal del cliente

**Estado:** construido y desplegado en el entorno de pruebas el 2026-09-25.

**Para qué:** que el cliente de TEINS descargue el PDF vigente de sus informes con un QR y una clave, sin ver jamás nada de otro cliente aunque el código del portal tenga un error (QA-4, ADR-0009), y sin que se pueda adivinar una clave (QA-7). Con este corte queda completo el recorrido delgado.

### Alcance

**Acceso de cliente (ADR-0009, parte 4):** identificador aleatorio no adivinable y clave con hash (scrypt); el QR lleva la URL del portal con el identificador y nunca la clave. Se crea y se regenera por comando (no hay rol administrador todavía); regenerar invalida el QR anterior, la clave y todas las sesiones.

**Barrera en la base (ADR-0009, parte 3):** rol `teins_portal` con conexión propia. Solo lee las versiones publicadas con PDF listo del cliente de la sesión (seguridad por fila por organización y cliente) y las tablas del propio portal. No tiene permiso sobre levantamientos, usuarios, visitas ni nada más.

**Protección:** límite de intentos por identificador y por origen con espera creciente; sesión corta (30 minutos desde el último uso) en cookie `HttpOnly`, `Secure`, `SameSite=Strict`, en el host propio del portal. Cada ingreso y cada descarga quedan en la cadena de auditoría del acceso.

**Vigente:** por cada informe del cliente, la versión publicada más reciente con su PDF listo (ADR-0013: "publicada" y "visible para el cliente" son distintos).

**Portal (paquete `portal`, el más pequeño, ADR-0002):** ingreso (identificador precargado desde el QR), lista de informes vigentes con su descarga, salir; estados vacío, cargando, error y sin conexión.

**Despliegue:** cuarto servicio web `portal` en Railway con su dominio.

### Fuera del corte 5

| Qué | Dónde se resuelve |
|---|---|
| Pantalla de administración de accesos de cliente | Iteración de administración (con el rol administrador) |
| Versiones anteriores visibles para el cliente | Solo la vigente, por la regla 12; si TEINS las pide, se agregan |
| Retirar una versión del portal | Con el rol administrador |
| Aviso al cliente por correo de un informe nuevo | Después del piloto (ADR-0014) |

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Extremo a extremo: con el QR y la clave, el cliente ve su informe vigente y descarga el PDF | Cumplido en Chromium y WebKit, en local y contra el entorno (`e2e/pruebas/portal.spec.ts`, el recorrido delgado completo) |
| 2. Cero accesos cruzados (QA-4): un cliente no ve ni descarga informes de otro, ni adivinando identificadores; probado también directo en la base con el rol del portal | Cumplido en integración (API y base) y extremo a extremo |
| 3. Intentos fallidos bloquean con espera creciente por identificador y por origen (QA-7); la clave se guarda con hash | Cumplido en integración |
| 4. Regenerar el acceso invalida el identificador anterior, la clave y las sesiones abiertas | Cumplido en integración |
| 5. Ingresos y descargas quedan en la auditoría | Cumplido en integración, con la cadena verificada |
| 6. Desplegado en el entorno de pruebas con el extremo a extremo en verde contra él | Cumplido el 2026-09-25 (servicio `portal`) |

### Decisiones tomadas al construirlo

- **Conexión propia del portal:** el rol web abre una segunda conexión con `DATABASE_URL_PORTAL` (rol `teins_portal`) y todas las rutas del portal usan solo esa. Sin esa variable, el rol web no atiende el portal: en Railway solo el servicio `portal` la tiene.
- **Qué puede el rol del portal:** leer accesos (para el ingreso), manejar sus sesiones y su límite de intentos, registrar en la auditoría y leer `informes.versiones`, donde la seguridad por fila exige organización, cliente y PDF listo. Probado: con el rol del portal, la base no devuelve versiones de otro cliente ni sin cliente fijado, y niega levantamientos, usuarios, clientes, informes y visitas.
- **La versión guarda su cliente** al publicar (`cliente_id`); las publicadas antes se completaron desde su visita en la migración.
- **Accesos:** identificador de 20 caracteres (unos 99 bits) y clave de 12 en grupos de cuatro (unos 59 bits), sin caracteres que se confunden; la clave se puede escribir en minúsculas o sin guiones. scrypt con sal propia. Un identificador desconocido se verifica igual contra un hash de relleno: la respuesta no revela si existe.
- **Límite de intentos:** desde el quinto fallo con un identificador o el vigésimo desde un origen, espera de 1, 2, 4… minutos hasta una hora; los fallos se olvidan tras una hora. Mientras dura la espera, ni la clave correcta entra.
- **Sesión:** token aleatorio en cookie `__Host-teins-portal` (`HttpOnly`, `Secure`, `SameSite=Strict`, en producción); la base guarda su huella. 30 minutos desde el último uso. La cookie de oficina no sirve en el portal.
- **Vigente para el cliente:** la versión más reciente con PDF listo; mientras la nueva genera su PDF, el cliente sigue viendo la anterior.
- **Auditoría del acceso:** cadena por acceso de cliente con `acceso_cliente_creado`, `acceso_cliente_regenerado`, `ingreso_portal` y `descarga_portal`. Los fallos de ingreso no van a la cadena (un ataque la llenaría); quedan en el límite de intentos.
- **Comandos:** `crear-acceso-cliente` y `regenerar-acceso-cliente` muestran una sola vez el identificador, la clave y la URL, e imprimen el QR en la terminal (sirve por `railway ssh`); con `--qr` lo guardan como SVG. Dependencia nueva: `qrcode` (MIT).
- **Portal mínimo:** React, TanStack Query y `ui`, sin enrutador ni service worker; 111 KB de JavaScript comprimido, casi todo el validador del contrato. Escala de tokens de campo, porque el cliente llega desde el celular con el QR.
- **Pruebas en paralelo y cola compartida:** `procesarCola` de las pruebas repite hasta que no quede trabajo listo ni en curso; el PDF, lento y de a uno, hizo visible una carrera entre archivos de prueba.

---

## Iteración 6 · Administración

**Estado:** terminada y desplegada el 2026-09-25 (Kevin pidió avanzar con la siguiente iteración; administración era la recomendada).

**Para qué:** que TEINS opere el piloto sin comandos: una persona administradora, con segundo factor obligatorio (ADR-0009), gestiona usuarios, ve la salud de los teléfonos (ADR-0017), entrega los accesos de sus clientes con su QR y retira una versión del portal si hace falta.

### Alcance

- **Administrador = persona de oficina con la marca `administrador`.** El modelo de dominio dice que los roles son un conjunto asignable; en TEINS quien administra también revisa, así que no necesita dos cuentas. La primera persona administradora se marca por comando.
- **Segundo factor obligatorio (ADR-0009):** TOTP con el plugin de Better Auth (app autenticadora y códigos de respaldo). Sin segundo factor activo, ninguna acción de administración responde; la pantalla guía la activación. El ingreso pide el código después de la contraseña.
- **Usuarios:** lista, crear (técnico u oficina, con contraseña temporal que se muestra una vez), restablecer contraseña, desactivar (revocación del corte 2), marcar o quitar administrador.
- **Dispositivos (ADR-0017, parte 3):** panel con la salud de cada teléfono (versión de la app, pendientes y el más antiguo, espacio, persistente, último error, último contacto, orden de borrado) y alerta de pendientes viejos.
- **Accesos de clientes:** lista de clientes con su acceso; crear o regenerar muestra una vez código, clave y QR.
- **Retirar una versión del portal** (modelo de dominio, estado "versión retirada"): con motivo, queda en la auditoría; el cliente pasa a ver la anterior vigente.

### Fuera de la iteración 6

| Qué | Dónde se resuelve |
|---|---|
| Crear y programar clientes, sitios y visitas desde oficina | Iteración de gestión de visitas y clientes (la siguiente recomendada) |
| Editar formatos y catálogo | Cuando TEINS lo pida (P10) |
| Passkeys | Iteración 13 |
| Rol supervisor | Cuando TEINS defina qué hace |

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Una persona administradora sin segundo factor no puede administrar; lo activa y desde entonces el ingreso le pide el código | Cumplido en integración (`pruebas/administracion.test.ts`) y extremo a extremo por la interfaz (`e2e/pruebas/administracion.spec.ts`) |
| 2. Extremo a extremo: la administradora crea un técnico, ve su teléfono en el panel tras la primera sincronización, crea el acceso de un cliente con QR y retira una versión del portal | Cumplido en Chromium y WebKit en local y en Chromium contra el entorno (`administracion.spec.ts`; el retiro, al final de `portal.spec.ts`) |
| 3. Oficina sin marca de administrador y técnicos no acceden a nada de administración | Cumplido en integración (403 `sin_permiso`; un técnico tampoco puede activar el segundo factor) |
| 4. Cada acción queda en la auditoría | Cumplido en integración: creación, restablecimiento, desactivación, marca, activación del segundo factor y retiro con su motivo |
| 5. Desplegado en el entorno de pruebas con el extremo a extremo en verde contra él | Cumplido el 2026-09-25 (migraciones 0011 y 0012 aplicadas por `campo`) |

### Decisiones tomadas al construirlo

- **Marca, no rol nuevo:** columna `administrador` en `identidad.usuarios`, solo con efecto para oficina (un técnico marcado por error no administra). La política `administrador` exige rol oficina, la marca y el segundo factor activo; sin segundo factor responde `segundo_factor_requerido` (403) y la pantalla guía la activación. Nadie se quita la marca a sí mismo ni se desactiva a sí mismo: así la organización no se queda sin quien administre. La primera persona administradora se marca con `marcar-administrador`.
- **Segundo factor con el plugin `twoFactor` de Better Auth:** TOTP (SHA-1, 6 dígitos, 30 s, emisor "TEINS") y 10 códigos de respaldo, cifrados con `AUTH_SECRETO` en `identidad.segundos_factores`. El factor no cuenta hasta confirmarlo con un código. Con el factor activo, la contraseña sola no crea sesión: responde `twoFactorRedirect` con una cookie de desafío de 10 minutos y la sesión nace al verificar. Cinco códigos equivocados invalidan el desafío; diez seguidos bloquean la cuenta 15 minutos. Las rutas `/two-factor/*` tienen el mismo límite por origen que el ingreso (`INICIOS_DE_SESION_POR_MINUTO`). Sin "recordar este dispositivo".
- **Solo oficina activa el segundo factor:** campo no sabe pedir el código, así que un técnico que lo activara quedaría por fuera; el servidor lo rechaza (403).
- **Un solo campo para el código** en el ingreso: seis dígitos van a la app autenticadora; cualquier otra cosa se prueba como código de respaldo.
- **Contraseñas temporales** de 16 caracteres (96 bits) generadas en el servidor y mostradas una sola vez; restablecer cierra las sesiones del usuario. El nombre de usuario es único en todo el sistema (con él se inicia sesión).
- **Retirar una versión** escribe solo tres columnas nuevas (`retirada_en`, `retirada_por`, `motivo_retiro`) con permiso de columna; la copia congelada sigue sin permiso de escritura (probado). La barrera del portal en la base exige además `retirada_en is null`, así que el cliente pasa a ver la versión anterior sin retirar, o nada. Retirar es definitivo: para volver a entregar se publica una versión nueva (regla 10). En oficina, "vigente" es la más reciente sin retirar.
- **Accesos de clientes desde oficina** con el mismo código del comando (`crearAccesosDeClientes`) y la URL de `PORTAL_URL`; el QR lo dibuja oficina en el navegador (`qrcode`, cargado solo al necesitarlo) y se puede descargar como SVG.
- **Panel de teléfonos:** alerta cuando el pendiente más antiguo lleva más de un día sin subir y cuando el almacenamiento no es persistente; se relee cada minuto.
- **Auditoría:** `usuario_creado`, `contrasena_restablecida`, `usuario_desactivado`, `administrador_cambiado` y `segundo_factor_activado` en la cadena de cada usuario (el factor solo se quita al restablecer, y queda en `contrasena_restablecida`); `version_retirada` con su motivo en la del informe; accesos como en el corte 5.
- **Oficina se prueba en escritorio:** en el viewport de celular el encabezado de oficina desborda (oficina se usa en monitor, `docs/diseno/pendientes.md`); las pruebas de oficina usan 1366 × 900.

---

## Iteración 7 · Gestión de visitas y clientes

**Estado:** terminada y desplegada el 2026-09-25 (Kevin aceptó la recomendación: "Ok. Hazlo").

**Para qué:** que oficina programe el trabajo de campo sin comandos: clientes con sus sitios, visitas con fecha, motivo y técnicos, y los cambios de agenda (reasignar, reprogramar, cancelar) llegando solos a los teléfonos por la bajada del corte 2.

### Alcance

- **Quién:** cualquier persona de oficina (programar es trabajo de oficina, no de administración). Supuesto de P2 vigente: oficina programa y asigna; el técnico no crea visitas.
- **Clientes:** lista con sus sitios; crear un cliente con su primer sitio; agregar sitios. Datos mínimos (regla 18): nombre del cliente, nombre y dirección del sitio.
- **Visitas:** lista en tres vistas (próximas, anteriores, canceladas) con técnicos y avance deducido de sus levantamientos (modelo de dominio, sección 5); programar (cliente, sitio, motivo, fecha, técnicos); reasignar técnicos (regla 17); reprogramar fecha y motivo; cancelar con motivo, el único estado explícito.
- **Campo:** una visita cancelada sale del teléfono como una reasignada; si ya tenía levantamientos empezados, se conservan y se pueden enviar (regla 17), con el aviso "Oficina canceló esta visita".
- **Concurrencia:** cada cambio de una visita lleva la versión que se tenía abierta; si otra persona la cambió antes, se rechaza (QA-25).
- **Auditoría:** cliente creado, sitio agregado, visita creada, reasignada, reprogramada y cancelada.

### Fuera de la iteración 7

| Qué | Dónde se resuelve |
|---|---|
| Corregir el nombre de un cliente o la dirección de un sitio | Cuando TEINS lo pida; exige avisar a los teléfonos con visitas de ese sitio |
| Contactos del cliente | Cuando TEINS diga qué datos necesita el técnico (regla 18) |
| Calendario semanal o por técnico | Después del piloto, si la lista no alcanza |
| Visita no programada creada en campo | Solo si TEINS responde P2 distinto al supuesto |
| Aviso push de visitas nuevas | Después del piloto (ADR-0014) |

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Extremo a extremo: oficina crea un cliente con su sitio, programa una visita y el técnico la ve en su teléfono; la reprograma y el teléfono muestra la fecha nueva; la cancela y sale del teléfono | Cumplido en Chromium y WebKit en local y en Chromium contra el entorno (`e2e/pruebas/programacion.spec.ts`) |
| 2. Reasignar y cancelar conservan los levantamientos empezados, que se pueden enviar | Cumplido en integración (`pruebas/visitas.test.ts`: envío a una visita reasignada y cancelada) y en campo (`motor.test.ts`: la visita cancelada con algo empezado se queda con su motivo) |
| 3. Dos personas cambiando la misma visita: la segunda recibe "otra persona la cambió" | Cumplido en integración (409 `conflicto_de_version`) |
| 4. Técnicos no programan; nada cruza organizaciones; cada cambio queda en la auditoría | Cumplido en integración, con las cadenas de cliente y de visita verificadas |
| 5. Desplegado en el entorno de pruebas con el extremo a extremo en verde contra él | Cumplido el 2026-09-25 (migración 0013 aplicada por `campo`) |

### Decisiones tomadas al construirlo

- **Cancelar reutiliza la salida del alcance** del corte 2: el teléfono ya sabe retirar una visita y conservarla si tiene algo empezado. La bajada agrega `motivo` (`reasignada` o `cancelada`) a `fuera_de_alcance`, como expansión (ADR-0015): una app anterior no lo lee y muestra "se asignó a otra persona"; la nueva dice "Oficina canceló esta visita". La versión de la app no cambia (sigue en 3).
- **Una visita cancelada no vuelve a los teléfonos:** `asignadas` la excluye aunque luego llegue otro cambio, y no se puede reasignar, reprogramar ni volver a cancelar (`estado_invalido`). Cancelar es definitivo; si hace falta, se programa otra. Los levantamientos de una visita cancelada se siguen recibiendo (regla 17) y cuentan en su avance.
- **Reprogramar** cambia fecha y motivo y avisa a los técnicos asignados con un cambio de la visita; el teléfono la reemplaza en la siguiente bajada.
- **Concurrencia:** reasignar, reprogramar y cancelar llevan la versión de la visita (la columna ya existía); con otra versión, `conflicto_de_version` (409) con `versionActual`. El formulario queda abierto y reintenta con la versión recién leída. El comando `reasignar-visita` sigue sin versión.
- **Avance deducido** con un conteo por estado que aporta `levantamientos` (`conteosPorVisita`). `visitas` no importa `levantamientos` (sería un ciclo, porque `levantamientos` usa `visitas`): recibe esa función al componer el rol web en `app.ts`.
- **Técnicos asignables:** solo técnicos activos de la organización, validados en el servidor contra `identidad.tecnicosActivos`; nueva operación `listarTecnicos` para oficina.
- **Vistas:** "próximas" desde hoy (fecha del navegador, que envía oficina en la consulta: el servidor no supone zona horaria), completas y por fecha ascendente; "anteriores" y "canceladas", las 100 más recientes. Índice nuevo por organización y fecha.
- **Motivo:** en oficina, las tres opciones del lenguaje común (mantenimiento, cotización, modificación); el contrato lo sigue aceptando como texto, por las visitas que ya existían.
- **Componentes nuevos en `ui`:** `CampoSeleccion` (lista nativa, para clientes y sitios) y fecha en `CampoTexto`.
- **Auditoría:** `cliente_creado` y `sitio_agregado` en la cadena del cliente; `visita_reprogramada` (antes y después) y `visita_cancelada` (con su motivo) en la de la visita, junto a las que ya existían.

---

## Iteración 8 · Producción provisional, copias y simulacro

**Estado:** terminada el 2026-09-25; producción provisional montada y respaldada, sin datos reales (ADR-0021). Kevin pidió subir la rama y montar producción con un dominio gratuito mientras TEINS no tiene dominio ni cuenta; eligió un proyecto aparte y transferible, sin datos reales hasta la transferencia (ADR-0021), y abrir un pull request en borrador para que corra la integración continua.

**Para qué:** que producción exista, se pueda recrear desde el repositorio y tenga copias probadas antes del piloto, de modo que el día que TEINS tenga cuenta solo haya que transferirla (ADR-0016, QA-10, QA-18). Procedimiento completo en [`produccion.md`](produccion.md).

### Alcance

- Rama `corte-0` en GitHub con la integración continua en verde (pull request #1, en borrador).
- `.railway/railway.ts`: infraestructura como código de Railway, la misma para pruebas y producción, sin secretos.
- `infra/railway/montar.sh`: monta un entorno desde cero (secretos generados sin mostrarse, roles, dominios gratuitos, despliegue, copias y primera persona administradora).
- Copias en los cuatro niveles de ADR-0016: recuperación a un punto en el tiempo y copias del volumen (Railway); servicio `respaldos` con volcado diario y copia de archivos a otro proyecto y otra región; simulacro con verificación de cadenas y archivos (`infra/respaldos/simulacro.sh`, `verificar-integridad`).

### Fuera de la iteración 8

| Qué | Dónde se resuelve |
|---|---|
| Destino de los respaldos en otro proveedor (nivel 2 completo), con una llave sin permiso de borrar y retención obligatoria del bucket | Cuando Kevin o TEINS abran una cuenta compatible con S3; cambian variables y la retención pasa a ser regla del bucket (`produccion.md`, "Pendiente para cumplir del todo el nivel 2") |
| Dominio propio | Cuando TEINS lo tenga; se agrega junto al de Railway |
| Datos reales | Después de transferir a TEINS o con su autorización escrita (ADR-0021) |
| Despliegue automático desde GitHub | Al fusionar a `master` (ADR-0016: pruebas automático, producción con aprobación) |

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. La rama está en GitHub y la integración continua pasa completa | Cumplido el 2026-09-25: pull request #1, los cinco trabajos en verde (tipos y reglas, secretos, servidor con PostgreSQL y S3, imagen, extremo a extremo) |
| 2. `railway config plan` no muestra diferencias después de aplicar | Cumplido el 2026-09-25 en pruebas y en producción ("already up to date") |
| 3. Producción montada con `montar.sh`, con dominios gratuitos, y verificada | Cumplido el 2026-09-25: las tres superficies responden, la primera persona administradora entra y administrar le exige el segundo factor. Se verificó con una prueba de humo, no con el extremo a extremo: este crea usuarios, clientes y visitas ficticios, y producción debe quedar limpia |
| 4. El servicio `respaldos` corre en pruebas y en producción y deja el volcado y los archivos en `teins-respaldos` | Cumplido el 2026-09-25 en los dos entornos (volcado con su SHA-256 y archivos copiados) |
| 5. Simulacro correcto contra la copia real de cada entorno, anotado en `produccion.md` | Cumplido el 2026-09-25: pruebas (75 cadenas y 23 archivos) y producción (2 cadenas); en local detectó 4 fotos que ya faltaban en el origen |

### Decisiones tomadas al construirlo

- **Infraestructura como código de Railway** (`.railway/railway.ts`, paquete `railway`, MIT) y no `railway.json`: el formato anterior deja de leerse el 2026-12-01. Las conexiones se arman con referencias (`${{Postgres.PGHOST}}`, `${{teins-pruebas.ENDPOINT}}`, `${{portal.RAILWAY_PUBLIC_DOMAIN}}`); los secretos quedan como `preserve()`. El plan contra pruebas mostró que el archivo reproduce el proyecto: solo cambian los dominios escritos a mano por referencias equivalentes y salen cuatro variables de host que cada servicio no usaba.
- **Un solo archivo para los dos proyectos:** `ctx.projectName` elige el almacenamiento y quita `ENTORNO_DE_PRUEBAS` en producción, así que `sembrar` nunca corre allí.
- **Secretos por la entrada estándar:** `montar.sh` los genera con `openssl` y los fija con `railway variable set --stdin`; las contraseñas de los roles se aplican dentro del contenedor de Postgres. Nada queda en la terminal ni en el repositorio.
- **Respaldo con `pg_dump` y `rclone`** (MIT) en una imagen propia sobre `postgres:18-alpine`: el volcado se lee con `pg_restore --list` antes de subirlo y viaja con su SHA-256; los archivos se copian con `--immutable` (nunca se reemplaza ni se borra nada en el destino). Retención de volcados: 35 días. Desde el 2026-09-29 también con `--checksum`: compara tamaño y huella, no la fecha. El respaldo de pruebas de ese día falló porque, tras vaciar el almacenamiento, cinco archivos ya copiados se subieron otra vez con el mismo contenido y otra fecha, y `--immutable` sin `--checksum` lo toma como una modificación. Otro contenido bajo la misma llave sigue siendo un error.
- **Destino en otro proyecto y otra región** (`teins-respaldos`, US West) mientras no haya cuenta de otro proveedor: sobrevive a que se borre producción, no a perder la cuenta (lo dice ADR-0021).
- **Simulacro verificable:** restaura en un PostgreSQL desechable con los roles de `infra/roles.sql`, verifica todas las cadenas de la auditoría con el código del servidor y compara los archivos referenciados con los copiados. Corre en el computador de quien lo lanza con `railway run`, que le pasa las credenciales sin mostrarlas. Usa una carpeta temporal bajo `~/.cache`, porque Colima y Docker Desktop no siempre comparten `/tmp` con los contenedores.
- **Contraseñas de los roles:** la primera corrida de `montar.sh` en pruebas dejó vacías las contraseñas de `teins_app` y `teins_portal`: el contenedor de Postgres no veía las variables, porque se agregaron después de que arrancó (un contenedor solo ve las que tenía al desplegarse). Las conexiones abiertas siguieron funcionando y el único despliegue que falló (campo) no reemplazó al anterior; se corrigió desde el contenedor del portal, tomando cada contraseña de su conexión ya resuelta. Desde entonces `montar.sh` redespliega Postgres si no ve las contraseñas y nunca aplica una vacía.
- **Región de la base:** el `apply` inicial creó el Postgres de producción en `us-west2` (la región por defecto del espacio de trabajo), lejos de los servicios en `us-east4`. El plan lo detectó y se movió con la base casi vacía y respaldada; los datos se verificaron después (ingreso y cadenas íntegras). `respaldos` sigue en `us-west2`: Railway no aplica la región declarada a un servicio programado; el volcado cruza de región una vez al día.
- **Archivo de la recuperación a un punto en el tiempo:** Railway elige su región al activarla (`iad` en pruebas, `sjc` en producción) y no se puede cambiar; el archivo la declara por proyecto.
- **Organización de producción:** producción nunca se siembra, así que la crea el comando nuevo `crear-organizacion` (mismo identificador que en pruebas, nombre "TEINS").
- **Copias programadas del volumen:** con el plan Hobby, Railway no deja programarlas; queda la recuperación a un punto en el tiempo, y `montar.sh` lo avisa sin detenerse.
- **Correr un respaldo ya:** `infra/respaldos/ahora.sh` (la API de Railway ejecuta el servicio programado sin esperar a su hora).
- **Pruebas del PDF bajo carga:** esperar los PDF por tiempo (hasta 90 s, procesando la cola) y no por 20 vueltas: un PDF que falla una vez bajo carga vuelve a la cola segundos después (`esperarPdf` en las pruebas del servidor).
- **Integración continua:** el trabajo del servidor instala el Chromium de `playwright-core` (sin él no se generaban los PDF), y gitleaks recibió permiso para leer el pull request.

**Revisión de seguridad 4d (2026-09-29): configuración, Railway e `infra`.**

- **El rol dueño solo donde se usa:** `DATABASE_URL_PROPIETARIO` es opcional en la configuración y la exigen el worker, `migrar`, `sembrar` y `crear-organizacion` (`urlDelPropietario`). En Railway la tienen `campo` (migra y corre los comandos) y `worker`; `oficina` y `portal`, no. Un fallo en el portal ya no entrega una conexión que se salta la seguridad por fila y puede reescribir la auditoría. Que el servicio del portal atienda solo el portal, sin `teins_app` ni `AUTH_SECRETO`, sería un tercer rol de arranque: cambia ADR-0001 y queda para un ADR si se quiere.
- **Proxies contados, no "confiar en todo":** `PROXIES_DE_CONFIANZA` (en Railway, 2) reemplaza `trustProxy: true`. La IP del cliente es la que está justo antes de los proxies en `X-Forwarded-For`; lo que el cliente escriba antes se ignora aunque el borde deje de descartarlo. Fastify 5.12 no acepta el número (lo trata como "no confiar", porque no puede validar quién conecta), así que va como función; en Railway solo se llega al servicio por el borde o por la red privada. En producción la configuración exige el dato: sin él, todas las solicitudes compartirían un límite de intentos.
- **Sin `NODE_ENV`, no arranca un despliegue:** con orígenes `https` y modo de desarrollo, la configuración falla (saldrían cookies sin `Secure`, sin HSTS y con `sembrar` permitido). Se eligió esa regla y no hacer obligatorio `NODE_ENV`, que obligaba a tocar los `.env` de todos; la imagen ya fija `NODE_ENV=production`.
- **La correlación la genera el servidor:** la cabecera `x-correlacion` que manda quien pide ya no llega a la auditoría encadenada.
- **Respaldos cifrados** con `rclone crypt` y `RESPALDOS_CLAVE` en `cifrado/` del destino, con copia de la clave en `privado/<proyecto>-respaldos.txt` (sin ella no se restaura nada si se pierde el proyecto). Sin clave, el respaldo no corre, y con otra tampoco: antes de escribir, la clave tiene que abrir la huella del último volcado del destino. La primera corrida mueve la copia vieja sin cifrar a la cifrada. `clave.sh` nunca genera una clave nueva si ya hay copia en `privado/` (montar de nuevo un proyecto perdido habría dejado ilegibles los respaldos; lo encontró una revisión independiente de las correcciones). Se verificó en local de punta a punta (cero apariciones del contenido en claro, simulacro correcto con la clave y fallido con otra, otra clave detenida sin escribir) y en el entorno de pruebas el 2026-09-29: la raíz del destino quedó solo con `cifrado/`, los 7 volcados cifrados y el simulacro correcto (177 cadenas, 27 archivos). Los almacenamientos de Railway no ofrecen versiones, bloqueo ni credenciales limitadas: que quien tome producción no pueda borrar las copias queda para el destino en otro proveedor.
- **`montar.sh`:** si la CLI falla al leer un secreto, se detiene (antes lo tomaba por inexistente y lo reemplazaba: habría cerrado todas las sesiones y dejado ilegibles los segundos factores); la contraseña de la primera persona administradora y las de los roles viajan por la entrada estándar, y las de los roles no quedan en el registro de PostgreSQL (verificado con `log_statement = 'all'`). Al final corre `verificar-exposicion.sh`: la base, el worker y los respaldos no se alcanzan desde internet (verificado en pruebas).
- **`dejar-limpio.sql` no borra nada fuera del entorno de pruebas:** exige `oficina.prueba` y `tecnico.prueba`, que solo crea `sembrar`. Verificado en una base desechable con forma de producción (no borra) y con la de pruebas (limpia).

---

## Iteración 9 · Secciones repetibles

**Estado:** terminada y desplegada en el entorno de pruebas el 2026-09-25 (Kevin: "Yes. start.", después de validar el iPhone); falta la prueba en el iPhone. Producción sigue con la versión anterior hasta que Kevin decida actualizarla.

**Para qué:** que un formato tenga secciones que el técnico repite cuantas veces haga falta (pisos, áreas, tableros), cada una con su nombre y los mismos campos (F2 en `01-impulsores.md`; ADR-0006 ya reserva `repetible` en el formato). Los formatos reales de TEINS casi seguro lo necesitan: con esto, llegan como datos y no como código (QA-11).

### Alcance

- **Formato:** una sección puede declarar `repetible: { etiqueta, min, max }`, por ejemplo `{ "etiqueta": "Tablero", "min": 0, "max": 20 }`. El meta-esquema lo valida y exige `appMinima` 4: una app anterior no lo recibe (ADR-0015, punto 4).
- **Campo (app 4):** en una sección repetible, "Agregar tablero", cada repetición con su nombre (por defecto "Tablero 1", "Tablero 2"; se puede cambiar) y "Quitar" con confirmación. El levantamiento nace con las `min` repeticiones.
- **Validación, en el teléfono y en el servidor:** cada repetición con sus campos obligatorios, y el número de repeticiones entre `min` y `max`.
- **Oficina:** revisa y corrige cada repetición por separado; el historial dice en cuál ("Tableros · Tablero 2 · Corriente nominal"). Oficina no agrega ni quita repeticiones: eso es captura.
- **Informe y PDF:** cada repetición con su nombre, en orden.

### Fuera de la iteración 9

| Qué | Dónde se resuelve |
|---|---|
| Secciones repetibles dentro de otra repetible (pisos con áreas) | Cuando un formato real de TEINS lo pida |
| Reordenar repeticiones | Cuando TEINS lo pida; hoy quedan en el orden en que se agregan |
| Bocetos | Iteración siguiente (ADR-0019) |

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Extremo a extremo: el técnico agrega dos tableros, los llena y envía; oficina ve los dos con su nombre, corrige uno y el historial dice cuál; el PDF los muestra en orden | Cumplido el 2026-09-25 en Chromium y WebKit en local y en Chromium contra el entorno (`e2e/pruebas/repeticiones.spec.ts`); el orden en el PDF, en integración (`pruebas/repeticiones.test.ts`) |
| 2. Un formato con sección repetible no llega a una app anterior, y una definición inválida no se publica | Cumplido en integración (la bajada con app 3 no lo trae; sin `appMinima` 4 no se publica) |
| 3. El servidor rechaza repeticiones de menos o de más, campos obligatorios vacíos en una repetición y claves de repetición que no existen | Cumplido en integración y en `dominio` |
| 4. Los formatos y levantamientos sin secciones repetibles funcionan igual que antes | Cumplido: toda la suite anterior en verde (17 de 17 en el extremo a extremo, más el salto conocido) |
| 5. Probado en el iPhone | Pendiente: fase 9 de [`verificacion-manual.md`](verificacion-manual.md) |

### Decisiones tomadas al construirlo

- **Cómo se guardan las respuestas:** cada repetición es una clave más del mismo mapa de respuestas, `seccion~id` (por ejemplo `tableros~k3f9x2ab`), y el levantamiento lleva aparte la lista ordenada `repeticiones` con el id y el nombre de cada una. Se descartó guardar un arreglo por sección: cambiaba la forma de las respuestas en todo el sistema y la ruta de una corrección dependería de la posición, que cambia al quitar una repetición. Con un id estable, la auditoría y las correcciones siguen diciendo `seccion.campo`, y las fotos, la validación y el almacenamiento casi no cambian. `~` no es válido en una clave de sección, así que nunca choca.
- **App 4:** `campo` sube a `VERSION_APP = 4`. El meta-esquema exige `appMinima` 4 a todo formato con secciones repetibles, así que la bajada nunca se lo entrega a una app anterior (probado). Un levantamiento sin secciones repetibles viaja igual que antes: el comando solo lleva `repeticiones` si las tiene (ADR-0015, expansión).
- **Ids de repetición:** 8 caracteres en base 36 al azar, generados en `campo`; `dominio` sigue siendo TypeScript puro y los recibe como parámetro. El levantamiento nace con las `min` repeticiones.
- **Nombres:** por defecto "Tablero 1", "Tablero 2"; al agregar se usa el primer número libre, así que quitar "Tablero 2" y agregar otro no repite un nombre. Un nombre vacío no se guarda: se conserva el anterior.
- **Quitar** pide confirmación y borra las respuestas de esa repetición; las fotos quedan en el teléfono hasta que nada las use, como siempre.
- **Oficina** ve cada repetición como una sección con su nombre y, si la sección quedó vacía, "El técnico no agregó ninguno". Corrige y comenta solo en repeticiones que existen; el servidor rechaza una clave de repetición que no está en la lista. La auditoría guarda la ruta con el id (`tableros~id.ubicacion`) y oficina y campo la muestran con el nombre ("Tableros · Tablero 2 · Ubicación del tablero").
- **Límites:** hasta 50 repeticiones por sección si el formato no pide menos; nombre de hasta 120 caracteres. `LIMITES` pasó a su propio archivo en `dominio` para no crear un ciclo entre `levantamiento` y `validacion`.
- **Formato de prueba v4:** `prueba-ups` v3 más la sección repetible "Tableros" (0 a 10, con ubicación y corriente obligatorias y una foto opcional). Con mínimo 0, los recorridos existentes no cambian.

---

## Iteración 10 · Bocetos

**Estado:** terminada y desplegada en el entorno de pruebas el 2026-09-25 (Kevin: "We can have the validation on stand by. Continue with the next step"); la prueba en iPhone, de esta y de la iteración 9, queda en espera. Producción sigue con la versión anterior.

**Para qué:** que el técnico dibuje en el teléfono, sobre cuadrícula, el croquis que hoy hace en papel (P14, F3), y que llegue nítido a oficina y al PDF. Las decisiones grandes ya están en ADR-0019: trazos vectoriales propios con perfect-freehand, seis herramientas, y subida al enviar.

### Alcance

- **Formato:** tipo de campo `boceto` (ADR-0006). Exige app 5 (`appMinima` 5).
- **Campo (app 5):** el campo muestra la miniatura y abre el editor a pantalla completa: trazo libre, línea recta, texto, borrador por trazo, deshacer y rehacer, cuadrícula; lápiz con presión y rechazo de la palma; zoom y desplazamiento con dos dedos. Cada trazo se guarda al terminarlo, sin conexión.
- **Archivo:** el boceto es un documento JSON (trazos, líneas y textos) guardado como archivo inmutable direccionado por su huella (ADR-0007), igual que una foto. La respuesta guarda `{ boceto: huella }`. A diferencia de las fotos, sube solo cuando el levantamiento se envía (ADR-0019, parte 3).
- **Servidor:** acepta el tipo de archivo del boceto, verifica su estructura en el worker y lo exige completo antes de registrar el envío (QA-2).
- **Oficina y PDF:** el boceto se ve como imagen vectorial; no se corrige desde oficina (como las fotos).

### Fuera de la iteración 10

| Qué | Dónde se resuelve |
|---|---|
| Formas, capas, escalas y medición | Fuera de alcance por ADR-0019 (terreno del plano de oficina) |
| Dibujar sobre una foto | Cuando TEINS lo pida |
| Probar el lápiz en tabletas reales | Prueba en dispositivo, junto con la del iPhone |

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Extremo a extremo: el técnico dibuja un trazo, una línea y un texto, deshace y rehace, envía; oficina ve el boceto y el PDF lo incluye | Cumplido el 2026-09-25 en Chromium y WebKit en local y en Chromium contra el entorno (`e2e/pruebas/bocetos.spec.ts`, hasta publicar el informe) |
| 2. El boceto no sube mientras es borrador; sube al enviar y el envío espera a que esté verificado | Cumplido en campo (`repositorio.test.ts`, `motor.test.ts`) y en integración (`pruebas/bocetos.test.ts`) |
| 3. El servidor rechaza un boceto con estructura inválida y un formato con bocetos sin `appMinima` 5 | Cumplido en integración |
| 4. Lo anterior sigue igual: toda la suite en verde y el presupuesto de campo respetado | Cumplido: 19 de 19 en el extremo a extremo (más el salto conocido); campo en 114,1 KB de 120 |
| 5. Probado en el iPhone (y con lápiz, si hay una tableta) | Pendiente: fase 10 de [`verificacion-manual.md`](verificacion-manual.md), en espera por decisión de Kevin |

### Decisiones tomadas al construirlo

- **El boceto es un archivo, como una foto:** documento JSON (`formato: "teins-boceto"`, versión 1) con lienzo lógico de 1000 × 750 (4:3), cuadrícula de 25 y tres clases de elemento: trazo, línea y texto. La respuesta guarda `{ boceto: huella }`; el documento vive en el archivo, direccionado por su huella (ADR-0007). La serialización es canónica (orden de claves fijo, un decimal), así que el mismo dibujo da siempre la misma huella.
- **El contorno se calcula en campo:** cada trazo guarda sus puntos (con presión) y el contorno que calcula perfect-freehand (MIT) al terminarlo. Así el SVG sale de una función pura de `dominio` (`bocetoASvg`) y oficina, el PDF y el componente `Boceto` de `ui` lo dibujan sin la biblioteca de dibujo; solo `campo` la usa.
- **Sube al enviar (ADR-0019, parte 3):** cada cambio guarda una versión nueva del archivo en el teléfono y borra la anterior si nada la usa; la cola de subidas solo toma los bocetos de levantamientos ya enviados. El envío espera, como con las fotos, a que el boceto llegue y se verifique (QA-2).
- **Verificación en el worker:** un boceto no tiene firma de tipo; se lee completo (hasta 2 MB) y se valida con `validarBoceto` de `dominio`. Solo campo sube bocetos (oficina, no); un contenido inválido se rechaza y se borra, como cualquier archivo.
- **Oficina lo pide al servidor ya verificado** (`GET /api/archivos/{huella}/boceto`) en vez de descargarlo del almacenamiento: no hace falta abrir CORS de lectura al bucket y nunca se dibuja algo sin validar. Un boceto no se corrige desde oficina, como las fotos.
- **Editor cargado aparte:** el editor (con perfect-freehand) es un fragmento propio de 4,5 KB comprimidos que se carga al tocar "Dibujar boceto"; el JavaScript inicial de campo quedó en 114,1 KB de 120.
- **Entrada:** trazo, línea, texto (se toca la hoja y se escribe), borrador por elemento (toque o arrastre), deshacer y rehacer (en memoria, durante la edición), zoom de 1× a 4× y desplazamiento con dos dedos. Rechazo de la palma: desde que aparece un lápiz, el dedo no dibuja.
- **App 5:** `campo` sube a `VERSION_APP = 5` y el meta-esquema exige `appMinima` 5 a un formato con bocetos. Formato de prueba v5: v4 más "Croquis del cuarto" (opcional).
- **Un error encontrado al probar:** el motor de sincronización pedía subir todo archivo como `image/jpeg`; el worker rechazaba el boceto (con razón) y el envío quedaba esperando. Ahora cada archivo sube con su tipo; lo cubre una prueba del motor.

---

## Iteración 11 · Cantidades con catálogo

**Estado:** terminada el 2026-09-25 y desplegada en el entorno de pruebas (formato de prueba v6 sembrado). Falta la prueba en iPhone (fase 11 de la guía), en espera con las de las iteraciones 9 y 10.

**Para qué:** que los materiales y trabajos que el técnico anota en campo no se vuelvan a digitar para cotizar: oficina los vincula al catálogo de TEINS, los suma por visita y los exporta a Excel (F9, P27, P28; reglas 6 y 7 del modelo de dominio).

### Alcance

- **Formato:** tipo de campo `cantidades` con sus unidades permitidas (`unidades`, como la medida). Exige app 6.
- **Campo (app 6):** tabla de líneas: descripción, cantidad (decimal, mayor que cero), unidad y observación opcional; agregar y quitar líneas. Texto libre: el técnico no elige del catálogo (regla 6).
- **Servidor:** al recibir el levantamiento, y después de cada corrección, las líneas se proyectan a una tabla relacional en la misma transacción (ADR-0006, parte 2). Allí vive el vínculo al catálogo. Una línea que desaparece se marca como quitada, nunca se borra (regla 14).
- **Catálogo:** pantalla de oficina para crear, editar y desactivar ítems (código, descripción, unidad) e importarlos en bloque desde CSV (TEINS ya tiene su lista, P28).
- **Revisión:** quien tiene la revisión corrige las líneas (con historial) y vincula cada una a un ítem del catálogo (queda en la auditoría).
- **Exportación:** por visita, dos CSV que Excel en español abre directo: el detalle de líneas y el resumen sumado por ítem de catálogo (o por descripción y unidad si no está vinculado). Sin precios (regla 7).
- **Informe:** la tabla de cantidades en el PDF.

### Supuestos mientras TEINS responde

| Pregunta | Supuesto |
|---|---|
| P28: ¿qué columnas tiene su catálogo? | Código, descripción y unidad |
| P29: ¿qué columnas necesita el Excel? | Visita, cliente, sitio, levantamiento, técnico, sección, descripción, cantidad, unidad, observación, código y descripción del catálogo; el resumen suma por ítem y unidad |

### Fuera de la iteración 11

| Qué | Dónde se resuelve |
|---|---|
| Sugerencias del catálogo en campo mientras se escribe | Cuando TEINS lo pida: exige bajar el catálogo al teléfono |
| Precios y presupuestos | Módulo futuro (QA-12); nunca en la línea de cantidad (regla 7) |
| Archivo .xlsx con formato | Cuando TEINS responda P29; mientras, CSV |

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Extremo a extremo: el técnico anota líneas y envía; oficina importa un catálogo, vincula una línea, corrige otra y exporta el detalle y el resumen de la visita; el PDF trae la tabla | Hecho: `e2e/pruebas/cantidades.spec.ts` en Chromium y WebKit en local, y en Chromium contra el entorno de pruebas; la tabla del PDF, en `servidor/pruebas/cantidades.test.ts` |
| 2. El servidor rechaza líneas sin descripción, con cantidad cero o con una unidad no permitida | Hecho: `cantidades_invalidas` en `dominio/src/cantidades.test.ts` y en el envío (`servidor/pruebas/cantidades.test.ts`) |
| 3. La tabla relacional sigue al documento: corregir agrega, cambia o marca quitadas las líneas y conserva los vínculos | Hecho: `servidor/pruebas/cantidades.test.ts` (proyección, corrección y exportación) |
| 4. Vincular solo lo hace quien tiene la revisión, y queda en la auditoría | Hecho: sin revisión responde `estado_invalido`, un ítem desactivado `entrada_invalida`, el técnico no ve el catálogo (403); `linea_vinculada` en la auditoría con el ítem anterior y el nuevo |
| 5. Lo anterior sigue igual y el presupuesto de campo se respeta | Hecho: verificación completa en el orden de la integración continua (dominio 73, protocolo 18, oficina 4, campo 41, servidor 89, extremo a extremo 21 y 1 omitida); campo 115,4 de 120 KB |

### Decisiones tomadas al construirlo

- **La cantidad es un decimal en texto** ("12.5"), mayor que cero, como la medida (ADR-0006): nada de coma flotante en lo que se cotiza. Campo y oficina aceptan "12,5" y guardan el canónico; lo que no se puede leer se guarda tal cual y la validación del envío lo marca (`cantidades_invalidas`).
- **Cada línea tiene un id de 8 caracteres** que genera quien la crea. El vínculo al catálogo y las correcciones siguen la línea por su id, no por su posición: reordenar o quitar otra línea no cambia a qué ítem está vinculada.
- **El vínculo no está en las respuestas, está en la proyección** (`levantamientos.lineas_cantidad`, clave levantamiento, sección, campo y línea). Lo que escribió el técnico no cambia al vincular; la proyección se actualiza en la misma transacción que el envío y que cada corrección, y una línea que desaparece queda marcada `quitada_en` con su vínculo (regla 14).
- **Vincular es una acción de revisión:** solo quien tiene la revisión, sube la versión del levantamiento (dos pestañas no se pisan, QA-25) y queda en la auditoría como `linea_vinculada` con el ítem anterior y el nuevo. Un ítem desactivado no se vincula, pero las líneas que ya lo tenían lo conservan.
- **Módulo `catalogo` propio** (esquema `catalogo`, RLS por organización), con interfaz pública `items(ids)`: levantamientos no lee su tabla. Un ítem nunca se borra; se desactiva. La importación actualiza por código (el último del archivo manda) y reactiva lo que estaba desactivado.
- **El CSV lo arma el navegador;** el servidor entrega los datos (`cantidadesDeVisita`). Punto y coma, coma decimal, BOM y CRLF para que Excel en español lo abra con doble clic. Una celda de texto libre que empieza por `=`, `+`, `-` o `@` lleva un apóstrofo delante: Excel no la ejecuta como fórmula.
- **La exportación incluye levantamientos sin revisar,** con un aviso: oficina puede querer cotizar antes de cerrar la revisión. El resumen suma por ítem y unidad; lo no vinculado, por descripción (sin distinguir mayúsculas ni espacios) y unidad.
- **Elegir el ítem es una lista nativa** con todos los activos ("C-12 · Cable THHN 12 AWG (m)"), sin filtrar por la unidad de la línea: el técnico puede escribir "und" donde el catálogo dice "UN". Si el catálogo real es de miles de ítems y la lista se vuelve lenta, se cambia por un buscador.
- **Contra el entorno de pruebas, un navegador y una prueba a la vez:** tres pruebas seguidas chocan con el límite de 5 inicios de sesión por minuto (QA-7) y la de repeticiones venció esperando la bandeja; sola pasó en 28 s.
- **oficina estrena pruebas unitarias** (`src/csv.test.ts`): la lectura del catálogo y la escritura de los CSV no se prueban bien solo de punta a punta.

## Iteración 12 · Cifrado local en campo

**Estado:** terminada el 2026-09-25 y desplegada en el entorno de pruebas (`cifrado.spec.ts` en Chromium contra el entorno, verde). Falta la prueba en iPhone (fase 12 de la guía), en espera con las de las iteraciones 9 a 11.

**Para qué:** que un teléfono perdido o copiado no entregue datos de clientes, y que la orden de borrado de un técnico revocado vuelva ilegible todo lo suyo al instante, aunque borrar cientos de fotos se interrumpa (ADR-0009, parte 5; QA-5; I-15).

### Alcance

- **Clave:** AES-GCM de 256 bits, no extraíble, una por técnico en el teléfono.
- **Sellado:** respuestas y repeticiones, fotos y bocetos, el comando del outbox, las visitas y los comentarios de oficina (ADR-0022, punto 1).
- **Migración sin pérdida:** lo guardado antes del cifrado se sella en segundo plano, registro por registro (regla 5).
- **Borrado por revocación:** primero la clave, después los registros; si se interrumpe, se termina antes de confirmarlo al servidor.
- **Diagnóstico:** "Datos cifrados: Todos" o cuántos faltan.

### Fuera de la iteración 12

| Qué | Dónde se resuelve |
|---|---|
| Cifrado en `oficina` y en el portal | No aplica: no guardan datos en el dispositivo |
| Clave ligada a la biometría del teléfono | Cuando la web lo permita (ADR-0022, "Cuándo revisarla") |
| Passkeys | Iteración 13 |

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. En la base del teléfono no se lee nada de lo capturado ni de la visita, en Chromium y WebKit, y todo se lee igual al volver a abrir y se envía | Hecho: `e2e/pruebas/cifrado.spec.ts` lee IndexedDB directamente; `campo/src/datos/cifrado.test.ts` recorre todas las tablas |
| 2. La clave no se puede exportar y un sellado copiado a otro registro no abre | Hecho: `cifrado.test.ts` |
| 3. Un teléfono con datos de la iteración 11 conserva todo: se cifra lo que tiene responsable, con su estado de subida y su envío; lo del corte 0 espera a su responsable | Hecho: `cifrado.test.ts`, migración de la versión 3 a la 4 |
| 4. La orden de borrado destruye primero la clave; interrumpida, deja todo ilegible y se termina; no le quita a otro técnico una foto compartida | Hecho: `cifrado.test.ts` y las pruebas de revocación del motor |
| 5. Escrituras seguidas o desde dos pestañas no se pisan y la última tecla es la que queda | Hecho: `cifrado.test.ts` |
| 6. Lo anterior sigue igual y el presupuesto de campo se respeta | Hecho: verificación completa en el orden de la integración continua (dominio 73, protocolo 18, oficina 4, campo 47, servidor 89, extremo a extremo 23 y 1 omitida); campo 117,2 de 120 KB |

### Decisiones tomadas al construirlo

- **Sellar fuera de la transacción y escribir con comprobación optimista** (ADR-0022): WebCrypto no cabe en una transacción de IndexedDB. Se descartaron `Dexie.waitFor` (consultas de relleno, frágil en Safari) y el cifrado síncrono en JavaScript (la clave quedaría legible en la base).
- **Las escrituras de un levantamiento van en fila dentro de la pestaña.** Solo con la comprobación optimista, ocho escrituras a la vez se estorbaban hasta agotar los reintentos, y una tecla vieja podía guardarse después de una nueva. La fila las pone en orden; entre pestañas decide la comprobación.
- **Las huellas de los archivos de cada levantamiento quedan a la vista**, junto al sellado: subir, borrar y decidir si otro usa una foto no exige abrir nada, y eso sí cabe en una transacción.
- **Índice `cifrado` en los archivos:** saber qué fotos faltan por sellar sin cargar los bytes de todas en memoria.
- **La migración no está en `upgrade` de Dexie** (no admite WebCrypto): la versión 4 solo agrega la tabla y el índice, y el sellado corre al abrir la app y al iniciar sesión. Se puede interrumpir y repetir.
- **Una foto compartida por dos técnicos pasa a la clave del otro** antes de destruir la del revocado: el borrado de uno nunca le quita datos al otro, como antes del cifrado.
- **Quedan 2,8 KB del presupuesto de campo** (117,2 de 120): la próxima iteración que toque campo empieza por revisar qué se puede cargar aparte, como ya se hizo con el editor de bocetos.
- **Las pantallas no saben del cifrado:** leen por el repositorio y por `datos/lecturas.ts`, que abren lo sellado dentro de `useLiveQuery`.

## Iteración 13 · Llaves de acceso (passkeys)

**Estado:** terminada el 2026-09-25 y desplegada en el entorno de pruebas (`llaves.spec.ts` en Chromium contra el entorno, verde). Falta la prueba en iPhone (fase 13 de la guía), en espera con las de las iteraciones 9 a 12.

**Para qué:** que el técnico entre con Face ID, huella o el PIN del teléfono en lugar de escribir una contraseña en campo, y que oficina pueda hacer lo mismo. Una llave de acceso no se puede suplantar desde otro sitio web (ADR-0009, parte 1: "passkey recomendada" para técnicos, opcional para oficina).

### Alcance

- **Servidor:** plugin de llaves de acceso de Better Auth (`@better-auth/passkey`, MIT) con la tabla `identidad.llaves_de_acceso`. Crear y quitar una llave queda en la auditoría.
- **Campo:** "Entrar con llave de acceso" en el inicio de sesión. Después de entrar con la contraseña, la app propone crear la llave ("Ahora no" la oculta en ese teléfono).
- **Oficina:** "Entrar con llave de acceso" y "Mi cuenta" (el nombre en el encabezado) para crear y quitar llaves.
- **Administración:** restablecer el acceso de una persona también quita sus llaves (teléfono perdido).

### Fuera de la iteración 13

| Qué | Dónde se resuelve |
|---|---|
| Autocompletar la llave en el campo de usuario (mediación condicional) | Cuando se vea en el iPhone si hace falta: el botón ya evita escribir |
| Llave como segundo factor sin TOTP para administrar | Se revisa si TEINS lo pide: hoy administrar exige el TOTP activo (respaldo si se pierde el teléfono) |
| Llave compartida entre campo y oficina | Con el dominio propio de TEINS (un solo `rpID` padre); hoy cada superficie tiene su dominio gratuito |

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Técnico y oficina crean una llave y entran sin contraseña | Hecho: `e2e/pruebas/llaves.spec.ts` (Chromium con autenticador virtual) y `servidor/pruebas/llaves-de-acceso.test.ts` (autenticador de software) |
| 2. Sin verificar a la persona (solo un toque) no se entra | Hecho: `llaves-de-acceso.test.ts` |
| 3. Un usuario desactivado no entra con su llave; restablecer el acceso invalida la llave del teléfono perdido | Hecho: `llaves-de-acceso.test.ts` |
| 4. Nadie quita la llave de otra persona; crear y quitar quedan en la auditoría | Hecho: `llaves-de-acceso.test.ts` |
| 5. Lo anterior sigue igual y el presupuesto de campo se respeta | Hecho: verificación completa en el orden de la integración continua (dominio 73, protocolo 18, oficina 4, campo 47, servidor 93, extremo a extremo 24 y 2 omitidas); campo 117,3 de 120 KB |

### Decisiones tomadas al construirlo

- **Una instancia de Better Auth por dominio de superficie.** Una llave queda ligada al dominio donde se creó (`rpID`), y el plugin solo lo toma de una URL base fija; la nuestra sale del host de cada solicitud (ADR-0016). Cada superficie tiene su instancia con su `rpID`; todas comparten la base, el secreto y las sesiones, y la solicitud va a la de su host. Consecuencia: la llave de campo no sirve en oficina y viceversa, hasta tener un dominio propio.
- **Siempre con verificación de la persona** (Face ID, huella o PIN): se exige al crearla y al entrar (el plugin solo la prefería). Así la llave vale por dos factores, como pide ADR-0009 para quien administra.
- **Detectable (`residentKey: required`):** se entra sin escribir el usuario.
- **El nombre que muestra el teléfono es el usuario** (`tecnico.prueba`), no el correo interno `usuario@<organización>.invalid`. Lo pone el servidor.
- **Un usuario desactivado no entra con su llave:** la regla ya vivía en la creación de la sesión (regla 13), por donde pasa también la llave.
- **Restablecer el acceso quita todas las llaves** de la persona y lo registra (`llavesQuitadas`): es lo que hace quien administra cuando alguien pierde el teléfono.
- **Administrar sigue exigiendo el TOTP activo.** Entrar con la llave cuenta como segundo factor (ADR-0009), pero el TOTP es el respaldo si se pierde el dispositivo con la llave.
- **La biblioteca del navegador (`@simplewebauthn/browser`, MIT) se carga solo al usar una llave:** 2,8 KB comprimidos fuera del JavaScript inicial de campo. La propuesta de crearla también se carga aparte.
- **Pruebas sin navegador:** un autenticador WebAuthn de software (`servidor/pruebas/autenticador.ts`, clave P-256 y el CBOR mínimo) prueba las reglas de seguridad en el servidor. WebKit no tiene autenticador virtual: esa parte se prueba en Chromium y en el iPhone.

## Iteraciones 15 a 21 · Plan acordado el 2026-09-26

**Por qué estas:** Kevin pidió funciones útiles en la vida real de TEINS; se investigaron aplicaciones de campo comparables (SafetyCulture, CompanyCam, magicplan, Bluebeam, software de mantenimiento de UPS) y se descartaron las que la plataforma no permite (medir con la cámara o LiDAR y medidores por Bluetooth: Safari no tiene WebXR ni Web Bluetooth) o que el teléfono ya resuelve (dictado por voz, que el teclado ya hace). Kevin eligió siete.

**Orden:** campo primero, porque Kevin quiere la PWA terminada. La 15 cierra lo último que le faltaba a la PWA (la instalación guiada) y monta los avisos; la 17 va antes de la 21 porque las líneas que llegan vinculadas vuelven casi automática la cotización; la 20 va antes de la 21 para enviar las cotizaciones por los mismos canales. Cada iteración empieza con maquetas en el lienzo, luego el ADR, el código, las pruebas de extremo a extremo y el despliegue en el entorno de pruebas. La prueba en iPhone de las iteraciones 9 a 14 sigue pendiente y es la que más riesgo reduce: cada iteración de campo se suma a ella.

| # | Qué | Versión de la app | Qué hace falta de fuera |
|---|---|---|---|
| 15 | Avisos push (Web Push con VAPID y el formato declarativo de Safari 18.4) e instalación guiada | Sin cambio de protocolo | Nada |
| 16 | Firma del cliente: tipo de campo `firma`, guardado como documento de boceto de solo trazos | 7 | TEINS confirma el texto de la constancia |
| 17 | Catálogo en la bajada; sugerencias, frecuentes y recientes al escribir; la línea lleva el ítem | 8 | Catálogo real de TEINS (P28); con el de prueba se construye |
| 18 | Mantener para enderezar (línea, polilínea, rectángulo, elipse), ajuste de ángulos y extremos, mover, rotar, duplicar, cota y flecha; documento de boceto versión 2 | 9 | Nada |
| 19 | Símbolos como datos (trazado SVG, nombre, categoría, código de catálogo opcional), publicados como los formatos y copiados dentro del boceto que los usa | 10 | Lista de símbolos de TEINS |
| 20 | Contactos del cliente; el informe publicado sale por correo (Resend, por HTTPS) y WhatsApp (Cloud API de Meta, plantilla de utilidad con el PDF) con estado por envío | Sin cambio | Cuenta de Resend y número de prueba de Meta para el entorno de pruebas; dominio de TEINS y cuenta de WhatsApp Business a su nombre para producción (R10) |
| 21 | Módulo de cotizaciones: lista de precios con historia, cotización desde las cantidades revisadas, IVA o AIU por cotización, versiones inmutables, PDF y envío | Sin cambio | Precios, plantilla (P29), tratamiento tributario y numeración |

**Decisiones de Kevin (2026-09-26):**

- **El informe se envía con el PDF adjunto** y el enlace al portal, no solo con el enlace: es lo que el cliente espera (P17). Consecuencia aceptada: "Retirar del portal" no recupera las copias ya enviadas, y el diálogo de retiro lo dirá.
- **La firma del cliente certifica la visita, no el contenido técnico:** oficina puede corregir medidas sin invalidarla, y firmar no bloquea el levantamiento.
- **El orden de la tabla.**

**Hallazgos que cambian el diseño:**

- **Railway bloquea SMTP en los planes Hobby y Free:** el correo sale por la API HTTPS del proveedor, no por SMTP.
- **El portal oculta una versión hasta que su PDF está listo:** el envío al cliente se encola cuando el PDF queda listo, no al publicar.
- **Los clientes no tienen contactos en ninguna parte** (solo `nombre`): la iteración 20 empieza por ellos. Para la SIC, los datos de contacto corporativos quedan fuera de la Ley 1581; Meta igual exige la autorización para WhatsApp, que se registra con quién y cuándo.
- **El AIU no aplica a la instalación ni al mantenimiento de redes eléctricas** según la doctrina de la DIAN: la cotización admite IVA sobre el subtotal o AIU con IVA sobre la utilidad, y el contador de TEINS decide en cada caso.
- **En iPhone, la app instalada no comparte datos con Safari** y los avisos solo llegan a la app instalada: la instalación va antes de iniciar sesión.
- **La biblioteca `web-push` es MPL-2.0,** que la verificación de licencias ya admite.

## Propuesta · Vista en vivo de los documentos

**Estado:** propuesta del 2026-09-29, a partir del prototipo de la base visual Precisión (https://claude.ai/artifact/MkRSHwecL2gXCZQ8zfHCrY). A Kevin le pareció "un diferencial grandísimo" y pidió plantearla como una sola función. Su ADR es el 0031, aceptado por Kevin el 2026-10-01: paquete `paquetes/documentos`, hoja continua aproximada y estilos servidos por oficina. Es la iteración 26, construida el 2026-10-01 (sección "Iteración 26").

**La idea:** mientras oficina trabaja, ve al lado el documento que va a recibir el cliente, tal como va a quedar, y se actualiza al escribir. Hoy solo se ve después de publicar, cuando ya no se puede cambiar.

**Dónde se usa:**

| Pantalla | Qué se ve en vivo |
|---|---|
| Cotización | La hoja de la cotización: cada precio, línea o cambio de impuestos se refleja al instante; pestaña "Correo" con el mensaje que recibe el contacto |
| Informe | El informe completo en el orden del PDF: introducción, un capítulo por levantamiento incluido, conclusiones y planos |
| Revisión de un levantamiento | Al corregir un dato, el capítulo del informe donde aparece, con el cambio resaltado y el valor anterior |
| Envíos | El correo y el WhatsApp que salen, con el adjunto |
| Campo (después) | En "Antes de enviar", lo que oficina va a recibir |

**Arquitectura propuesta (va al ADR):** las plantillas del informe y la cotización salen del servidor a un paquete nuevo, `paquetes/documentos`, que solo depende de `dominio` (hoy ya solo dependen de él y de una función de escape). El servidor las sigue usando para imprimir el PDF; oficina las usa para dibujar la vista en vivo sin ir al servidor en cada tecla. Así la vista previa y el PDF salen del mismo código y no se pueden separar. Los estilos de la plantilla pasan a un archivo servido por la misma superficie, para que la CSP de oficina (`style-src 'self'`) los admita en un marco `srcdoc`. Queda por decidir cómo paginar en pantalla (hojas carta fijas o continuo con marcas de salto).

**Lo que ya existe y se reemplaza:** la vista previa de la cotización de la iteración 24 (documento del servidor con la versión guardada), que pasaría a ser en vivo y sin guardar.

## Iteración 42 · Lo que se ve sale de lo guardado

**Estado:** pedido de Kevin el 2026-10-15. Encontró en producción que, al agregar un tablero y quitarlo, «Revisa y envía» le pedía completar los campos del tablero quitado («Investiga qué otros bugs de este estilo puede haber»). La investigación lo reprodujo en el navegador y encontró la misma familia en campo, oficina y servidor: copias viejas de los datos que sobreviven a lo que las originó, escrituras que llegan tarde y callejones sin salida. Kevin aprobó arreglarlo todo de corrido y sin pedirle confirmación («Termina todas las tandas de corrido»), con un solo despliegue al entorno de pruebas al final. Aceptó las tres decisiones propuestas: croquis de hasta 10 MiB medido en el teléfono, cliente y sitio guardados en el levantamiento, y quitar al enviar las respuestas de tableros que ya no existen. ADR-0045. Construida, verificada y desplegada en el entorno de pruebas el 2026-10-15 (`campo`, `oficina`, `portal` y `worker`; sin migración ni versión nueva de la app de campo). Allí pasaron las dos pruebas del fallo reportado y el worker arrancó con su tarea periódica. El mismo día Kevin pidió cerrar también lo menor que había quedado de las revisiones y fusionar todo a `master` («si dale, una vez termines todo mergeas TODOS los cambios a master»): es la tanda 5, desplegada otra vez en el entorno de pruebas antes del pull request de `corte-0`.

**El fallo reportado:** la pantalla guardaba los errores como una copia. Al tocar «Siguiente» con el tablero nuevo vacío, sus campos entraban a esa copia, y quitar el tablero no los sacaba. «Revisa y envía» mostraba «Faltan 2 datos» con nombres internos (`ubicacion`, `tableros~…`), aunque el envío sí pasaba al confirmar.

**Tanda 1 · Campo: lo que perdía datos o bloqueaba el envío**
- **Volver a un paso mostraba los campos vacíos, y agregar un material borraba los anteriores.** Desde la iteración 22, cada paso monta sus campos al abrirse, pero partían de la copia tomada al abrir el borrador. Ahora parten de lo guardado, también el motivo de «No se pudo obtener» y la unidad de la medida.
- **Lo que llegaba tarde a un tablero quitado lo revivía y bloqueaba el envío para siempre**: el «Deshacer» de una foto o de «No se pudo obtener», o una foto que terminaba de procesarse. Quedaba «Falta 1 dato: `tableros~…`» sin nada que completar, y la única salida era descartar el levantamiento. Ahora el dominio no escribe en una repetición que ya no existe (`editar`), y el repositorio no guarda nada si no hubo cambio. Al enviar, el teléfono quita las respuestas huérfanas que hubiera dejado una versión anterior (`sinRespuestasHuerfanas`), y lo mismo hacen el recorrido y «Mis visitas».
- **Lo que falta sale de la validación vigente**: la pantalla recuerda qué datos ya señaló, no los errores. Un tablero quitado, o una foto devuelta con «Deshacer», dejan de pedirse.
- **La clave de cada campo lleva su sección**: dos pasos seguidos con un campo de la misma clave (el meta-esquema solo exige claves únicas dentro de cada sección) no comparten lo escrito.
- **«Deshacer» de un material** devolvía la lista entera del momento y borraba lo agregado en esos 10 s. Ahora devuelve solo esa línea, en su lugar, sobre la lista vigente, y un segundo toque no la duplica.
- **Un croquis grande se perdía después de enviar.** Con el formato del editor, 100 trazos a mano pesan 0,54 MB: unos 370 pasaban el límite de 2 MB del servidor, el envío quedaba en error y oficina no podía resolverlo. El límite pasa a 10 MiB, el mismo de una foto (`LIMITES_BOCETO.bytes`). El teléfono mide bocetos y firmas antes de enviar y, si alguno se pasa, lo dice en el dato (`archivo_muy_grande`). «Dibujar boceto» espera a que se lea lo guardado, para no abrir una hoja vacía que lo reemplace.
- **Un envío que oficina nunca recibió vuelve a borrador** (ADR-0045): «Volver a borrador para corregir», junto a «Reintentar envío» y «Descartar levantamiento». Antes, un rechazo permanente solo dejaba descartar la visita.
- **El teléfono ya no deja salir lo que el servidor rechazaría para siempre:** los decimales se validan con el largo del protocolo (`LIMITES.decimal`), y los caracteres nulos salen del texto al enviar y al responder en el chat.

**Tanda 2 · Campo: lo que engañaba**
- **Lo enviado de días anteriores guarda dónde fue.** La visita atendida sale del teléfono al día siguiente (ADR-0041), y «Enviados» mostraba «Formato de prueba · N fotos» en todas las filas. Ahora el levantamiento guarda sellados el cliente y el sitio al crearse (`lugar`), o al enviarse si es de antes. Los usan «Enviados», la papelera, el chat y la captura. La cuenta de fotos ya no suma las líneas de materiales.
- **«Ver en Descartados» abre la papelera una vez**: antes se abría sola cada vez que se volvía al inicio.
- **Al abrir la app se borran los archivos que nada usa** (`limpiarArchivosSinUso`): las fotos de un tablero quitado o las que reemplazó «No se pudo obtener». Se hace solo al abrir, para que ningún «Deshacer» pierda su foto.
- **El chat fija su destino** al empezar a escribir: una pregunta que llega mientras tanto no lo cambia, y si oficina retira la elegida vuelve a la última que sigue. Dice qué pasa si no hay pregunta, si el teléfono no pudo guardar la respuesta o si la sesión venció.
- **Mientras el técnico cambia la contraseña temporal**, el 403 del servidor ya no hace perder terminaciones de visita ni marca las respuestas del chat como rechazadas: esperan como un error pasajero.
- **La espera de verificación de archivos crece**: con el worker caído, el teléfono ya no consulta cada 5 s sin fin.
- **Un borrador descartado no retiene en el teléfono una visita que el servidor ya cerró.**
- **Menores:** una foto que falla en un lote no detiene las demás, y el aviso dice cuántas faltan. Si la captura no se puede cargar, se dice y el siguiente toque la intenta de nuevo. Un borrador bloqueado dice «Ver lo capturado», no «Ver lo que enviaste».
- **Dominio:** un mínimo de fotos exige que el campo sea obligatorio. Sin eso, el envío quedaba bloqueado y no se podía marcar «No se pudo obtener».

**Tanda 3 · Oficina**
- **Un documento ya no se escribe encima de otro.** Las rutas del informe, la cotización y el cliente no se volvían a montar al cambiar de id (⌘K, Recientes, Atrás). La pantalla del segundo mostraba el borrador del primero, y el guardado automático podía escribirlo encima. Ahora llevan `key={id}`, como el levantamiento.
- **Una visita con su técnico desactivado se puede reasignar.** Antes el desactivado no tenía casilla para quitarlo y el servidor rechazaba la lista. Ahora sale al guardar («Se desactivó a X: sale de la visita»), y la lista de Visitas lo dice en la fila, con la insignia «Sin técnico» si no queda nadie activo. Reprogramar tampoco lo cuenta como ocupado (servidor).
- **Lo que se está escribiendo no se pierde:**
  - si falla una relectura, la revisión y el cliente ya no se reemplazan por «No se pudo cargar»: el error solo se ve si nunca hubo datos;
  - el comentario o la respuesta a medias sobrevive al cambiar de pestaña, ocultar el panel o abrir otro globo;
  - «Marcar revisado» dice qué se pierde, como una corrección sin guardar o comentarios sin enviar;
  - con un conflicto de guardado, lo escrito después también se copia en el equipo.
- **La autorización de WhatsApp queda atada al número**: con otro celular se desmarca y hay que confirmarla de nuevo.
- **Cada «Deshacer» se hace una sola vez** (`Notificaciones`): un doble clic duplicaba una línea de la cotización. El de las cantidades en la revisión devuelve solo su línea sobre las de ahora.
- **Los diálogos de visita adoptan la versión vigente después de un conflicto**: el reintento ya no choca otra vez. Mientras no hay conflicto siguen con su copia, para no pisar en silencio lo que cambió otra persona.
- **Mensajes que dicen lo que pasó.** Un `estado_invalido` muestra la explicación del servidor, por ejemplo una visita cancelada sin informe o un cliente archivado mientras se programaba. En la lista de visitas, «Abrir el informe» dice por qué no abrió. Un cliente archivado no tiene contactos marcados por omisión al publicar, y la confirmación dice cómo enviarlo después.
- **Errores que sobreviven a su causa:** los errores por campo se van al corregir el campo (Visitas, Cliente, Clientes, Catálogo, Administración, Mi cuenta y la contraseña obligatoria). El error de publicar ya no queda en la cotización después de cancelar. «Con correcciones» compara la sección exacta. Si quien revisaba se desactivó, se dice y se ofrece tomar la revisión.
- **Menores:** marcar «No se pudo obtener» vuelve a dejar guardar la corrección, y desmarcarlo conserva lo que muestra el campo. El avance de una versión retirada dice «Retirada del portal». La lista de técnicos se vuelve a leer tras cada acción de Administración. Al abrir «Reasignar», ya no se quita en silencio a quien tenía la visita.

**Tanda 4 · Servidor**
- **Corregir un sitio o un cliente llega a los teléfonos**: sus visitas por hacer vuelven a bajar con la dirección o el nombre nuevo. Antes el técnico seguía viendo la dirección vieja. El portal también toma el nombre corregido.
- **Desactivar otra vez a quien se reactivó vuelve a ordenar el borrado de sus teléfonos.** Antes, la orden ya cumplida impedía una nueva y sus datos de clientes se quedaban en el teléfono (QA-5).
- **Una foto o un boceto que ya está guardado y perdió su fila** (después de restaurar la base o de dejar limpio un entorno) se adopta si pasa el mismo examen del worker: huella, tamaño y tipo por contenido. Antes se rechazaba para siempre y el envío quedaba atascado. Un PDF nunca se adopta: no se distingue de un documento generado (regla 7).
- **Lo que no llegó a un contacto que ya no recibe por ese canal** no queda como «envío sin entregar» para siempre.
- **El rechazo por técnico inactivo dice quién es**, sin nombrar a nadie de otra organización.
- **Carreras con oficina:**
  - cerrar visitas vuelve a mirar la fecha y la cancelación en la fila, así que una visita reprogramada no queda cerrada;
  - programar en un cliente que se archiva espera al archivo (`FOR SHARE` sobre el cliente);
  - programar y reprogramar el mismo día a la vez ya no se traban: los dos toman el día primero.

**Tanda 5 · Lo que quedaba de las revisiones**
- **Lo reciente de la búsqueda (⌘K / Ctrl + K) se ve como está ahora**: con el nombre que corrigió otra persona y el estado de hoy de cada levantamiento. Antes mostraba lo de cuando se abrió, y una visita reciente se buscaba en Visitas con el nombre viejo del cliente, sin encontrarla.
- **«Ver en Canceladas», «Ver en Activos» y «Programar otra» funcionan también después de salir de la pantalla.** Antes no hacían nada, aunque el aviso siguiera a la vista. Si ya se está en la lista, no agregan otra entrada al historial (`useIrConPedido`).
- **Lo que pide la búsqueda o un aviso se atiende una vez** (`usePedido`): «Programar visita», «Nuevo cliente» y «Nueva cotización» ya no se vuelven a abrir al regresar con Atrás ni al recargar la página.
- **Lo escrito mientras se envía un comentario o una respuesta ya no se borra al llegar.** El campo se vaciaba cuando terminaba de releerse la bandeja, después de que el comentario ya se veía; con ↵ para enviar, el siguiente mensaje desaparecía. Ahora se vacía solo si sigue diciendo lo enviado (`vaciarSiSigue`). Lo encontró una falla de WebKit en la prueba de la revisión.
- **Un borrador bloqueado con la sesión vencida ofrece «Iniciar sesión»** ahí mismo y, al entrar, vuelve a editarse. Antes decía «conéctate para seguir», y conectarse no bastaba.
- **Servidor:**
  - un archivo guardado sin fila que no coincide con lo declarado ya no se describe como «documento generado»: se dice que no coincide y que no se reemplaza;
  - la auditoría de una segunda desactivación cuenta todos los teléfonos que van a borrar, también el que seguía con su orden sin cumplir.
- **Pruebas que faltaban:** pasar de un informe a otro sin recargar (`key={id}`), además de una por cada arreglo de esta tanda. La del informe abre primero el segundo: si no estaba leído, el esqueleto de carga volvía a montar la pantalla y ocultaba el fallo. La del informe, la del comentario y la del formulario que parte de Clientes se corrieron también sin su arreglo, y fallaron. El doble toque en «Deshacer» ya lo cubría `copias-viejas.spec.ts`.
- **Un verificador de solo lectura revisó la tanda** y encontró una regresión: el enrutador cambia la ubicación al empezar a cargar, con la pantalla anterior todavía montada. Así, desde Clientes o Cotizaciones, «Programar visita» llegaba a Visitas sin abrir el formulario, porque la pantalla que se dejaba borraba el pedido. Se corrigió antes del despliegue, con una prueba que parte de Clientes.

**Decisiones tomadas al construirla**
- **Lo que se muestra se deriva de los datos; no se copia.** La pantalla recuerda qué datos ya señaló, no los errores, y cada paso parte de lo guardado. Se descartó limpiar la copia en cada lugar que cambia algo, porque siempre aparece un lugar nuevo.
- **El guardia va en el dominio (`editar`)**, el único punto por donde pasa toda escritura de respuestas. Un «Deshacer» o una foto que llegue tarde en el futuro tampoco revive un tablero.
- **El servidor sigue estricto.** El teléfono limpia antes de enviar y, si aun así el servidor rechaza para siempre, el levantamiento vuelve a borrador (ADR-0045).
- **10 MiB para el croquis**, el mismo límite de una foto, sin cambiar su formato. Se descartó no guardar el contorno de cada trazo: pesaría la tercera parte, pero cambia el formato del boceto y el PDF, y necesitaría un ADR.
- **El cliente y el sitio van en el levantamiento, sellados**, en vez de conservar la visita atendida en el teléfono: no cambia el ADR-0041 ni la agenda.
- **Los archivos sin uso se borran solo al abrir la app**: durante la sesión, un «Deshacer» puede devolverlos.
- **«Deshacer» después de enviar no hace nada**, porque el levantamiento ya no se edita. Se deja así: no se pierde nada de lo enviado.
- **Al reprogramar, solo cuentan los técnicos activos.** Un desactivado ya no hará ninguna de sus visitas.
- **Lo que pide una navegación se borra de su entrada del historial al atenderlo** (`usePedido`, con `navigate` en `replace`), y se lee de la ubicación ya resuelta (`resolvedLocation`), no de la que se está cargando. Se descartó recordar en memoria qué entradas ya se atendieron: al recargar la página se perdería y el formulario volvería a abrirse. También se descartó guardar el pedido fuera del historial: una navegación bloqueada (salida protegida) lo dejaría pendiente para la próxima vez.
- **Los avisos con un siguiente paso navegan** («Ver en Canceladas», «Ver en Activos»), como ya hacía «Ver en Archivados». Así funcionan desde cualquier pantalla, y si la lista está abierta, se cambia de pestaña en ella.
- **La integración continua corre la prueba de extremo a extremo en un trabajo por navegador**, en paralelo y con hasta 60 minutos cada uno. La suite pasó de 39 a 78 pruebas desde el pull request #1, que ya tardaba 26 de los 30 minutos permitidos con los dos navegadores juntos. Cada pull request sigue corriendo Chromium y WebKit.
- **`paquetes/ui` sigue sin pruebas de componentes.** Su lógica la cubren las pruebas de extremo a extremo. Montarlas requiere jsdom y Testing Library, y eso es otra decisión.
- **Repartida en tres frentes:** campo, dominio y protocolo los construyó la sesión principal. Oficina y servidor los construyeron dos agentes, cada uno en su worktree, con commits propios. Después se integraron y se verificó todo junto.
- **Tres verificadores independientes** (campo, oficina, servidor), de solo lectura, revisaron lo construido. No encontraron regresiones graves. Sí encontraron fallos de la misma familia, y se corrigieron:
  - **campo:**
    - en un campo de materiales obligatorio, «Deshacer» de «No se pudo obtener» montaba el editor vacío y el siguiente cambio borraba lo devuelto;
    - volver a borrador podía dejar dos borradores en una visita (ahora lo dice: `VisitaConOtroBorrador`);
    - la hoja de «Siguiente» se quedaba con su lista (ahora sale de la validación y se cierra sola);
    - un error de croquis de un tablero quitado se quedaba atascado;
    - una sección repetible entera se nombraba por su clave;
    - el «Deshacer» de materiales podía escribir sobre un editor que ya se había cerrado (ahora se retira al salir del paso, `useRetirarNotificacion`);
    - reemplazar un boceto borraba el documento que otro campo del mismo levantamiento usaba.
  - **oficina:**
    - los «Deshacer» de líneas se ofrecían con su editor ya cerrado;
    - Esc, el menú, Atrás o recargar perdían lo escrito en la revisión (ahora se conserva en la pestaña, Esc no sale con una corrección abierta y recargar pregunta);
    - con algo que se pierde, «Marcar revisado» se confirmaba con ↵;
    - apagar WhatsApp borraba la autorización registrada;
    - si fallaba la ocupación, no se veían técnicos;
    - el candado de «Deshacer» de un comentario podía quedar pegado;
    - el comentario sobre un dato admitía 2.000 caracteres y el servidor recibe 1.000.
  - **servidor:**
    - reprogramar pedía una segunda conexión del pool dentro de su transacción, y quince a la vez respondían 500;
    - lo archivado se podía reprogramar;
    - una visita atendida que se reprogramaba para volver no contaba como por hacer;
    - quitar un contacto avisaba como un envío fallido;
    - corregir el nombre de un cliente no lo tomaba.

**Evidencia:**
- **Antes del arreglo**, cada fallo de campo se reprodujo con una prueba de navegador sobre la compilación de producción local, cada uno con su captura de pantalla: el tablero quitado que se pedía, los tres caminos que bloqueaban el envío para siempre, la foto devuelta con su aviso y el paso que volvía vacío y borraba materiales. Esas pruebas pasaron a `e2e/pruebas/copias-viejas.spec.ts`. Las tres fallas del servidor que encontró su verificador también se reprodujeron antes del arreglo; la del pool lo hizo con quince reprogramaciones a la vez.
- **Verificaciones:** `pnpm typecheck` (8 paquetes), `arquitectura` (372 módulos), `licencias` (325 paquetes), `audit` sin vulnerabilidades y `presupuesto` (134,6 KB de 135).
- **Pruebas:** dominio 121, documentos 11, protocolo 29, oficina 62, campo 143 y servidor 245.
- **Extremo a extremo** en Chromium y WebKit: 143 pasan, 3 omitidas y ninguna falla (27,6 min). Incluye `copias-viejas.spec.ts` (8 pruebas) y `robustez-oficina.spec.ts` (4).
- **Tanda 5:**
  - `arquitectura` con 373 módulos y las mismas pruebas unitarias; las del servidor suman aserciones en `cuenta.test.ts` y `api.test.ts`;
  - extremo a extremo en Chromium y WebKit: 153 pasan, 3 omitidas y ninguna falla (37,1 min), con `robustez-oficina.spec.ts` en 8 pruebas;
  - en el entorno de pruebas, después del despliegue, pasaron la del formulario que parte de Clientes, «Ver en Canceladas» y el borrador bloqueado con la sesión vencida;
  - `avisos.test.ts` («410 borra la suscripción…») falló una vez con los 22 archivos en paralelo, y pasó sola y en la corrida siguiente: es intermitente desde antes y no depende de esta tanda.

## Iteración 41 · Nada queda a medias ni crece sin fin

**Estado:** pedido de Kevin el 2026-10-06, después del fallo de la 40 («Que otro fallo de ese estilo puede haber? revisa»). Una revisión encontró fallos de la misma familia: estados que nadie actualiza, trabajo que se atasca para siempre y datos que nunca se borran. Kevin aprobó arreglarlos en cuatro tandas y desplegar una sola vez al final («despliega cuando ya termines todas las mejoras, con eso nos ahorramos algo de costos»). Aceptó 30 días de retención en el teléfono. Construida, verificada y desplegada en el entorno de pruebas el 2026-10-06 (ADR-0043 y ADR-0044, migración `0038`; `campo` primero, después `worker` y `oficina`). El worker desplegado arrancó con la tarea periódica registrada.

**Tanda 1 · Trabajo atascado para siempre**
- **Lo que espera la app nueva sale al actualizar.** Un envío en «requiere actualizar» no se reanudaba nunca y la pantalla decía «Enviando a oficina…» para siempre. Ahora, al abrir una versión nueva de la app, vuelve a la cola (`reanudarTrasActualizar`).
- **Una foto que el almacenamiento rechaza** ya no se reintenta cada 30 segundos sin fin: espera cada vez más y, al agotar los intentos, pasa a error con un mensaje para el técnico.
- **Un envío rechazado se puede descartar** desde su pantalla, a la papelera de 30 días (ADR-0035). Antes no tenía salida e inflaba para siempre lo «por enviar».
- **Los trabajos del worker que quedaron a medias se recuperan** (ADR-0043): una tarea cada hora (`mantenimiento.recuperar`, la primera periódica del proyecto) vuelve a encolar, con la misma llave, lo que lleva más de 12 horas a medias: PDF «generando», envíos «en cola» y archivos «subidos» sin verificar.

**Tanda 2 · Lo que crecía sin fin** (ADR-0044)
- **En el teléfono:** un levantamiento revisado que oficina recibió hace más de 30 días sale después de cada bajada, con sus fotos, su envío, su estado y su chat. Nunca sale lo que no se ha enviado ni revisado (regla 5).
- **En el servidor:** la tarea periódica borra las sesiones vencidas y compacta el registro de cambios (deja el último cambio de cada entidad por destinatario). La lista de teléfonos de Administración muestra los que tuvieron contacto en los últimos 90 días y los que tienen un borrado pendiente. Los teléfonos no se borran: la orden de borrado de un usuario revocado tiene que poder llegar.

**Tanda 3 · Estado que no se actualizaba**
- **Una visita ya atendida hoy no bloquea archivar el cliente** («primero cancele o reprograme»): «por hacer» excluye las terminadas, las cerradas y las que tienen levantamientos.
- **Campo y oficina se enteran del paso del tiempo** con la app abierta (`useMinuto` en `paquetes/ui`): cada minuto y al volver a la app, una visita pasa a «En curso», aparece «Terminar visita» y, después de medianoche, «Hoy» cambia.
- **«Terminar visita» también está en la fila** de una visita en curso, no solo en la tarjeta principal.
- **Una visita cancelada o reasignada con un borrador a medias** ya no sale como «Siguiente visita» encima de la de hoy: va con las atrasadas.
- **Al desactivar a quien revisa**, lo que tenía en revisión queda sin tomar (`revision_liberada` en el historial). Otra persona lo toma sin reasignar, y las respuestas del técnico le llegan a quien escribió el comentario, no a alguien sin acceso.
- **«Tomar el más antiguo» desde la búsqueda (⌘K)** avisa si otra persona lo tomó primero, en lugar de llevarlo como si fuera suyo.

**Tanda 4 · Menores**
- Un informe con todas sus versiones retiradas dice «Retirado del portal» en la lista de Informes, no «Borrador» (`todasRetiradas`, como en Cotizaciones).
- «Enviar a otro contacto» ofrece el canal por el que el contacto todavía no la recibió (correo o WhatsApp), y manda el canal explícito.
- En Administración, un teléfono con orden de borrado ya no dice «Llame al técnico»; uno ya borrado no muestra lo que tenía pendiente ni su último error.
- Una visita cancelada no aparece en «Visitas para cotizar», y no abre un informe nuevo (`estado_invalido`); el que ya tenía se sigue consultando.
- Mientras el PDF de la vigente se genera, o si falló, oficina dice qué versión ve el cliente («Mientras, el cliente ve la versión 2»).
- La franja de campo ya no cuenta como «subiendo» un envío con error permanente; la pregunta al cerrar sesión sí lo cuenta, porque sigue sin enviar.

**Decisiones tomadas al construirla**
- **Una tarea por hora y no una por organización al bajar:** recuperar trabajos no depende de que un técnico pregunte (ADR-0043). La ventana de 12 horas deja terminar los 10 reintentos de Graphile antes de volver a encolar.
- **Compactar el registro en vez de cortarlo por fecha:** cortar por fecha haría que un teléfono nuevo no bajara una visita vigente programada hace meses (ADR-0044).
- **La tarea periódica se declara como objeto** (`periodicas()` en `servidor/src/tareas.ts`, con `parsedCronItems`). La primera versión usaba el crontab de texto, que no acepta el punto de `mantenimiento.recuperar`: el worker no arrancaba. Las pruebas del servidor no lo vieron porque procesan la cola sin el crontab; lo encontró la e2e, que se quedó en «El servidor está verificando las fotos». Nunca llegó al entorno de pruebas.
- **Fallas intermitentes de WebKit en la e2e:** venían de `conversaciones.spec.ts` (iteración 39), que dejaba abierto su contexto de oficina. La página seguía consultando y redibujando el resto de la corrida, y en WebKit cada clic de campo tardaba hasta 30 s. Fallaba una prueba distinta en cada corrida, y sola pasaba. Ahora los contextos se cierran en un `afterEach`, también si la prueba falla.
- **Desactivar llama a `levantamientos` desde la composición** (`crearIdentidad(…, { alDesactivar })` en `app.ts` y en el comando `desactivar-usuario`), en la misma transacción: identidad no conoce las tablas de otro módulo.
- **Sin cambio, después de revisarlos:**
  - en una visita con dos técnicos, el segundo teléfono la sigue mostrando hasta que alguno la termine, porque puede necesitar su propio levantamiento; «Terminar visita» ya les llega a todos;
  - una visita de todo el día ocupa al técnico todo el día aunque la terminen temprano: así lo decidió el ADR-0037, que lo deja como consecuencia aceptada.

**Evidencia:** `pnpm typecheck`, `arquitectura` (366 módulos), `licencias` (325 paquetes), `audit` sin vulnerabilidades y `presupuesto` (133,6 KB de 135). Pruebas: dominio 116, protocolo 29, documentos 11, oficina 34, campo 128 (agenda con cancelada y borrador, reanudar al actualizar, foto rechazada, descartar el rechazado, retención de 30 días) y servidor 231. Las del servidor cubren la recuperación de trabajos a medias, la poda y compactación, la tarea periódica, «por hacer» sin lo atendido, desactivar a quien revisa, informe retirado, visita cancelada sin informe nuevo ni cotización. Extremo a extremo en Chromium y WebKit: 119 pasan, 3 omitidas y ninguna falla (24,7 min).

## Iteración 40 · Lo atendido no es la siguiente visita

**Estado:** pedido de Kevin el 2026-10-06 («soluciona todo el flujo completo, empieza»). Construida, verificada y desplegada en el entorno de pruebas el 2026-10-06 (ADR-0041, migración `0037`, app de campo 15).

**El fallo:** una visita terminada, con su levantamiento enviado y revisado, seguía en el teléfono como «Siguiente visita» con «Iniciar levantamiento». Tenía dos causas:
- en el teléfono, el orden de «Mis visitas» nunca sacaba una visita, solo la bajaba al final, y sin otra pendiente la atendida volvía a ser la primera;
- en el servidor, una visita solo salía del teléfono si la reasignaban o la cancelaban.

Además, una visita terminada sin nada enviado quedaba como «atrasada» por encima de las futuras, y lo atendido se acumulaba en el teléfono sin límite.

**Parte A, en el teléfono** (`campo/src/visitas.ts`, `agendaDeVisitas`):
- una visita atendida (algo enviado o terminada, sin borrador a medias) no es pendiente;
- «Siguiente visita» es la primera pendiente, y sin pendientes se ve «No tienes visitas pendientes»;
- lo atendido hoy va en «Atendidas hoy», al final, con «Iniciar levantamiento» para otro formato;
- lo atendido de días anteriores no se muestra, y su levantamiento sigue en «Enviados»;
- «Ver la siguiente visita» después de enviar usa la misma agenda.

**Parte B, en el servidor** (ADR-0041):
- antes de armar la bajada de un técnico, el servidor cierra sus visitas de días anteriores que están terminadas o tienen algún levantamiento recibido (`visitas.cerrada_en`);
- les manda `fuera_de_alcance` con motivo `atendida`, solo a la app 15 o posterior, y una visita cerrada no vuelve a bajar;
- el teléfono la quita sin aviso, salvo que tenga un borrador o un envío por salir (regla 5).

**Decisiones tomadas al construirla**
- **Se cierra al bajar, sin tarea programada:** el worker no tiene ninguna, y una por organización con su aislamiento por fila sería más pesada.
- **Lo de hoy no se cierra**, por si hace falta otro levantamiento. Lo atrasado sin atender tampoco: oficina lo reprograma o lo cancela.
- **A la app 14 no se le manda el motivo `atendida`:** su contrato lo rechazaría junto con toda la bajada. Ya no muestra lo atendido gracias a la parte A, y al actualizarse baja todo de nuevo sin las visitas cerradas.

**Evidencia:** `visitas.test.ts` (7 casos de la agenda: el de Kevin, sin pendientes, atendida de otro día, terminada sin enviar, borrador, orden); `bajada.test.ts` (cierra lo atendido de días anteriores, no lo de hoy ni lo atrasado, la app 14 no recibe el motivo, una cerrada no vuelve a bajar y se cierra una sola vez); `motor.test.ts` (sale sin aviso, se queda con borrador o envío por salir); `envio.spec.ts` (tras enviar la única visita no hay «Siguiente visita» y sí «Atendidas hoy»); envío, bajada, programación, conversaciones y revisión de extremo a extremo en Chromium y WebKit; `pnpm typecheck`, `arquitectura` y `presupuesto` (133,4 KB).

## Iteraciones 38 y 39 · La revisión al lado y las conversaciones con campo

**Estado:** las dos aprobadas por Kevin. La 38 quedó construida, verificada y desplegada en el entorno de pruebas el 2026-10-06 (falta que Kevin la pruebe); la 39, construida, verificada y desplegada en el entorno de pruebas el 2026-10-06 (ADR-0040, migración `0036`, app de campo 14, Dexie 7; `campo` primero, después `worker` y `oficina`). La 39 usa el panel de la 38.

### Iteración 38 · La revisión armada como el informe

Prototipo aprobado ("Me gusta", 2026-10-04): `prototipos/revision-al-lado/prototipo.html` (https://claude.ai/artifact/72t1ukfkYFAvcoT6uBNjaW). Hay que igualarlo. Solo `oficina/src/pantallas/Detalle.tsx` y `pantallas/Lienzo.tsx`; sin servidor ni migración.

- **Distribución:** los datos a la izquierda. A la derecha va un panel a todo el alto con las pestañas «En el informe», «Comentarios» e «Historial».
  - Se arma con `EditorConVista`, `useVistaPrevia` y `BotonMostrarVista` de `Lienzo.tsx`, así que trae divisor, «Ampliar» (solo la hoja, a tamaño real) y «Ocultar».
  - `useVistaPrevia(nombre)` recibe un nombre (`"revision"`). Así el ancho y el «oculto» de la revisión se recuerdan aparte de los del informe.
  - También se recuerda la pestaña. La primera vez abre en «En el informe».
- **El estado va en la barra superior, junto a la acción**, como «Guardado»:
  - «● En revisión · la tomó usted» con «Marcar revisado»;
  - «● Revisado · por usted, 8:41 p. m.» con «Abrir el informe».
  - Salen la frase «Corrija lo que haga falta…» y las tarjetas `grupo-c` con borde.
- **El capítulo** (`CapituloEnVivo`) toma el ancho del panel, no la caja de 520 px. El diálogo «Ver en grande» desaparece porque «Ampliar» lo reemplaza. La nota «Lo azul es lo corregido y no sale en el PDF» va sobre la hoja. Comentarios e historial son listas dentro del panel hundido, sin tarjetas.
- **«Siguiente»** (revisar en serie) va encima de los datos cuando el levantamiento ya está revisado.
- **Por debajo de 1280 px**, un botón en la barra abre el panel en hoja lateral, como la vista previa del informe.
- **Siguen funcionando** los atajos T, R, S y Esc, y `CorreccionEnCurso` (el resaltado en vivo mientras se corrige).
- **Verificación:**
  - `revision.spec.ts` y `usabilidad.spec.ts` en Chromium y WebKit;
  - capturas comparadas con el prototipo;
  - `pnpm typecheck`, `pnpm arquitectura` y `pnpm test`;
  - despliegue de `oficina` en el entorno de pruebas.
- **Al terminarla**, se hace commit junto con `prototipos/revision-al-lado/` y la línea de `prototipos/README.md`, que siguen sin commit.

**Decisiones tomadas al construirla (2026-10-06)**
- El panel es un `Lienzo` con la propiedad `panel` (etiqueta, «Ampliar» solo en «En el informe», otra cabecera al ampliar y «Volver a la revisión»), dentro del mismo `EditorConVista` del informe; no se hizo un componente aparte.
- La pestaña se guarda en una preferencia nueva (`revision-pestana`) para que la primera vez abra en «En el informe»; la del carril anterior abría en «Comentarios».
- «Revisado · por usted, 8:41 p. m.»: la hora sale del último evento `levantamiento_revisado` del historial; el servidor no la entrega aparte. Si no fue hoy, lleva el día.
- La acción de revisado dice «Abrir el informe» (antes «Abrir el informe de la visita»), como el prototipo.
- Salen el aviso «N datos corregidos» y el chulo animado del carril: el prototipo no los tiene y la barra de secciones ya marca lo corregido.
- Con la hoja ampliada, ninguna tecla suelta actúa (Esc solo la reduce): `atajos.ts` cuenta un `role="dialog"` modal como diálogo abierto.
- Comentarios e historial conservan sus listas de hoy dentro del panel, sin tarjetas; la 39 rehace los comentarios como hilos.

**Evidencia:** `revision.spec.ts` y `usabilidad.spec.ts` en Chromium y WebKit (14 pasan); capturas a 1440 px en claro y oscuro (en el informe, comentarios, historial, ampliado, oculto, revisado con «Siguiente») y a 1100 px con la hoja lateral, comparadas con el prototipo; `pnpm typecheck`, `pnpm arquitectura` y `pnpm test`.

### Iteración 39 · Conversaciones entre oficina y campo

Pedido de Kevin el 2026-10-04: «una especie de chat» para que el técnico responda los comentarios de oficina desde el teléfono cuando tenga señal. El prototipo se aprobó en su versión 4, el 2026-10-05 («Si, aprobado»): `prototipos/hilos/prototipo.html` (https://claude.ai/artifact/BnYMDTcuo8gBST3dtSwBoi). Hay que igualarlo; sus casos «Oficina · revisión», «Oficina · bandeja», «Campo» y «Los dos a la vez» son la referencia visual.

**Decisiones aprobadas**

1. Solo oficina abre conversaciones: cada comentario de oficina es el comienzo de una. El técnico responde, y oficina puede seguir respondiendo en la misma.
2. La conversación se cierra al marcar revisado: las dos partes la siguen viendo, pero ya no se responde.
3. Solo texto, por ahora.
4. **El punto de «sin leer».** Se apaga al abrir la conversación.
   - En oficina: en la fila de la bandeja (con «María Gómez respondió · hora» debajo del cliente), en la pestaña «Comentarios» (o en el botón que muestra el panel, si está oculto) y la línea «Nuevo» dentro del hilo.
   - En campo: en la fila de «Enviados» («Oficina te escribió»), el número de sin leer en la fila del chat y la franja «N mensajes sin leer» dentro del chat.
5. **Para quién es el punto en oficina:** para quien revisa el levantamiento; si nadie lo ha tomado, para quien escribió el comentario (la misma regla de `envio_fallido`). Lo leído se guarda en el servidor por persona; en campo, en el teléfono.
6. **Avisos push en los dos sentidos:** al técnico, «Oficina · Hotel Plaza Real» con el texto; a oficina, «María Gómez respondió». Con la conversación abierta no hay aviso: cada lado consulta cada 15 s. No hay SSE por ahora; el ADR-0014 lo permite después.
7. **Lo que envía el técnico:**
   - se manda solo cuando hay señal;
   - no se corrige ni se borra;
   - si llega cuando ya está revisado, el servidor lo rechaza y el teléfono dice «No se envió: oficina ya lo había marcado revisado. Si es importante, llama a oficina.», y el mensaje queda en el teléfono.
8. Hasta 1000 caracteres por mensaje, en los dos lados.
9. **En campo, un solo chat con oficina por levantamiento**, como WhatsApp. En oficina, un hilo por dato.
10. **El técnico ve «Leído»** bajo su último mensaje cuando oficina lo leyó; si no, «Enviado».

**Cómo se ve en campo** (`campo/src/pantallas/Captura.tsx`, la vista de un levantamiento enviado; referencias: iMessage/Luma, WhatsApp, LinkedIn, corner)
- **«Enviados»** (`Inicio.tsx`, `Fila`):
  - con algo sin leer, una tercera línea «Oficina te escribió» en el color de la marca y un punto azul junto a la hora;
  - con mensajes en cola, «N respuestas por enviar», con reloj y en color de alerta.
- **El levantamiento enviado:** «Comentarios de oficina» pasa a ser una fila de chat con un icono de edificio, «Oficina», el último mensaje («Tú: …» si es propio), la hora (en azul si hay sin leer) y una insignia con el número. Al tocarla se abre el chat. Sin señal y con mensajes en cola, un aviso: «Sin señal · Tu mensaje está guardado en el teléfono y se envía solo cuando vuelva».
- **El chat** es una pantalla completa:
  - **Encabezado:** «‹» a la izquierda y, centrados, «Oficina» y «Hotel Plaza Real · Torre A». Sin señal, en lugar del sitio dice «Esperando señal…» en color de alerta.
  - **Primera línea**, centrada y gris: «Oficina revisa lo que enviaste y te pregunta aquí. Toca un mensaje para responderlo.»
  - **La hora va centrada entre grupos** («Hoy 8:26 p. m.»): solo al principio y cuando pasan 10 minutos o más. Nunca va una hora ni un nombre en cada mensaje.
  - **Franja «N mensajes sin leer»** en el color de la marca, con líneas a los lados.
  - **Globos:**
    - oficina a la izquierda (`--t-superficie-pista`); el técnico a la derecha (color de la marca);
    - los seguidos del mismo lado van pegados (2 px y esquinas de 6 px del lado que se unen);
    - en cola, el globo va más claro; rechazado, con borde de peligro.
  - **De qué se habla:** el primer mensaje de oficina sobre un dato lleva adentro un recuadro con borde de la marca a la izquierda: «Tu respuesta · Llegada» / **«¿Quién te recibe?»** / lo que respondió («No la respondiste», en cursiva, si está vacío; «12 kVA»). Al tocar el recuadro se abre ese dato en «Ver lo que enviaste»; al tocar el globo, se elige esa pregunta para responder. Nunca pin ni tarjeta suelta: Kevin vio que se leía como una ubicación.
  - **Cita:** cuando un mensaje del técnico cambia de tema respecto al anterior, lleva una cita de la pregunta de oficina («Oficina» y el texto en una línea), como en WhatsApp.
  - **Estado solo bajo el último mensaje propio:** «Enviado», «Leído», «Enviando…», «Se envía cuando haya señal» (con reloj, en alerta) o el texto del rechazo.
  - **Para escribir:**
    - siempre visible, «Respondiendo a Oficina» con la pregunta en una línea; por omisión, la última pregunta de oficina, y cambia (con un destello) al tocar otro mensaje;
    - debajo, un campo redondeado «Mensaje» con el botón de enviar redondo adentro (gris si está vacío);
    - revisado: la barra cambia por «🔒 La conversación quedó cerrada / Oficina marcó revisado el levantamiento».
- **Aviso push:** «TEINS · Oficina · Hotel Plaza Real» y el texto; al tocarlo abre el chat.

**Cómo se ve en oficina** (referencias: un hilo de Slack, Reddit, Dropbox Dash)
- **Pestaña «Comentarios»** del panel de la 38:
  - arriba, «Lo que escriba aquí le llega a María Gómez en su teléfono.» (revisado: «Cerradas al marcar revisado.»);
  - una conversación por dato, separadas por una línea fina y sin recuadros.
- **Cada conversación:**
  - empieza con el dato tal como quedó: un recuadro con «Llegada» en pequeño, y «¿Quién te recibe?» con «Sin dato» (o «Potencia nominal» con «12 kVA») a la derecha; al tocarlo, se va a esa fila de los datos y la resalta;
  - debajo, como en Slack: avatar de 26 px (OP neutro, MG en el color de la marca), nombre y hora **una vez por grupo** y el texto plano, **sin globos**;
  - entre el comentario y las respuestas, el separador «N respuestas»; antes de lo nuevo, la línea «Nuevo» en el color de la marca;
  - al final, un campo compacto «Responder…» con un botón de flecha adentro (activo solo con texto); ↵ envía y ⇧↵ hace otra línea; revisado: «🔒 Cerrada al marcar revisado. María Gómez la sigue viendo.»
- **Bajo cada dato comentado**, a la izquierda: el comentario, la última respuesta («María Gómez: …», con el punto si no está leída) y «N respuestas · Ver la conversación», que abre la pestaña en ese hilo.
- **El punto:** en la pestaña «Comentarios» o en el botón que muestra el panel.
- **La bandeja:** punto azul antes del cliente y «María Gómez respondió · 8:44 p. m.» en el color de la marca, debajo.
- **«Historial»:** «María Gómez respondió sobre ¿Quién te recibe?» (evento `comentario_respondido`).
- **El diálogo «Marcar revisado»** añade: «Las conversaciones se cierran: María Gómez las sigue viendo en su teléfono, pero ya no responde.»
- **Aviso del navegador:** «María Gómez respondió · Hotel Plaza Real · sobre ¿Quién te recibe?»; al tocarlo abre la pestaña en ese hilo.

**Cómo se construye** (contrato primero, `docs/proceso/forma-de-trabajo.md`)
1. **ADR-0040** (plantilla `docs/adr/0000-plantilla.md`):
   - amplía el ADR-0003 (la subida lleva respuestas), el 0014 (consulta cada 15 s con la conversación abierta) y el 0023 (avisos a oficina);
   - en el modelo de dominio (`02-modelo-dominio.md`), Comentario pasa a «lo abre oficina; el técnico responde»;
   - nunca se editan los ADR anteriores; se agrega la fila al índice `docs/adr/README.md`.
2. **Servidor y protocolo**, con las pruebas escritas antes:
   - **Migración `0036`, solo aditiva:**
     - en `levantamientos.comentarios`, las columnas anulables `en_respuesta_a` (al comentario raíz), `de` (`oficina` o `tecnico`, por omisión `oficina`) y el autor del técnico;
     - una tabla de lo leído por persona: usuario, levantamiento y hasta cuándo;
     - permisos por columna como hoy, porque `plataforma.test.ts` comprueba que no hay UPDATE a nivel de tabla.
   - **Operación del técnico `responderComentario`**, como `terminarVisita`:
     - lleva un uuid del cliente como llave de idempotencia (regla 4) y `politicas.tecnico`;
     - comprueba el `tecnicoId` del levantamiento, que el comentario raíz no esté retirado, que no esté revisado (si lo está, responde un error que el teléfono traduce) y el límite de 1000;
     - registra el evento de auditoría `comentario_respondido`;
     - manda el aviso a quien revisa o, si nadie lo ha tomado, a quien escribió el comentario.
   - **Oficina responde en el hilo** con la operación de comentar de hoy más `en_respuesta_a`. Nueva operación `marcarConversacionLeida`.
   - **La consulta de la bandeja y del detalle** trae, por levantamiento, si hay respuesta sin leer y la hora de la última.
   - **Bajada:** las respuestas van anidadas en `ComentarioParaTecnico.respuestas`, como campo opcional, para que la app 13 las ignore. Cada mensaje del técnico lleva si oficina ya lo leyó, para mostrar «Leído».
3. **Campo**, app 14:
   - Dexie versión 7 con la tabla `respuestasPendientes`, sellada (ADR-0022); nunca se borra nada local (regla 5);
   - reintentos con espera creciente, como `terminacionPendiente`; tiene que sobrevivir a `reiniciarPorEpoca`;
   - lo leído por el técnico se guarda en el teléfono;
   - con el chat abierto, consulta cada 15 s;
   - la pantalla del chat y la fila, como arriba.
4. **Oficina:**
   - la pestaña «Comentarios» con los hilos;
   - el resumen bajo el dato;
   - el punto en la bandeja, la pestaña y el botón del panel;
   - consulta cada 15 s con la pestaña abierta.
5. **Extremo a extremo** en Chromium y WebKit:
   - una respuesta del teléfono llega a oficina con el punto, y la de oficina llega al teléfono;
   - sin señal queda en cola y sale al volver;
   - revisado, se cierra.
6. **Despliegue:** `campo` primero, por la migración; después `servidor` y `oficina`.

**Decisiones tomadas al construirla (2026-10-06)**
- **Avisos con el cliente y el texto:** chocaban con la regla 3 del ADR-0023 (sin datos del cliente). Kevin eligió el 2026-10-06 mantener lo aprobado; el ADR-0040 lo deja como excepción solo para las conversaciones. El aviso dice el cliente («Oficina · Hotel Plaza Real»), no el sitio.
- **Las respuestas son comentarios** con `en_respuesta_a`, `de` y `llave` (única): la idempotencia va en la misma fila (`ON CONFLICT DO NOTHING`) y no en `comandos_procesados`. Un reintento con la misma llave devuelve el mensaje guardado aunque ya esté revisado. Las respuestas no llevan sección ni campo: son del dato de su conversación.
- **Códigos:** revisado → `estado_invalido`; comentario retirado, respuesta a una respuesta o levantamiento de otro técnico → `no_encontrado`. El teléfono guarda el motivo (`revisado`, `no_existe`, `invalida`) y no reintenta.
- **Lo leído en oficina** es por persona y por levantamiento (`levantamientos.lecturas`, solo avanza). «Leído» en el teléfono: alguien de oficina leyó después del mensaje.
- **La cola del teléfono** guarda lo enviado como «enviado» hasta que la bajada lo trae, para que no desaparezca de la pantalla entre las dos cosas; un mensaje que espera detiene los siguientes del mismo chat para no desordenarlo.
- **Con la conversación abierta no hay aviso:** la pantalla le dice al service worker qué conversación ve (mensaje, no la dirección); el aviso se muestra en silencio y se cierra. Limitación: Safari 18.4 o posterior puede mostrar el formato declarativo sin pasar por el service worker, así que en iPhone el aviso puede verse igual.
- **Aviso tocado con la app abierta:** el service worker le pide a la ventana abrir lo suyo (`/?conversacion=` en campo, `/levantamientos/<id>?hilo=` en oficina) sin recargarla.
- **En campo**, la fila de «Enviados» ya no dice «N comentarios de oficina»: dice «Oficina te escribió» o «N respuestas por enviar», como el prototipo. Se arregló de paso la hora de la fila, que salía como «a. m.» sola.
- **En oficina** se conserva el campo de comentario general bajo los hilos y la edición del comentario propio (ADR-0035) con «Editado <hora>».
- `source-map-js` forzado a 1.2.2 o posterior (aviso alto nuevo, por `better-auth`, ajeno a la iteración).
- **Fallos de WebKit en administración y cuenta resueltos** (venían de antes de la 38): eran tiempos agotados, no errores. Buscar por etiqueta o rol en toda la página recorría la tabla de Administración, que en la base local tenía cientos de usuarios de corridas anteriores (33 s por campo en WebKit). Las pruebas ahora buscan dentro de la hoja o la fila; además se limpió la base local, a pedido de Kevin. Administración pasó de agotar los 90 s a 11 s.

**Evidencia:** pruebas nuevas de protocolo (4), servidor (5 de revisión, 1 de avisos, lecturas en plataforma) y campo (6 del motor, 4 del chat, cifrado y migración a Dexie 7); `conversaciones.spec.ts` en Chromium y WebKit; `revision.spec.ts` y `usabilidad.spec.ts` siguen pasando; capturas de campo a 390 × 844 (lista, detalle, chat, sin señal, oscuro) y de oficina a 1440 px (comentarios, punto, cerrada, oscuro) comparadas con `prototipos/hilos`; `pnpm typecheck`, `arquitectura`, `licencias`, `audit` y `presupuesto` (campo 133,3 KB de 135).

### Terminado cuando

| Criterio | Evidencia |
|---|---|
| 1. Como los prototipos | Capturas de la 38 junto a `revision-al-lado` y de la 39 junto a `hilos` (oficina a 1440 px; campo a 390 × 844, en claro y oscuro) |
| 2. Pruebas de paquetes | Siguen pasando `revision.test.ts`, `repeticiones.test.ts`, `avisos.test.ts`, `plataforma.test.ts`, `protocolo.test.ts`, `motor.test.ts` y `cifrado.test.ts` de campo. Nuevas: idempotencia de `responderComentario`, rechazo después de revisado, permisos (otro técnico, oficina), la app 13 ignora `respuestas`, la cola sin señal y el cifrado de `respuestasPendientes` |
| 3. Extremo a extremo | `revision.spec.ts` y `usabilidad.spec.ts` (38); un spec nuevo de conversaciones (39) en Chromium y WebKit |
| 3b. Reglas | `pnpm typecheck`, `pnpm arquitectura`, `pnpm licencias`, `pnpm audit`, `pnpm presupuesto` (campo ≤ 135 KB) |
| 4. Desplegadas | Entorno de pruebas, `campo` primero en la 39. Falta que Kevin las pruebe, en su iPhone para campo |

## Iteración 37 · Buscar en todo y revisar con el teclado

**Estado:** del mismo prototipo aprobado que la 36 (`prototipos/usabilidad-oficina`, casos «Buscar e ir» y «Revisar con el teclado», con los atajos en Mac y Windows). Kevin pidió seguir el 2026-10-04 ("Sigue"). Construida, verificada y desplegada en el entorno de pruebas el mismo día (solo `oficina`).

### Alcance (solo oficina y `paquetes/ui`, sin servidor ni migración)

- **Buscar en todo** (`oficina/src/busqueda.ts`, `pantallas/Paleta.tsx`): ⌘K / Ctrl + K o «Buscar» en el menú; recientes (`useRecientes`, `useAnotarReciente` al abrir un levantamiento, un informe, una cotización o un cliente), acciones («Programar visita», «Nuevo cliente», «Nueva cotización» abren su formulario por el estado del enrutador `abrir`; «Tomar el más antiguo»), secciones y resultados por grupo. Una visita abre Visitas buscando ese cliente.
- **Revisar con el teclado** (`oficina/src/atajos.ts`, `useTeclaSuelta`): J, K, ↓, ↑, Enter y «/» en la bandeja (mueven la fila marcada de la 36); T, R, S y Esc en la revisión; «?» y «Atajos del teclado» abren la lista (`pantallas/Atajos.tsx`). Cada botón con atajo muestra su tecla.

### Fuera de la iteración 37

| Qué | Cuándo |
|---|---|
| Buscar en las visitas anteriores y canceladas, y en los clientes archivados | Si oficina lo pide: la búsqueda usa las consultas de las listas, y Visitas trae las próximas |
| Atajos en otras pantallas (cotización, informe) | Si oficina lo pide |

### Terminado cuando

| Criterio | Evidencia |
|---|---|
| 1. Como el prototipo | Capturas en Chromium a 1440 px: la búsqueda vacía con las acciones, con resultados y sin nada, la lista de atajos y la bandeja con la fila marcada |
| 2. Pruebas de paquetes | `oficina/src/busqueda.test.ts` (7, escritas antes del código): grupos y orden, varias palabras sin tildes, los levantamientos que ya vienen buscados, y las teclas sueltas sin modificadores, fuera de campos y sin diálogos. Oficina 34, dominio 116, documentos 11, protocolo 25, campo 107; servidor 214 de 215 (falla la de `informes.test.ts` que ya era inestable; no se tocó el servidor) |
| 3. Extremo a extremo | `usabilidad.spec.ts` suma dos (buscar con el atajo, ir a un cliente, recientes y «Programar visita»; la serie J, Enter, T, R, Enter, S y Esc, y «?»): 12 de 12 en Chromium y WebKit. `revision.spec.ts`, `programacion.spec.ts`, `correcciones.spec.ts`, `cotizaciones.spec.ts` y `borradores.spec.ts`: 26 de 26 |
| 3b. Reglas | `pnpm typecheck`, `pnpm arquitectura` sin violaciones, `pnpm licencias`, `pnpm audit` sin vulnerabilidades; presupuesto de campo 132,1 de 135 KB |
| 4. Desplegada | Entorno de pruebas el 2026-10-04 desde el commit 5448f78 (subido a GitHub): `oficina` en `SUCCESS` (Kevin corrió `railway up`). Verificado: salud 200, la misma compilación que la local (`index-BgazDbpn.js`, con «Buscar en oficina» y «Atajos del teclado») y `verificar-exposicion.sh`. Falta que Kevin la pruebe |

### Decisiones tomadas al construirlo

- **Sin operación nueva en el servidor** (el prototipo proponía `buscar`): informes, cotizaciones y clientes ya llegan completos a oficina, y los levantamientos ya se buscan en el servidor (`listarLevantamientos` con `buscar` y `limite: 4`, uno por estado). La búsqueda usa esas consultas: ve lo mismo que las listas, con sus mismos permisos, y la iteración solo despliega `oficina`.
- **Un diálogo que se está cerrando no cuenta como abierto:** su copia (`capa-saliendo`) dura 200 ms, y sin esto la primera tecla después de Esc se perdía.
- **Enter y Espacio sobre un botón o un enlace hacen lo suyo,** no abren la fila marcada.
- **Esc en la revisión vuelve a la bandeja** solo fuera de los campos y sin diálogos (Esc en un diálogo lo cierra).
- **Atajos a la vista, después de verlo Kevin en el entorno de pruebas** ("¿es estético que se vean los comandos? ¿esto se usa realmente en la industria?"): solo «Buscar» muestra «⌘K»; «Plegar el menú» es un icono junto al logo; «Atajos del teclado» sale del menú (queda con «?» y en la búsqueda); los botones de la revisión llevan su tecla en la ayuda al pasar el cursor. El pie del menú vuelve a ser solo la cuenta.
- **La lista de la búsqueda se aplastaba en Safari** (`flex: 1` con base 0 en un diálogo sin alto fijo; el WebKit de Playwright no lo reprodujo): ahora `flex: 1 1 auto`. Desplegado en el entorno de pruebas el 2026-10-04 desde 9588b51 (`index-DECwusc1.js`, igual a la local).
- **Pruebas:** el servidor de vista previa de oficina se llama `vite.js preview`; `pkill -f "vite preview"` no lo cierra y Playwright lo reutiliza con la compilación vieja (`reuseExistingServer`). Ciérrelo con `pkill -f "vite.js preview"` antes de correr el extremo a extremo.

## Iteración 36 · Usabilidad de oficina

**Estado:** prototipo `prototipos/usabilidad-oficina/prototipo.html` (https://claude.ai/artifact/EQDmHRyzPDiWvDmdsQdBDw) aprobado por Kevin el 2026-10-04 ("Me gusta, pero esos comandos tienen que estar y entenderse también para usuarios de windows"): la versión 2 del prototipo muestra los atajos en Mac y en Windows. Construida, verificada y desplegada en el entorno de pruebas el mismo día (solo `oficina`, sin migración).

**Para qué:** que oficina no pierda trabajo ni espacio: el informe y la cotización se guardan solos, la hoja se acomoda a lo que se está haciendo, el menú se pliega, cada persona vuelve a donde quedó y el orden se cambia arrastrando.

### Alcance (solo oficina y `paquetes/ui`, sin servidor ni migración)

- **Vista previa** (`EditorConVista`, `useVistaPrevia` y `BotonMostrarVista` en `oficina/src/pantallas/Lienzo.tsx`): «Ampliar» y «Ocultar» en la cabecera de la hoja; divisor que se arrastra o se mueve con las flechas, con doble clic para volver al ancho de siempre; la hoja desde 360 px y el editor desde 520 (660 en la cotización). Se recuerdan si va oculta y su ancho; la ampliación no.
- **Guardado automático** (`oficina/src/guardado.ts`, `pantallas/Guardado.tsx`): 1,5 s después de dejar de escribir y al salir; los guardados van en cola, cada uno sobre la versión que dejó el anterior (`useBorrador` lee la versión y el contenido vigentes sin esperar a pintar). Copia en el equipo mientras no se guarda; sin conexión, reintento al volver; con la sesión vencida, reintento después de ingresar; conflicto con «Guardar la mía encima» (usa la `versionActual` del 409) o «Cargar la guardada». Se quitan «Guardar borrador» y `useSalidaProtegida` (`salida.tsx`).
- **Menú plegable** (`Marco.tsx`): «Plegar el menú» al pie y ⌘B / Ctrl + B.
- **Lo que se recuerda** (`oficina/src/preferencias.ts`, `PersonaDeOficina` en `rutas.tsx`): pestañas de Levantamientos, Clientes, Visitas y del carril de la revisión; búsquedas de las cinco listas mientras dure la pestaña del navegador; la fila abierta marcada en la bandeja (`FilaTabla marcada`).
- **Ordenar arrastrando** (`ListaOrdenable`, `destinoAlArrastrar` y `moverEnLista` en `paquetes/ui`): los levantamientos incluidos y los planos anexos del informe, con el puntero y con el teclado; sin bibliotecas.
- **Atajos en Mac y Windows** (`paquetes/ui/src/teclas.ts`): ⌘ y ↵ en Mac, «Ctrl + …» y «Enter» en Windows, también en el ↵ de las confirmaciones de oficina.

### Fuera de la iteración 36

| Qué | Cuándo |
|---|---|
| ⌘K / Ctrl + K para buscar en todo (operación nueva `buscar`) | Iteración 37 |
| Atajos para revisar en serie (J, K, Enter, T, R, S, /) y su lista con «?» | Iteración 37 |
| Decir quién guardó en el aviso de conflicto («Cargar la de Laura»): el servidor no guarda quién guardó el borrador | Si oficina lo pide (necesita una columna y el dato en `obtenerInforme` y `obtenerCotizacion`) |
| Arrastrar las líneas de la cotización | Si oficina lo pide |

### Terminado cuando

| Criterio | Evidencia |
|---|---|
| 1. Como el prototipo | Capturas en Chromium a 1440 px: el informe con la hoja y sus botones, la hoja ampliada con «Volver al editor», la hoja oculta con «Mostrar la vista previa» en la barra, el menú plegado y el asa de los planos. Diferencias: el aviso de conflicto no nombra a la otra persona (ver arriba); el editor sin la hoja usa el ancho de siempre (1144 px) |
| 2. Pruebas de paquetes | `oficina/src/usabilidad.test.ts` (9, escritas antes del código): atajos en Mac y Windows, el destino al arrastrar (falló primero por un caso mal planteado en la prueba), preferencias por persona y sin almacenamiento, estados del guardado y la copia del equipo. Oficina 27, dominio 116, documentos 11, protocolo 25, campo 107, servidor 215 (`informes.test.ts` falló una vez por tiempos y pasa 11 de 11 sola; es la inestable conocida) |
| 3. Extremo a extremo | `borradores.spec.ts` reescrita para el guardado automático (8: se guarda solo, fallo de red, conflicto, publicar, sesión vencida, salir sin preguntar, copia sin conexión y copia de antes de otro guardado) y `usabilidad.spec.ts` nueva (4: vista previa, menú y atajo, lo recordado, ordenar con puntero y teclado), más `informe.spec.ts`, `informe-al-cliente.spec.ts`, `cotizaciones.spec.ts` y `revision.spec.ts`: 34 de 34 en Chromium y WebKit. Suite completa en local: 111 pasan, 3 omitidas y 2 fallan, las dos `administracion.spec.ts` (Chromium y WebKit) por tiempo: la lista de accesos de clientes de Administración, con los miles de clientes de prueba de la base local (la lentitud conocida; esta iteración no toca Administración) |
| 3b. Reglas | `pnpm typecheck`, `pnpm arquitectura` sin violaciones, `pnpm licencias`, `pnpm audit` sin vulnerabilidades; presupuesto de campo 132,0 de 135 KB (nada de lo nuevo entra a campo) |
| 4. Desplegada | Entorno de pruebas el 2026-10-04 desde el commit 7956826 (subido a GitHub): `oficina` en `SUCCESS` (Kevin corrió `railway up`; el control de permisos no me dejó). Verificado: salud 200, la misma compilación que la local (`index-DFQS79ZV.js`, con «Plegar el menú» y «Guardar la mía encima») y `verificar-exposicion.sh`. Falta que Kevin la pruebe |

### Decisiones tomadas al construirlo

- **La plataforma se lee de `userAgentData.platform` y, si viene vacía, de `navigator.platform`.** Cualquier otro sistema (Windows, Linux, Android) usa Ctrl. En Mac no se toma Ctrl, que en los campos borra hasta el final de la línea.
- **Los guardados automáticos van en cola** y cada uno lee la versión vigente de una referencia, no de lo pintado: dos guardados seguidos sin una pintada en medio chocaban consigo mismos (409).
- **Lo que falla igual no se reintenta a cada momento:** un error de validación espera a que cambie lo escrito; sin respuesta del servidor o con la sesión vencida, se reintenta cada 10 s.
- **La ampliación es la misma hoja en posición fija**, no otra copia: el marco no se vuelve a dibujar, y lo de atrás queda `inert` mientras tanto.
- **En las pruebas, la tecla del atajo depende del sistema que ve la página:** el proyecto emula un teléfono Android, así que la app espera Ctrl aunque la prueba corra en un Mac.

## Iteraciones 34 y 35 · Firma en una pantalla y qué sale en el informe

**Estado:** prototipo `prototipos/informe-y-firma/prototipo.html` (https://claude.ai/artifact/4BgK3s9xXkizCK3x7exodN) aprobado por Kevin el 2026-10-04 con sus cinco decisiones; construidas, verificadas y desplegadas en el entorno de pruebas el mismo día.

**Para qué:** que el cliente firme sin pasar por una pantalla de bienvenida casi vacía, y que el informe sea fiel a lo que TEINS entrega: sin las fotos de llegada (son para que la empresa verifique la visita) ni el croquis de campo (oficina adjunta su plano), con libertad para poner o quitar lo demás.

### Alcance

**Iteración 34 · firma (solo campo, sin migración):** `HojaDeFirma` en una pantalla: el logo y «Cancelar»; «Constancia de visita · cliente» y «Confirme la visita de …» (de usted, ADR-0024); la declaración exacta; «Su nombre» y «Cargo (opcional)» en una fila; el recuadro (4:3) con «×», la línea, «Firme aquí con el dedo» y «Borrar» dentro; «Firmar» con lo que falta debajo. Sin la pantalla de bienvenida ni la lista de sitio, fecha y motivo (ya están en la declaración).

**Iteración 35 · qué sale en el informe (ADR-0039, migración `0035_seleccion_del_informe`):** `paquetes/dominio/src/seleccion.ts` (claves, lo de por omisión, `elegir`, `mostrarTodo`, `ocultosDe`, `aplicarSeleccion`); `DefinicionSeccion.soloEmpresa`; la columna `seleccion` del borrador, en `guardarInforme` (opcional) y `obtenerInforme`; al publicar, la copia congelada va sin lo oculto y con `ocultos`; la plantilla salta lo oculto en el PDF y en la vista lo dibuja rayado con «Mostrar» y pone «Ocultar» en lo que sale. En oficina, «Qué sale en el informe» bajo cada levantamiento incluido (`QueSaleEnElInforme.tsx`) y «Ocultar» sobre la hoja (`HojaEnVivo` con `botones`: una capa que pregunta qué hay bajo el puntero, porque la hoja no ejecuta scripts y Safari no entrega sus eventos). Formato de prueba v9: v8 con la Llegada `soloEmpresa`.

### Fuera de las iteraciones 34 y 35

| Qué | Cuándo |
|---|---|
| Ocultar datos sueltos de una sección que sale | Si oficina lo pide (ADR-0039, "Cuándo revisarla") |
| La pestaña «En el informe» de la revisión sigue mostrando el capítulo completo | Si confunde a oficina |
| «Ocultar» sobre la hoja con el teclado: hoy se hace con los interruptores del panel, que sí lo admiten | Con la próxima revisión de accesibilidad de oficina |
| Los formatos reales de TEINS con sus secciones «solo para la empresa» | Cuando TEINS los entregue |

### Terminado cuando

| Criterio | Evidencia |
|---|---|
| 1. Como el prototipo | Capturas en WebKit de la firma (vacía y firmada) y de la composición con la llegada oculta y una foto oculta desde la hoja; corregido: la hoja tomaba el nombre del título; el texto bajo «Firmar» repetía el error; tres «Ocultar» a la vez al pasar sobre una foto |
| 2. Pruebas de paquetes | dominio 116 (`seleccion.test.ts`, 5 nuevas), documentos 11 (2 nuevas: PDF sin rastro de lo oculto, vista con sus claves), protocolo 25, oficina 18, campo 107, servidor `informes.test.ts` 11 (nueva: la selección se guarda, una pestaña anterior no la borra y la versión sale sin la foto) |
| 3. Extremo a extremo | `informe.spec.ts` (la llegada no sale y una foto se oculta sobre la hoja), `firma.spec.ts`, `proteccion-campo.spec.ts`, `informe-al-cliente.spec.ts` y `portal.spec.ts` en Chromium y WebKit, más `revision.spec.ts` en WebKit: 15 de 15 en WebKit |
| 3b. Reglas | `pnpm typecheck`, `pnpm arquitectura` sin violaciones, `pnpm licencias`, `pnpm audit` sin vulnerabilidades, servidor 215 de 215; presupuesto de campo 132,0 de 135 KB |
| 4. Desplegada | Entorno de pruebas el 2026-10-04 desde el commit 2ab48c2 (subido a GitHub): `campo` primero ("Migraciones aplicadas", la `0035`), después `oficina`, `portal` y `worker`, los cuatro en `SUCCESS`; el formato de prueba v9 publicado con `publicar-formato`. Verificado: salud 200 en las tres superficies, las mismas compilaciones que las locales (campo `index-Drn8BtBi.js`, oficina `index-BOC_leX_.js`), la hoja de estilos de la vista con lo nuevo y `verificar-exposicion.sh`. Falta que Kevin la pruebe (en el iPhone, la firma) |

### Decisiones tomadas al construirlo

- **«Ocultar» sobre la hoja funciona con una capa encima** (`elementFromPoint`) y no con eventos dentro del marco: WebKit no los entrega desde un marco sin scripts (comprobado con una página mínima), y abrir los scripts del marco quitaría su aislamiento.
- **Al pasar el puntero se marca solo la parte más cercana**, para que no aparezcan varios «Ocultar» a la vez.
- **Safari y la hoja en vivo (arreglado el 2026-10-04, a pedido de Kevin):** WebKit no le entrega a la pantalla los eventos de un marco sin scripts. El correo editable de la iteración 30 escuchaba "input", así que en Safari lo escrito sobre el correo no se guardaba (`cotizaciones.spec.ts` lo reprodujo en WebKit antes del arreglo); ahora un `MutationObserver` lee el bloque. La hoja volvía a medirse con el evento "load" de cada foto; ahora con un `ResizeObserver`, para que en Safari no quede cortada cuando una foto tarda.
- **El nombre accesible de la constancia es fijo** («Constancia de visita»), no el título que cambia con el técnico.
- **`formatoContenido` sigue en 1**: `ocultos` es opcional y las versiones anteriores se dibujan igual.

## Iteraciones 32 y 33 · Ajustes de campo y la época de la bajada

**Estado:** prototipo `prototipos/ajustes-campo/prototipo.html` (https://claude.ai/artifact/ALQohRzdD6UgBLW1bYmDDX) aprobado por Kevin el 2026-10-03 con sus diez decisiones: "Si, apruebo. pero la animacion puede ser un poquito mas rapida, a esta velocidad da la sensacion de que esta lageada". Construidas y verificadas en local el mismo día; desplegadas en el entorno de pruebas el mismo día.

**Para qué:** Kevin revisó la app del técnico y pidió lo mismo que en oficina: que nada se abra de golpe, Tu cuenta mejor distribuida, los tableros con «Quitar» en otro lugar, un botón del catálogo que no confunda, el «Listo» del croquis, una entrega del teléfono menos extraña, la firma usando el espacio, un repaso antes de enviar con contenido y una lista de enviados que no se rompa. Y que el teléfono deje de mostrar datos que el servidor ya borró, sin reinstalar la app y sin romper el trabajo sin conexión.

### Alcance

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

### Fuera de las iteraciones 32 y 33

| Qué | Cuándo |
|---|---|
| La prueba en el iPhone de las pantallas nuevas (movimiento, hojas, firma, croquis) | Al desplegar en el entorno de pruebas |
| Teléfonos con la app 12 o anterior: no conocen la época y siguen necesitando reinstalar tras una limpieza | Se resuelve solo al actualizar a la 13 |
| "Hora" de la visita en la entrega del teléfono solo cuando la visita tiene horario (ADR-0037) | Ya es así: sin horario no se muestra |

### Terminado cuando

| Criterio | Evidencia |
|---|---|
| 1. Como el prototipo | Capturas en WebKit (iPhone 13) de Tu cuenta, Descartados, tableros, un tablero con su menú, el catálogo, la entrega, la constancia firmada y el repaso, comparadas con el prototipo, y el inicio con «Necesita atención»; corregidos el pie del catálogo (se partía en dos líneas) y el visto de un paso sin datos |
| 2. Pruebas de paquetes | dominio 111, documentos 9, protocolo 25, oficina 18, campo 107 y servidor 214 (una de informes falló una vez por tiempos de la verificación de un plano y pasa 10 de 10 al repetirla dos veces; no toca estas iteraciones). Nuevas: campo con `mensajes.test.ts` (estados cortos) y tres de la época en `motor.test.ts` (la primera no borra; otra quita lo viejo y conserva borrador y visita con trabajo; lo recibido después de limpiar se queda); servidor con la época por organización en `bajada.test.ts` |
| 3. Reglas | `pnpm typecheck`, `pnpm arquitectura` sin violaciones, `pnpm licencias`, `pnpm audit` sin vulnerabilidades; presupuesto de campo 132,0 de 135 KB |
| 4. Extremo a extremo | Chromium, los 9 archivos que tocan campo: 20 de 20 (con los textos nuevos: «Revisa y envía», «Revisar y firmar», «Repetir», el menú del tablero, «Ver materiales», "Contraseña" dentro de la cuenta, "Recibido" y "Revisado") |
| 4b. Extremo a extremo en WebKit | Los mismos archivos más `revision` y `cotizaciones`: 21 de 21 |
| 5. Desplegada | Entorno de pruebas el 2026-10-03 desde el commit 30e5981 (subido a GitHub): `campo` primero ("Migraciones aplicadas", la `0034`), después `oficina`, `portal` y `worker`, los cuatro en `SUCCESS`. Verificado: salud 200 en las tres superficies, la misma compilación de campo que la local (`index-HT6rm2Bt.js`), la bajada sin cabeceras de sincronización responde 426 y `verificar-exposicion.sh`. Falta que Kevin la pruebe en su iPhone y producción |

### Decisiones tomadas al construirlo

- **Las hojas entran en 260 ms y los pasos en 220 ms**, más rápido que el primer prototipo (380 ms): Kevin dijo que así se sentía con retraso.
- **La entrega del teléfono trata de usted** ("confirme"), como la constancia (ADR-0024), aunque el prototipo decía "confirma": quien la lee es el cliente.
- **Lo enviado se quita al terminar de bajar todo, no al cambiar la época**: un levantamiento que el servidor recibió después de la limpieza baja con su estado y se queda; solo sale lo que el servidor ya no conoce.
- **El catálogo se vacía al cambiar la época** aunque haya otra persona en el mismo teléfono: es de la organización y vuelve con la bajada.
- **La app de campo pasa a la versión 13**: vuelve a bajar todo (ADR-0015) y adopta la época sin borrar nada.

## Iteraciones 29 a 31 · Ajustes de oficina, el correo que escribe oficina y visitas con horario

**Estado:** prototipo `prototipos/ajustes-oficina/prototipo.html` (https://claude.ai/artifact/Ms1PjHDXDjL1YhsDCdbSqu) aprobado por Kevin el 2026-10-02 en tres versiones: la primera con sus ocho decisiones ("Sí. Me gustan"); la segunda con la unidad libre del catálogo, la vista previa opcional al enviar, Programar visita sin desplazamiento y con selectores propios, y «Marcar revisado» fuera del panel; la tercera escribiendo sobre el correo mismo. "Si, empieza. Deja todo tal cual me lo mostraste en el artifact en la aplicacion." Construidas y verificadas en local el mismo día; sin confirmar ni desplegar.

**Para qué:** Kevin revisó formularios y cuadros de oficina y encontró capas a todo el alto para tres campos, una página que se cortaba al bajar, botones estirados, un correo que nadie podía cambiar, visitas que ocupaban el día entero y un fallo: "Regenerar acceso" decía "No se pudo completar la acción" aunque el acceso ya había cambiado.

### Alcance

**Iteración 29 · ajustes de oficina (sin migración):**
- **El fallo de «Regenerar acceso»** (confirmado por Kevin: la pestaña estaba abierta desde antes del despliegue). El servidor regeneraba y el navegador fallaba al cargar el QR, una pieza aparte cuyo nombre cambió con el despliegue: la clave nueva no se mostraba y la anterior ya no servía. Ahora, una vez el servidor responde, la clave se muestra siempre (`credencialConQr`); sin QR, lo dice. Si una pestaña vieja no encuentra una pieza (`vite:preloadError`), el marco ofrece "Hay una versión nueva de TEINS · Recargar" (`version.ts`), y los errores de ese tipo dicen eso en vez de un mensaje genérico (`esVersionVieja`). La relectura de la lista ya no convierte en error una acción que el servidor hizo. Lo mismo para el QR del segundo factor.
- **Capas a la medida:** `Dialogo` con `forma="formulario"` (centrado, del alto de su contenido, con su equis) y `ancho` (`medio`, `ancho`, `doble`, `previa`). Pasan a él: cambiar la contraseña, nuevo ítem, editar ítem, cambiar precio, agregar sitio, nuevo y editar contacto, editar cliente y sitio, nuevo usuario, reprogramar y reasignar. Siguen en hoja lateral: Nuevo cliente (ahora más largo), Nueva cotización, Importar y la vista previa en pantallas angostas.
- **Notificación:** la acción ("Deshacer") es texto sin borde (`--t-enlace-notificacion`). **Lo nuevo:** tinte al 8 % que se va en 1,2 s, sin barra (`--t-duracion-resaltado`). **Salir sin guardar:** 480 px, en una fila, el atajo solo en "Guardar y salir".
- **Mi cuenta:** columna de 680 px centrada; filas con icono, nombre, estado y una acción secundaria del mismo tamaño ("Activar avisos" deja de ser principal: un permiso se propone con botón secundario); las llaves como una fila de "Acceso"; el tema como segmentos en "Preferencias". Cambiar la contraseña en diálogo, con las reglas bajo la contraseña nueva.
- **Catálogo:** descripción arriba, código y unidad en una fila; **la unidad se sigue escribiendo libre**, con las del catálogo debajo como atajos (`CampoTexto` con `sugerencias`). "Cambiar precio de …" con su historia.
- **La cotización que se cortaba al bajar:** los textos solo para lectores de pantalla se ubicaban contra toda la app y no contra su columna, y estiraban la página (1.328 px en una ventana de 900). Cada columna del documento en vivo es ahora su referencia (`position: relative`) y el contenedor recorta (`overflow: clip`). El informe compartía la causa.
- **Enviar a otro contacto:** diálogo centrado; solo los contactos que todavía no la recibieron (en cola, enviado o entregado); "Todos los contactos ya la recibieron" con el enlace a Clientes; "Ver cómo llega" opcional (se recuerda en el equipo) abre al lado lo que recibe; "Lo enviado no se puede recuperar." junto a los botones.
- **Nuevo cliente con su contacto principal:** bloques Cliente, Primer sitio y Contacto principal (nombre, cargo, correo, celular, qué recibe y por dónde, autorización de WhatsApp), con correo o celular obligatorio. `crearCliente` acepta `contacto` (opcional en la API, por el comando y las pruebas) y lo crea en la misma transacción, con `contacto_creado` en la auditoría. Los campos del contacto son `CamposDeContacto.tsx`, compartidos con "Nuevo contacto".
- **Revisión:** materiales como filas de una tabla en oficina (`EditorCantidades` con `disposicion="tabla"`; campo sigue con tarjetas); la plantilla del informe fija el ancho de las columnas de cantidades (también en el PDF); "En el informe" ensancha el carril (44 %, mínimo 520 px) y la hoja usa el alto disponible, con "Ver en grande" a tamaño real; «Tomar para revisar», «Marcar revisado» y «Abrir el informe de la visita» van en la barra superior; el carril dice el estado en una línea ("En revisión · la tomó usted", "Revisado · por …") y "Siguiente: …" es una fila, no un botón relleno.

**Iteración 30 · el correo que escribe oficina (ADR-0036, sin migración):** asunto y texto editables en la pestaña "Correo" de la cotización y del informe (escribiendo sobre la vista previa: el asunto en su lugar y el texto punteado dentro del correo) y en "Enviar a otro contacto" (en el formulario o sobre "Ver cómo llega"; es el mismo texto). El saludo, el adjunto, el botón del portal y el pie los pone la plantilla; "Volver al texto de TEINS" lo restablece. El contrato acepta `mensaje` en publicar y enviar; el servidor lo copia a `envios.mensaje.personal` de cada envío por correo y el worker lo usa. El envío dice "con su texto". WhatsApp no se edita (plantillas de Meta).

**Iteración 31 · visitas con horario (ADR-0037, migración `0033_horario_visitas`):** fecha, hora y duración en selectores propios (calendario, rejilla de media en media hora con "Todo el día", duraciones de 30 min a 8 h con "No sé cuánto dura"); Programar visita en un diálogo de dos columnas que se ve entero, con los técnicos libres a esa hora (buscador, "Libres a esa hora" y "Ocupados" con el motivo, seis a la vista); la lista de visitas con la columna "Hora", ordenada por hora y con "En curso"; reprogramar con horario y reasignar con disponibilidad. El servidor rechaza los cruces (`tecnico_ocupado`), da la ocupación del día (`ocupacionDeTecnicos`) y recibe `terminarVisita`. En campo (app 12), la visita muestra su horario; una sin fin, ya empezada, muestra "En curso" y "Terminar visita", que se guarda al instante sin señal y sale con su llave en la siguiente sincronización. Los avisos dicen la hora.

### Fuera de las iteraciones 29 a 31

| Qué | Cuándo |
|---|---|
| «Deshacer revisado» (el prototipo lo mostraba): reabrir una revisión es ADR-0032, aplazado | Cuando Kevin decida el ADR-0032 |
| Guardar en el borrador el texto del correo escrito antes de publicar (hoy vive en la pantalla hasta publicar) | Si oficina lo pide (ADR-0036) |
| Un texto propio por omisión para todos los envíos | Si oficina lo pide (ADR-0036) |
| Avisar al técnico cuando el servidor rechaza para siempre su "Terminar visita" (hoy la visita vuelve a "En curso" sin mensaje) | Con la prueba en el iPhone |
| La prueba en el iPhone de "Terminar visita" y del horario en "Mis visitas" | Con la prueba en iPhone de las fases 9 a 19 |

### Terminado cuando

| Criterio | Evidencia |
|---|---|
| 1. Como el prototipo | Kevin aprobó oficina en el entorno de pruebas el 2026-10-03. Capturas de cada pantalla en local comparadas con el prototipo (Mi cuenta, contraseña, nuevo ítem, enviar a otro contacto con y sin vista, nuevo cliente con errores, programar visita con sus listas, revisión); falta que Kevin lo compare en el entorno de pruebas |
| 2. El fallo, reproducido antes de arreglarlo | `oficina/src/administracion.test.ts`: fallaba (la clave se perdía y el mensaje era genérico) y pasa con `credencialConQr` y `esVersionVieja` |
| 3. El corte, medido | En el navegador: alto de la página 1.328 px en una ventana de 900 antes, 900 después; `cotizaciones.spec.ts` lo verifica con las versiones y sus envíos a la vista |
| 4. Pruebas de paquetes | dominio 111, protocolo 25, documentos 9 (3 nuevas: texto propio, escapado, PDF que no cabe), oficina 18 (horario y fallo), campo 100 (11 nuevas: horario, en curso, terminar sin señal con su llave), servidor 213 (nuevas: cliente con contacto, correo propio, horario, cruces, ocupación y terminar) |
| 5. Reglas | `pnpm typecheck`, `pnpm arquitectura` (sin violaciones), `pnpm licencias`, `pnpm audit` sin vulnerabilidades; presupuesto de campo 130,6 de 135 KB |
| 6. Extremo a extremo | Local, Chromium y WebKit: la corrida completa dio 90 bien y 11 fallas, todas de pruebas con los textos y controles anteriores; corregidas, los 6 archivos afectados pasan (más `proteccion-oficina` y `programacion` otra vez tras un arreglo). Ese arreglo vino de la prueba de reasignar: al desmarcar a un técnico elegido, la lista lo reordenaba fuera de la vista; ahora quien se eligió en el diálogo conserva su lugar |
| 7. Desplegada | Entorno de pruebas el 2026-10-02 desde el commit cab5f54: `campo` primero ("Migraciones aplicadas", la `0033`), después `oficina`, `portal` y `worker`, los cuatro en `SUCCESS`. Verificado: las tres superficies 200, salud 200, la misma compilación de oficina que la local (`index-BMDu84Yz.js`), `ocupacionDeTecnicos` y `terminarVisita` 401 sin sesión, y `verificar-exposicion.sh`. Falta que Kevin la pruebe y producción |

### Decisiones tomadas al construirlo

- **Los cruces se validan en la API, no en el comando `crear-visita`**, que sigue siendo una herramienta de administración. Se mira después de validar el pedido (fecha, sitio), sin contar la propia visita, con un bloqueo por organización y día.
- **El mediodía es "12:00 p. m."** en oficina, en campo y en los avisos, para un solo formato.
- **Un técnico elegido que queda ocupado al cambiar la hora deja de estar elegido**; Programar visita propone de 9:00 a 11:00 de hoy.
- **Reprogramar a otro día u otra hora deja la visita otra vez por hacer** (borra la terminación).
- **En campo, la terminación pendiente vive en el registro de la visita, fuera de lo sellado** (solo una hora y una llave, nada del cliente), para que la bajada la conserve sin abrir el sello; la del servidor gana.
- **La app de campo pasa a la versión 12**: ADR-0015 hace que un teléfono con versión nueva vuelva a bajar todo, y así recibe el horario de lo ya asignado.
- **La vista del correo se escribe dentro del marco**: el bloque del texto es editable (`contenteditable="plaintext-only"`) y el marco no se vuelve a dibujar mientras se escribe, para no perder el cursor; sí cuando el texto cambia desde afuera ("Volver al texto de TEINS", el formulario).

## Iteración 28 · Datos que se corrigen

**Estado:** prototipo aprobado por Kevin el 2026-10-02 (`prototipos/correcciones/prototipo.html`, https://claude.ai/artifact/5zrTMQo97hoNsoWUmxKwyN: "Dale, empieza la implementacion") con sus seis decisiones; construida y verificada en local el mismo día, y desplegada en el entorno de pruebas desde el commit 1eff68c. Kevin pidió llevarla a producción de una vez ("despliega en todo lado de una vez"). En producción el 2026-10-02 desde el commit 1eff68c: Kevin corrió las escrituras (mi permiso ya no admite desplegar ahí); respaldo `20261002T174223Z` listo antes, `campo` primero (aplicó la `0032`) y después `oficina`, `portal` y `worker`, los cuatro en `SUCCESS`. Verificado: salud 200 en las tres superficies, la misma compilación de oficina que la local (`index-De-fAUDX.js`), la ruta para archivar un cliente sin sesión 401, las mismas 8 cabeceras de seguridad que el entorno de pruebas y `verificar-exposicion.sh`. Falta que Kevin la pruebe y el extremo a extremo contra el entorno de pruebas, que corre él.

**Para qué (ADR-0034 y ADR-0035):** que un error se corrija en el lapso en que todavía se puede, sin borrar historia ni tocar lo publicado. Un envío equivocado se detiene mientras espera en la cola; una cotización mal publicada deja de valer; un cliente, un sitio o un comentario se corrigen o se archivan; y el técnico quita de su teléfono un levantamiento empezado por error sin perderlo de una vez.

### Alcance

- **Cancelar un envío en cola** (decisión 1, ADR-0034): "Cancelar" junto al envío `en_cola`, en las versiones del informe y de la cotización y en el avance de publicar, sin confirmar y con "Deshacer" en la notificación mientras siga en cola. El envío cancelado queda tachado con quién y cuándo ("cancelado por … : no sale"). Estado nuevo `cancelado` con `cancelado_por` y `cancelado_en`. Si ya salió, la app lo dice ("ya salió"). Operaciones `cancelarEnvio`, `reanudarEnvio`, `cancelarEnvioDeCotizacion` y `reanudarEnvioDeCotizacion`; reanudar no se ofrece en una versión retirada ni si el PDF falló.
- **Retirar una versión de cotización** (decisión 2): "Retirar versión" solo en la vigente y solo para quien administra, con motivo obligatorio y confirmación irreversible. La versión y su PDF se conservan; la anterior no retirada pasa a vigente, o la cotización queda "Sin versión vigente" (también en la lista). Sus envíos en cola se cancelan y una versión retirada no se vuelve a enviar. Evento `version_retirada`.
- **Corregir clientes y sitios** (decisiones 3 y 4, ADR-0035): "Editar" (hoja lateral) para el nombre del cliente y "Editar sitio" para el nombre y la dirección; el encabezado dice "Cambiado por … · fecha" y la auditoría guarda el valor anterior y el nuevo. "Archivar cliente" y "Archivar sitio" son confirmaciones con consecuencias; con visitas por hacer no se archiva y el diálogo dice cuáles (fecha, sitio y técnicos) con "Ver las visitas". Clientes tiene las pestañas "Activos" y "Archivados", con quién archivó, cuándo y "Recuperar". Un cliente archivado sale de las listas, de "Programar visita" y deja de recibir envíos (`paraEnviar` y `sigueRecibiendo`); no se le agregan sitios ni visitas. Archivar un sitio se deshace desde la notificación.
- **Corregir un comentario** (decisión 5): en el carril, "⋯" en el comentario propio con "Editar" (en su lugar) y "Borrar" (al instante, queda "Comentario retirado por … " con "Deshacer"), solo su autor y hasta que el levantamiento esté Revisado. Editar deja "Editado …". El técnico deja de ver lo retirado y ve la última versión en la siguiente bajada, con "· Editado". Los retirados no cuentan en la pestaña, en la fila del dato ni en la confirmación de "Marcar revisado". El historial dice "Editó su comentario" con el texto anterior y el nuevo, "Retiró" y "Restauró".
- **Descartar un levantamiento en campo** (decisión 6): "Descartar levantamiento" al final del recorrido, solo en un borrador nunca enviado, con confirmación irreversible que dice qué pasa con el trabajo y cuántas fotos tiene. Pasa a "Descartados", en "Tu cuenta", con la fecha en que se borra; "Recuperar" lo devuelve tal como estaba, o como levantamiento suelto si su visita ya tiene otro borrador. A los 30 días se borra con las fotos que nada más usa (al iniciar sesión). El servidor no se entera (ADR-0035).
- **Migración `0032_correcciones`:** las columnas de cada corrección y los `GRANT UPDATE` por columna para `teins_app`. En campo, `descartadoEn` es un campo visible del registro (no va sellado), así que Dexie no cambia de versión.

### Fuera de la iteración 28

| Qué | Cuándo |
|---|---|
| Una pantalla con el historial de cambios de un cliente (hoy, el último cambio en el encabezado y el registro completo en la auditoría) | Si oficina lo pide |
| Vaciar la papelera antes de los 30 días cuando el diagnóstico avisa de poco espacio (ADR-0035, mitigación) | Con la próxima iteración que toque el diagnóstico |
| Soltar, reabrir y devolver una revisión (ADR-0032, aplazado) | Cuando Kevin lo decida |
| La prueba en el iPhone de "Descartar" y "Descartados" | Con la prueba en iPhone de las fases 9 a 19 |

### Terminado cuando

| Criterio | Evidencia |
|---|---|
| 1. Como el prototipo | Pendiente: Kevin lo compara con el prototipo en el entorno de pruebas |
| 2. La carrera entre cancelar y mandar | `envios.test.ts`, "cancelar un envío en cola (ADR-0034)": cancelar mientras el worker procesa; gana quien llega primero a la fila (el worker marca `enviado_en` antes de salir y cancelar exige `enviado_en IS NULL`) |
| 3. Pruebas del servidor | `envios.test.ts` y `cotizaciones.test.ts` (cancelar, reanudar y retirar), `visitas.test.ts` ("corregir clientes y sitios (ADR-0035)": archivar bloqueado, el único sitio, sin envíos al archivado) y `revision.test.ts` ("corregir un comentario (ADR-0035)": solo su autor, no en Revisado, el técnico deja de verlo) |
| 4. Campo | `repositorio.test.ts`: descartar solo lo nunca enviado, recuperar como suelto si la visita ya tiene otro borrador, vaciar a los 30 días con las fotos que nada más usa |
| 5. Recorridos de punta a punta | `correcciones.spec.ts` (oficina corrige un cliente; el técnico descarta y recupera) y `revision.spec.ts` (editar y borrar un comentario) |
| 6. Verificación completa en local | Typecheck, arquitectura, licencias, auditoría (sin vulnerabilidades), pruebas de paquetes (dominio 111, documentos 6, protocolo 25, oficina 11, campo 88, servidor 207: una de la iteración 26, el estado de un plano, falló una vez en la corrida completa por una carrera con la cola y pasó tres veces seguidas sola), presupuesto de campo (129,3 de 135 KB) y el extremo a extremo completo: 100 pasan, 3 se saltan y 1 falla, `administracion.spec` en WebKit, por la base local con miles de usuarios (como en la iteración 27; pasa en el entorno de pruebas) |
| 7. Desplegada en el entorno de pruebas | 2026-10-02, desde el commit 1eff68c (subido a GitHub). `campo` primero (aplicó la `0032`: "Migraciones aplicadas"), después `oficina`, `portal` y `worker`, los cuatro en `SUCCESS`. Verificado: salud 200 en las tres superficies, la misma compilación de oficina que la local (`index-De-fAUDX.js`), `POST /api/clientes/{id}/archivar` sin sesión 401 y `verificar-exposicion.sh`. El extremo a extremo contra el entorno lo corre Kevin (crea datos ficticios allí y mi permiso no lo admite) |

### Decisiones tomadas al construirlo

- **No se archiva el único sitio activo de un cliente activo.** Sin sitio no se le programa nada, y para eso está archivar el cliente. El diálogo lo dice en lugar de ofrecer la confirmación; el servidor también lo rechaza.
- **Cancelar y mandar se resuelven en la fila.** Cancelar es `UPDATE … WHERE estado = 'en_cola' AND enviado_en IS NULL`; el worker marca `enviado_en` con `WHERE estado = 'en_cola'` antes de llamar al proveedor. El que llega primero gana y el otro ve que la fila ya cambió: no hace falta un bloqueo aparte.
- **Reanudar vuelve a encolar el envío solo si el PDF está listo;** si todavía se está generando, el trabajo del PDF lo encola al terminar, como a los demás.
- **Clientes no importa Visitas:** "visitas por hacer" llega como una función que `app.ts` le pasa al registrar sus rutas (`visitas.porHacer`), porque Visitas ya depende de Clientes y la frontera no admite el ciclo. "Por hacer" es no cancelada y programada de hoy en adelante, en la hora de Colombia.
- **Editar un sitio también marca el cliente como cambiado,** para que el encabezado diga el último cambio de cualquiera de los dos.
- **Archivar un sitio no pide la pestaña de archivados:** se queda en la lista del cliente con la insignia "Archivado" y "Recuperar", porque un cliente tiene pocos sitios.
- **Los errores de clientes y sitios dicen lo que dice el servidor** (`mensajeDeCliente` en `src/programacion.ts`): `estado_invalido` ahí es "tiene visitas por hacer", "es el único sitio" o "está archivado", no "la visita ya está cancelada" como en Visitas. Las confirmaciones de archivar vuelven a leer las consultas de programación antes de cerrarse, para que la lista y el detalle ya digan lo nuevo.
- **Lo descartado no sube ni se sella aparte:** `descartadoEn` es un campo visible del registro local, `listar` lo deja fuera y la papelera lo lee con `descartados`. Así no cambia la versión de Dexie (regla 5).

## Iteración 27 · Flujos

**Estado:** prototipo aprobado por Kevin el 2026-10-01 (`prototipos/flujos/prototipo.html`, https://claude.ai/artifact/EH56tcLrrRmHoBbsTrNg8X: "me gustan mucho esas animaciones y como lo planteaste tanto en campo como en oficina") con sus seis decisiones, construida, verificada en local y desplegada en el entorno de pruebas el mismo día; Kevin pidió llevarla a producción con la 26 ("pasa a produccion"). En producción el 2026-10-01 desde el commit 820ebd4: respaldo `20261001T223347Z` antes, `campo` primero (aplicó la `0031`) y después `oficina`, `portal` y `worker`, los cuatro en `SUCCESS`. Verificado: salud 200 en las tres superficies, la misma compilación de oficina que la local (`index-B4boh-4V.js`), `/documentos/informe.css`, `cotizacion.css` y `geist.woff2`, `estadoDePlano` sin sesión 401, las cabeceras y `verificar-exposicion.sh`. Falta que Kevin la pruebe.

**Para qué:** que los flujos no salten y siempre digan qué sigue. El envío del levantamiento era la vara: dice el estado real, cambia en su lugar y termina con el siguiente paso. Cuatro reglas (`DESIGN.md`, movimiento): lo que cambia se queda en su sitio y se transforma; lo que entra o sale se ve entrar o salir; solo lo nuevo se anima; cada acción termina diciendo qué pasó y qué sigue.

### Alcance

- **View Transitions en las dos superficies y sin Motion** (decisión 1). `conTransicion` (`paquetes/ui/src/transicion.ts`) hace de un cambio de estado una transición, con dirección (`adelante`, `atras`, `seccion`) y, si hace falta, esperando a que llegue lo nuevo; la raíz ya no se mueve (`:root { view-transition-name: none }`): solo lo que tiene nombre. El enrutador de oficina navega por `conTransicion` cuando cambia la ruta.
- **Campo:** la tarjeta de la visita se convierte en la cabecera de la captura (la captura se carga al abrir el inicio y la transición espera a que lea lo suyo: sin "Abriendo…" ni esqueleto). Entre pasos solo se desliza el cuerpo; la cabecera y la barra se quedan y la barra de avance crece. Al enviar, la hoja de confirmar baja y la pantalla avanza a "Enviado" desde arriba. «Ver la siguiente visita» (decisión 4) vuelve al inicio sin esqueleto, con la siguiente arriba y lo enviado resaltado en "Enviados" ("Enviando…" hasta que oficina lo recibe). El croquis y la firma suben y bajan. Solo las fotos, los materiales y las tarjetas nuevas entran animados. «Todo subido» en verde al vaciarse la cola. Las etapas del envío tienen clave fija y ya no se vuelven a animar al cambiar su texto.
- **Oficina:** cambiar de sección desvanece el contenido (el menú y la barra no se mueven); el título de la fila se convierte en el del detalle (levantamientos y clientes, leídos antes con un `loader` de hasta 400 ms y `defaultPreload: "intent"`). Tomar y corregir cambian en su lugar: la pastilla del estado pasa de uno a otro, el dato corregido destella y una notificación lo confirma. **Revisar en serie** (decisión 2): al marcar revisado, el chulo se dibuja y «Siguiente: …» abre el que más lleva esperando, con cuántos quedan; el cuerpo se desliza y el carril se queda. **El avance de publicar en su lugar** (decisión 3): arriba del editor, publicada, PDF, en el portal y cada envío; los envíos están hechos cuando ninguno queda en cola. Crear: la fila entra arriba, las demás se corren y el resaltado se desvanece; lo cambiado se resalta en su lugar sin saltar arriba; si queda en otra pestaña, se cambia a ella. Cancelar o desactivar: la fila se cierra o cambia, y **la notificación lleva a donde quedó** (decisión 5: «Agregar contactos», «Ver en Canceladas»). **Administración avisa** al desactivar y al dar o quitar la administración (decisión 6). Diálogos y notificaciones salen en 200 ms; el subrayado de las pestañas se desliza; «Nueva cotización» va a la cotización en un solo movimiento; «Sesión recuperada» al ingresar de nuevo encima.
- **Las dos:** con movimiento reducido nada se mueve (también lo que tenía duraciones fijas: la barra de avance, el anillo del envío y el de enderezar, el botón de ingreso, la etiqueta flotante y el chevron de "Ver lo que enviaste"); los desplazamientos son suaves solo con movimiento. Las animaciones de `oficina.css` que se llamaban igual que las de `tema.css` (`subir`, `aparecer`, `sacudida`, `latido`, `trazo`) tienen nombres propios, y salieron 74 reglas de `oficina.css` que ya no usaba ninguna pantalla, el `--i` de `FilaTabla` y `ChuloDeExito`.

### Fuera de la iteración 27

| Qué | Cuándo |
|---|---|
| El título de la fila convertido en el del detalle en informes y cotizaciones (sus títulos no son el texto de la fila) | Si Kevin lo pide al probarla |
| Firefox: no tiene View Transitions entre estados del mismo documento; ahí los cambios son instantáneos, como con movimiento reducido | Cuando el navegador lo soporte; no hace falta código |
| La prueba en el iPhone de los movimientos de campo | Con la prueba en iPhone de las fases 9 a 19 |

### Terminado cuando

| Criterio | Evidencia |
|---|---|
| 1. Como el prototipo | Pendiente: Kevin lo compara con el prototipo en el entorno de pruebas (no se hicieron capturas lado a lado) |
| 2. Sin nombres repetidos ni errores de transición | Pruebas de humo con Playwright contra la compilación local: una transición mínima tarda de 2 a 108 ms en cada sección de oficina (Clientes tardaba más de 400 s antes de nombrar solo las filas a la vista); Administración responde después de cerrar sesión, volver a entrar y tocar la misma sección; crear un usuario en WebKit muestra la credencial en 4 s con 5000 usuarios en la lista; sin errores en la consola |
| 3. Recorridos de punta a punta | `revision.spec.ts` ve el chulo de "Revisado", «Por …» y la notificación «Marcado revisado»; `filaDeLaBandeja` busca dentro del panel de la bandeja, porque la navegación ahora se aplica dentro de la transición; el resto de los recorridos pasan sin cambios |
| 4. Verificación completa en local | Typecheck, arquitectura, licencias, auditoría, pruebas de paquetes (campo 84, oficina 11, dominio 111, protocolo 25, documentos 6; servidor sin cambios, no se volvió a correr), presupuesto de campo (127,8 de 135 KB: 1,1 KB más por cargar la captura con su transición) y el extremo a extremo completo: 95 pasan, 3 se saltan y 2 fallan. Repetidas solas: `cantidades.spec` pasa en los dos navegadores (era la carrera del ayudante); `administracion.spec` en WebKit agota el tiempo porque la base local tiene más de 5000 usuarios de corridas anteriores (llenar la hoja tarda 28 s; la relectura, 34 ms). Contra el entorno de pruebas pasa en WebKit (53,6 s) |
| 5. Desplegada en el entorno de pruebas | 2026-10-01, desde el commit c384a07 (subido a GitHub con los de la 26). `campo`, `oficina`, `portal` y `worker` en `SUCCESS`, sin migración. Verificado: salud 200 en las tres superficies, la misma compilación de oficina que la local (`index-B4boh-4V.js`) y `verificar-exposicion.sh`. Extremo a extremo allí, un archivo por minuto por el límite de ingresos: `administracion.spec` (Chromium y WebKit) y `revision.spec` (Chromium) pasan |

### Decisiones tomadas al construirlo

- **La relectura después de una acción va dentro de la transición** (`useAccionDeProgramacion`, `useAccion`, `useAccionDeCatalogo` y la revisión): la pantalla se queda en la foto de antes mientras llega lo nuevo y después se mueve solo lo que cambió. No en los editores con guardado automático (informe, cotización), para no congelarlos mientras se escribe.
- **Lo nuevo de una lista es lo que llega después de abrir la pantalla** (`useLoNuevo`): va primero y resaltado, en la misma transición que lo trae; lo cambiado se resalta en su lugar. Así crear no da dos saltos (aparecer y después subir).
- **El diálogo sale con una copia inerte:** quien lo usa lo sigue quitando con una condición; al desmontarse, `Dialogo` deja una copia (sin ids, inerte y con lo escrito) que sale en 200 ms. Se muestra solo si de verdad se quitó: StrictMode desmonta y vuelve a montar sin quitarlo.
- **`flushSync` y dos vueltas del bucle** antes de que el navegador tome la foto de después: las consultas avisan en un `setTimeout(0)` y React pinta en el siguiente.
- **La dirección la pone el enrutador** según de dónde a dónde se va (otra sección, el siguiente de la misma, de la lista al detalle), con `onBeforeNavigate`; `conTransicion` la pone para los cambios dentro de una pantalla.
- **Inicio recuerda su última lectura en memoria** (`useLecturaRecordada`), no en el teléfono, y la olvida al quedar sin sesión.
- **Con dirección se mueve la raíz, no un elemento del tamaño del documento.** Al principio el contenido de oficina (`contenido`) y el cuerpo de campo y del detalle (`cuerpo`) tenían nombre: su foto medía todo el documento, y WebKit (el iPhone) se quedaba tomándola con una lista larga. Ahora, con `data-direccion` la raíz tiene nombre (su foto es la ventana) y lo que se queda quieto tiene el suyo (menú, barra, cabecera, barra del paso, carril).
- **Una fila tiene nombre de transición solo mientras está en pantalla** (`useNombreEnPantalla`, con un `IntersectionObserver` compartido y 200 px de margen; lo de adentro lo lleva por `data-transicion`). Cada elemento con nombre es una foto aparte: con las miles de filas que deja el extremo a extremo en la base local, Clientes tardaba más de 400 s en tomar la foto de antes y la pantalla se congelaba; con el observador, 108 ms. La ref de la fila es estable: una nueva en cada dibujo le quitaría el nombre en medio de la transición.
- **El enrutador anima solo cuando cambia la ruta y nunca congela la pantalla.** Su `startViewTransition` pasa por `conTransicion`. Con la misma ruta (otra vez el enlace del menú, después de cerrar sesión y volver a entrar) el enrutador espera una confirmación de pintado que no llega, y la pantalla quedaba congelada; ahora no hay transición en ese caso, y `conTransicion` nunca espera más de 1,5 s en la foto de antes, aunque lo que espera termine después.
- **Los nombres de transición son únicos por pantalla:** `visita-<id>` en la tarjeta o la fila de la visita y en la cabecera de su captura, `lev-<id>` en la fila de un levantamiento, `estado-<id>` en su pastilla, `fila-<id>` en las filas de tablas, `indicador-<id>` por cada grupo de pestañas.

## Iteración 26 · Vista en vivo de los documentos

**Estado:** prototipo aprobado por Kevin el 2026-10-01 (`prototipos/vista-en-vivo/prototipo.html`, https://claude.ai/artifact/KMNfFJPu6FkPF2SZx1zUud) con sus siete decisiones, construida y desplegada en el entorno de pruebas el mismo día, y **aprobada por Kevin en el entorno de pruebas** ("todo funciona bien"). En producción el 2026-10-01 desde el commit 820ebd4: respaldo `20261001T223347Z` antes, `campo` primero (aplicó la `0031`) y después `oficina`, `portal` y `worker`, los cuatro en `SUCCESS`. Verificado: salud 200 en las tres superficies, la misma compilación de oficina que la local (`index-B4boh-4V.js`), `/documentos/informe.css`, `cotizacion.css` y `geist.woff2`, `estadoDePlano` sin sesión 401, las cabeceras y `verificar-exposicion.sh`.

**Para qué (ADR-0031):** que oficina vea el documento que va a recibir el cliente mientras lo arma, y corrija antes de publicar, cuando todavía no es inmutable (QA-9). La vista y el PDF salen del mismo código, así que no pueden mostrar cosas distintas (QA-17).

### Alcance

- **`paquetes/documentos`:** las plantillas del informe y de la cotización, los mensajes de envío (correo, variables y texto de la plantilla de WhatsApp), `escapar`, el logo y los nombres de los PDF salen del servidor a un paquete que solo depende de `dominio`. Cada plantilla recibe la salida: `pdf` (estilos en `<style>` y Geist incrustada, como antes) o `vista` (enlaza `/documentos/informe.css` o `cotizacion.css`, servidos por oficina). El servidor imprime y envía con ellos; oficina los carga aparte, al abrir un documento.
- **Cotización:** el editor a la izquierda y la hoja a la derecha, a todo el alto; "Cotización" y "Correo" (lo que recibe cada contacto que recibe cotizaciones por correo, con el asunto y el adjunto). Una línea sin precio va como `[Precio]` y lo que cambia destella. Las acciones van a la barra superior y las versiones con sus envíos al final del editor.
- **Informe:** igual, con el documento completo en el orden del PDF: portada, introducción, capítulos con fotos (por sus URL firmadas), bocetos y firmas (en SVG, como el worker), conclusiones y los planos como fichas. Una franja marca dónde el PDF salta de página. Al pasar a una sección del editor, la hoja va hasta esa parte.
- **Revisión:** la pestaña "En el informe" del carril, que se ensancha a 560 px: el capítulo del levantamiento, con lo corregido resaltado y "Antes: …" debajo y, mientras se escribe una corrección, el valor nuevo enmarcado ("· sin guardar"). Desde la corrección, "Ver cómo queda en el informe" abre la pestaña.
- **Enviar a otro contacto:** pasa de diálogo a hoja lateral de 680 px, con lo que recibe cada contacto elegido por cada canal (el correo tal como sale; el WhatsApp con sus variables resaltadas) y, antes del botón, que lo enviado no se recupera.
- **Bajo 1280 px** la hoja no cabe al lado: "Vista previa" en la barra la abre en una hoja lateral ancha.
- **Estados:** mientras cargan las plantillas, la forma de una hoja; si no cargan o fallan al dibujar, "No se pudo mostrar la vista previa" con "Volver a intentar" (el trabajo no se afecta); sin conexión, la vista sigue al día y lo dice, y en el informe las fotos que no alcanzaron a cargar salen como `[FOTO]`.
- **La confirmación de publicar** ya no carga la vista previa del servidor (iteración 24): sus consecuencias dicen que es el documento de la vista previa. Salieron `/api/cotizaciones/{id}/vista-previa`, `rutaVistaPreviaCotizacion` y `registrarDocumento`.
- **La sesión trae `organizacion`:** su nombre, con el que firman el documento y el correo de la vista, y la dirección del portal (`PORTAL_URL`, nula si el entorno no la tiene), que lleva el botón del correo del informe igual que el que envía el servidor.
- **La ficha de cada plano dice cuántas páginas anexa.** Al verificar un plano, el servidor lo abre con pdf-lib con los mismos dos pasos con que lo anexa al imprimir (cargar y copiar sus páginas) y guarda el número (`archivos.paginas`, migración `0031`). Uno que pdf-lib no puede anexar queda marcado (0 páginas): la fila del plano lo dice en rojo, la ficha de la hoja también, y la confirmación de publicar lo lista como consecuencia, porque el PDF del informe fallaría y sus envíos no saldrían. Oficina lo lee con `estadoDePlano` (`GET /api/archivos/{huella}/plano`), también para los planos recién subidos, y vuelve a preguntar cada 2 s mientras se verifica.

### Fuera de la iteración 26

| Qué | Cuándo |
|---|---|
| Las páginas de los planos verificados antes de la migración `0031`: no se cuentan hacia atrás; su ficha dice "se anexa al final del PDF" sin el número | Al volver a subirlos, o si hace falta, con un comando que los recuente |
| Impedir publicar con un plano que no se puede anexar: hoy se avisa en la fila, la hoja y la confirmación, y el servidor lo sigue aceptando | Si TEINS lo pide: regla `plano_ilegible` al publicar (ADR nuevo, porque cambia lo que acepta publicar) |
| Campo ("Antes de enviar", lo que oficina va a recibir) | Cuando se decida; el paquete ya lo permite (ADR-0031) |
| El texto de la plantilla de WhatsApp en Meta | Al tener la cuenta de Meta: se registra el de `plantillaDeWhatsapp` |

### Terminado cuando

| Criterio | Evidencia |
|---|---|
| 1b. La ficha del plano | `servidor/pruebas/informes.test.ts`, "estado de un plano": "verificando" antes del worker, "listo" con 3 páginas después, "ilegible" el que empieza como PDF y pdf-lib no puede anexar, 403 para el técnico y 404 para otra organización o una huella desconocida. `informe.spec.ts` ve "1 página" en la fila y en la ficha; `informe-al-cliente.spec.ts`, el aviso del plano dañado en la fila, la ficha y la confirmación |
| 1. Una plantilla, dos salidas | `documentos/src/documentos.test.ts` (6 pruebas): las dos salidas solo difieren en cómo llegan estilos y fuente; la vista no lleva estilos en línea; la hoja de la vista contiene los estilos del PDF; anclas y `data-dato`; `[Precio]`; una marca de la plantilla de WhatsApp por variable. Regla `documentos-solo-dominio` en `.dependency-cruiser.cjs`, probada con una importación prohibida |
| 2. El PDF no cambia | Las pruebas del servidor que usan las plantillas y los mensajes pasan con el paquete (`informes`, `bocetos`, `firmas`, `repeticiones`, `cantidades`, `envios`, `cotizaciones`, `api`) |
| 3. Como el prototipo | Capturas de la cotización (documento, correo, confirmación, enviar a otro contacto y "Vista previa" a 1100 px), del informe y de la revisión, comparadas con el prototipo |
| 4. Funciona con la CSP de oficina | Oficina compilada y servida por el servidor real (con su CSP) en `localhost`: la hoja enlazada, Geist y las imágenes cargan en el marco en Chromium y WebKit, y los estilos del correo por CSSOM sin una sola violación. El extremo a extremo de cotización, informe, revisión y envíos pasó contra ese servidor |
| 5. Recorridos de punta a punta | `cotizaciones.spec.ts` (la hoja muestra `[Precio]`, cambia al escribir el precio y con AIU; "Correo"; la confirmación sin el PDF del servidor), `informe.spec.ts` (introducción, capítulo y la ficha del plano, y la introducción nueva al escribirla) y `revision.spec.ts` (el valor nuevo con "Antes: 10 kVA · sin guardar" antes de guardar, y resaltado después) |
| 6. Verificación completa en local | Typecheck, arquitectura, licencias, auditoría, pruebas de paquetes (servidor 197: salió la de la vista previa del servidor y entró la del estado de un plano; documentos 6, campo 84, protocolo 25, oficina 11, dominio 111), presupuesto de campo (126,7 de 135 KB, sin cambio) y el extremo a extremo completo: 97 pasan y 3 se saltan, en Chromium y WebKit. Con la ficha del plano terminada, otra vez la verificación completa: todo en verde y el extremo a extremo 97 pasan y 3 se saltan. Las pruebas de oficina usan Vitest con `--configLoader runner`, igual que Vite |
| 7. Desplegada en el entorno de pruebas | 2026-10-01, desde el commit 9cfc5a3. Kevin corrió los `railway up` (el control de permisos no me deja desplegar): `campo` primero (aplicó la `0031`) y después `oficina`, `portal` y `worker`, los cuatro en `SUCCESS`. Verificado: salud y las 7 cabeceras en las tres superficies, oficina sirve `/documentos/informe.css`, `cotizacion.css` y `geist.woff2`, la misma compilación que la local (`index-B1d3-3hK.js`), `estadoDePlano` sin sesión da 401 y la vista previa vieja 404, y `verificar-exposicion.sh`. Extremo a extremo allí en Chromium, un archivo por minuto: `cotizaciones.spec` (1), `informe.spec` (1), `revision.spec` (1) e `informe-al-cliente.spec` (2), los cinco a la primera; el entorno sí aplica la CSP de oficina |

### Decisiones tomadas al construirlo

- **La CSP de oficina no cambia.** El marco `srcdoc` hereda `style-src 'self'`: la vista enlaza su hoja de estilos (servida por oficina en `/documentos/`, generada por el plugin `teins-documentos` de `vite.config.ts` desde las mismas constantes del PDF) y la fuente por archivo. El correo trae sus estilos en atributos `style`, que la CSP bloquea en el HTML y también por `style.cssText` (Chromium lo trata como estilo en línea): se pasan a `data-estilo` y se aplican propiedad por propiedad con `style.setProperty`, lo mismo que hace React. Probado en Chromium y WebKit contra el servidor real.
- **El extremo a extremo no ve la CSP:** sirve las superficies con `vite preview`. La prueba con la CSP se hizo sirviendo la compilación de oficina con el servidor (`SUPERFICIE_OFICINA_HOST=localhost`) y `E2E_OFICINA_URL`; queda descrita aquí para repetirla si cambia la forma de dibujar.
- **El marco se arma una vez** y al escribir se reemplaza solo el cuerpo, en el siguiente cuadro (`HojaEnVivo`); lo que cambió destella comparando el texto de cada elemento antes y después. La hoja se mide por el cuerpo, no por el documento, para que pueda encogerse.
- **La revisión marca encima de la plantilla:** la plantilla pone `data-dato="sección/campo"` en cada fila (el PDF lo ignora) y oficina agrega la clase y el "Antes: …" (con `attr()` en CSS) después de pintar. Así la vista y el PDF siguen saliendo del mismo HTML.
- **La corrección en curso llega por contexto** (`CorreccionEnCurso` en `Detalle.tsx`): el editor de la fila avisa cada valor y el capítulo lo muestra sin guardar.
- **Lo que viene del borrador se arma como lo arma el servidor al publicar:** la cotización con `calcularTotales` del dominio (una cantidad a medio escribir no suma; un porcentaje a medio escribir deja el último que servía) y el informe con el capítulo de cada levantamiento (`capituloDe`) y sus recursos (`useRecursosDelInforme`).
- **El editor nunca baja de 660 px** para que la tabla de líneas quepa entera; la hoja se reduce con lo que queda. En la columna del editor, impuestos y totales van uno debajo del otro.
- **Vite carga su configuración con `--configLoader runner`:** el plugin importa `@teins/documentos`, que es TypeScript del monorepo y Node no lo resuelve sin transformarlo.
- **Un plano ilegible se avisa y no se bloquea:** publicar sigue aceptando lo mismo que antes (el servidor no cambia su regla), pero quien publica lo sabe antes. El conteo usa pdf-lib con los mismos pasos del worker, así que "ilegible" en pantalla y `PlanoIlegible` al imprimir no se pueden contradecir. 0 páginas se guarda como "no se puede anexar"; nulo, "no se contó" (otro tipo de archivo, o verificado antes de la `0031`).
- **Las plantillas pesan 29 KB comprimidas** (el logo en base64 es la mayor parte) y se cargan aparte; el resto de oficina no cambia de tamaño por ellas.

## Iteración 25 · Usuarios y cuenta propia

**Estado:** prototipo aprobado por Kevin el 2026-10-01 (`prototipos/cuenta/prototipo.html`), construida, verificada, desplegada en el entorno de pruebas y llevada a producción ese día.

**Para qué (ADR-0033):** que la contraseña que entrega administración deje de servir al primer ingreso, que cada persona cambie la suya, que quien no administra pueda quitar su segundo factor y que un usuario desactivado por error vuelva con su misma cuenta. Kevin pidió que la seguridad no baje: cada regla la exige el servidor, aunque se llame a la API sin pasar por la pantalla.

### Alcance

- **Contraseña temporal:** la que se entrega al crear, restablecer o reactivar desde Administración queda marcada (`debe_cambiar_contrasena`, migración 0030). Con la marca, el servidor responde `cambio_de_contrasena_requerido` (403) a toda operación salvo leer la sesión y cambiar la contraseña, y el puente de Better Auth niega registrar llaves y activar el segundo factor. Oficina muestra "Cree su contraseña" sin menú; campo, "Crea tu contraseña" dentro del ingreso, sin guardar el usuario en el teléfono hasta cambiarla.
- **Cambiar la propia contraseña** (`POST /api/cuenta/contrasena`): con la actual; la nueva de 10 a 128 caracteres y distinta de la actual. Cierra las demás sesiones (siempre: lo decide el servidor) y deja abierta la que la cambió, con el segundo factor y las llaves intactos. En oficina, hoja lateral en "Mi cuenta › Acceso"; en campo, "Tu cuenta › Cambiar contraseña", que sin señal no se abre.
- **Quitar el propio segundo factor** (`POST /api/cuenta/segundo-factor/quitar`): con la contraseña y un código vigente de la app; nunca para quien administra (403 aunque se llame directo). Cierra las demás sesiones.
- **Reactivar** (`POST /api/administracion/usuarios/{id}/reactivar`): en la fila del desactivado, con consecuencias; entrega una temporal una sola vez. No devuelve sesiones, llaves, segundo factor ni avisos, y las órdenes de borrado pendientes de sus teléfonos siguen.
- Restablecer la propia contraseña desde Administración se niega también en el servidor (antes solo la pantalla no lo ofrecía).

### Fuera de la iteración 25

- Activar el segundo factor quien no administra: el prototipo dibuja "Activar" en "Mi cuenta", pero el ADR no lo pide y hoy solo se activa al entrar a Administración. Queda "Sin activar" sin botón; se decide cuando haga falta.
- "Llaves de acceso" como una fila con "Administrar" (prototipo): se conserva la lista completa de 13 que ya tenía "Mi cuenta", debajo de "Acceso".
- Recuperar la contraseña sin administración (correo o SMS): ADR-0009 deja la recuperación en manos de quien administra.

### Terminado cuando

| Criterio | Evidencia |
|---|---|
| 1. El servidor exige cada regla sin la pantalla | `servidor/pruebas/cuenta.test.ts` (9 pruebas): la temporal solo lee la sesión y la cambia (sincronizar y registrar una llave dan 403); igual a la temporal no sirve; restablecer desde Administración la marca y el comando del servidor no; Better Auth no expone `/change-password` ni `/two-factor/disable`; la actual equivocada da 422 en su campo; otras sesiones se cierran; mismo límite de intentos que el ingreso (429); quitar el segundo factor pide código y contraseña y se niega a quien administra; reactivar exige administración con segundo factor, marca la temporal, no deshace la orden de borrado y no se repite; quien administra no restablece la suya |
| 2. Oficina y campo como el prototipo | Capturas en claro y oscuro de las ocho pantallas comparadas con el prototipo |
| 3. Recorrido de punta a punta | `e2e/pruebas/cuenta.spec.ts` (temporal en oficina, cambio desde "Mi cuenta", quien administra sin botón para quitar el factor; reactivar y crear la propia en campo, y cambiarla desde "Tu cuenta") y `administracion.spec.ts` actualizado |
| 4. Verificación completa en local | Typecheck, arquitectura, licencias, auditoría, pruebas de paquetes (servidor 197, campo 84, protocolo 25, oficina 11, dominio 111), presupuesto (126,7 de 135 KB) y el extremo a extremo completo: 97 pasan y 3 se saltan, en Chromium y WebKit |
| 5. Desplegada en el entorno de pruebas | 2026-10-01, desde el commit bd86295: `campo` aplicó la 0030 y después `oficina`, `portal` y `worker`, los cuatro en `SUCCESS`. Salud y las 7 cabeceras en las tres superficies, `verificar-exposicion.sh`, `/api/cuenta/contrasena` sin sesión da 401 y `/api/auth/change-password` 404. Extremo a extremo allí en Chromium, un archivo por minuto: `cuenta.spec` (2), `administracion.spec` (2), `llaves.spec` (1) y `proteccion-campo.spec` (9; dos chocaron con el límite de 5 ingresos por minuto y solas pasaron) |
| 6. En producción | 2026-10-01, desde el commit 101fbcf. Kevin corrió las escrituras: respaldo `20261001T042956Z` (listo), `campo` (aplicó la 0030) y después `oficina`, `portal` y `worker`, los cuatro en `SUCCESS`. Verificado: salud y las 7 cabeceras en las tres superficies, `/api/cuenta/contrasena` y `reactivar` sin sesión dan 401, `/api/auth/change-password` 404, el código nuevo servido ("Cree su contraseña" en oficina y "Crea tu contraseña" en el fragmento de ingreso de campo, el mismo `index` que la compilación local), `verificar-exposicion.sh` y el worker sin errores. En producción no se corre el extremo a extremo (ADR-0021) |

### Decisiones tomadas al construirlo

- **Operaciones propias sobre Better Auth.** Cambiar la contraseña y quitar el segundo factor llaman a Better Auth por su manejador HTTP, con las cookies, el origen y la IP que resolvió Fastify. Así aplican su límite de intentos (`/change-password` se agregó a las reglas, con el mismo máximo que el ingreso) y la verificación de origen, y el servidor arma el cuerpo: el cliente no elige si se cierran las demás sesiones. El puente sigue cerrado para `/change-password` y `/two-factor/disable`.
- **Una contraseña equivocada es 422 `credencial_incorrecta` con su campo**, nunca 401: oficina trata un 401 como sesión vencida y pediría ingresar de nuevo.
- **Quitar el segundo factor verifica primero el código** (`/two-factor/verify-totp`, que con la sesión ya verificada solo valida) y después la contraseña (`/two-factor/disable`). Better Auth deja una sesión nueva en lugar de la actual; el servidor cierra las demás sin tocar esa.
- **Los comandos del servidor no marcan la temporal:** quien corre `crear-usuario` o restablece por comando elige la contraseña al aprovisionar. Solo la que genera Administración es temporal.
- **La temporal en memoria, no en el teléfono ni en el navegador:** oficina recuerda la contraseña con la que se acaba de entrar hasta leer la sesión, para pedir solo la nueva; si la página se recarga, "Cree su contraseña" pide también la temporal. Campo la tiene en el estado del ingreso.
- **Campo no guarda el usuario hasta cambiarla:** si cierra la app a mitad, vuelve a entrar con la temporal. "Listo" espera a "Ir a mis visitas" para bajar visitas y formatos.
- **Reactivar es atómico:** quita la fecha de desactivación solo si sigue desactivado, así dos personas a la vez no entregan dos contraseñas.
- **Piezas nuevas en `paquetes/ui`:** `RequisitosDeContrasena` y `validarContrasenaNueva` (los mismos límites que el contrato), `Consecuencias` (sacada de `Confirmacion` para usarla en formularios), el ojo para mostrar lo escrito en `CampoTexto` de tipo contraseña y el mensaje de error por campo en `CampoDeIngreso`.
- **Arreglado de paso (iteración 24):** un doble toque en "Iniciar levantamiento" podía crear dos en WebKit. `useSinRepetir` suelta el bloqueo al terminar, y entre `abrir()` y que la captura reemplace la pantalla un segundo toque creaba otro. Ahora, creado uno, esa pantalla no inicia otro. Lo destapó `proteccion-campo.spec.ts` (2 de 3 en WebKit) con los cambios de esta iteración en `Inicio.tsx`; con el arreglo, 6 de 6.
- "Mi cuenta" de oficina se ordena como el prototipo: "Acceso" (contraseña y segundo factor) primero; "Sesión" queda solo con cerrar sesión.

## Iteración 24 · Robustez y protección

**Estado:** aprobada por Kevin el 2026-09-29. 24a y 24b hechas y desplegadas en el entorno de pruebas el 2026-09-29. 24c hecha y desplegada en el entorno de pruebas el 2026-09-30, con su prototipo aprobado. Sigue 24d.

**Para qué:** que nadie pierda trabajo ni haga algo sin querer. Cuatro auditorías de solo lectura (campo, oficina dos veces y transversal) encontraron borradores que se borran solos, acciones que se repiten con un doble toque, errores que no se ven y acciones con consecuencias sin confirmar. Va antes del rediseño visual: un flujo bonito que pierde datos no sirve.

**Orden acordado:** iteración 24 → tema claro, oscuro y del sistema → base visual (tipografía, color, forma) → flujos.

### Alcance

**24a · Grupo A: fallos que pierden datos o bloquean** (cada uno con una prueba que falla antes de corregirlo)

1. Informe y cotización: el borrador se borra al volver a la pestaña (`key={version}` con `refetchOnWindowFocus`).
2. "Guardar y publicar" vuelve a montar la composición y el error de publicar no se ve.
3. En oficina, la sesión vencida pierde el borrador: no hay manejo global del 401.
4. Los códigos de respaldo del segundo factor se pierden al volver a la pestaña después de 60 segundos.
5. Campo, "No se pudo obtener": borra el dato sin confirmar ni deshacer, y el texto queda desactualizado.
6. Campo, "Foto eliminada": el "Deshacer" queda detrás del visor de fotos (capa superior del `<dialog>`).
7. Campo, un doble toque en "Iniciar levantamiento" o "Agregar sección" crea duplicados.
8. Campo: las fallas al guardar en el teléfono no se avisan.
9. Campo: un error permanente de envío no tiene salida.
10. Envíos al cliente sin idempotencia, sin vista previa y sin cancelar.
11. Nadie lee `problema.campos` del servidor ("Revise cuerpo").
12. Oficina sin pantalla de error ni de ruta inexistente; el portal sin captura de errores.

**24b · Piezas compartidas en `paquetes/ui`:** `Confirmacion` con `nivel` obligatorio (deshacible, consecuencia, irreversible), salida protegida con cambios sin guardar, guardia de doble envío, interceptor de sesión vencida, errores por campo desde `problema.campos`, captura de errores y página 404 en español.

**24c · Grupos B, C y E: aplicar la regla de `DESIGN.md`** a las acciones que hoy la incumplen (confirmaciones que faltan o sobran, "Deshacer" donde la acción se puede revertir, salida protegida en las ~12 pantallas con campos, doble envío en inicios de sesión, firma, reintentar y cerrar sesión, tipos de teclado y foco al primer error).

**24d · Funciones que faltan, como propuesta:** reactivar usuario, soltar, reabrir o devolver una revisión, retirar cotización, editar o borrar comentario, cancelar un envío en cola, cambiar contraseña, desactivar el segundo factor, editar o quitar cliente o sitio, descartar borrador. Van con ADR nuevos (nunca se editan los aceptados) y no se construyen en esta ronda.

### Decisiones de Kevin (2026-09-29)

- "Enviar a oficina" sigue siendo una confirmación normal, no roja: `DESIGN.md` la clasifica como "consecuencias".
- La vista previa de la cotización es el HTML de la misma `plantillaCotizacion(...)` del servidor en un marco, marcado como aproximado; el PDF congelado sigue siendo la fuente de verdad.

### Terminado cuando

| Criterio | Evidencia |
|---|---|
| 24a: los 12 fallos del grupo A corregidos, cada uno con una prueba que fallaba antes | Hecho en local el 2026-09-29. 1 a 3: `e2e/pruebas/borradores.spec.ts`; 4: la primera prueba de `administracion.spec.ts`; 5 a 9: `proteccion-campo.spec.ts`; 10: `envios.test.ts` (llave) y `cotizaciones.test.ts` (vista previa) del servidor, y `cotizaciones.spec.ts`; 11: `oficina/src/mensajes.test.ts`; 12: `errores-de-pantalla.spec.ts` |
| Verificación completa | Tipos, arquitectura, licencias, auditoría y pruebas de los paquetes en verde (dos fallas intermitentes del servidor que pasan 3 de 3 solas, abajo); presupuesto de campo 124,1 de 135 KB; extremo a extremo completo en Chromium y WebKit: 71 pasan y 3 se saltan, como antes |
| 24a desplegada en el entorno de pruebas | 2026-09-29: `campo` (aplicó la migración 0029), `oficina`, `portal` y `worker`, subidos desde lo ya en commits; salud de las tres superficies y los 17 del extremo a extremo de 24a en Chromium contra el entorno (`borradores`, `proteccion-campo`, `errores-de-pantalla`, `administracion`, `cotizaciones`, `informe-al-cliente`; un archivo por minuto) |
| 24b: piezas compartidas | Hecha el 2026-09-29 y desplegada en el entorno de pruebas (`campo`, `oficina` y `portal`; las pruebas de salida protegida y de captura en campo, en verde contra el entorno): `Confirmacion` con `nivel` obligatorio (los 20 usos clasificados; sin él no compila), `useSalidaProtegida` (prueba "salida protegida" en `borradores.spec.ts`), `errorDelCampo` (`oficina/src/mensajes.test.ts`), captura de errores en campo (`errores-de-pantalla.spec.ts`); extremo a extremo completo en local, 75 pasan y 3 se saltan. La guardia de doble envío, la sesión vencida y la captura de oficina y el portal salieron en 24a |
| 24c: la regla de `DESIGN.md` en los grupos B, C y E | Prototipo aprobado por Kevin el 2026-09-30 (`prototipos/proteccion/prototipo.html`). Hecho en local el mismo día, con pruebas que fallaban antes: `e2e/pruebas/proteccion-oficina.spec.ts` (desactivar con "Deshacer", reasignar dice qué pasa, contacto con errores por campo y foco, fechas desde hoy), `proteccion-campo.spec.ts` (tablero y material con "Deshacer", doble toque en "Firmar", botón atrás), `borradores.spec.ts` ("Guardar y salir"), `revision.spec.ts` (motivo obligatorio), `administracion.spec.ts` (restablecer lista el segundo factor; no para uno mismo) y `restaurarRepeticion` en `dominio` |
| 24d | Propuesta escrita el 2026-10-01 (ADR-0032 a 0035). Kevin aceptó 0033, 0034 y 0035 y aplazó 0032. Se construyen en iteraciones propias (25 y 28) |

### Decisiones tomadas al construirlo

- **El borrador guarda contra la versión en que se basa lo escrito** (`oficina/src/borrador.ts`), no contra la última leída: si otra persona guardó en medio, el servidor responde conflicto en vez de pisarla. Sin cambios propios, sigue al servidor. Se quitó `key={version}`, que borraba lo escrito cada vez que el servidor subía la versión.
- **Un error al releer no desmonta la pantalla** (informe, cotización y la raíz de oficina): la pantalla de error solo sale si nunca cargó. Sin conexión, el marco ya lo avisa.
- **Sesión vencida: se ingresa de nuevo encima**, en un `<dialog>` que no se cierra, con la pantalla montada detrás. Cualquier 401 relee la sesión (`api.ts`). Si ingresa otra persona, todo se vuelve a montar (`key` del marco es el usuario): lo escrito por la anterior no queda a la vista.
- **Las notificaciones van dentro del diálogo modal de encima.** Un `popover` sobre un `<dialog>` modal queda inerte en Chromium y WebKit (comprobado), así que el "Deshacer" del visor de fotos no se podía tocar.
- **`useSinRepetir`** (`paquetes/ui`): bloqueo síncrono, porque el segundo toque llega antes de que React pinte el botón deshabilitado. Es la guardia de doble envío de 24b; ya la usan iniciar levantamiento, agregar repetición y reintentar envío.
- **"No se pudo obtener"** ofrece "Deshacer" cuando reemplaza algo capturado, y el control se vuelve a montar con lo guardado: desmarcar ya no deja a la vista un valor que no está. `MarcaNoObtenido` separa `onMarcar` de `onMotivo`.
- **Un rechazo permanente del envío** (formato retirado, enviado por otra persona, datos no aceptados) no lo resuelve el técnico: la salida es decir qué pasó, que lo capturado sigue en el teléfono, que oficina ya lo ve en "Teléfonos de campo" (ADR-0017) y reintentar cuando lo resuelvan. Volver el levantamiento a borrador cambiaría su ciclo de vida: si hace falta, va con ADR en 24d.
- **Los envíos al cliente llevan llave** (regla 4, migración 0029): la fila de la versión ya se bloquea al programar, así que basta con guardar la llave en cada envío y revisarla dentro del bloqueo. La llave es opcional por N-1. Un pedido repetido no se vuelve a auditar.
- **La vista previa de la cotización es un documento propio del servidor** (`/api/cotizaciones/{id}/vista-previa`, `registrarDocumento`), no un `srcdoc`: el `srcdoc` hereda la CSP de oficina (`style-src 'self'`) y la plantilla se vería sin estilos. El documento lleva su propia CSP (sin scripts, conexiones ni formularios, solo dentro de oficina). Muestra lo guardado, así que "Publicar" guarda primero si hay cambios. Salió en la iteración 26: la vista en vivo la dibuja oficina con `paquetes/documentos` (ADR-0031).
- **"Revise cuerpo" se traduce en oficina** (`textoDelServidor`): el servidor sigue listando las rutas en `problema.campos` y oficina nombra los datos como en la pantalla. Marcar cada campo en su formulario es de 24b.
- **Fallas intermitentes vistas en la verificación, sin relación con el cambio:** `envios.test.ts` "si no se sabe si WhatsApp lo recibió" y `api.test.ts` "rechaza y elimina un archivo que dice ser JPEG", las dos con la cola del worker bajo carga (la segunda con el extremo a extremo corriendo a la vez); pasan 3 de 3 solas.

**En 24b:**

- **`nivel` tiene dos valores, no tres:** "se deshace fácil" no usa `Confirmacion` sino la notificación con "Deshacer" (`DESIGN.md`). La migración fue mecánica (`peligro` → `irreversible`), así nada cambió a la vista; la clasificación de cada acción contra la tabla es de 24c. Ya se ve que tres no la cumplen: quitar una sección repetida, desactivar un usuario y quitar una llave llevan botón rojo y la tabla los pone en "tiene consecuencias".
- **La salida protegida vive en oficina** (`src/salida.tsx`), no en `paquetes/ui`: depende del enrutador de oficina. Campo guarda cada dato al escribirlo y el portal no tiene formularios.
- **La sesión vencida solo necesitaba oficina:** campo trabaja sin conexión y guarda en el teléfono (el envío queda en "Inicia sesión para enviar"), y el portal solo lee.
- **`errorDelCampo` marca el campo con un texto general** ("Revise este dato: no tiene la forma esperada."): los mensajes de Zod del servidor están en inglés y no se muestran. Usarlo en cada formulario es de 24c.

**En 24c:**

- **Lo que se revierte no pregunta:** desactivar un ítem, quitar un tablero y bajar un material a cero pasan al instante con "Deshacer". El tablero vuelve a su lugar con lo escrito (`restaurarRepeticion` en `dominio`); `quitarRepeticion` devuelve lo quitado leído en la misma escritura, así "Deshacer" incluye lo último que se tecleó. Las fotos del tablero no se borran mientras tanto.
- **Quitar una hoja del croquis ya se deshacía** con el "Deshacer" de la barra del editor (su historial): no lleva otra notificación.
- **Importar CSV ya mostraba el resumen** ("2 ítems listos para importar") antes de "Importar 2 ítems": no cambió.
- **Salir con cambios:** "Guardar y salir" es la acción principal y recibe el foco; "Salir sin guardar" va a la izquierda, en rojo. Sigue en informe y cotización: las demás pantallas con campos editan en hojas, que son modales, así que no se puede salir con una abierta.
- **Restablecer contraseña** lista sus cuatro consecuencias (contraseña temporal, sesiones, segundo factor y llaves, avisos) y no aparece en la fila propia; la fila propia no tiene menú (todas sus opciones ya estaban ocultas).
- **Corregir un dato exige motivo**, con el error en el campo y el foco en él. El servidor sigue aceptándolo opcional: la regla es de la pantalla.
- **Reasignar** dice en la hoja quién deja de ver la visita y quién la recibe, y el botón nombra a quien la recibe ("Reasignar a María Gómez"). No se dice "con un aviso": el aviso de una visita reasignada no está confirmado.
- **Formularios de oficina:** el foco va al primer campo con error (`enfocarPrimerError`), correo y celular con su teclado (`tipo="email"`/`"tel"`), y las fechas de programar y reprogramar desde hoy (también al enviar, porque los formularios usan `noValidate`).
- **Campo:** el botón atrás del teléfono hace lo que la flecha de cada pantalla (`dispositivo/atras.ts`: una entrada de más en el historial mientras hay un levantamiento abierto); "Firmar" no se repite con un doble toque (`useSinRepetir`); Esc cierra la constancia como la equis.
- **Desviaciones del prototipo:** Esc en la firma cierra sin preguntar, igual que la equis de hoy; en el croquis no se agregó Esc: una tecla cerraría a pantalla completa el trabajo de dibujo sin querer, y el editor ya tiene su "Listo".
- **Visto al probar:** en un teléfono, oficina se desborda a lo ancho (la página mide 491 px en uno de 412) y la notificación queda en parte fuera de la pantalla. Oficina es de escritorio; queda como pendiente de diseño.
- **Arreglado de paso:** el cuerpo de un diálogo centrado de oficina largo (reasignar con muchos técnicos) tapaba su pie: el diálogo no podía desplazarse desde el cambio a Precisión.

### Fuera de la iteración 24

- Las funciones de 24d, entre ellas cancelar un envío en cola: solo la propuesta.

## Iteración 23 · Oficina con la identidad Recorrido

**Estado:** construida y verificada en local el 2026-09-27, y desplegada en el entorno de pruebas el 2026-09-29 con la ronda de revisión de código; falta que Kevin la apruebe.

**Para qué:** llevar a oficina la identidad que Kevin aprobó en campo, sin repetir lo que no funcionaba: pantallas llenas de recuadros y listas sin búsqueda.

### Cómo se hizo

1. **Inventario** de las 15 pantallas de oficina: datos, acciones, diálogos y estados, con sus textos exactos.
2. **Prototipo navegable** (`prototipos/oficina/prototipo.html`, https://claude.ai/artifact/XwTGDmPxCJ1wFFpqcBGycX) con tema oscuro y claro, los estados vacío, cargando, error y sin conexión, y los flujos de revisión, informe, cotización y administración.
3. **Corrección de Kevin:** "que en cada módulo haya tantos recuadros resulta agobiante... piensa cómo se puede reorganizar esta información". Se rehízo: primero qué hace la persona en cada pantalla y en qué orden lee, después Mobbin para validar (Stripe, Linear, Xero, Squarespace, Frame.io, entre otras). Cada pantalla del prototipo lo explica.
4. **Detalles que pidió Kevin sobre el prototipo:** impuestos como dos opciones en lista, comentario escrito debajo del dato (sin subir y bajar), búsqueda en todas las listas, y un inicio de sesión con el plano de un cuarto eléctrico dibujado en luz, sin textos de venta.
5. **Construcción módulo por módulo**, comparando cada pantalla de la app con la del prototipo en capturas del mismo tamaño.

### Terminado cuando

| Criterio | Evidencia |
|---|---|
| Cada pantalla igual al prototipo | Capturas lado a lado de inicio de sesión, bandeja, detalle, confirmaciones, visitas, clientes, catálogo, informes, informe, cotizaciones, cotización, administración y mi cuenta |
| El CSS del prototipo, sin estilos en las pantallas (regla 11) | `paquetes/ui/oficina.css`, importado solo por oficina; los componentes compartidos llevan clases gancho que en campo y en el portal no pintan nada |
| La bandeja busca en el servidor | `buscar` opcional en `listarLevantamientos` (cliente y sitio por la interfaz de visitas, técnico por la de identidad, formato en el propio módulo), sin tildes ni mayúsculas; prueba en `revision.test.ts` |
| Sin romper funciones ni el servidor | Las operaciones, validaciones, confirmaciones y textos de error siguen iguales; el protocolo solo ganó dos campos opcionales (`buscar`, `nombreFormato`) |
| Verificación | Tipos, arquitectura y licencias; extremo a extremo en Chromium (21 pruebas) con los selectores del diseño nuevo |

### Decisiones tomadas al construirlo

- El título del detalle es el cliente y el sitio: es lo que oficina reconoce. El estado va junto al título pero fuera del `h1`, así el título se lee solo.
- La acción de la revisión va en el carril, que queda fijo al bajar.
- "Lleva esperando" cuenta días de calendario: "Hoy", "Desde ayer", "3 días"; en ámbar desde dos días.
- Las visitas se agrupan por día; "Hoy" va en la cabecera del día.
- Guardar borrador aparece solo cuando hay cambios; si no, se lee "Todo guardado".
- `Dialogo` ignora un `close` que quedó en cola de un montaje anterior: en desarrollo (StrictMode) cerraba las confirmaciones apenas se abrían.

### Fuera de la iteración 23

- El tema claro: está en el prototipo, pero oficina queda en oscuro como campo.
- El portal del cliente sigue con Consola.

## Iteración 22 · Campo rehecho con la dirección Recorrido

**Estado:** terminada, desplegada en el entorno de pruebas y aprobada por Kevin en su iPhone el 2026-09-27.

**Para qué:** Kevin juzgó la interfaz "demasiado fea". En el teléfono todo era una lista larga de campos, y lo único que le gustaba era el croquis.

### Cómo se hizo

1. **Línea base:** 21 pantallas de campo en tamaño iPhone y 21 problemas numerados (artifact "Línea base de campo").
2. **Crítica con impeccable:** 22/40 y veredicto "genérica". Lo más grave (P0) era la captura en un solo desplazamiento.
3. **Referencias de Mobbin:** 15 búsquedas en apps reales (Jobber, Lloyds, Hevy, Gojek, Vestiaire y otras).
4. **Prototipo navegable** con la mezcla B+A: estructura de recorrido y lenguaje del croquis (`prototipos/campo/prototipo.html`). Kevin lo aprobó.

### Terminado cuando

| Criterio | Evidencia |
|---|---|
| La captura va por pasos: recorrido, un paso por sección, tarjetas para lo repetido, revisar antes de enviar | `Captura.tsx` (`Borrador`, `Repeticiones`, `Repeticion`); pruebas de extremo a extremo de envío, repeticiones, firma y cifrado |
| El recorrido sale de las secciones del formato, sin código por formato (regla 6) | Los pasos se arman con `formato.secciones` |
| Paleta oscura en campo; croquis, firma y miniaturas sobre papel claro | `tokens.css` (`[data-superficie="campo"]`, `[data-tema="claro"]`) |
| El movimiento es CSS (regla 10) | View Transitions y `@keyframes` en `tema.css`; el JavaScript solo cambia de pantalla |
| Presupuesto de peso | 120,1 KB de 135 KB (ADR-0030) |
| Verificación | Tipos, arquitectura, licencias, pruebas rápidas y extremo a extremo en Chromium y WebKit (39 pasan, 3 omitidas) |

### Decisiones tomadas al construirlo

- Un levantamiento nuevo abre en su primer paso; uno con datos, en el recorrido.
- Avanzar no se bloquea. Lo que falta se ve en el recorrido y se lista en Revisar, donde cada dato lleva a su paso.
- La unidad elegida se pinta con el color del texto, para que el azul quede solo en la acción que avanza.
- El aviso de instalar es una línea. Un enviado ya no repite su estado en una insignia.
- "Guardado en este teléfono" se muestra en el recorrido, no en cada paso.

### Corrección del 2026-09-27

Al probarlo en el iPhone, Kevin vio que el contador de pasos no avanzaba y que la firma se veía lavada. También vio que varias pantallas del prototipo quedaron comprimidas en una. Pidió que quedara igual al prototipo, sin recortar nada.

Se agregó lo que faltaba:
- el formato v8 con los pasos del prototipo (Llegada, Cuarto técnico, Tableros, Materiales, Croquis, Firma del cliente), valores comunes y fotos por puesto;
- el campo de medida grande;
- materiales con − y + y el catálogo alto;
- el croquis y la firma como pasos propios;
- la pantalla de enviado del prototipo;
- el saludo y la cuenta en Mis visitas;
- el inicio de sesión rediseñado.

El contador cuenta también los pasos por los que ya se pasó. El texto de lo que se dibuja o se firma toma el color de la paleta clara. "Diagnóstico del teléfono" pasó al botón de la cuenta.

### Fuera de la iteración 22

Oficina y portal siguen con Consola: el mismo método empieza por cotizaciones.

## Iteración 21 · Cotizaciones desde las cantidades

**Estado:** terminada el 2026-09-27, verificada en local y desplegada en el entorno de pruebas (ver "Terminado cuando"). Maquetas aprobadas por Kevin en el lienzo (página "v1.1 · Cotizaciones", "Sí, aprobadas"); decidió que los precios los cambia solo administración.

**Para qué:** de la visita revisada a una cotización con PDF y envío, sin volver a digitar las cantidades (P27, QA-12).

### Alcance

- **Lista de precios con historia (ADR-0029, parte 1):** en "Catálogo", la columna "Precio sin IVA" y el filtro "Solo los que no tienen precio"; "Cambiar precio" (solo administración con segundo factor) abre la hoja lateral con la historia. Importar el CSV con una columna de precio también es de administración; para el resto de oficina, el archivo entra sin precios y lo dice. Los precios nunca bajan al teléfono (regla 7).
- **Módulo `cotizaciones` (ADR-0029, parte 2):** "Cotizaciones" en la navegación. "Nueva cotización" elige una visita con levantamientos revisados; las líneas salen de sus cantidades, sumadas por ítem y unidad, con el precio vigente. Oficina cambia cantidad y precio por línea (se ve el del catálogo si lo cambió), agrega líneas (mano de obra), quita con "Deshacer", elige IVA sobre el subtotal o AIU con IVA sobre la utilidad, y fija validez, forma de pago y notas.
- **Pesos enteros:** el cálculo vive en el dominio, con `BigInt`; la pantalla y el servidor usan el mismo. Una línea sin precio impide publicar, y el aviso está junto a la línea.
- **Numeración `COT-{año}-{consecutivo}`,** por organización y año, sin repetirse.
- **Versiones inmutables con PDF** (cola `pdf`, carta, con la marca), y envío por correo como el informe (ADR-0028): cada contacto marca si recibe informes, cotizaciones o los dos, y al publicar se marcan quienes reciben cotizaciones.
- **La impresión a PDF pasó a `plataforma/pdf.ts`:** un módulo no importa las partes internas de otro.

### Fuera de la iteración 21

| Qué | Dónde se resuelve |
|---|---|
| Lista de precios, plantilla (P29), tratamiento tributario, forma de pago y numeración de TEINS | Cuando TEINS los entregue: la lista se importa por CSV (administración); la numeración cambia en `numeroDeCotizacion` |
| Estado comercial de la cotización (aceptada, rechazada) y su retiro | Si TEINS lo pide |
| Cotizaciones en el portal del cliente | Si TEINS lo pide: hoy el portal solo muestra informes |
| WhatsApp de la cotización (plantilla `cotizacion_publicada`) | Con la cuenta de Meta, como el del informe |
| Contar los símbolos del croquis como cantidades | Si TEINS lo pide: el código de catálogo ya viaja en cada símbolo puesto |
| Precios de prueba en `sembrar` | No hacen falta: el entorno de pruebas los pone administración desde "Catálogo" |

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Kevin aprueba las maquetas | Hecho el 2026-09-27 |
| 2. El cálculo es exacto en pesos enteros: línea, porcentajes, IVA, AIU con IVA sobre la utilidad, líneas sin precio, validación y numeración | Hecho: `dominio/src/cotizacion.test.ts` |
| 3. Solo administración cambia o importa precios; la historia se conserva y reimportar el mismo precio no la ensucia | Hecho: `servidor/pruebas/cotizaciones.test.ts` |
| 4. La cotización toma las cantidades revisadas con el precio vigente, se numera, no se publica sin precios, se publica congelada (cambiar la lista después no la toca; la base no deja modificarla) con su PDF, y su envío sale como cotización | Hecho: `servidor/pruebas/cotizaciones.test.ts` y `envios.test.ts` |
| 5. Extremo a extremo: administración pone el precio, el técnico anota el material, oficina revisa, crea la cotización, agrega mano de obra, elige AIU, publica y descarga el PDF, y el contacto de compras la recibe | Hecho en Chromium y WebKit (`e2e/pruebas/cotizaciones.spec.ts`) |
| 6. Lo anterior sigue igual | Hecho el 2026-09-27: tipos, arquitectura, licencias y auditoría en verde; dominio 103, protocolo 18, oficina 6, campo 80, servidor 134; extremo a extremo 40 y 3 omitidas en Chromium y WebKit (la de cotizaciones falló una vez en WebKit porque el nombre del PDF llega en forma NFD, como en macOS; la prueba ahora lo normaliza); campo sigue en 119,9 de 120 KB |
| 7. Desplegada en el entorno de pruebas | Hecho el 2026-09-27: el worker en `SUCCESS` (con `cotizaciones.generarPdf`) antes que la app; campo (que aplicó `0026` y `0027`), oficina y portal en `SUCCESS` y salud en 200. Contra el entorno, `cotizaciones.spec` e `informe-al-cliente.spec` en verde en Chromium, con el correo de la cotización saliendo por Resend |

### Decisiones tomadas al construirlo

- **Puede haber más de una cotización por visita** (alternativas); la hoja de "Nueva cotización" dice cuáles ya tiene.
- **El borrador guarda la cantidad y el precio de cada línea;** la versión publicada guarda además sus totales calculados, así el PDF y la lista no recalculan.
- **En pantallas de menos de 1600 px, los totales y la publicación van debajo de las líneas,** en dos columnas: la tabla de líneas no cabe al lado del panel a 1366 px.
- **Las pruebas del servidor de cotizaciones no procesan envíos:** la cola es compartida y el correo de la cotización se prueba en `envios.test.ts`.
- **Quitar una línea no pide confirmación:** se deshace con la notificación (DESIGN.md).

## Iteración 20 · Contactos del cliente e informe por correo y WhatsApp

**Estado:** construida el 2026-09-27 con los envíos simulados y verificada en local (ver "Terminado cuando"). Maquetas aprobadas por Kevin en el lienzo (página "v1.0 · Informe por correo y WhatsApp", "Sí, aprobadas"). Kevin eligió construir sin las cuentas externas: el correo y el WhatsApp reales esperan la clave de Resend y el número de prueba de Meta.

**Para qué:** que el informe publicado le llegue al cliente por correo y WhatsApp con el PDF adjunto (P17), y que oficina vea qué llegó y qué no.

### Alcance

- **Contactos del cliente (ADR-0028, parte 5):** el cliente tiene su pantalla (Clientes → el cliente) con sus contactos y sus sitios. Cada contacto: nombre, cargo, correo, celular y por qué canal recibe el informe. WhatsApp exige la autorización, que queda con quién de oficina la confirmó y cuándo; cambiar el celular la borra. La lista de clientes dice cuántos reciben el informe y avisa "Nadie".
- **Publicar con destinatarios:** el diálogo de publicar marca por omisión a todos los que reciben el informe; se puede desmarcar. Sin contactos, avisa que el informe solo quedará en el portal y lleva a agregarlos.
- **Envíos (módulo `envios`, ADR-0028):** una fila por contacto y canal, "En cola" al publicar; salen cuando el PDF queda listo, en la misma transacción que lo marca. Correo por Resend (HTTPS, idempotente, con el PDF adjunto y el enlace al portal); WhatsApp por la Cloud API de Meta con la plantilla `informe_publicado` y el PDF en el encabezado.
- **Estado de cada envío:** En cola, Enviado, Entregado y No llegó, con el motivo. Los eventos firmados de Resend (Svix) y de Meta (`X-Hub-Signature-256`) llegan a `/api/envios/eventos/correo` y `/api/envios/eventos/whatsapp`. Un rebote marca el correo del contacto. Lo que no llega avisa por push a quien lo pidió y se marca en la bandeja de Informes ("Envío sin entregar").
- **Volver a enviar y enviar a otro contacto** desde el panel "Envíos de la versión N"; el intento anterior se conserva. Una versión cuyo PDF no se pudo generar no se envía: se publica una nueva (revisión de seguridad 4c).
- **Retirar del portal** dice a quién ya le llegó una copia, porque no se recupera.
- **Proveedores simulados** (`ENVIOS_SIMULADOS=true`) en desarrollo, en el extremo a extremo y en el entorno de pruebas: aceptan todo menos las direcciones con "rebota" (y los celulares que terminan en 000). El servidor no arranca con simulados en producción.

### Fuera de la iteración 20

| Qué | Dónde se resuelve |
|---|---|
| Correo real en el entorno de pruebas: cuenta de Resend, dominio verificado, `RESEND_CLAVE_API`, `RESEND_SECRETO_EVENTOS`, `CORREO_REMITENTE`, `CORREO_RESPONDER_A` y la dirección de eventos registrada | Cuando Kevin entregue la cuenta: variables en el worker (clave) y en `oficina` (secreto de eventos), y `ENVIOS_SIMULADOS` fuera |
| WhatsApp real: número de prueba de Meta, plantilla `informe_publicado` aprobada, `WHATSAPP_TOKEN`, `WHATSAPP_NUMERO_ID`, `WHATSAPP_SECRETO_APP`, `WHATSAPP_TOKEN_VERIFICACION` | Igual que el correo; producción con la cuenta de WhatsApp Business de TEINS (R10) |
| Producción: dominio de TEINS y su cuenta de WhatsApp Business | Al transferir producción (ADR-0021) |
| Un envío que se acepta y no se reenvía si el worker cae justo después de que Meta lo aceptó (Meta no tiene llave de idempotencia) | Aceptado: el riesgo es un WhatsApp repetido, no uno perdido |
| `bajada.spec.ts` "permiso local vencido" falla contra el entorno de pruebas incluso sola (2 de 2): al recargar sin conexión, el service worker no sirve la página (`ERR_INTERNET_DISCONNECTED`). En local pasa. La iteración no toca campo; ya había fallado una vez en la iteración 19 | Investigar antes de la prueba en iPhone: si el service worker controla la primera carga en el entorno (precarga terminada antes de quedar sin señal) |
| La corrida completa contra el entorno choca con el límite de 5 inicios de sesión por minuto (QA-7) y falla en cualquier archivo | Correr contra el entorno de a un archivo con un minuto entre ellos, o subir el límite solo en pruebas con `INICIOS_DE_SESION_POR_MINUTO` |
| `informes.test.ts` ("planos verificados") falló una vez en la corrida completa del servidor y pasó al repetirla: otro archivo verificó el plano antes de publicar | Ya existía la carrera: aislar la cola de verificación por archivo si vuelve a fallar |

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Kevin aprueba las maquetas | Hecho el 2026-09-27 |
| 2. Contactos: se crean, cambian y quitan (sin borrar la fila, ADR-0009); WhatsApp exige la autorización y la registra; el técnico no los ve | Hecho: `servidor/pruebas/envios.test.ts` |
| 3. Los envíos esperan el PDF y salen con el adjunto, el asunto, las etiquetas y las variables de la plantilla; lo rechazado queda "No llegó" con su motivo, se marca en la bandeja y se vuelve a enviar | Hecho: `servidor/pruebas/envios.test.ts` |
| 4. Nadie envía a un contacto de otro cliente, por un canal que no recibe, ni una versión retirada | Hecho: `servidor/pruebas/envios.test.ts` |
| 5. Eventos: sin firma válida o viejos se rechazan; entregado, rebote (marca al contacto) y fallo de WhatsApp cambian el estado | Hecho: `servidor/pruebas/envios.test.ts` |
| 6. Extremo a extremo: contactos desde oficina, publicar con destinatarios, "No llegó" con su motivo, "Envío sin entregar" en la bandeja, corregir el correo y volver a enviar | Hecho en Chromium y WebKit (`e2e/pruebas/informe-al-cliente.spec.ts`) |
| 7. Lo anterior sigue igual | Hecho el 2026-09-27: tipos, arquitectura, licencias y auditoría en verde; dominio 95, protocolo 18, oficina 4, campo 80, servidor 127; extremo a extremo 37 y 3 omitidas en Chromium y WebKit; campo sigue en 119,9 de 120 KB (la iteración no toca campo) |
| 8. Desplegada en el entorno de pruebas, el worker antes que la app, con los envíos simulados | Hecho el 2026-09-27: `ENVIOS_SIMULADOS` aplicado con `railway config apply`; el worker en `SUCCESS` antes de subir la app; campo (que aplicó `0024` y `0025`), oficina y portal en `SUCCESS`, salud en 200 y el contrato nuevo publicado. Extremo a extremo contra el entorno en Chromium: `informe-al-cliente.spec` en verde. La corrida completa tuvo 8 fallas por el límite de 5 inicios de sesión por minuto (429 en el inicio de sesión); repetidas de a una, con un minuto entre ellas, pasaron 7. La octava, `bajada.spec` (permiso vencido), falla sola: ver "Fuera" |
| 9. Correo y WhatsApp reales en el entorno de pruebas | Correo hecho el 2026-09-27: clave de solo envío limitada a `deportur.tech` y dirección de eventos creadas con el CLI de Resend (Kevin guardó los secretos en Railway por tubería); `informe-al-cliente.spec` contra el entorno en verde, con los envíos saliendo por Resend y tres eventos firmados aceptados (204). WhatsApp en espera: el 2026-09-27 Kevin avisó un problema con su cuenta de Meta y pidió seguir con la iteración 21; mientras tanto sigue simulado |

### Decisiones tomadas al construirlo

- **Quitar un contacto no borra la fila:** la aplicación no borra en ninguna tabla de negocio (ADR-0009, prueba de plataforma). Se borran su correo, su celular y su autorización, y queda el nombre.
- **La auditoría de contactos enmascara el correo y el celular** (`a•••@cliente.example`, `•••0117`; revisión de seguridad 4d): la auditoría no se borra, así que con los datos completos quitar el contacto no los borraba de verdad (regla 18). El registro sigue mostrando cuál cambió. Los envíos anteriores sí conservan su destino completo, como constancia de a dónde salió cada copia (ADR-0028).
- **Los eventos se aceptan solo con el id del mensaje que dio el proveedor** (o antes de guardarlo): un evento firmado de otro mensaje no cambia un envío.
- **El panel muestra el último intento por contacto y canal:** uno que no llegó y se volvió a enviar ya no pide nada; el historial completo queda en la base.
- **Publicar confirma con el botón de peligro**, como dice `DESIGN.md` para lo que no se deshace (antes usaba el principal).
- **Sin la configuración de un canal, sus envíos quedan "No llegó: … no está configurado en este entorno":** oficina lo ve, nunca se pierde en silencio.
- **Mientras la plantilla de WhatsApp no esté aprobada, Meta rechaza el envío** y queda "No llegó" con su motivo (la maqueta decía "En cola"): así oficina sabe que no salió.
- **La simulación se elige por canal** (`ENVIOS_SIMULADOS`: `true`, `correo` o `whatsapp`): en el entorno de pruebas el correo sale de verdad por Resend con el dominio verificado de Kevin (`deportur.tech`, elegido por él para pruebas; producción irá con el de TEINS) mientras WhatsApp sigue simulado.
- **El extremo a extremo usa las direcciones de prueba de Resend** (`delivered@resend.dev`, `bounced@resend.dev`): con Resend real no dañan la reputación del dominio, y simulado `bounced@resend.dev` también se rechaza, así la misma prueba sirve en local y en el entorno.
- **El panel de envíos se vuelve a leer cada 10 s durante 10 minutos** después de enviar: la entrega o el rebote llegan por evento, no al enviar.
- **En las pruebas del servidor, solo el archivo que trae sus proveedores procesa `envios.enviar`:** la cola es compartida entre archivos, como con los avisos.

## Iteración 19 · Símbolos en el croquis

**Estado:** terminada el 2026-09-26, verificada en local y desplegada en el entorno de pruebas (el worker primero, después campo, oficina y portal; la biblioteca de prueba publicada; los 17 archivos del extremo a extremo en verde contra el entorno). Falta la prueba en iPhone. Maquetas aprobadas por Kevin en el lienzo (página "v0.9 · Símbolos en el croquis", "Si, aprobado").

**Para qué:** que el técnico ponga tableros, UPS, tomas, luminarias o racks con un toque, iguales en todos los croquis, en vez de dibujarlos.

### Alcance

- **Biblioteca como datos (ADR-0027):** por organización, publicada completa desde un archivo JSON (`publicar-simbolos`); lo que sale se retira, nunca se borra. Baja a la app 10 como el catálogo (cambio `simbolo`) y queda en el teléfono sin sellar (base local versión 6).
- **Símbolo:** trazado SVG en una caja de 100 × 100, relleno y sigla opcionales, nombre, categoría y código de catálogo opcional. El trazado se valida como geometría y nada más.
- **Editor:** "Símbolos" abajo a la derecha abre la biblioteca (buscar sin tildes, recientes de este teléfono y todo por categoría, sin textos de ayuda); el símbolo cae en el centro de lo que se ve, elegido con "Mover", y se mueve, gira, cambia de tamaño y duplica como las formas.
- **En el boceto se copia el dibujo** (versión 2 del documento, elemento `simbolo`): oficina y el PDF lo dibujan igual aunque la biblioteca cambie.
- **Biblioteca de prueba ficticia** de 21 símbolos (`simbolos-prueba.json`), que `sembrar` publica, hasta tener la de TEINS.

### Fuera de la iteración 19

| Qué | Dónde se resuelve |
|---|---|
| La lista real de símbolos de TEINS | Cuando TEINS la entregue: se publica con `publicar-simbolos`, sin tocar la app |
| Pantalla de oficina para crear o editar símbolos | Si TEINS cambia su biblioteca a menudo (ADR-0027, opción C) |
| Contar los símbolos como cantidades | Iteración 21 o después: el código de catálogo ya viaja en cada símbolo puesto |
| Sacar la validación del boceto del arranque de campo (2,3 KB) | Si el presupuesto no alcanza: campo quedó en 119,9 de 120 KB |
| `bajada.spec` falló una vez contra el entorno en la corrida completa y pasó sola; sin el detalle guardado. Sospecha: el límite de 5 inicios de sesión por minuto con la prueba anterior | Mirar con `repeticiones.spec`: correr la suite completa guardando los rastros de cada archivo |

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Kevin aprueba las maquetas | Hecho el 2026-09-26 |
| 2. Un símbolo y una biblioteca se validan; el trazado solo admite geometría; en el boceto se copia, se serializa y se dibuja | Hecho: `dominio/src/simbolos.test.ts` |
| 3. La biblioteca se publica, baja solo a la app 10 con su orden, un cambio la vuelve a mandar, lo que sale se retira y cada organización tiene la suya | Hecho: `servidor/pruebas/simbolos.test.ts` |
| 4. El teléfono la guarda, la busca, la agrupa y recuerda los recientes (también sin almacenamiento) | Hecho: `campo/src/simbolos.test.ts` y `repositorio.test.ts`; mover, girar y escalar un símbolo en `transformar.test.ts` |
| 5. Extremo a extremo: buscar y poner una UPS, duplicarla, verla en recientes, enviar; oficina y el PDF la dibujan | Hecho en Chromium y WebKit (`e2e/pruebas/simbolos.spec.ts`) |
| 6. Lo anterior sigue igual y el presupuesto de campo se respeta | Hecho: tipos, arquitectura, licencias y auditoría en verde; dominio 95, protocolo 18, oficina 4, campo 80, servidor 118; extremo a extremo 35 y 3 omitidas en Chromium y WebKit; campo 119,9 de 120 KB |
| 7. Desplegada en el entorno de pruebas, el worker antes que la app, con la biblioteca de prueba publicada | Hecho el 2026-09-26: el worker en `SUCCESS` antes de subir la app; campo (que aplicó `0022` y `0023` antes de arrancar), oficina y portal en `SUCCESS`, salud en 200 y el mismo JavaScript que en local; `publicar-simbolos` publicó los 21 de prueba; los 17 archivos del extremo a extremo contra el entorno en Chromium, 19 pruebas en verde (`bajada.spec` falló una vez en la corrida y pasó al repetirla sola; ver "Fuera") |
| 8. Probada en el iPhone | Pendiente: fase 19 de [`verificacion-manual.md`](verificacion-manual.md) |

### Decisiones tomadas al construirlo

- **La clave del símbolo es la organización y su id:** el archivo trae los ids, así que dos organizaciones pueden publicar la misma biblioteca.
- **Quitar un símbolo del medio vuelve a mandar los que siguen:** su orden cambió, y el orden es el de la pantalla. Son pocos bytes.
- **El símbolo cae del mismo tamaño en pantalla a cualquier acercamiento** (96 px), dentro de los límites de tamaño.
- **La biblioteca no abre el teclado:** el foco queda en el diálogo (`focoEnElDialogo`); lo normal es tocar un símbolo, no buscarlo.
- **Los símbolos los lee la captura y se los pasa al editor:** leerlos desde el editor partía el JavaScript inicial de campo en seis archivos y lo subía a 120,5 KB.

## Iteración 18 · Croquis a pantalla completa, con hojas

**Estado:** terminada el 2026-09-26, verificada en local y desplegada en el entorno de pruebas (el worker primero, después campo, oficina y portal; los 16 archivos del extremo a extremo en verde contra el entorno). Falta la prueba en iPhone. Maquetas aprobadas por Kevin en el lienzo (página "v0.8 · Croquis a pantalla completa", "Esoo, muchísimo mejor") después de dos rondas: la primera propuesta (página "v0.7", editor con la hoja apaisada y las herramientas en cuadrícula) le pareció pequeña, y la segunda (herramientas en un desplegable con su explicación) todavía gastaba espacio. Pidió el estilo de Notas de iOS y GoodNotes, con capturas de GoodNotes.

**Para qué:** croquis limpios y grandes: la hoja llena el teléfono, los trazos se enderezan, las paredes se miden y cada piso va en su hoja con nombre.

### Alcance

- **Editor a pantalla completa (ADR-0026, parte 4):** una sola barra de iconos arriba (volver, deshacer y rehacer; Trazo, Cota, Texto, Mover y Borrador) y la hoja en todo lo demás; abajo, la pastilla con la hoja en que se está. Sin textos de ayuda: se enseñan al operario.
- **Enderezar:** medio segundo con el dedo quieto al terminar; un anillo lo anuncia. Línea, pared en L o en U, triángulo, rectángulo, círculo o elipse; se ajusta a 0°, 45° y 90° y pega los extremos a los de otras paredes.
- **Cota** con su medida escrita; **Mover** con giro de a 15°, tamaño, "Duplicar" y "Quitar"; **Texto** y **Borrador** como antes. La herramienta "Línea" salió: la recta es un trazo enderezado.
- **Hojas:** verticales y del alto de la pantalla donde se crean; hasta 12 por boceto, cada una con nombre (se pide al crearla). Dos dedos a lo ancho pasan de hoja y, después de la última, agregan una; el menú de la pastilla va a una hoja, agrega, cambia el nombre y quita.
- **Documento versión 2** (`{ hojas: [{ nombre, ancho, alto, elementos }] }`) con `polilinea`, `elipse` y `cota`; la versión 1 sigue igual (las firmas la usan) y un boceto viejo se abre como hoja apaisada. App 9.
- **Captura, oficina y PDF:** las hojas de a dos, con su nombre si hay varias; en la captura, tocar una abre esa hoja.

### Fuera de la iteración 18

| Qué | Dónde se resuelve |
|---|---|
| Símbolos (tablero, UPS, tomas) | Iteración 19, sobre esta misma barra y documento |
| Flecha, colores y grosores | Si TEINS los pide: el croquis es en blanco y negro para el PDF |
| Ver la hoja de otro piso atenuada debajo | Si los técnicos la piden; ningún plano de TEINS lo requiere hoy |
| Deshacer con toques de varios dedos | No: se disparan por accidente e iOS ya los usa |
| `repeticiones.spec` falla a veces en WebKit en la corrida completa (esperando "Piso 3" tras corregir en oficina); pasa sola y repetida | Investigar antes de la iteración 19: ya falló en las iteraciones 17 y 18 |

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Kevin aprueba las maquetas | Hecho el 2026-09-26, en la tercera ronda |
| 2. Documento versión 2 con hojas y formas; la versión 1 y las firmas siguen igual | Hecho: `dominio/src/boceto.test.ts` (versión 2: hojas, tamaños, límites, canónica, SVG) y `firma.test.ts` |
| 3. El worker verifica la versión 2 y oficina la recibe igual; el PDF pone cada hoja con su nombre | Hecho: `servidor/pruebas/bocetos.test.ts` |
| 4. Enderezar, transformar y encajar la hoja, sin interfaz | Hecho: `campo/src/dibujo/enderezar.test.ts`, `transformar.test.ts` y `vista.test.ts` |
| 5. Extremo a extremo: enderezar, cota, mover y duplicar, dos hojas con nombre (en Chromium, pasando de hoja con dos dedos), la captura abre una hoja, oficina y el PDF | Hecho en Chromium y WebKit (`e2e/pruebas/croquis.spec.ts` y `bocetos.spec.ts`) |
| 6. Lo anterior sigue igual y el presupuesto de campo se respeta | Hecho: tipos, arquitectura, licencias y auditoría en verde; dominio 90, protocolo 18, oficina 4, campo 74, servidor 115; extremo a extremo 32 y 3 omitidas en Chromium y WebKit, con una falla intermitente de `repeticiones.spec` en WebKit que pasa sola (ver "Fuera"); campo 119,0 de 120 KB |
| 7. Desplegada en el entorno de pruebas, el servidor antes que la app | Hecho el 2026-09-26: el worker en `SUCCESS` antes de subir la app; campo, oficina y portal en `SUCCESS`, salud en 200 y el mismo JavaScript que en local; los 16 archivos del extremo a extremo contra el entorno en Chromium, 18 pruebas en verde |
| 8. Probada en el iPhone | Pendiente: fase 18 de [`verificacion-manual.md`](verificacion-manual.md) |

### Decisiones tomadas al construirlo

- **Las hojas van dentro del documento, no un archivo por hoja:** el valor del campo, su validación y la revisión no cambiaron, y ningún teléfono tenía todavía bocetos de la versión 2 (ADR-0026, parte 3).
- **La hoja toma la forma de la pantalla donde se crea** (`altoDeHoja`): una forma fija dejaba bandas vacías arriba y abajo. En otra pantalla se encaja con un margen.
- **Las maquetas ahora dibujan la barra de estado y la raya de inicio del iPhone:** sin ellas, el espacio vacío parecía mayor de lo real.
- **Deshacer guarda la hoja en que se estaba:** deshacer un cambio de otra hoja vuelve a ella.
- **El gesto de volver del iPhone se bloquea sobre la hoja** (a 24 px del borde): la hoja llega al borde y un trazo desde ahí no debe sacar al técnico de la captura.
- **La validación de las hojas viaja con el arranque de campo:** la base local lee los bocetos al abrir la captura. 117,4 → 119,0 de 120 KB; la iteración 19 debe cargar sus símbolos con el editor, aparte.
- **El guardado ya no se anuncia en pantalla:** "Guardado en este teléfono" queda para el lector de pantalla; un error sí se muestra, arriba de la hoja.

## Iteración 17 · Catálogo en el teléfono

**Estado:** terminada el 2026-09-26, verificada en local y desplegada en el entorno de pruebas (los cuatro servicios, la migración del catálogo aplicada y los 15 archivos del extremo a extremo en verde contra el entorno). Falta la prueba en iPhone. Maquetas aprobadas por Kevin en el lienzo (página "v0.6 · Catálogo en el teléfono", "yeah, i aprove").

**Para qué:** que el técnico elija los materiales del catálogo al anotar cantidades, sin conexión, y que esas líneas lleguen a oficina ya vinculadas: menos escritura en campo, descripciones iguales entre técnicos y la base de la cotización (iteración 21).

### Alcance

- **Bajada (ADR-0025):** cambio `item_catalogo` para toda la organización (código, descripción, unidad y si está activo; sin precio), solo a la app 8 o posterior. El catálogo registra cada ítem creado, editado o importado; una migración registra los que ya existían.
- **Línea de cantidad:** puede llevar `item` (el id del ítem) además de su texto. Al recibirla, el servidor la proyecta vinculada a nombre del técnico si el ítem existe; si no, sin vínculo y sin rechazar el envío. La regla 6 del modelo de dominio cambió: el técnico elige, oficina confirma, cambia o completa.
- **Campo (app 8, base local versión 5):** "Del catálogo" abre la búsqueda (sin tildes ni mayúsculas, por comienzo de palabra o por código) con "Los que más usas"; elegir agrega la línea con descripción y unidad fijas y "Del catálogo · código". Lo que no está se agrega como línea libre con lo escrito. Sin ítems que sirvan para el campo, solo "Agregar línea".
- **Oficina:** "Elegido en campo" bajo el vínculo que eligió el técnico; corregir la tabla conserva el ítem de cada línea.

### Fuera de la iteración 17

| Qué | Dónde se resuelve |
|---|---|
| Catálogo real de TEINS y sus columnas de Excel | Cuando TEINS responda P28 y P29; se prueba con ítems ficticios |
| Precios en el teléfono | Nunca en la línea (regla 7); la cotización es de oficina (iteración 21) |
| Contar los símbolos de un boceto como cantidades | Iteración 19, si los símbolos llevan código de catálogo |

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Kevin aprueba las maquetas | Hecho el 2026-09-26 |
| 2. El catálogo baja solo a la app 8, sin precio; uno desactivado baja inactivo; otra organización no lo ve | Hecho: `servidor/pruebas/catalogo-en-campo.test.ts` |
| 3. La línea elegida llega vinculada a nombre del técnico; un ítem desconocido no rechaza el envío; oficina lo cambia | Hecho: `catalogo-en-campo.test.ts` y `cantidades.test.ts` |
| 4. Búsqueda y "los que más usas" sin conexión, solo con ítems activos y unidades del campo | Hecho: `campo/src/catalogo.test.ts` y `repositorio.test.ts` (catálogo en la bajada) |
| 5. Extremo a extremo: oficina crea el ítem, el técnico lo busca y lo elige, agrega una línea libre desde la búsqueda y oficina ve "Elegido en campo" | Hecho en Chromium y WebKit (`e2e/pruebas/catalogo-campo.spec.ts`) |
| 6. Lo anterior sigue igual y el presupuesto de campo se respeta | Hecho: tipos, arquitectura, licencias y auditoría en verde; dominio 82, protocolo 18, oficina 4, campo 58, servidor 114; extremo a extremo 31 y 3 omitidas (Chromium y WebKit); campo 117,4 de 120 KB |
| 7. Desplegada en el entorno de pruebas | Hecho el 2026-09-26: los cuatro servicios en `SUCCESS`, salud en 200, `campo` aplicó la migración `0021` antes de arrancar y los 15 archivos del extremo a extremo contra el entorno en Chromium, 17 pruebas en verde |
| 8. Probada en el iPhone | Pendiente: fase 17 de [`verificacion-manual.md`](verificacion-manual.md) |

### Decisiones tomadas al construirlo

- **La línea conserva su texto aunque venga del catálogo:** se lee igual en el PDF, en oficina y en una app sin catálogo, aunque el ítem cambie después.
- **El vínculo se decide al recibir, contra el catálogo del servidor:** un teléfono con el catálogo de ayer puede elegir un ítem que ya no existe; la línea entra sin vínculo y oficina la vincula como siempre.
- **"Elegido en campo" es `vinculada_por` = el técnico:** cuando oficina lo cambia, deja de decirlo. No hizo falta otra columna.
- **"Los que más usas" se cuenta en el teléfono,** de las líneas de ese técnico, al abrir la búsqueda. No se sube nada nuevo.
- **La hoja de búsqueda va dentro de la captura, no como carga aparte:** cargada aparte desde la captura, el empaquetador partió el JavaScript inicial en cinco archivos y subió de 117,4 a 119,2 KB; la captura ya se carga aparte, así que la hoja no pesa en el arranque (117,4 KB).
- **El catálogo no se sella en el teléfono:** es la lista de materiales de la organización, como los formatos (ADR-0022 sella lo del cliente).
- **La prueba de extremo a extremo de cantidades acepta "Agregar línea" o "Línea libre":** el catálogo es de la organización y las corridas lo comparten, así que el botón depende de si ya hay ítems.

## Iteración 16 · Firma del cliente

**Estado:** terminada el 2026-09-26, verificada en local y desplegada en el entorno de pruebas (los cuatro servicios, el formato de prueba v7 sembrado y los 14 archivos del extremo a extremo en verde contra el entorno). Falta la prueba en iPhone. Maquetas aprobadas por Kevin en el lienzo (página "v0.5 · Firma del cliente", "Yeah i liked it").

**Para qué:** que quien recibe la visita firme en el teléfono del técnico una constancia de que estuvo en el sitio, que llegue a oficina y al PDF del cliente, sin papel. Certifica la visita, no el contenido técnico (Kevin, 2026-09-26; ADR-0024).

### Alcance

- **Dominio y contrato:** tipo de campo `firma` con `declaracion` opcional (`{tecnico}`, `{sitio}`, `{fecha}`); valor `{ firma: huella, nombre, cargo?, firmadoEn, declaracion }`; validación (`firma_invalida`), no corregible por oficina, exige `appMinima` 7. Formato de prueba v7 con "Cierre de la visita".
- **Campo (app 7):** "Pedir la firma" abre la constancia a pantalla completa (nombre, cargo opcional, recuadro para firmar con dedo o lápiz, "Borrar" y "Firmar"); firmada, se ve con quién y cuándo, y "Volver a firmar" pide confirmar. Los trazos se guardan como un boceto y suben al enviar.
- **Oficina:** la firma en la revisión, con quién, cuándo, en el teléfono de qué técnico y la constancia; se comenta, no se corrige.
- **PDF:** "Constancia de visita" con lo que se leyó, la firma recortada, el nombre, el cargo y la hora.

### Fuera de la iteración 16

| Qué | Dónde se resuelve |
|---|---|
| Firma de quien responde por el informe en TEINS (el marcador `[FIRMA]` del PDF) | Cuando TEINS responda P23 |
| Documento de identidad de quien firma | Solo si TEINS lo pide (regla 18, datos mínimos) |
| Firma digital con certificado | ADR-0024, "Cuándo revisarla" |

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Kevin aprueba las maquetas | Hecho el 2026-09-26 |
| 2. Una firma válida se envía y una incompleta o con datos de más se rechaza; oficina no la corrige | Hecho: `dominio/src/firma.test.ts` (8 pruebas) y `servidor/pruebas/firmas.test.ts` |
| 3. Los trazos se guardan en el teléfono, volver a firmar los reemplaza y suben al enviar | Hecho: `campo/src/datos/repositorio.test.ts` |
| 4. El PDF muestra la constancia; sin firma, el dato como cualquier otro | Hecho: `firmas.test.ts` |
| 5. Extremo a extremo: firmar en el teléfono, enviar y verla en oficina sin poder corregirla | Hecho en Chromium y WebKit (`e2e/pruebas/firma.spec.ts`) |
| 6. Lo anterior sigue igual y el presupuesto de campo se respeta | Hecho: tipos, arquitectura, licencias y auditoría en verde; dominio 81, protocolo 18, oficina 4, campo 52, servidor 112; extremo a extremo 28 y 3 omitidas en Chromium y WebKit (ver la nota de `repeticiones.spec.ts` abajo); campo 117,4 de 120 KB |
| 7. Desplegada en el entorno de pruebas | Hecho el 2026-09-26: los cuatro servicios en `SUCCESS`, salud en 200, `sembrar` publicó el formato v7 y los 14 archivos del extremo a extremo contra el entorno en Chromium, 16 pruebas en verde |
| 8. Probada en el iPhone | Pendiente: fase 16 de [`verificacion-manual.md`](verificacion-manual.md) |

### Decisiones tomadas al construirlo

- **La firma es un documento de boceto:** el mismo archivo, la misma subida al enviar, la misma verificación en el worker y el mismo dibujo. Por eso el recuadro es 4:3 (el lienzo de la versión 1); se muestra recortado a los trazos, sin cuadrícula (`Firma` de `ui` y `firmaASvg` para el PDF).
- **La constancia se llena en el teléfono y se guarda ya llena:** el PDF muestra lo que se leyó, aunque después cambie el nombre del sitio o el formato. El texto por defecto no nombra a la organización (R7); el del formato de prueba sí dice "de TEINS", porque es un dato del formato.
- **La pantalla de la firma trata de usted:** la lee el cliente, no el técnico (el resto de campo tutea).
- **Los errores se dicen al tocar "Firmar"** ("Escriba su nombre.", "Firme en el recuadro."), como en los formularios de oficina; "Firmar" no se deshabilita, porque un botón gris no explica qué falta.
- **La firma en el formato de prueba v7 es opcional:** así los demás recorridos de extremo a extremo no tienen que firmar; `firmas.test.ts` prueba la obligatoria.
- **El contorno de los trazos pasó a `campo/src/dibujo/trazo.ts`,** que usan el editor de bocetos y la firma: los dos se cargan aparte y comparten ese fragmento.
- **En el extremo a extremo en WebKit (iPhone 13) el recuadro queda bajo el pliegue:** la prueba se desplaza hasta él, como la persona.
- **Observado el 2026-09-26:** en la corrida completa, justo después de las pruebas de integración, `repeticiones.spec.ts` en Chromium agotó su tiempo una vez (1,5 minutos). No se reprodujo: 3 de 3 sola y 16 de 16 en la corrida completa de Chromium siguiente. Se vigila como el caso de `envio.spec.ts` del 2026-09-25; la integración continua reintenta una vez.

## Iteración 15 · Avisos push e instalación guiada

**Estado:** terminada el 2026-09-26, verificada en local y desplegada en el entorno de pruebas (los cuatro servicios; extremo a extremo contra el entorno en Chromium, 13 archivos y 15 pruebas en verde). Falta la prueba en iPhone. Maquetas aprobadas en el lienzo (página "v0.4 · Avisos e instalación").

**Para qué:** que el técnico sepa de una visita nueva, cambiada o cancelada, de un comentario o de una revisión sin abrir la app, y que oficina sepa de un levantamiento nuevo con la pestaña cerrada. En iPhone los avisos exigen la app instalada, así que la instalación guiada (pendiente desde la iteración 14) entra aquí.

### Alcance

- **Módulo `avisos` en el servidor (ADR-0023):** suscripciones por persona y dispositivo; un trabajo por suscripción, encolado en la misma transacción del hecho que avisa; envío con VAPID; la suscripción que el servicio de avisos da por muerta (404 o 410) se borra; desactivar o restablecer a una persona borra las suyas (QA-5).
- **Qué se avisa:** al técnico, visita asignada, reprogramada, cancelada o pasada a otra persona, comentario de oficina y levantamiento revisado; a oficina (quien lo active), levantamiento nuevo. El texto nunca lleva datos del cliente: se ve con el teléfono bloqueado (R5).
- **Campo:** el service worker generado importa un manejador de avisos; tarjeta "Avisos en este teléfono" bajo la siguiente visita; estado de los avisos en el diagnóstico; al cerrar sesión o borrar por revocación se quita la suscripción.
- **Instalación guiada:** en un teléfono sin la app instalada, antes de iniciar sesión, los pasos de iPhone o el botón de Android; "Seguir en Safari" o "Seguir en el navegador" deja continuar.
- **Oficina:** service worker solo de avisos (sin caché, sigue siendo una app en línea) y la sección "Avisos en este navegador" en Mi cuenta.

### Fuera de la iteración 15

| Qué | Dónde se resuelve |
|---|---|
| Avisos de envíos al cliente que fallan | Iteración 20 |
| Abrir el levantamiento o la visita exacta al tocar el aviso | Se abre el inicio de cada superficie, que ya muestra lo nuevo primero; se revisa si la prueba con técnicos lo pide |
| Preferencias por tipo de aviso | Cuando alguien pida apagar uno solo; hoy son pocos y todos piden una acción |
| Quitar la suscripción del navegador al ejecutar la orden de borrado | No hace falta: desactivar ya borró las suscripciones en el servidor, así que no llega ningún aviso |

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Kevin aprueba las maquetas en el lienzo antes de programar | Hecho el 2026-09-26 ("i like the hierarchy"), con un cambio: la app se llama "TEINS" en los avisos y bajo el ícono |
| 2. Cada hecho avisa a quien corresponde, en la transacción del hecho, y un hecho revertido no avisa | Hecho: `servidor/pruebas/avisos.test.ts` (visita asignada, reprogramada, cancelada y reasignada; comentario, revisado y levantamiento nuevo; una reasignación rechazada no avisa; otra organización no recibe nada) |
| 3. Ningún aviso lleva datos del cliente | Hecho: la misma prueba busca el nombre del cliente y del sitio en todo lo enviado |
| 4. Solo se aceptan servicios de avisos conocidos, por https y desde una superficie propia | Hecho: `avisos.test.ts` (dirección interna, host desconocido, http y origen ajeno rechazados) |
| 5. Suscripciones muertas se borran; desactivar o restablecer a una persona apaga sus avisos; 5xx reintenta | Hecho: `avisos.test.ts` (410, 400, 503, desactivar, restablecer, teléfono compartido) |
| 6. Cada envío va cifrado y firmado con VAPID | Hecho: `avisos.test.ts` con las opciones reales del enviador |
| 7. Campo guía la instalación antes de iniciar sesión; el técnico activa los avisos y oficina en su navegador | Hecho: `e2e/pruebas/avisos.spec.ts` (guía en Chromium y WebKit; activar en Chromium con el servicio de avisos simulado en el navegador) |
| 8. Lo anterior sigue igual y el presupuesto de campo se respeta | Hecho: tipos, arquitectura, licencias y auditoría en verde; dominio 73, protocolo 18, oficina 4, campo 51, servidor 108; extremo a extremo 27 y 3 omitidas (Chromium y WebKit); campo 117,0 de 120 KB |
| 9. Desplegada en el entorno de pruebas | Hecho el 2026-09-26: claves VAPID generadas sin mostrarlas y guardadas en el `worker`; `railway config apply` (la pública por referencia en `campo` y `oficina`, el contacto en el `worker`) y el plan sin diferencias después; los cuatro servicios en `SUCCESS`, salud en 200 y los 13 archivos del extremo a extremo contra el entorno en verde |
| 10. Probada en el iPhone: instalar, activar y recibir una visita nueva con el teléfono bloqueado | Pendiente: fase 15 de [`verificacion-manual.md`](verificacion-manual.md) |

### Decisiones tomadas al construirlo

- **Avisos a personas y envíos al cliente en módulos distintos:** el plan hablaba de un solo módulo de mensajería, pero las suscripciones son de personas con sesión (se revocan con ellas) y los contactos del cliente tendrán otro ciclo (autorización de WhatsApp, rebotes de correo). Lo que comparten, el trabajo encolado en la transacción del hecho, ya lo da la cola (ADR-0012). `envios` llega en la iteración 20.
- **Un trabajo por suscripción, con el texto armado al encolar:** si un teléfono falla, su reintento no repite el aviso en los demás; el trabajo no necesita leer otros módulos.
- **`tag` y `Topic`:** un segundo aviso de la misma visita reemplaza al primero en el teléfono y en el servicio de avisos si todavía no se entregó.
- **El aviso abre el inicio de la superficie, tomado del origen desde el que se suscribió** (la operación recibe ahora la cabecera `Origin`, que el servidor ya valida): sin variables nuevas por superficie.
- **El nombre del técnico se lee antes de la transacción del envío:** leído adentro pedía una segunda conexión mientras la primera esperaba, y la prueba de diez envíos simultáneos agotó el pool.
- **Campo conserva el service worker generado** y le suma el manejador con `importScripts`; pasar a `injectManifest` habría obligado a escribir a mano la caché que hoy da `vite-plugin-pwa`.
- **Sin instalar, el recordatorio del inicio habla de los avisos y abre la misma guía;** la tarjeta de avisos no aparece (en la maqueta era otro estado de la tarjeta: decía lo mismo dos veces).
- **"Seguir en Safari" y "Ahora no" se recuerdan en `localStorage`,** por teléfono, como la propuesta de la llave de acceso: son comodidades, no datos del negocio.
- **En el extremo a extremo el servicio de avisos se simula en el navegador** (permiso y `PushManager`): no hay servicio de avisos en las pruebas ni worker corriendo. La entrega real se prueba en el servidor y en el iPhone.
- **La clave pública del extremo a extremo vive en `playwright.config.ts`:** no es un secreto; la privada no existe ahí.

## Iteración 14 · Interfaz con la dirección Consola

**Estado:** terminada el 2026-09-26, verificada en local (verificación completa en el orden de la integración continua, en verde) y desplegada en el entorno de pruebas (`campo`, `oficina`, `portal` y `worker`; extremo a extremo en Chromium contra el entorno, 13 de 13). Falta la prueba en iPhone.

**Para qué:** Kevin encontró la interfaz "básica y fea": botones de tamaños distintos, confirmaciones metidas en filas, resultados que aparecían lejos de la acción (el QR de un acceso salía arriba de la tabla), lo creado se perdía en el orden alfabético y no había diálogos, menús ni notificaciones. Se auditó el código pantalla por pantalla, se investigó cómo resuelven lo mismo Google, Microsoft, Apple, AWS, GitHub, Shopify e IBM (segundo factor, credenciales que se muestran una vez, QR, confirmaciones, creación, tablas, formularios de campo), se compararon tres direcciones en el lienzo (página "v0.3 · Direcciones") y Kevin eligió la A, Consola, con dos reglas: la jerarquía (el título es la sección del menú; las subsecciones, pestañas) y que todo lo que se muestra esté justificado.

### Alcance

- **`DESIGN.md` reescrito:** la regla de justificación, la jerarquía, los tokens de Consola, cuándo usar cada componente, qué se confirma y qué se deshace, crear en hoja lateral y lo nuevo primero y resaltado, lo que se entrega una sola vez y el flujo del segundo factor.
- **`paquetes/ui`:** juego de componentes nuevo (botones con variantes, tamaños, icono y estado de carga; diálogo sobre `<dialog>` centrado, lateral e inferior; confirmación; notificaciones; tabla; menú de acciones sobre el popover del navegador; encabezado de pantalla; insignias; estado vacío; esqueletos; búsqueda; copiar; visor de fotos) e iconos de Lucide. `Marquilla` se retiró.
- **Oficina:** menú lateral con iconos y la cuenta de lo que espera revisión; cada pantalla con su encabezado; tablas con "Más acciones"; crear y editar en hoja lateral con errores por campo; confirmaciones en diálogo; credenciales en un diálogo que no se cierra por accidente; segundo factor en pasos numerados con los códigos de respaldo después de verificar; revisión e informe en dos columnas con el panel de acción fijo; aviso al salir del informe con cambios sin guardar.
- **Campo:** barra superior con el estado de sincronización; la siguiente visita como tarjeta focal; barra de envío fija con lo que falta y resumen con enlaces; confirmaciones en hoja inferior; fotos a pantalla completa que se quitan con deshacer (`quitarFoto`); sin la línea "Datos de prueba" que se habría visto en producción; diagnóstico plegado.
- **Portal:** ingreso y lista de informes en la dirección nueva, sin el marcador `[LOGO]` a la vista del cliente.
- **Servidor:** el PDF se descarga como archivo con un nombre legible (`Content-Disposition: attachment`), en oficina y en el portal; "Revisados" va del más reciente al más antiguo; en Administración, los usuarios activos primero.
- **Columna "Visita" en la bandeja:** cada levantamiento dice de qué cliente y sitio es sin abrirlo. El resumen del levantamiento en `protocolo` trae la visita (nula para los de antes de las visitas); el servidor la lee por la interfaz del módulo de visitas (`resumenes`), en una consulta por página.

### Fuera de la iteración 14

| Qué | Dónde se resuelve |
|---|---|
| Nombre del formato en la bandeja (hoy muestra la clave) | `docs/diseno/pendientes.md` |
| Las demás pantallas de Consola en el lienzo, para revisarlas con TEINS | `docs/diseno/pendientes.md` |
| Borrar del almacenamiento una foto que ya había subido y el técnico quitó antes de enviar | Tarea de limpieza del worker, cuando el volumen lo justifique: hoy queda huérfana y no se entrega |
| Instalación guiada de la PWA en iPhone | Siguiente en código mientras TEINS responde |

### Terminado cuando

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

### Decisiones tomadas al construirlo

- **Componentes propios sobre el navegador, sin shadcn ni Radix:** `<dialog>` da el foco atrapado, el velo, Esc y el fondo inerte; el popover da los menús encima de todo, sin que una tabla con desplazamiento los recorte. Cero dependencias nuevas salvo Lucide, y el movimiento sigue en CSS (regla 10).
- **El amarillo dejó de pintar botones:** la acción principal va en el azul de la marca; el amarillo marca el foco y lo recién creado. Con un solo acento, el amarillo sigue llamando la atención donde importa.
- **El borde de los campos de texto es más oscuro que el de los botones** (`borde-control`, 3:1): el campo no tiene otra forma de verse, el botón tiene su texto.
- **Los avisos llevan el texto en negro y el tono en el icono:** el texto de color sobre fondo teñido no llegaba a 7:1.
- **Una acción principal por fila, el resto en "Más acciones":** los botones con el nombre del cliente o del usuario en cada fila (que variaban de ancho) pasaron a un texto corto con el nombre accesible completo, así las pruebas y el lector de pantalla siguen encontrando cada uno.
- **La captura de campo se carga aparte:** el juego de componentes nuevo llevaba el JavaScript inicial a 124 KB; con la captura fuera del arranque quedó en 116 KB (el service worker la guarda igual y abre sin conexión). `ui` declara `sideEffects` para que cada superficie empaquete solo lo que usa.
- **Quitar una foto borra el archivo solo si nada más lo usa:** las fotos se direccionan por contenido, así que otro campo u otro levantamiento pueden compartirla. Una subida en curso de la foto quitada termina sin efecto.
- **Las visitas siguen en orden de fecha al programar una nueva:** la agenda es cronológica, así que la nueva se resalta y se lleva a la vista en su lugar en vez de subir al principio; clientes, usuarios e ítems nuevos sí van primero.
