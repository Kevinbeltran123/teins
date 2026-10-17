# Plan de entrega

Cortes verticales ordenados por riesgo (`forma-de-trabajo.md`). Cada corte termina completo: esquema en `protocolo`, endpoint, política, auditoría, pantalla, estados y pruebas. Lo que un corte deja fuera queda escrito en su archivo de historia, con el corte que lo resuelve.

Este archivo dice dónde va el proyecto. El detalle de cada corte o iteración (alcance, fuera, terminado cuando, decisiones tomadas al construirlo y lo que se anotó al cerrarla) está en [`historia/`](historia/README.md), un archivo por corte o grupo de iteraciones.

**Cómo se mantiene.** Al cerrar una iteración, aquí y en `historia/` se actualizan cuatro cosas (lo que toca en otros documentos está en [`../README.md`](../README.md), "Al cerrar una iteración"):

1. Su fila del mapa, con un estado corto y el enlace a su archivo.
2. "Estado actual": entornos y pendientes.
3. "Próximo paso": se reemplaza, no se acumula. El anterior pasa al archivo de su iteración, bajo "Al cerrarla".
4. Su archivo en `historia/` (`NN-slug.md`, con NN el número del primer corte o iteración) y su fila en [`historia/README.md`](historia/README.md).

## Estado actual

Al 2026-10-16.

**Entornos:**

- **Entorno de pruebas:** al día hasta la iteración 42, desplegada el 2026-10-15 con su tanda 5 ([`entorno-de-pruebas.md`](entorno-de-pruebas.md)).
- **Producción:** apagada desde el 2026-10-10 para no pasar el límite de USD 10 del mes; la base y la configuración siguen intactas. Cómo encenderla está en [`produccion.md`](produccion.md). Lo último desplegado allí son las iteraciones hasta la 41 (2026-10-06, migraciones hasta la `0038`). Sin datos reales ni formatos publicados hasta que TEINS entregue los suyos (ADR-0021). En el mapa, "En producción" quiere decir que entró en ese último despliegue.
- **Código:** todo `corte-0` se fusionó a `master` con el pull request #2 el 2026-10-16. `corte-0` sigue como rama de trabajo.

**Pendientes de Kevin:**

- Probar la iteración 42 en su iPhone (agregar y quitar tableros, volver a pasos ya capturados, materiales, croquis) y en oficina.
- Probar de la 38 a la 41; de la 39 a la 41, también en el iPhone (app de campo 15).
- Probar la 36 y la 37 en Mac y, si puede, en Windows.
- Probar la 27, la 28 y la 35, y aprobar la 23.
- La prueba en el iPhone de las iteraciones 9 a 19 (fases 9 a 19 de [`verificacion-manual.md`](verificacion-manual.md)), de «Terminar visita» (31), de los ajustes de campo (32) y de la firma (34). La fase 8 (producción) también quedó para después.

**Pendientes de TEINS:**

- Lista de precios, plantilla de la cotización (P29), tratamiento tributario y numeración.
- Sus formatos reales (P7, P8), su catálogo y columnas de Excel (P28) y la lista de símbolos.
- Respuestas para ajustar el informe (P22, P23, P26, formato de los planos) y las preguntas P2, P5, P9 y P40 a P43.
- Su cuenta en Railway, para transferirle producción (ADR-0021).
- WhatsApp sigue simulado y en espera: falta el número de prueba de Meta, y la cuenta de Meta de Kevin tiene un problema desde el 2026-09-27.

## Próximo paso

