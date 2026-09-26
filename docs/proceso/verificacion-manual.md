# Verificación manual de todas las fases

Recorrido completo, a mano, de lo construido en los cortes 0 a 5 y las iteraciones 6 a 8. Las pruebas automáticas ya cubren la lógica; esto confirma lo que solo una persona con un teléfono real puede confirmar: que la app instalada en iPhone sobrevive sin señal, que las pantallas se entienden y que todo el recorrido funciona de punta a punta.

**Todo se hace en el entorno de pruebas** (datos ficticios, R5). Producción solo se toca en la fase 8, sin crear datos.

Tiempo total: unas 2 horas y media, que se pueden repartir en varias sesiones siguiendo el orden de las fases.

## Antes de empezar

| Qué | Dónde |
|---|---|
| iPhone con Safari, cargado y con señal | El teléfono de campo |
| Computador con Chrome o Safari | Para oficina |
| App autenticadora en el iPhone (Google Authenticator o Microsoft Authenticator, gratis) | Para el segundo factor de la fase 6 |
| Contraseñas de `tecnico.prueba`, `oficina.prueba` y `tecnico.revocable` | `privado/entorno-de-pruebas.txt` en el computador de Kevin |

Direcciones del entorno de pruebas:

| Superficie | Dirección |
|---|---|
| Campo (iPhone) | https://campo-production-2642.up.railway.app |
| Oficina (computador) | https://oficina-production-d24f.up.railway.app |
| Portal del cliente | https://portal-production-d5d9.up.railway.app |

Anote lo que observe en cada paso marcado con **Anotar**. Si algo no se ve como dice "Debe", anote qué se vio, en qué paso y, si puede, tome una captura (sin datos reales).

---

## Fase 1 · Instalación y captura sin conexión (cortes 0 y 1)

Prueba lo más riesgoso del sistema: que Safari no borre lo capturado sin señal (QA-1).

1. En el iPhone, Safari → dirección de campo → botón Compartir → **Agregar a inicio**. Cierre Safari y abra la app **desde el ícono**, no desde Safari.
2. Inicie sesión con `tecnico.prueba`.
   - Debe: aparecer "Mis visitas" con "Cliente de prueba" en el bloque azul "Siguiente visita".
3. Baje al final de la pantalla, al diagnóstico.
   - **Anotar:** si dice "Persistente" sí o no, y el espacio usado.
4. Active el **modo avión**. Toque **Iniciar levantamiento**. Llene potencia y descripción y tome 3 o 4 fotos con la cámara.
   - Debe: guardar cada dato sin señal y mostrar las fotos.
5. Toque **Volver a mis visitas**.
   - Debe: la visita dice "Continuar levantamiento".
6. Cierre la app desde el selector de apps. **Reinicie el iPhone.** Ábrala de nuevo, todavía en modo avión.
   - Debe: el borrador y sus fotos siguen ahí.
7. En el diagnóstico, toque **Verificar fotos**.
   - Debe: todas íntegras, cero perdidas.
   - **Anotar:** modelo de iPhone, versión de iOS, fotos tomadas, fotos íntegras.
8. Sin señal, abra el levantamiento y toque **Enviar a oficina** → **Confirmar envío**.
   - Debe: en "Mis visitas", bajo la visita, la fila del levantamiento dice "Sin conexión: se enviará al recuperar señal".
9. Quite el modo avión y vuelva a la app.
   - Debe: en menos de un minuto, "Recibido en oficina".
10. En el computador, abra oficina e inicie sesión con `oficina.prueba`.
    - Debe: el levantamiento está en "Esperando revisión", con sus fotos nítidas.

## Fase 2 · Bajada y revocación (corte 2)

1. En el iPhone, **Cerrar sesión**. Entre con `tecnico.revocable`.
   - Debe: aparecer su visita "Cliente revocación".
2. Inicie un levantamiento en esa visita y escriba algo, sin enviarlo.
3. En el computador, en oficina con `oficina.prueba`, vaya a **Administración** (si pide activar el segundo factor, haga primero los pasos 1 a 4 de la fase 6 y vuelva).
4. En "Usuarios", toque **Desactivar a Técnico revocable** → **Sí, desactivar a Técnico revocable**.
5. En el iPhone, **sin cerrar sesión**, salga de la app y vuelva a abrirla, con señal.
   - Debe: aparecer "Se cerró el acceso de Técnico revocable en este teléfono y se borraron sus datos".
   - Si antes cerró sesión, ese aviso no sale, pero el borrado ocurre igual (el paso 7 lo confirma). Y si intenta entrar con `tecnico.revocable`, dice "Usuario o contraseña incorrectos": es a propósito, para no revelar que la cuenta existe.
