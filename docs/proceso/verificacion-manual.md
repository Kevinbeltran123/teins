# Verificación manual de todas las fases

Recorrido completo, a mano, de lo construido en los cortes 0 a 5 y las iteraciones 6 a 44 (la fase N es la iteración N). No tienen fase propia: la 14 (cambió la interfaz), la 22, la 26, la 29 y la 30 (ya aprobadas; sus pantallas se recorren en las fases 20, 21, 32 y 38) y la 33 (solo se ve después de limpiar el entorno). Las pruebas automáticas ya cubren la lógica; esto confirma lo que solo una persona con un teléfono real puede confirmar: que la app instalada en iPhone sobrevive sin señal, que las pantallas se entienden y que todo el recorrido funciona de punta a punta.

**Todo se hace en el entorno de pruebas** (datos ficticios, R5). Producción solo se toca en la fase 8, sin crear datos.

Tiempo total: unas 2 horas y media hasta la fase 19 y unas 3 horas más de la 20 a la 44, que se pueden repartir en varias sesiones siguiendo el orden de las fases. Cada fase dice al empezar si se hace en el iPhone, en el computador o en los dos.

**Nombres de botones.** Las fases se escribieron con la interfaz de su momento; las iteraciones 22, 23, 32, 34, 36 y 38 rehicieron campo y oficina. Lo que se sabe que cambió ya está corregido abajo. Si un botón no aparece con el nombre que dice el paso, anote el que encontró.

## Antes de empezar

| Qué | Dónde |
|---|---|
| iPhone con Safari, cargado y con señal | El teléfono de campo |
| Computador con Chrome o Safari | Para oficina |
| App autenticadora en el iPhone (Google Authenticator o Microsoft Authenticator, gratis) | Para el segundo factor de la fase 6 |
| Contraseñas de `tecnico.prueba` y `oficina.prueba` | `privado/entorno-de-pruebas.txt` en el computador de Kevin |
| Un cliente con una visita de hoy y un técnico para revocar | Desde la limpieza del 2026-10-02 el entorno no los tiene: `sembrar` crea "Cliente de prueba" con una visita de hoy para `tecnico.prueba` ([`entorno-de-pruebas.md`](entorno-de-pruebas.md)); para la fase 2, cree en Administración el técnico `tecnico.revocable` y prográmele una visita ("Cliente revocación") como en la fase 5 |
| Direcciones de correo para los contactos de prueba | Las de prueba de Resend: `delivered@resend.dev` (llega) y `bounced@resend.dev` (rebota). Nunca un correo real (R5) |
| Un computador con Windows, si hay | Para los atajos de las fases 36 y 37 |

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
   - Debe: aparecer "Mis visitas" con "Cliente de prueba" como siguiente visita.
3. Abra **Tu cuenta** → **Diagnóstico del teléfono**.
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
8. Sin señal, abra el levantamiento y toque **Enviar a oficina** → **Enviar levantamiento**.
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
4. En "Usuarios", abra el menú de Técnico revocable → **Desactivar usuario** y confirme con **Desactivar usuario**.
5. En el iPhone, **sin cerrar sesión**, salga de la app y vuelva a abrirla, con señal.
   - Debe: aparecer "Se cerró el acceso de Técnico revocable en este teléfono y se borraron sus datos".
   - Si antes cerró sesión, ese aviso no sale, pero el borrado ocurre igual (el paso 7 lo confirma). Y si intenta entrar con `tecnico.revocable`, dice "Usuario o contraseña incorrectos": es a propósito, para no revelar que la cuenta existe.
6. Entre de nuevo con `tecnico.prueba`.
   - Debe: su levantamiento enviado en la fase 1 sigue ahí. El borrado solo afectó al usuario revocado.
7. En oficina, pestaña "Teléfonos de campo".
   - Debe: el iPhone aparece para los dos técnicos; el de Técnico revocable, con "Datos borrados".

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

1. En oficina, en el levantamiento revisado, toque **Abrir el informe**.
2. Marque el levantamiento para incluirlo y escriba una introducción y unas conclusiones.
   - Debe: se guarda solo; junto a «Publicar» dice «Guardado» (no hay «Guardar borrador»).
3. En "Agregar planos en PDF", suba un PDF cualquiera que no tenga información real.
4. Toque **Publicar versión 1** y confirme con **Publicar versión 1** (o **Publicar y enviar a N**, si el cliente tiene contactos).
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
   - Debe: la visita sigue como siguiente visita solo por el borrador, con el aviso "Oficina canceló esta visita. Puedes terminar y enviar lo que ya empezaste", y con "Continuar levantamiento" pero sin "Iniciar levantamiento".
   - La cancelación no aparece en el historial del levantamiento: es de la visita, no del levantamiento. Se ve en oficina, **Visitas → Canceladas**, con quién la canceló, cuándo y por qué.
8. Envíe ese levantamiento.
   - Debe: llegar a oficina, y la visita cancelada lo cuenta en su avance.

## Fase 6 · Administración con segundo factor (iteración 6)

1. En oficina con `oficina.prueba`, abra **Administración**.
   - Debe: pedir activar el segundo factor.