**Iteración 42 desplegada en el entorno de pruebas (2026-10-15).** Kevin encontró en producción que un tablero quitado se seguía pidiendo al enviar. La investigación lo reprodujo y encontró la misma familia de fallos en campo, oficina y servidor, todos arreglados (ADR-0045). Una quinta tanda cerró lo menor que dejaron las revisiones, y todo `corte-0` pasó a `master` con el pull request #2 el 2026-10-16, cuando la integración quedó en verde (el trabajo de WebKit no instalaba el Chromium con el que el worker imprime los PDF). Siguiente: que Kevin pruebe la 42 en su iPhone (agregar y quitar tableros, volver a pasos ya capturados, materiales, croquis) y en oficina. Después, producción cuando la vuelva a encender: respaldo antes, y `campo`, `oficina`, `portal` y `worker`, sin migración. Pendiente de antes: probar de la 38 a la 41 y lo que entregue TEINS.

El detalle de la iteración 42 está en [`historia/42-lo-que-se-ve-sale-de-lo-guardado.md`](historia/42-lo-que-se-ve-sale-de-lo-guardado.md).

## Mapa

| Corte | Entregable demostrable | Riesgo que cierra | Estado | Historia |
|---|---|---|---|---|
| 0 | Captura sin conexión con fotos, instalada en iPhone | Durabilidad de la PWA en Safari (QA-1, ADR-0002) | Terminado | [00-captura-sin-conexion](historia/00-captura-sin-conexion.md) |
| 1 | El técnico inicia sesión, envía el levantamiento y oficina lo ve en su bandeja | Entrega completa, sin duplicados y con archivos verificados (QA-2), idempotencia, aislamiento por organización | En producción; probado en iPhone | [01-envio-a-oficina](historia/01-envio-a-oficina.md) |
| 2 | Bajada: formatos como datos, visitas asignadas, estado de mis levantamientos, permiso de trabajo local, revocación con borrado | Punto de control seguro (ADR-0005), revocación sin conexión (QA-5), formatos sin publicar la app (QA-11) | En producción; probado en iPhone | [02-bajada](historia/02-bajada.md) |
| 3 | Revisión: tomar, corregir con trazabilidad por campo, comentar al técnico, marcar revisado | Concurrencia en oficina (QA-25), trazabilidad (QA-8) | En producción; probado en iPhone | [03-revision](historia/03-revision.md) |
| 4 | Informe: composición mínima, publicación inmutable y PDF | Versiones inmutables (QA-9), PDF reproducible en segundo plano (QA-17) | En producción, con supuestos de P22, P23 y P26 | [04-informe](historia/04-informe.md) |
| 5 | Portal: acceso con QR y clave, descarga del informe vigente | Cero accesos cruzados entre clientes (QA-4, QA-7) | En producción | [05-portal-del-cliente](historia/05-portal-del-cliente.md) |
| Iteración 6 | Administración con segundo factor: usuarios, teléfonos, accesos de clientes, retiro de versiones | Cuenta de mayor impacto protegida (ADR-0009), operar el piloto sin comandos | En producción | [06-administracion](historia/06-administracion.md) |
| Iteración 7 | Gestión de visitas y clientes desde oficina | Operar el piloto sin comandos; cambios de agenda que llegan solos a los teléfonos | En producción; probada en iPhone | [07-visitas-y-clientes](historia/07-visitas-y-clientes.md) |
| Iteración 8 | Producción provisional (transferible), respaldos diarios y simulacro | Copias probadas y entorno recreable antes del piloto (QA-10, QA-18) | Terminada; producción sin datos reales (ADR-0021) | [08-produccion-provisional](historia/08-produccion-provisional.md) |
| Iteración 9 | Secciones repetibles (pisos, áreas, tableros) | Formatos reales de TEINS como datos, no código (F2, QA-11) | En producción; falta iPhone | [09-secciones-repetibles](historia/09-secciones-repetibles.md) |
| Iteración 10 | Bocetos sobre cuadrícula (ADR-0019) | El croquis en papel pasa al teléfono, nítido en oficina y en el PDF (F3, P14) | En producción; falta iPhone | [10-bocetos](historia/10-bocetos.md) |
| Iteración 11 | Cantidades con catálogo y exportación a Excel | Los materiales anotados en campo no se vuelven a digitar para cotizar (F9, P27 a P29) | En producción; falta iPhone | [11-cantidades-con-catalogo](historia/11-cantidades-con-catalogo.md) |
| Iteración 12 | Cifrado local en campo (ADR-0022) | Un teléfono perdido no entrega datos de clientes y el borrado por revocación es instantáneo (QA-5, I-15) | En producción; falta iPhone | [12-cifrado-local](historia/12-cifrado-local.md) |
| Iteración 13 | Llaves de acceso (passkeys) | Entrar con Face ID, huella o PIN, sin contraseñas que se puedan suplantar (ADR-0009) | En producción; falta iPhone | [13-llaves-de-acceso](historia/13-llaves-de-acceso.md) |
| Iteración 14 | Interfaz rehecha con la dirección Consola (`DESIGN.md`) | Una herramienta que la gente quiera usar: jerarquía clara, confirmaciones donde hay consecuencias, resultados junto a la acción | En producción; falta iPhone | [14-interfaz-consola](historia/14-interfaz-consola.md) |
| Iteración 15 | Avisos push (técnicos y oficina) e instalación guiada de la app | El técnico se entera de su visita sin abrir la app; nadie captura en Safari lo que la app instalada no ve (ADR-0002) | En producción; falta iPhone | [15-avisos-push](historia/15-avisos-push.md) |
| Iteración 16 | Firma del cliente en sitio | Constancia de la visita firmada en el teléfono, íntegra (Ley 527) | En producción; falta iPhone | [16-firma-del-cliente](historia/16-firma-del-cliente.md) |
| Iteración 17 | Catálogo en el teléfono al anotar cantidades | Líneas que llegan vinculadas: menos digitación y cotización casi automática (P28) | En producción; falta iPhone | [17-catalogo-en-el-telefono](historia/17-catalogo-en-el-telefono.md) |
| Iteración 18 | Bocetos: pantalla completa, hojas con nombre, enderezar trazos, formas, mover, cotas | Croquis limpios y grandes, un piso por hoja (F3) | En producción; falta iPhone | [18-croquis-a-pantalla-completa](historia/18-croquis-a-pantalla-completa.md) |
| Iteración 19 | Biblioteca de símbolos en los bocetos | Tableros, UPS, tomas y demás con un toque, iguales en todo croquis | En producción; falta iPhone | [19-simbolos-en-el-croquis](historia/19-simbolos-en-el-croquis.md) |
| Iteración 20 | Contactos del cliente e informe por correo y WhatsApp | El informe le llega al cliente por donde lo espera, con PDF adjunto (P17) | En producción; WhatsApp simulado | [20-informe-por-correo-y-whatsapp](historia/20-informe-por-correo-y-whatsapp.md) |
| Iteración 21 | Cotizaciones desde las cantidades | De la visita a la cotización sin volver a digitar (P27, QA-12) | En producción; precios de prueba | [21-cotizaciones](historia/21-cotizaciones.md) |
| Iteración 22 | Campo rehecho con la dirección Recorrido (`DESIGN.md`) | Una app que los técnicos quieran usar: la captura sigue la visita paso a paso en vez de una lista interminable | En producción; aprobada en iPhone | [22-campo-recorrido](historia/22-campo-recorrido.md) |
| Iteración 23 | Oficina con la identidad Recorrido (`DESIGN.md`) | Oficina clara y sin recuadros: cada pantalla ordenada por lo que hace la persona, con búsqueda en las listas | En producción; falta que Kevin la apruebe | [23-oficina-recorrido](historia/23-oficina-recorrido.md) |
| Iteración 24 | Robustez y protección: nada se pierde ni se hace sin querer | Borradores que se borran solos, dobles envíos, errores invisibles y acciones con consecuencias sin confirmar | 24a a 24c en producción; 24d pasó a las iteraciones 25 a 28 | [24-robustez-y-proteccion](historia/24-robustez-y-proteccion.md) |
| Iteración 25 | Usuarios y cuenta propia (ADR-0033): contraseña temporal obligatoria, cambiar la propia, quitar el propio segundo factor, reactivar | Una contraseña temporal que se usa para siempre y nadie que pueda cambiar la suya | En producción | [25-usuarios-y-cuenta-propia](historia/25-usuarios-y-cuenta-propia.md) |
| Iteración 26 | Vista en vivo de los documentos (ADR-0031): la cotización, el informe, el capítulo en la revisión y lo que recibe cada contacto, al lado mientras se escribe | Oficina publica sin ver lo que recibe el cliente, y una versión publicada no se cambia | En producción; aprobada | [26-vista-en-vivo](historia/26-vista-en-vivo.md) |
| Iteración 27 | Flujos: View Transitions en campo y oficina, sin Motion; revisar en serie, el avance de publicar en su lugar, «Ver la siguiente visita» y notificaciones con su siguiente paso | Flujos que saltan, animan de más o terminan sin decir qué sigue | En producción; falta que Kevin la pruebe | [27-flujos](historia/27-flujos.md) |
| Iteración 28 | Datos que se corrigen (ADR-0034 y ADR-0035): cancelar un envío en cola, retirar una versión de cotización, editar y archivar clientes y sitios, corregir comentarios y descartar levantamientos en campo | Un error que no se puede corregir sin borrar historia o tocar lo publicado | En producción; falta que Kevin la pruebe | [28-datos-que-se-corrigen](historia/28-datos-que-se-corrigen.md) |
| Iteración 29 | Ajustes de oficina: formularios cortos en diálogo, Mi cuenta centrada, la cotización que no se corta, enviar solo a quien falta, nuevo cliente con su contacto, la revisión (materiales en tabla, informe legible, «Marcar revisado» arriba) y el fallo de «Regenerar acceso» | Formularios con media pantalla en blanco, una página que se corta al bajar y una clave regenerada que nunca se mostraba | En producción; aprobada | [29-ajustes-de-oficina-correo-y-horario](historia/29-ajustes-de-oficina-correo-y-horario.md) |
| Iteración 30 | El correo que escribe oficina (ADR-0036): asunto y texto editables al publicar y al enviar, sobre la vista previa del correo | El correo al cliente siempre igual, sin el toque de quien lo envía | En producción; aprobada | [29-ajustes-de-oficina-correo-y-horario](historia/29-ajustes-de-oficina-correo-y-horario.md) |
| Iteración 31 | Visitas con horario (ADR-0037): todo el día, de una hora a otra o hasta que el técnico la termine; solo técnicos libres al programar | Una visita ocupaba el día entero y se podía asignar a quien ya estaba ocupado | En producción; falta iPhone | [29-ajustes-de-oficina-correo-y-horario](historia/29-ajustes-de-oficina-correo-y-horario.md) |
| Iteración 32 | Ajustes de campo: movimiento más rápido y desde el borde, Tu cuenta en una lista, tableros en filas con su menú, el pie del catálogo, la barra del croquis, la entrega del teléfono al cliente, la constancia firmada, «Revisa y envía» con contenido y Enviados en dos líneas | Pantallas que se abrían de golpe, botones que confundían y una lista que se desbordaba con un error largo | En producción; falta iPhone | [32-ajustes-de-campo-y-epoca-de-la-bajada](historia/32-ajustes-de-campo-y-epoca-de-la-bajada.md) |
| Iteración 33 | Época de la bajada (ADR-0038): el teléfono se entera de que el servidor se dejó limpio | Después de limpiar un entorno, los teléfonos mostraban visitas y enviados que ya no existían hasta reinstalar la app | En producción | [32-ajustes-de-campo-y-epoca-de-la-bajada](historia/32-ajustes-de-campo-y-epoca-de-la-bajada.md) |
| Iteración 34 | Firma en una sola pantalla: la constancia, el nombre y el recuadro juntos | Una pantalla de bienvenida con media pantalla en blanco antes de poder firmar | En producción; falta iPhone | [34-firma-y-que-sale-en-el-informe](historia/34-firma-y-que-sale-en-el-informe.md) |
| Iteración 35 | Qué sale en el informe (ADR-0039): oficina oculta secciones, fotos y croquis; no salen por omisión el croquis de campo ni lo «solo para la empresa» | El cliente recibía las fotos de llegada y el croquis de campo, que son para la empresa | En producción; falta que Kevin la pruebe | [34-firma-y-que-sale-en-el-informe](historia/34-firma-y-que-sale-en-el-informe.md) |
| Iteración 36 | Usabilidad de oficina: la vista previa que se oculta, se amplía y cambia de ancho; el guardado automático; el menú plegable; lo que se recuerda de cada persona; ordenar arrastrando; atajos en Mac y Windows | Trabajo que se perdía sin «Guardar borrador», la hoja fija en la mitad, el menú siempre abierto y cada lista que volvía a empezar | En producción; falta que Kevin la pruebe | [36-usabilidad-de-oficina](historia/36-usabilidad-de-oficina.md) |
| Iteración 37 | Buscar en todo con ⌘K / Ctrl + K (recientes, acciones, secciones y resultados por grupo) y revisar en serie con el teclado (J, K, Enter, T, R, S, Esc y «?») | Cada lista buscaba solo lo suyo y revisar varios exigía ir y volver con el ratón | En producción; falta que Kevin la pruebe | [37-buscar-en-todo](historia/37-buscar-en-todo.md) |
| Iteración 38 | La revisión armada como el informe: datos a la izquierda; a la derecha, un panel a todo el alto con «En el informe», «Comentarios» e «Historial»; el estado en la barra | El capítulo en una caja de 520 px dentro de un carril de tarjetas | En producción; falta que Kevin la pruebe | [38-revision-al-lado-y-conversaciones](historia/38-revision-al-lado-y-conversaciones.md) |
| Iteración 39 | Conversaciones entre oficina y campo: el técnico responde los comentarios desde un chat en el teléfono, con o sin señal; oficina responde en hilos; «sin leer», avisos y «Leído» (ADR-0040) | El técnico no podía contestar un comentario; las aclaraciones iban por llamada o WhatsApp y no quedaban en el levantamiento | En producción; falta iPhone | [38-revision-al-lado-y-conversaciones](historia/38-revision-al-lado-y-conversaciones.md) |
| Iteración 40 | Lo atendido no es la siguiente visita (ADR-0041 y ADR-0042) | Una visita ya hecha seguía como «Siguiente visita» y se acumulaba en el teléfono | En producción; falta iPhone | [40-lo-atendido-no-es-la-siguiente-visita](historia/40-lo-atendido-no-es-la-siguiente-visita.md) |
| Iteración 41 | Nada queda a medias ni crece sin fin (ADR-0043 y ADR-0044): lo que espera la app nueva, la foto rechazada, el envío sin salida, los trabajos a medias, la retención de 30 días, la poda del servidor y el estado que no se actualizaba | Trabajo atascado para siempre, un teléfono que se llena y pantallas que no se enteran del paso del tiempo | En producción; falta iPhone | [41-nada-queda-a-medias](historia/41-nada-queda-a-medias.md) |
| Iteración 42 | Lo que se ve sale de lo guardado (ADR-0045): el tablero quitado que se seguía pidiendo, los pasos que volvían vacíos y borraban materiales, lo que llegaba tarde a un tablero quitado, el croquis grande, el envío rechazado que vuelve a borrador, y la misma familia en oficina y servidor | Un tablero quitado bloqueaba el envío, lo capturado se perdía al volver a un paso y oficina podía escribir un documento sobre otro | En pruebas y en `master`; falta iPhone | [42-lo-que-se-ve-sale-de-lo-guardado](historia/42-lo-que-se-ve-sale-de-lo-guardado.md) |

Con el corte 5 quedó completo el **recorrido delgado**. Desde ahí, cada iteración se eligió por riesgo, en el orden del mapa.