6. Entre de nuevo con `tecnico.prueba`.
   - Debe: su levantamiento enviado en la fase 1 sigue ahí. El borrado solo afectó al usuario revocado.
7. En oficina, pestaña "Teléfonos de campo".
   - Debe: el iPhone aparece para los dos técnicos; el de Técnico revocable, con "Datos borrados el …".

## Fase 3 · Revisión en oficina (corte 3)

1. En oficina, abra el levantamiento de la fase 1 y toque **Tomar para revisar**.
2. En un dato de texto o medida, toque **Corregir …**, cambie el valor, escriba el motivo y toque **Guardar corrección**.
3. En otro dato, toque **Comentar …**, escriba un comentario para el técnico y toque **Enviar comentario**.
4. Mire el historial del levantamiento.
   - Debe: aparecen "Tomó la revisión", "Corrigió" (con el valor anterior y el nuevo) y "Comentó", y el sello **Historial íntegro**.
5. En el iPhone (con `tecnico.prueba`), abra la app con señal.
   - Debe: el levantamiento dice "En revisión en oficina" y avisa que hay comentarios; al abrirlo, se lee el comentario.
6. En oficina, toque **Marcar revisado**.
7. En el iPhone, vuelva a abrir la app.
   - Debe: "Revisado por oficina".
8. Opcional, concurrencia (QA-25): abra el mismo levantamiento en dos ventanas de oficina e intente corregir el mismo dato en las dos.
   - Debe: la segunda recibe un aviso de que otra persona guardó antes, y nada se pisa.

## Fase 4 · Informe y PDF (corte 4)

1. En oficina, en el levantamiento revisado, toque **Abrir el informe de esta visita**.
2. Marque el levantamiento para incluirlo, escriba una introducción y unas conclusiones y toque **Guardar borrador**.
3. En "Agregar planos en PDF", suba un PDF cualquiera que no tenga información real.
4. Toque **Publicar versión 1** → **Sí, publicar la versión 1**.
   - Debe: "Generando el PDF…" y, en menos de un minuto, **Descargar PDF de la versión 1**.
5. Descargue el PDF y ábralo.
   - Debe: estar la visita, la introducción, los datos del levantamiento con la corrección de la fase 3, las fotos, las conclusiones y, al final, el plano anexo. Cada página con su pie.
   - **Anotar:** si algo del PDF se ve mal (fuentes, fotos cortadas, orden). Esto se ajustará con los informes reales de TEINS (P22, P23, P26).
6. Cambie algo del borrador y publique la **versión 2**.
   - Debe: la versión 1 sigue descargable e igual; la 2 queda como vigente.

## Fase 5 · Visitas y clientes (iteración 7)

1. En oficina, **Clientes**: cree un cliente ficticio con su sitio y dirección.
   - Debe: aparecer en la lista con su sitio.
2. **Visitas** → **Programar visita**: elija ese cliente, fecha de hoy, motivo "Mantenimiento" y marque a Técnico de prueba. Toque **Programar la visita**.
   - Debe: aparecer en "Próximas" con "Hoy".
3. En el iPhone (`tecnico.prueba`), abra la app con señal.
   - Debe: aparecer la visita nueva.
4. En oficina, toque **Reprogramar la visita de …**, póngale la fecha de mañana y guarde. En el iPhone, cierre y abra la app.
   - Debe: la visita dice "Mañana".
5. En el iPhone, inicie un levantamiento en esa visita y escriba algo, sin enviarlo.
6. En oficina, toque **Cancelar la visita de …**, escriba el motivo y confirme.
   - Debe: la visita pasa a la pestaña "Canceladas" con su motivo.