2. Escriba su contraseña y toque **Continuar**.
3. Escanee el QR con la app autenticadora del iPhone. **Guarde los códigos de respaldo** (en `privado/`, no en el repositorio).
4. Escriba los 6 dígitos que muestra la app y toque **Verificar y activar**.
   - Debe: aparecer las pestañas Usuarios, Teléfonos de campo y Accesos de clientes.
5. **Cerrar sesión** y vuelva a entrar con `oficina.prueba`.
   - Debe: después de la contraseña, pedir el código. Pruebe primero uno equivocado (debe rechazarlo) y después el correcto.
6. En "Usuarios", cree un técnico ficticio.
   - Debe: mostrar su contraseña temporal una sola vez, en un diálogo que no se cierra por accidente, hasta **Ya la entregué**.
7. Entre con ese técnico en el iPhone (cierre la sesión de `tecnico.prueba` antes).
   - Debe: entrar. Después vuelva a `tecnico.prueba`.
8. En "Accesos de clientes", cree el acceso del cliente de la fase 4 ("Cliente de prueba"); si ya tiene uno de pruebas anteriores, use **Regenerar acceso**.
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
5. En oficina, en el informe, toque **Retirar del portal** en la versión 2, escriba el motivo y confirme con **Retirar la versión 2**.
6. En el portal del iPhone, recargue.
   - Debe: ver la versión 1. Si retira también la 1, el informe desaparece del portal.
7. En oficina, en "Accesos de clientes", **Regenerar acceso** de ese cliente. En el iPhone, recargue el portal.
   - Debe: volver a pedir la clave, con el aviso "Su sesión se cerró: pasaron 30 minutos sin usarla o TEINS le entregó una clave nueva". La clave anterior ya no entra; la nueva sí.

## Fase 8 · Producción (iteración 8)

Aquí **no se crean datos**: producción queda limpia hasta transferirla a TEINS (ADR-0021). Si producción está apagada ([`plan-de-entrega.md`](plan-de-entrega.md), "Estado actual"), antes de esta fase hay que encenderla ([`produccion.md`](produccion.md)).

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
7. Márquelo revisado. En **Visitas**, en «Más acciones» de la visita, **Exportar cantidades** → **Descargar el detalle (CSV)** y **Descargar el resumen (CSV)**. Abra los dos en Excel.
   - Debe: Excel abre las columnas separadas, con tildes y coma decimal; el resumen suma por código del catálogo.
8. Opcional: publique el informe y abra el PDF.
   - Debe: la tabla de materiales con coma decimal.

**Anotar:** si las columnas de Excel no son las que usa TEINS (P29): son supuestas mientras responden.

## Fase 12 · Cifrado local (iteración 12)

Hágala **antes de aceptar la actualización**, con un borrador a medias y al menos una foto: es lo que prueba que la actualización no pierde nada.

1. Con la app todavía en la versión anterior, deje un borrador con texto y dos fotos, sin enviar.
2. Acepte "Hay una versión nueva de la app". Abra **Tu cuenta** → **Diagnóstico del teléfono**.
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

Desde la iteración 34 la constancia es una sola pantalla: los pasos 2 a 4 se ven como dice la fase 34.

1. En el iPhone, con la app actualizada (v7), inicie un levantamiento en la visita de hoy y vaya a "Cierre de la visita".
   - Debe: "Firma de quien recibe la visita" con **Entregar el teléfono**.
2. Toque **Entregar el teléfono**.
   - Debe: a pantalla completa, "Constancia de visita" con su nombre, el cliente y el sitio de la visita y la fecha de hoy.
3. Toque **Firmar** sin escribir nada.
   - Debe: "Escriba su nombre." y "Firme en el recuadro."
4. Escriba un nombre ficticio y un cargo, firme con el dedo y toque **Firmar**.
   - Debe: vuelve al levantamiento con la firma, "Nombre · Cargo" y "Firmó hoy a las …". El trazo sigue al dedo sin retraso.
5. Si hay una tableta con lápiz: firme con el lápiz apoyando la mano.
   - Debe: la palma no dibuja.
6. **Repetir** → **Cancelar**: la firma sigue. Envíe el levantamiento.
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

## Fase 18 · Croquis a pantalla completa, con hojas (iteración 18)

Con la app 9 instalada en el iPhone. Todo sin señal salvo el envío.

1. Inicie un levantamiento con croquis y toque **Dibujar boceto**.
   - Debe: la hoja cuadriculada en toda la pantalla; arriba, una sola barra de iconos (volver, deshacer, rehacer, trazo, cota, texto, mover, borrador); abajo, la pastilla "Hoja 1 1/1". Sin textos de ayuda.
2. Dibuje con el dedo, desde el borde izquierdo de la hoja hacia adentro.
   - Debe: el trazo sale; la app **no** vuelve a la captura.
3. Dibuje a mano un rectángulo y, al cerrarlo, deje el dedo quieto.
   - Debe: un anillo se llena y, al soltar, queda un rectángulo recto. Igual con una línea, una pared en L y un círculo. Sin dejar el dedo quieto, el trazo queda a mano.
4. **Cota**: trace una línea a lo largo de una pared y escriba "4,50 m".
   - Debe: la cota con topes y la medida sobre la línea, legible.
5. **Mover**: toque el rectángulo, arrástrelo, gírelo con el círculo y agrándelo con la esquina; **Duplicar** y **Quitar**.
   - Debe: todo con el dedo, sin que la página se desplace; **Deshacer** vuelve cada paso.
