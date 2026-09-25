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

## Al terminar

- Resultados del iPhone (fase 1, paso 7): en la tabla de resultados del corte 0 de `plan-de-entrega.md`.
- Todo lo que no se vio como "Debe": en una lista con fase, paso y lo que se vio. Con eso se abren los arreglos antes de seguir con campo (secciones repetibles y bocetos).
- Si todo pasó: los cortes 1, 2 y 3 dejan de decir "falta la prueba en iPhone" en el mapa del plan.