7. En el iPhone, cierre y abra la app.
   - Debe: la visita sigue en el bloque azul solo por el borrador, con el aviso "Oficina canceló esta visita. Puedes terminar y enviar lo que ya empezaste", y con "Continuar levantamiento" pero sin "Iniciar levantamiento".
   - La cancelación no aparece en el historial del levantamiento: es de la visita, no del levantamiento. Se ve en oficina, **Visitas → Canceladas**, con quién la canceló, cuándo y por qué.
8. Envíe ese levantamiento.
   - Debe: llegar a oficina, y la visita cancelada lo cuenta en su avance.

## Fase 6 · Administración con segundo factor (iteración 6)

1. En oficina con `oficina.prueba`, abra **Administración**.
   - Debe: pedir activar el segundo factor.
2. Escriba su contraseña y toque **Empezar la activación**.
3. Escanee el QR con la app autenticadora del iPhone. **Guarde los códigos de respaldo** (en `privado/`, no en el repositorio).
4. Escriba los 6 dígitos que muestra la app y toque **Confirmar y activar**.
   - Debe: aparecer las pestañas Usuarios, Teléfonos de campo y Accesos de clientes.
5. **Cerrar sesión** y vuelva a entrar con `oficina.prueba`.
   - Debe: después de la contraseña, pedir el código. Pruebe primero uno equivocado (debe rechazarlo) y después el correcto.
6. En "Usuarios", cree un técnico ficticio.
   - Debe: mostrar su contraseña temporal una sola vez, en el bloque azul, hasta **Ya la entregué**.
7. Entre con ese técnico en el iPhone (cierre la sesión de `tecnico.prueba` antes).
   - Debe: entrar. Después vuelva a `tecnico.prueba`.
8. En "Accesos de clientes", cree el acceso del cliente de la fase 4 ("Cliente de prueba"); si ya tiene uno de pruebas anteriores, use **Regenerar el acceso**.
   - Debe: mostrar la clave y el QR una sola vez. **No cierre ese bloque todavía**: se usa en la fase 7.

## Fase 7 · Portal del cliente (corte 5)

1. Con la **cámara del iPhone**, escanee el QR que quedó en la pantalla de oficina.
   - Debe: abrir el portal con el código de acceso ya puesto ("Código de acceso tomado del QR").
2. Escriba una clave equivocada y toque **Ver mis informes**.
   - Debe: "El código de acceso o la clave no son correctos".
3. Escriba la clave correcta.
   - Debe: ver "Informes de Cliente de prueba" con la versión vigente (la 2 de la fase 4).
4. Descargue el PDF en el iPhone.
   - Debe: abrirse y ser el mismo que descargó oficina.
5. En oficina, en el informe, toque **Retirar la versión 2 del portal**, escriba el motivo y confirme.
6. En el portal del iPhone, recargue.
   - Debe: ver la versión 1. Si retira también la 1, el informe desaparece del portal.
7. En oficina, en "Accesos de clientes", **Regenerar el acceso** de ese cliente. En el iPhone, recargue el portal.
   - Debe: volver a pedir la clave, con el aviso "Su sesión se cerró: pasaron 30 minutos sin usarla o TEINS le entregó una clave nueva". La clave anterior ya no entra; la nueva sí.

## Fase 8 · Producción (iteración 8)

Aquí **no se crean datos**: producción queda limpia hasta transferirla a TEINS (ADR-0021).

1. En el computador, abra la oficina de producción: https://oficina-production-9584.up.railway.app
2. Entre con `administracion` y la contraseña de `privado/teins-produccion.txt`.
3. Abra **Administración** y active el segundo factor (como en la fase 6, con otra entrada en la app autenticadora). Guarde sus códigos de respaldo en `privado/`.
   - Debe: ver las pestañas y, en Usuarios, solo "Administración TEINS".
4. Al día siguiente, compruebe que el respaldo corrió solo, desde la raíz del repositorio:

   ```sh
   railway link --project teins-produccion
   railway logs --service respaldos      # debe terminar en "respaldo …: listo"
   railway link --project teins-pruebas  # deje enlazado pruebas
   ```

5. Opcional: repita el simulacro (`docs/proceso/produccion.md`, sección "Simulacro").

## Fase 9 · Secciones repetibles (iteración 9)

Necesita la app 4: si campo avisa "Hay una versión nueva de la app", acéptela primero.