6. Con dos dedos, acerque y aleje; toque "200 %".
   - Debe: la hoja sigue a los dedos y "200 %" vuelve a la hoja completa.
7. Con la hoja completa, deslice dos dedos hacia la izquierda.
   - Debe: "Suelta para agregar la hoja 2"; al soltar, la hoja nueva y su nombre. Escriba "Segundo piso" y **Guardar**. Deslice dos dedos a la derecha: vuelve a la primera.
8. Toque la pastilla de abajo.
   - Debe: las dos hojas con miniatura, **Agregar hoja**, **Cambiar nombre** y **Quitar esta hoja**.
9. Vuelva a la captura.
   - Debe: las dos hojas con su nombre; tocar "Segundo piso" abre esa hoja.
10. Envíe. En oficina, abra el levantamiento; publique el informe y descargue el PDF.
    - Debe: las dos hojas con su nombre en oficina y en el PDF, de a dos por fila.

**Anotar:** si la barra de arriba se alcanza con una mano, si el medio segundo para enderezar se siente largo o corto, y si alguna vez un trazo se volvió forma sin querer.

## Fase 19 · Símbolos en el croquis (iteración 19)

Con la app 10 instalada y la biblioteca de prueba publicada en el entorno (`sembrar` la publica).

1. Abra la app con señal un momento y después póngala en modo avión.
2. Inicie un levantamiento, **Dibujar boceto** y toque **Símbolos** (abajo a la derecha).
   - Debe: la biblioteca por categoría (Energía, Datos, Obra), sin señal; el teclado **no** se abre solo.
3. Toque **UPS**.
   - Debe: la UPS en el centro de lo que ve, elegida, con **Mover** marcado. Arrástrela, gírela y agrándela; **Duplicar** deja otra.
4. Acerque con dos dedos y ponga un **Tomacorriente**.
   - Debe: se ve del mismo tamaño en pantalla que la UPS al ponerla; las líneas, igual de gruesas.
5. **Símbolos** otra vez y escriba "tom".
   - Debe: **Tomacorriente** y **Toma regulada**; y al borrar la búsqueda, **Recientes** con lo que acaba de poner.
6. Quite el modo avión, envíe y en oficina abra el levantamiento; publique el informe y descargue el PDF.
   - Debe: los símbolos iguales en oficina y en el PDF.

**Anotar:** qué símbolos faltan para los croquis de TEINS, y si el tamaño con que caen sirve o casi siempre hay que cambiarlo.

## Fase 20 · Informe por correo y WhatsApp (iteraciones 20 y 30)

Computador. En el entorno de pruebas el correo sale de verdad por Resend; WhatsApp está simulado y rechaza los celulares que terminan en 000.

1. En oficina, **Clientes** → "Cliente de prueba" → **Nuevo contacto**: nombre ficticio, correo `delivered@resend.dev`, recibe informes y cotizaciones por correo.
   - Debe: el contacto en la lista del cliente; en **Clientes**, la fila ya no dice "Nadie".
2. Agregue otro con `bounced@resend.dev` y un tercero solo por WhatsApp, con un celular inventado que termine en 000.
   - Debe: el de WhatsApp no se guarda sin marcar la autorización; guardado, dice "Lo confirmó … el …".
3. Revise un levantamiento de ese cliente y abra el informe (fases 3 y 4). En la pestaña **Correo** de la vista previa, escriba sobre el texto del correo.
   - Debe: lo escrito queda dentro del correo, con "Con su texto. Volver al texto de TEINS".
4. **Publicar versión N**, con los tres marcados → **Publicar y enviar a 3**.
   - Debe: en "Envíos de la versión N", los tres "En cola" hasta que el PDF está listo. Después, el primero "Entregado" con "· con su texto"; el rebotado y el de WhatsApp, **No llegó** con su motivo.
5. Abra **Informes**.
   - Debe: el informe con **Envío sin entregar**.
6. Cambie el correo del rebotado a `delivered@resend.dev` y, en el informe, toque **Volver a enviar** en su fila.
   - Debe: pasa a "Entregado".
7. Toque **Enviar a otro contacto**.
   - Debe: solo aparece el de WhatsApp, que no lo recibió; **Ver cómo llega** muestra al lado lo que recibe, y junto a los botones, "Lo enviado no se puede recuperar.".

## Fase 21 · Cotizaciones (iteración 21)

Computador, con `oficina.prueba` como administrador con segundo factor (fase 6). Precios inventados.

1. En **Catálogo**, toque **Solo sin precio (N)**. En "Cable de prueba uno" (fase 17), **Cambiar precio** a 12.000.
   - Debe: el precio en "Precio sin IVA" y la historia del ítem en el diálogo.
2. En el iPhone, en un levantamiento de "Cliente de prueba", agregue "Cable de prueba uno" con **Del catálogo** y una **Línea libre**, y envíe. En oficina, revíselo y **Marcar revisado**.
3. **Cotizaciones** → **Nueva cotización** → elija esa visita → **Crear cotización**.
   - Debe: las líneas salen de las cantidades revisadas; el cable con su precio; la línea libre sin precio, con el aviso junto a ella y `[Precio]` en la hoja de la derecha.
4. Ponga el precio de la línea libre. **Agregar línea** para la mano de obra. Quite una línea y toque **Deshacer**. Elija **AIU**.
   - Debe: la hoja cambia mientras escribe y destella lo que cambió; la línea quitada vuelve a su lugar; los totales en pesos, sin decimales.
5. Pestaña **Correo** de la hoja.
   - Debe: lo que recibe el contacto de la fase 20, con el asunto y el adjunto.
6. **Publicar versión 1** → **Publicar y enviar a 1**. Descargue el PDF.
   - Debe: el número `COT-<año>-<consecutivo>`, el PDF con el logo y el envío en "Entregado".

**Anotar:** si la cotización se parece a la que entrega TEINS hoy (P29).

## Fase 23 · Oficina, para aprobarla (iteración 23)

Computador. La 23 ordenó cada pantalla de oficina; la letra y los colores cambiaron después, con la base visual Precisión. Esta fase aprueba el orden.

1. Recorra el menú: Levantamientos, Visitas, Clientes, Catálogo, Informes, Cotizaciones y Administración.
   - Debe: el título es la sección y sus partes son pestañas; sin recuadros dentro de recuadros; se sabe qué hacer primero.
2. En cada lista, busque parte de un nombre, sin tildes ni mayúsculas.
   - Debe: filtra; en Levantamientos, por cliente, sitio, técnico o formato.
3. En Levantamientos, mire "Lleva esperando".
   - Debe: "Hoy", "Desde ayer" o "N días", en ámbar desde dos días.
4. En **Mi cuenta** → Tema, pruebe "Del sistema", "Claro" y "Oscuro".
   - Debe: todo legible en los tres.

**Anotar:** cada pantalla que se vea cargada o confusa. Si no hay ninguna, la 23 queda aprobada.

## Fase 24 · Nada se pierde ni se hace sin querer (iteración 24)

iPhone y computador.

1. En el iPhone, en un paso con fotos, abra una foto y toque **Eliminar foto**.
   - Debe: "Foto eliminada" con **Deshacer** encima del visor; tocarlo la devuelve.
2. Toque dos veces seguidas, rápido, **Iniciar levantamiento**.
   - Debe: se crea uno solo.
3. En oficina, abra un informe en dos pestañas. En una, **Mi cuenta** → **Cerrar sesión**. En la otra, escriba en la introducción.
   - Debe: "Su sesión venció" encima de la pantalla, sin cerrarla. Al entrar: "Sesión recuperada: lo que estaba haciendo sigue aquí", con lo escrito.

## Fase 25 · Usuarios y cuenta propia (iteración 25)

iPhone y computador.

1. En oficina, **Administración** → **Nuevo usuario**: un técnico ficticio. Anote la contraseña temporal en `privado/`.
2. En el iPhone, cierre sesión y entre con ese técnico.
   - Debe: "Crea tu contraseña" antes de ver sus visitas; no acepta la temporal como nueva.
3. Cree la nueva. En **Tu cuenta** → **Cambiar contraseña**, primero en modo avión y después con señal.
   - Debe: sin señal, "Necesita señal" y no abre; con señal, la cambia y la sesión sigue abierta.
4. En oficina, menú del técnico → **Desactivar usuario**; después, en su fila, **Reactivar usuario**.
   - Debe: la confirmación dice "Le entrega una contraseña temporal" y "No recupera sesiones, llaves ni segundo factor"; la temporal se muestra una sola vez.
5. En el iPhone, entre con la temporal nueva.
   - Debe: otra vez "Crea tu contraseña".
6. En oficina, **Mi cuenta**, sección "Acceso".
   - Debe: **Cambiar contraseña** abre un diálogo; el segundo factor dice "Obligatorio para administrar", sin botón para quitarlo.

## Fase 27 · Flujos (iteración 27)

iPhone y computador. Mira el movimiento: que nada salte y que cada acción diga qué sigue. Con "Reducir movimiento" activo nada se mueve, y es lo esperado.

1. En el iPhone, en la siguiente visita, toque **Iniciar levantamiento**.
   - Debe: la tarjeta se convierte en la cabecera de la captura, sin pantalla en blanco.
2. Avance y retroceda entre pasos.
   - Debe: solo se desliza el cuerpo; la cabecera se queda y la barra de avance crece.
3. Abra y cierre el croquis y la firma.
   - Debe: suben y bajan.
4. Envíe y toque **Ver la siguiente visita**.
   - Debe: vuelve al inicio con lo enviado resaltado en "Enviados" y, al vaciarse la cola, "Todo subido" en verde.
5. En oficina, cambie de sección y abra un levantamiento de la bandeja.
   - Debe: el contenido se desvanece y el menú no se mueve; el título de la fila pasa a ser el del detalle.
6. Tómelo y márquelo revisado.
   - Debe: el estado cambia en su lugar, con "Marcado revisado" y "Siguiente: …".
7. Publique un informe con contactos.
   - Debe: arriba del editor, el avance (publicada, PDF, en el portal y cada envío) cambia en su lugar.
8. Cancele una visita.
   - Debe: la fila sale y la notificación trae **Ver en Canceladas**, que lleva a esa pestaña.

**Anotar:** lo que se sienta lento, brusco o animado de más.