1. En oficina, programe una visita para hoy a Técnico de prueba (fase 5, paso 2).
2. En el iPhone (`tecnico.prueba`), inicie el levantamiento de esa visita. Debajo del cuarto técnico aparece la sección **Tableros**, con "Todavía no hay ninguno".
3. Toque **Agregar tablero** dos veces. Llene en cada uno la ubicación y la corriente, y tómele una foto a uno.
   - Debe: "Tablero 1" y "Tablero 2", cada uno con sus campos.
4. Cambie el nombre del primero a "Tablero principal". Agregue un tercero y quítelo (**Quitar Tablero 3** → **Sí, quitar Tablero 3**).
   - Debe: quedan dos, con los nombres que puso.
5. Complete la potencia y las fotos del equipo y envíe.
6. En oficina, abra el levantamiento.
   - Debe: "Tableros · Tablero principal" y "Tableros · Tablero 2", cada uno con sus datos y su foto.
7. Tómelo, corrija la ubicación del Tablero 2 y mire el historial.
   - Debe: "Tableros · Tablero 2 · Ubicación del tablero: … → …".
8. Opcional: márquelo revisado, publique el informe y abra el PDF.
   - Debe: los dos tableros con su nombre, en orden.

## Fase 10 · Bocetos (iteración 10)

Necesita la app 5: si campo avisa "Hay una versión nueva de la app", acéptela primero.

1. Inicie un levantamiento (fase 9, pasos 1 y 2). Al final del cuarto técnico está **Croquis del cuarto**, con "Todavía no hay boceto".
2. Toque **Dibujar boceto**. Se abre la hoja cuadriculada a pantalla completa.
3. Dibuje con el dedo unos trazos. Elija **Línea** y trace una pared. Elija **Texto**, toque la hoja, escriba "Tablero" y toque **Poner texto**.
   - Debe: el trazo sigue el dedo sin retraso; la línea sale recta; el texto queda donde tocó.
4. Pruebe **Deshacer** y **Rehacer**, y el **Borrador** tocando un trazo.
5. Con dos dedos, acerque y mueva la hoja; toque **Ver la hoja completa**.
   - Debe: el zoom no dibuja nada por accidente.
6. Toque **Listo**. En el formulario aparece la miniatura y el botón cambia a **Editar boceto**.
7. Cierre la app desde el selector, ábrala de nuevo y abra el levantamiento.
   - Debe: el boceto sigue ahí.
8. Envíe y, en oficina, abra el levantamiento.
   - Debe: el croquis, nítido, con el texto "Tablero".
9. Si hay un iPad con lápiz: dibuje con el lápiz apoyando la palma en la pantalla.
   - Debe: la palma no deja trazos y el lápiz cambia el grosor con la presión.

**Anotar:** si el trazo se siente lento o se corta, y en qué pantalla.

## Fase 11 · Cantidades con catálogo (iteración 11)

Necesita la app 6: si campo avisa "Hay una versión nueva de la app", acéptela primero. Datos ficticios (R5): nada de la lista real de TEINS en el entorno de pruebas.

1. En el computador, arme en Excel una hoja con las columnas **Código**, **Descripción** y **Unidad** y dos o tres filas inventadas (por ejemplo `C-12 · Cable 12 AWG · m`). Guárdela como **CSV (delimitado por comas)**.
2. En oficina, **Catálogo** → **Elegir archivo CSV** → el archivo.
   - Debe: "N ítems listos para importar" y, al importar, "Importado: N ítems nuevos y 0 actualizados". Los ítems aparecen en la lista y la búsqueda los encuentra.
3. En el teléfono, inicie un levantamiento (fase 9, pasos 1 y 2). Al final del cuarto técnico está **Materiales**, con "Todavía no hay líneas".
4. Toque **Agregar línea** dos veces. Escriba una descripción en cada una, una cantidad con coma ("25,5") y elija la unidad. Quite una tercera línea con **Quitar la línea 3**.
   - Debe: el teclado de la cantidad es numérico con coma.
5. Envíe y, en oficina, abra el levantamiento y tómelo.
   - Debe: la tabla Materiales con la columna **Catálogo**, cada línea con una lista para elegir el ítem.
6. Vincule una línea a un ítem. Corrija la otra con **Corregir materiales** (cambie la cantidad) y guarde.
   - Debe: el historial dice "vinculó al catálogo “…”: sin vincular → C-12" y la corrección "materiales: 2 líneas → 2 líneas"; el vínculo sigue ahí después de corregir.