## Fase 28 · Datos que se corrigen (iteración 28)

Computador y iPhone.

1. Publique un informe con un contacto (fase 20) y, apenas publique, mientras el envío dice "En cola", toque **Cancelar** en su fila.
   - Debe: sin confirmar; la notificación ofrece **Deshacer**; la fila queda tachada con "… cancelado por …: no sale".
2. En la cotización de la fase 21, **Retirar versión**, con motivo.
   - Debe: solo en la vigente; la cotización queda "Sin versión vigente" en su pantalla y en la lista; el PDF se sigue descargando.
3. En **Clientes**, en un cliente ficticio: **Editar** el nombre; en el menú de un sitio, **Editar sitio** y cambie la dirección.
   - Debe: el encabezado dice "Cambiado por … · …".
4. Con una visita por hacer, menú del cliente → **Archivar cliente**.
   - Debe: no deja, y dice qué visitas lo impiden, con fecha, sitio y técnicos.
5. Cancele esa visita y archívelo.
   - Debe: sale de la lista y de "Programar visita"; está en **Archivados** con quién y cuándo; **Recuperar** lo devuelve.
6. En una revisión, pestaña «Comentarios», menú de un comentario propio: **Editar** y después **Borrar**.
   - Debe: "Editado …"; al borrar, "Comentario retirado por …" con **Deshacer**. En el iPhone, al abrir la app, el técnico ya no lo ve.
7. En el iPhone, inicie un levantamiento, tome una foto y, al final del recorrido, **Descartar levantamiento**.
   - Debe: la confirmación dice qué pasa y cuántas fotos tiene; después, "Levantamiento descartado" con **Ver en Descartados**.
8. **Tu cuenta** → **Descartados** → **Recuperar**.
   - Debe: antes, "Se borra el …"; al recuperar, vuelve a "Mis visitas" igual, con su foto.

## Fase 31 · Visitas con horario (iteración 31)

Computador y iPhone, con `tecnico.prueba`.

1. En oficina, **Programar visita**: hoy, a la próxima media hora, duración **No sé cuánto dura**.
   - Debe: el diálogo se ve entero; "Libres a esa hora · N" y "Ocupados · N", con el motivo de cada ocupado.
2. Abra otra vez **Programar visita** a la misma hora.
   - Debe: Técnico de prueba aparece en "Ocupados", no en libres.
3. Mire **Visitas**.
   - Debe: la columna "Hora", ordenada por hora.
4. En el iPhone, abra la app.
   - Debe: la visita con su horario ("Hoy · Desde …").
5. Llegada la hora (fase 41, paso 1), active el modo avión y toque **Terminar visita** → **Terminar visita**.
   - Debe: "Visita terminada: oficina lo sabrá cuando tengas señal", y la visita dice "Terminada …".
6. Quite el modo avión. En oficina, abra **Programar visita** a esa hora.
   - Debe: Técnico de prueba vuelve a estar libre.
7. Con los avisos activos (fase 15), programe una visita con hora.
   - Debe: el aviso dice la hora.

## Fase 32 · Pantallas de campo, segunda vuelta (iteración 32)

iPhone.

1. Abra **Tu cuenta**.
   - Debe: una lista con el tema (tres iconos), **Cambiar contraseña**, **Descartados** con su número y **Diagnóstico del teléfono**; **Cerrar sesión** sola al final y la versión de la app. Cada fila abre dentro de la misma hoja, con "‹ Cuenta".
2. En Tableros, **Agregar tablero** dos veces y llene uno.
   - Debe: una fila por tablero con su foto y su avance, y "1 de 2 completos".
3. Abra un tablero.
   - Debe: el nombre es el título; **Cambiar nombre** y **Quitar tablero** en el menú "⋯"; abajo, "Siguiente: Tablero 2" y **Volver a la lista**, o "Listo, ver los 2" en el último.
4. En Materiales, **Del catálogo** y agregue dos ítems.
   - Debe: "Agregar del catálogo"; abajo, nada hasta agregar algo, y después lo agregado con **Ver materiales**.
5. Abra el croquis.
   - Debe: sube una sola vez, ya cargado; abajo, una barra fija con las hojas, los símbolos y **Listo** a la derecha.
6. Firme (fase 34) y vuelva al paso.
   - Debe: la constancia grande, con la firma sobre su línea, quién firmó y la declaración tal como sale en el informe; **Repetir** pide confirmar.
7. Toque **Revisar y enviar**.
   - Debe: "Revisa y envía" con cliente, sitio y formato; tres cifras (fotos, repeticiones, materiales); cada paso con lo que lleva y un visto, lo que falta en ámbar; tocar una fila lleva a su paso.
8. Envíe y vuelva a "Mis visitas".
   - Debe: en "Enviados", dos líneas: cliente y sitio con la hora; el estado corto ("En revisión", "Revisado", "Se envía al tener señal") y el formato. Lo que no entró sale arriba, en "Necesita atención".

**Anotar:** si las hojas y los pasos se sienten rápidos o con retraso.

## Fase 34 · Firma en una pantalla (iteración 34)

iPhone.