7. Márquelo revisado. En **Visitas**, en la visita, **Exportar las cantidades** → **Descargar el detalle (CSV)** y **Descargar el resumen (CSV)**. Abra los dos en Excel.
   - Debe: Excel abre las columnas separadas, con tildes y coma decimal; el resumen suma por código del catálogo.
8. Opcional: publique el informe y abra el PDF.
   - Debe: la tabla de materiales con coma decimal.

**Anotar:** si las columnas de Excel no son las que usa TEINS (P29): son supuestas mientras responden.

## Fase 12 · Cifrado local (iteración 12)

Hágala **antes de aceptar la actualización**, con un borrador a medias y al menos una foto: es lo que prueba que la actualización no pierde nada.

1. Con la app todavía en la versión anterior, deje un borrador con texto y dos fotos, sin enviar.
2. Acepte "Hay una versión nueva de la app". Abra Inicio y baje al diagnóstico.
   - Debe: **Datos cifrados: Todos** (si dice "Faltan N", espere unos segundos: se cifra en segundo plano).
3. Abra el borrador.
   - Debe: el texto y las dos fotos, iguales. Toque **Verificar fotos** en el diagnóstico: "Íntegras" igual a "Guardadas".
4. Escriba rápido en un campo de texto, salga y vuelva a entrar.
   - Debe: el texto completo, con la última letra.
5. Envíelo con señal.
   - Debe: "Recibido en oficina", y en oficina el texto y las fotos.
6. Repita la fase 2 (revocación) con `tecnico.revocable`.
   - Debe: lo mismo que en la fase 2: sus datos se borran y la pantalla de inicio de sesión lo explica.

**Anotar:** si capturar una foto se siente más lento que antes.

## Fase 13 · Llaves de acceso (iteración 13)

1. En el iPhone, entre a campo con `tecnico.prueba` y su contraseña.
   - Debe: en Inicio, "Entra sin escribir la contraseña" con **Crear llave de acceso**.
2. Toque **Crear llave de acceso** y confirme con Face ID.
   - Debe: "Listo. La próxima vez entra con…", y la propuesta desaparece.
3. **Cerrar sesión** → **Entrar con llave de acceso** → Face ID.
   - Debe: entra sin escribir nada y ve sus visitas.
4. En Ajustes → Contraseñas del iPhone, busque la llave.
   - Debe: aparece con el usuario `tecnico.prueba` y el dominio de campo.
5. En el computador, entre a oficina, toque su nombre en el encabezado (**Mi cuenta**) y **Crear llave de acceso** (con la huella o el rostro del computador, o con el iPhone por código QR).
6. **Cerrar sesión** → **Entrar con llave de acceso**.
   - Debe: entra sin contraseña.
7. En Administración, **Restablecer contraseña** de `tecnico.prueba` y anote la contraseña temporal en `privado/entorno-de-pruebas.txt` (reemplaza la anterior). En el iPhone, **Cerrar sesión** → **Entrar con llave de acceso**.
   - Debe: "Esa llave de acceso no sirve. Entra con tu usuario y contraseña."

**Anotar:** si el iPhone ofreció la llave sin tener que tocar el botón, o si el botón se ve fuera de lugar.

## Fase 15 · Instalación guiada y avisos (iteración 15)

Antes: en el iPhone, borre TEINS de la pantalla de inicio si ya estaba (los datos de la app instalada se borran con ella; envíe antes lo pendiente).

1. En Safari, abra campo.
   - Debe: "Instala la app" antes de iniciar sesión, con el aviso de que lo capturado en Safari no pasa a la app instalada y tres pasos.
2. Siga los pasos (Compartir, "Agregar a inicio") y abra TEINS desde el ícono.
   - Debe: el ícono dice "TEINS"; la app abre en pantalla completa, en el inicio de sesión, sin la guía.
3. Entre con `tecnico.prueba`.
   - Debe: bajo la siguiente visita, "Avisos en este teléfono" con **Activar avisos** y **Ahora no**.
4. Toque **Activar avisos** y permita en la pregunta del iPhone.
   - Debe: "Avisos activados en este teléfono." y la tarjeta desaparece. En el diagnóstico, "Avisos: Activos".