1. En el paso "Firma del cliente", toque **Entregar el teléfono**.
   - Debe: una sola pantalla clara: el logo y **Cancelar**; "Constancia de visita · Cliente de prueba" y "Confirme la visita de …"; la declaración; "Su nombre" y "Cargo (opcional)" en una fila; el recuadro con "Firme aquí con el dedo" y **Borrar**; **Firmar** abajo. Sin pantalla de bienvenida.
2. Toque **Firmar** sin nada.
   - Debe: "Faltan su nombre y su firma.", y cada campo marcado.
3. Escriba un nombre y un cargo ficticios, firme y toque **Firmar**.
   - Debe: el trazo sigue al dedo; vuelve al paso con la constancia firmada.

**Anotar:** si el teclado tapa el recuadro al escribir el nombre, y si todo cabe sin desplazar.

## Fase 35 · Qué sale en el informe (iteración 35)

Computador. Necesita un levantamiento nuevo con el formato de prueba 9 (el último que publica `sembrar`), con fotos de llegada, croquis y dos fotos del equipo.

1. Revíselo y abra el informe.
   - Debe: bajo el levantamiento, **Qué sale en el informe**; "Llegada" no sale ("Solo para la empresa (lo marca el formato)") y el croquis tampoco ("Croquis de campo: adjunte el plano en Planos anexos").
2. Apague una sección; en "Fotos del equipo", **Elegir fotos** y quite una.
   - Debe: en la hoja, lo oculto rayado con **Mostrar**.
3. Pase el puntero sobre una foto de la hoja y toque **Ocultar**.
   - Debe: un solo «Ocultar» a la vez; la foto queda rayada. Igual en Safari.
4. Publique y descargue el PDF.
   - Debe: sin la llegada, sin el croquis de campo y sin lo oculto. Lo que volvió a mostrar con **Mostrar**, sí.

## Fase 36 · Usabilidad de oficina (iteración 36)

Computador: Mac y, si puede, Windows.

1. Abra un informe, escriba en la introducción y deje de escribir.
   - Debe: en un par de segundos, "Guardado" junto a «Publicar»; no hay «Guardar borrador».
2. Escriba y cierre la pestaña enseguida. Ábrala de nuevo.
   - Debe: lo escrito sigue.
3. Abra el mismo informe en dos ventanas y escriba distinto en cada una.
   - Debe: el aviso de conflicto con **Guardar la mía encima** y **Cargar la guardada**.
4. Apague el wifi, escriba y vuelva a prenderlo.
   - Debe: se guarda solo al volver la conexión.
5. En la vista previa: arrastre el divisor y dele doble clic; **Ampliar la vista previa** y **Volver al editor**; **Ocultar la vista previa** y, en la barra, **Mostrar la vista previa**. Recargue con la vista oculta.
   - Debe: el divisor también se mueve con las flechas y el doble clic vuelve al ancho de siempre; al recargar, sigue oculta.
6. Pliegue el menú con el icono junto al logo y con ⌘B (Ctrl + B en Windows).
   - Debe: queda en iconos y se recuerda.
7. En Levantamientos, Clientes y Visitas, elija una pestaña y busque algo; vaya a otra sección y vuelva.
   - Debe: la misma pestaña y la misma búsqueda; en la bandeja, marcada la fila que abrió.
8. En el informe, ordene los levantamientos incluidos y los planos con el asa, y con el teclado (Espacio la toma, las flechas la mueven, Espacio la suelta).
   - Debe: el orden nuevo en la hoja y en el PDF.
9. En Windows, abra una confirmación y la lista de atajos («?»).
   - Debe: «Ctrl + …» y «Enter», no ⌘ ni ↵.

## Fase 37 · Buscar en todo y revisar con el teclado (iteración 37)

Computador: Mac y, si puede, Windows.

1. ⌘K (Ctrl + K), o **Buscar** en el menú.
   - Debe: "Buscar en oficina" con recientes, acciones («Programar visita», «Nuevo cliente», «Nueva cotización», «Tomar el más antiguo») y secciones.
2. Escriba parte del nombre de un cliente, sin tildes, y Enter.
   - Debe: resultados por grupo; abre el cliente. Una visita abre Visitas buscando ese cliente.
3. Elija «Programar visita». Después, vuelva con Atrás.
   - Debe: Visitas con el formulario abierto; al volver, no se abre otra vez.
4. En Levantamientos: J y K (o ↓ y ↑), Enter y «/».
   - Debe: la fila marcada se mueve, Enter la abre y «/» va al buscador.
5. En la revisión: T, R, S y Esc.
   - Debe: T toma, R pide confirmar el revisado, S va al siguiente y Esc vuelve a la bandeja. Las letras no hacen nada mientras escribe en un campo.
6. Toque «?».
   - Debe: "Atajos del teclado".
7. En Safari, abra la búsqueda con resultados.
   - Debe: la lista entera, no aplastada.

## Fase 38 · La revisión al lado (iteración 38)

Computador, con la ventana ancha (1440 px o más) y después angosta.

1. Abra un levantamiento enviado.
   - Debe: los datos a la izquierda; a la derecha, un panel a todo el alto con «En el informe», «Comentarios» e «Historial», abierto en «En el informe» la primera vez. En la barra: "Esperando revisión · nadie la ha tomado" y **Tomar para revisar**.
2. Tómelo.
   - Debe: "En revisión · la tomó usted" con **Marcar revisado**.
3. Corrija un dato sin guardar; después guarde.
   - Debe: en «En el informe», el valor nuevo enmarcado con "· sin guardar"; guardado, resaltado con "Antes: …".
4. Arrastre el divisor; **Ampliar** y **Volver a la revisión**; oculte el panel y vuelva a abrirlo con **Mostrar el panel**.
   - Debe: el ancho, el oculto y la pestaña se recuerdan, aparte de los del informe.
5. Márquelo revisado.
   - Debe: "Revisado · por usted, <hora>" con **Abrir el informe**, y "Siguiente: …" encima de los datos.
6. Angoste la ventana a menos de 1280 px.
   - Debe: el panel sale de la pantalla; **Mostrar el panel**, en la barra, lo abre en hoja lateral.

## Fase 39 · Conversaciones con campo (iteración 39)

iPhone y computador, con los avisos activos en los dos (fase 15).

1. En oficina, tome un levantamiento de `tecnico.prueba`. En un dato, toque el icono de comentar, escriba una pregunta y **Enviar comentario**.
   - Debe: en «Comentarios», "Lo que escriba aquí le llega a Técnico de prueba en su teléfono."
2. Con el iPhone bloqueado, espere.
   - Debe: el aviso "Oficina · Cliente de prueba" con el texto; tocarlo abre el chat.
3. En "Mis visitas".
   - Debe: en "Necesita atención" (iteración 46), "Oficina te escribió" y un punto azul; tocarla abre el chat. En el levantamiento, la fila "Oficina" con el número de sin leer.
4. Abra el chat.
   - Debe: "N mensajes sin leer"; la pregunta con un recuadro del dato y lo que respondió; abajo, "Respondiendo a Oficina".
5. En modo avión, escriba una respuesta y envíela.
   - Debe: el globo más claro con "Se envía cuando haya señal"; arriba, "Esperando señal…"; en "Enviados", "1 respuesta por enviar".
6. Quite el modo avión.
   - Debe: "Enviado". En oficina, en menos de 15 s y sin recargar: punto azul en la bandeja con "Técnico de prueba respondió · <hora>", y el aviso del navegador.
7. En oficina, en «Comentarios», responda en "Responder…" con ↵.
   - Debe: la línea "Nuevo" antes de lo del técnico. En el iPhone llega la respuesta y, bajo su mensaje, "Leído".
8. En el iPhone, en modo avión, escriba otra respuesta. En oficina, **Marcar revisado** (la confirmación dice "Las conversaciones se cierran"). Quite el modo avión.
   - Debe: "No se envió: oficina ya lo había marcado revisado. Si es importante, llama a oficina." y, en lugar del campo, "La conversación quedó cerrada".

**Anotar:** si llegó un aviso con el chat abierto (Safari a veces lo muestra igual; es una limitación conocida).

## Fase 40 · Lo atendido no es la siguiente visita (iteración 40)

iPhone, con una sola visita de hoy para `tecnico.prueba`.

1. Envíe el levantamiento de esa visita y toque **Ver la siguiente visita**.
   - Debe: no hay "Siguiente visita": dice "No tienes visitas pendientes", y la visita está abajo, en "Atendidas hoy".
2. En oficina, programe otra para mañana. En el iPhone, abra la app.
   - Debe: la de mañana es la siguiente; la de hoy sigue en "Atendidas hoy".
3. Al día siguiente, abra la app con señal.
   - Debe: la visita de ayer ya no está; su levantamiento sigue en "Enviados".

## Fase 41 · Nada queda a medias (iteración 41)

iPhone y computador. Lo de fondo (trabajos recuperados, retención de 30 días, poda del servidor) lo cubren las pruebas automáticas; aquí va lo que se ve.

1. Programe una visita de hoy a la próxima media hora con **No sé cuánto dura**, y deje la app de campo abierta en "Mis visitas" sin tocarla.
   - Debe: al llegar la hora, sin recargar, "En curso · desde …" y **Terminar visita**. Si otra visita ocupa la tarjeta de arriba, **Terminar visita** también está en la fila.
2. Con un cliente cuya única visita de hoy ya tiene un levantamiento enviado, **Archivar cliente**.
   - Debe: lo deja archivar; esa visita no cuenta como por hacer.
3. En **Informes**, mire un informe con todas sus versiones retiradas (fase 7, paso 6).
   - Debe: "Retirado del portal", no "Borrador".
4. Publique una versión nueva de un informe que ya tenía vigente y mire el avance mientras se genera el PDF.
   - Debe: "Mientras, el cliente ve la versión N".
5. Con un contacto que tiene correo y WhatsApp y solo recibió por correo, **Enviar a otro contacto**.
   - Debe: lo ofrece por WhatsApp.
6. Cree un usuario de oficina ficticio, tome con él un levantamiento y desactívelo desde `oficina.prueba`.
   - Debe: el levantamiento dice "En revisión · nadie la tiene desde que se desactivó a …", y **Tomar para revisar** lo toma sin reasignar.

## Fase 42 · Lo que se ve sale de lo guardado (iteración 42)

iPhone y computador.

1. En el iPhone, inicie un levantamiento. En Tableros, **Agregar tablero**, vuelva a la lista sin llenarlo y quítelo ("⋯" → **Quitar tablero**).
   - Debe: **Revisar y enviar** no pide datos del tablero quitado ni muestra nombres internos como `ubicacion` o `tableros~…`.