5. Bloquee el iPhone. En el computador, en oficina, programe una visita para `tecnico.prueba`.
   - Debe: en menos de un minuto, en la pantalla bloqueada, "Visita nueva · Para el …", sin el nombre del cliente. Tocarlo abre TEINS y la visita aparece.
6. Reprograme esa visita y después cancélela.
   - Debe: "Visita reprogramada" y luego "Visita cancelada", el segundo reemplazando al primero.
7. En oficina, **Mi cuenta** → **Activar avisos** en el navegador. Desde el iPhone, envíe un levantamiento y cierre la pestaña de oficina.
   - Debe: el computador muestra "Levantamiento nuevo · Técnico … envió un levantamiento."
8. En Ajustes → Notificaciones → TEINS, desactive las notificaciones y abra el diagnóstico.
   - Debe: "Avisos: Bloqueados" y el camino para volver a permitirlos.

**Anotar:** cuánto tardó cada aviso, y si la guía de instalación coincide con lo que muestra Safari (el nombre de "Agregar a inicio" puede variar con la versión de iOS).

## Fase 16 · Firma del cliente (iteración 16)

1. En el iPhone, con la app actualizada (v7), inicie un levantamiento en la visita de hoy y vaya a "Cierre de la visita".
   - Debe: "Firma de quien recibe la visita" con **Pedir la firma**.
2. Toque **Pedir la firma**.
   - Debe: a pantalla completa, "Constancia de visita" con su nombre, el cliente y el sitio de la visita y la fecha de hoy.
3. Toque **Firmar** sin escribir nada.
   - Debe: "Escriba su nombre." y "Firme en el recuadro."
4. Escriba un nombre ficticio y un cargo, firme con el dedo y toque **Firmar**.
   - Debe: vuelve al levantamiento con la firma, "Nombre · Cargo" y "Firmó hoy a las …". El trazo sigue al dedo sin retraso.
5. Si hay una tableta con lápiz: firme con el lápiz apoyando la mano.
   - Debe: la palma no dibuja.
6. **Volver a firmar** → **Cancelar**: la firma sigue. Envíe el levantamiento.
7. En oficina, abra el levantamiento.
   - Debe: la firma, "Firmó el …, en el teléfono de …" y la constancia; hay **Comentar** pero no **Corregir**.
8. Márquelo revisado, publique el informe y descargue el PDF.
   - Debe: "Constancia de visita" con la firma nítida, recortada, el nombre, el cargo y la hora.

**Anotar:** si firmar en el recuadro se sintió estrecho, y si el texto de la constancia se lee bien de un vistazo.

## Fase 17 · Catálogo en el teléfono (iteración 17)

Antes: en oficina, en **Catálogo**, cree dos ítems ficticios con unidad `m` (por ejemplo "Cable de prueba uno" y "Cable de prueba dos").

1. En el iPhone, con la app 8, abra la app con señal un momento y después póngalo en modo avión.
2. Inicie un levantamiento y vaya a "Materiales".
   - Debe: **Del catálogo** y **Línea libre**.
3. **Del catálogo** → escriba "cable prueba".
   - Debe: los dos ítems, sin señal. Elija uno: la línea queda con la descripción fija, "Del catálogo · código" y la unidad `m`.
4. **Del catálogo** otra vez, sin escribir nada.
   - Debe: "Los que más usas" con el que ya eligió.
5. Escriba algo que no exista y toque **No está: agregar … como línea libre**.
   - Debe: una línea libre con ese texto.
6. Llene lo obligatorio, quite el modo avión y envíe. En oficina, abra el levantamiento.
   - Debe: la línea del catálogo vinculada con "Elegido en campo"; la libre, "Sin vincular".

**Anotar:** si la búsqueda se sintió lenta, y si el teclado tapaba los resultados.

## Al terminar

- Resultados del iPhone (fase 1, paso 7): en la tabla de resultados del corte 0 de `plan-de-entrega.md`.
- Todo lo que no se vio como "Debe": en una lista con fase, paso y lo que se vio. Con eso se abren los arreglos antes de seguir con campo (secciones repetibles y bocetos).
- Si todo pasó: los cortes 1, 2 y 3 dejan de decir "falta la prueba en iPhone" en el mapa del plan.