2. Llene el cuarto técnico (un dato con "No se pudo obtener" y su motivo), avance hasta Materiales y vuelva con la flecha.
   - Debe: los datos y el motivo siguen ahí.
3. En Materiales, agregue tres líneas y baje una a cero.
   - Debe: **Deshacer** devuelve solo esa línea, en su lugar, y las otras siguen; un segundo toque no la duplica.
4. Opcional: llene varias hojas del croquis de trazos y envíe.
   - Debe: se envía y oficina ve el croquis completo.
5. Al día siguiente, mire "Enviados".
   - Debe: cada fila con su cliente y su sitio, no solo "Formato de prueba"; el número de fotos no cuenta los materiales.
6. En oficina, abra el informe de una visita y, con ⌘K → recientes, el de otra.
   - Debe: el segundo muestra lo suyo, no el borrador del primero.
7. En **Visitas**, la de "Cliente revocación" (fase 2) → **Reasignar**.
   - Debe: la fila dice "Se desactivó a Técnico revocable" con "Sin técnico"; en el diálogo, "Se desactivó a Técnico revocable: sale de la visita", y se guarda con otro técnico.
8. En una revisión, escriba un comentario sin enviarlo, cambie de pestaña del panel y vuelva.
   - Debe: lo escrito sigue. **Marcar revisado** dice que se pierde.
9. Cambie el celular de un contacto que recibe por WhatsApp.
   - Debe: la autorización se desmarca y hay que confirmarla de nuevo.
10. Corrija la dirección de un sitio con una visita por hacer de `tecnico.prueba`. En el iPhone, abra la app.
    - Debe: la visita con la dirección nueva.

## Fase 43 · Retirar una versión cancela sus envíos (iteración 43)

Computador, como administrador.

1. Publique una versión nueva de un informe con un contacto marcado y, mientras dice "Generando el PDF…", **Retirar del portal** → motivo → **Retirar la versión N**.
   - Debe: el envío queda **Cancelado**, con "Versión retirada" y "no sale"; no dice **No llegó** y no ofrece reanudarlo. Si alcanzó a salir, queda "Enviado" o "Entregado": también es correcto (ADR-0047).
2. Lo mismo con una cotización y **Retirar versión**.
   - Debe: igual.

## Fase 44 · Nada cambió (iteración 44)

iPhone y computador, después del primer despliegue con el flujo «Desplegar». La 44 reordenó el código sin cambiar lo que hace: es una pasada corta.

1. En el iPhone, capture un levantamiento completo (foto, tablero, material, croquis y firma) y envíelo.
   - Debe: como antes; fechas y horas de Colombia.
2. En oficina, tómelo, corrija, comente y márquelo revisado.
   - Debe: como antes, con el historial de siempre.
3. Publique el informe y una cotización y descargue los PDF.
   - Debe: fechas y pesos como antes.
4. En la pestaña **Correo** del informe, toque el texto del correo para escribir, en tema claro y en oscuro.
   - Debe: un borde punteado gris alrededor del texto, que pasa a borde azul al escribir. Es el único cambio a la vista: esos colores salen ahora de los tokens.

## Fase 46 · El chat a la vista y las visitas que aún no tocan (iteración 46)

iPhone con la app instalada y los avisos activos, y oficina en el computador.

1. Con la app abierta en «Mis visitas» (sin entrar al levantamiento), oficina comenta un dato de un levantamiento enviado de `tecnico.prueba`.
   - Debe: en segundos, sin tocar nada, el levantamiento aparece en «Necesita atención» con «Oficina te escribió», y sale de «Enviados».
2. Toque esa fila.
   - Debe: abre directo el chat con oficina, sin pasar por el levantamiento.
3. Mire el ícono de la app en la pantalla de inicio del iPhone antes y después de leer el chat.
   - Debe: el número de conversaciones sin leer baja al leerlas y desaparece con cero. Con la app cerrada no sube solo: se actualiza al abrirla (límite conocido).
4. En oficina, programe una visita para mañana para `tecnico.prueba`. En el iPhone, abra la app.
   - Debe: en lugar de «Iniciar levantamiento», dice «Podrás iniciarla mañana». La de hoy sí tiene el botón.
5. Programe una visita para dentro de varios días.
   - Debe: dice «Podrás iniciarla el <día>, <número> de <mes>».
6. Empiece un levantamiento de una visita de hoy y, sin enviarlo, oficina la reprograma para mañana.
   - Debe: el borrador se sigue pudiendo continuar («Continuar levantamiento»).

**Anotar:** si Safari mostró el aviso con la app abierta en el inicio (es lo esperado; lo nuevo es que la pantalla se entera sola).

## Al terminar

- Resultados del iPhone (fase 1, paso 7): en la tabla de resultados de [`historia/00-captura-sin-conexion.md`](historia/00-captura-sin-conexion.md).
- Todo lo que no se vio como "Debe": en una lista con fase, paso y lo que se vio. Con eso se abren los arreglos.
- Si todo pasó: en el mapa del plan, las iteraciones que dicen "falta iPhone" o "falta que Kevin la pruebe" pasan a probadas, y la 23 a aprobada.
