# servidor

Monolito modular (ADR-0001): un código con dos roles de ejecución, `web` (API) y `worker` (trabajos).

- **Dependencias:** `dominio`, `protocolo` y `documentos`. Nunca `campo`, `oficina`, `portal` ni `ui`.
- **ADR:** 0001, 0003, 0005, 0007, 0008, 0009, 0010, 0012, 0013, 0014, 0016, 0017, y los de cada módulo (abajo).
- La historia de cada iteración está en [`docs/proceso/historia/`](../../docs/proceso/historia/).

## Estructura

```
src/
  config.ts     Configuración por entorno, validada con Zod: un valor inválido impide arrancar.
  esquema.ts    Reúne los esquemas de Drizzle de los módulos.
  app.ts        Composición del rol web.
  web.ts        Punto de entrada del rol web.
  worker.ts     Punto de entrada del rol worker.
  tareas.ts     Trabajos de la cola y la tarea periódica: todo trabajo declarado debe tener manejador.
  cli/          Comandos de administración (uso en el encabezado de cada archivo).
  plataforma/   Lo que usan todos los módulos: base de datos, transacción por organización, errores,
                rutas con política, cola, almacenamiento, impresión a PDF (pdf.ts), búsqueda.
  modulos/
    identidad/       Usuarios, sesiones (Better Auth), resolución del actor, desactivación y reactivación,
                     dispositivos (secreto, informe de salud, orden de borrado) y llaves de acceso (una
                     instancia de Better Auth por dominio de superficie: cada llave queda ligada al suyo).
    formatos/        Versiones de formato inmutables y meta-esquema.
    archivos/        Subida firmada, verificación en el worker, descarga firmada, páginas de cada plano.
    auditoria/       Registro semántico con cadena de hashes (ADR-0008).
    cambios/         Registro de cambios para la bajada, serializado por organización; época de la bajada.
    clientes/        Clientes, sitios y contactos; editar y archivar (ADR-0035).
    visitas/         Visitas programadas, técnicos asignados, horario y cierre (ADR-0037, ADR-0041).
    levantamientos/  Recepción idempotente del envío (núcleo hexagonal), bandeja, revisión y conversaciones.
                     Proyecta las líneas de cantidad a `lineas_cantidad`, donde vive su vínculo al catálogo.
    catalogo/        Ítems (código, descripción, unidad), importación por código y lista de precios (ADR-0025, 0029).
    simbolos/        Biblioteca de símbolos de los bocetos por organización (ADR-0027).
    sincronizacion/  Bajada: compone los cambios del técnico con las interfaces de los demás módulos.
    informes/        Informe por visita, versiones publicadas inmutables y su PDF (ADR-0013, 0024, 0039).
    cotizaciones/    Cotizaciones desde las cantidades revisadas (ADR-0029, 0034).
    envios/          Informe y cotización al cliente por correo y WhatsApp (ADR-0028, 0034, 0036).
    portal/          Acceso al portal de cada contacto, ingreso con código y rutas del portal, con la conexión de `teins_portal` (ADR-0009, ADR-0053).
    avisos/          Avisos push (ADR-0023, ADR-0040).
    asistente/       El asistente de datos de oficina (ADR-0060): conversaciones, el bucle con el modelo en el worker,
                     el modelo de Anthropic y el simulado, el costo por modelo y el tope mensual.
    mantenimiento/   La tarea periódica: recupera trabajos a medias, poda, borra archivos sin uso y quita accesos al portal sin uso (ADR-0043, ADR-0044, ADR-0048, ADR-0055).
migraciones/    SQL generado por drizzle-kit más migraciones propias (permisos, cola). La última es 0044 (asistente, ADR-0060).
infra/          SQL que ejecuta la infraestructura, no las migraciones (roles de la base).
scripts/        compilar.mjs (la imagen) y vaciar-almacenamiento.mjs (entorno de pruebas).
pruebas/        Integración con PostgreSQL y S3Mock reales en contenedores.
```

Reglas de la estructura:

- Un módulo solo importa la interfaz pública de otro (`modulos/<nombre>/index.ts`), nunca sus tablas. Cuando dos módulos no pueden importarse, `app.ts` pasa la función (por ejemplo `visitas.porHacer` a `crearClientes`).
- Todo dato de negocio se lee y escribe dentro de `enOrganizacion`: la seguridad por fila de la base filtra por organización.
- Toda ruta declara su política; una ruta sin política impide arrancar.
- Todo cambio de esquema es de expansión (ADR-0015): columnas nuevas con valor por defecto o anulables.

## Roles de base de datos

| Rol | Uso | Permisos |
|---|---|---|
| Dueño (`DATABASE_URL_PROPIETARIO`) | Migraciones, cola de trabajos y compactar el registro de cambios. Solo la reciben el worker, `migrar`, `sembrar`, `crear-organizacion` y `preparar-ensayo` (la exigen con `urlDelPropietario`); el rol web arranca sin ella | Dueño de los esquemas |
| `teins_portal` (`DATABASE_URL_PORTAL`) | Rutas del portal del cliente | Solo versiones publicadas (informes y cotizaciones) con PDF listo del cliente de la sesión; leer los accesos y anotar el último ingreso; sus pedidos de código, sesiones e intentos; encolar el correo del código con `cola.encolar_correo_del_portal`; y registrar en auditoría |
| `teins_app` (`DATABASE_URL`) | Solicitudes y trabajos de negocio | Mínimos por tabla; sujeto a seguridad por fila; solo inserta y lee en auditoría, formatos y el registro de cambios; no borra en ninguna tabla de negocio |

`teins_app` lo crea la infraestructura con `infra/roles.sql` (en local lo hace Docker Compose).

## Desarrollo local

```sh
docker compose up -d --wait          # desde la raíz: PostgreSQL y S3Mock
cp paquetes/servidor/.env.example paquetes/servidor/.env   # y ponga AUTH_SECRETO
pnpm --filter @teins/servidor migrar
pnpm --filter @teins/servidor sembrar     # organización, formatos y símbolos de prueba, dos usuarios (muestra sus contraseñas) y un cliente con una visita
pnpm --filter @teins/servidor dev:web     # http://localhost:3000
pnpm --filter @teins/servidor dev:worker
```

Las variables están en `.env.example` y se validan en `src/config.ts` (cada una con su comentario). El worker usa Chromium para el PDF: en la imagen, el de Alpine (`CHROMIUM_RUTA=/usr/bin/chromium`); en desarrollo, sin esa variable, el que instala Playwright (`pnpm --filter @teins/e2e exec playwright install chromium` si falta).

Nueva migración: cambie el esquema del módulo y ejecute `pnpm --filter @teins/servidor generar-migracion --name <nombre>`. Los permisos de una tabla nueva van en una migración propia (`--custom`).

## Comandos de administración

`pnpm --filter @teins/servidor <comando>`; en un entorno desplegado, `node dist/cli/<comando>.js` (la imagen incluye todo `src/cli/`, `scripts/compilar.mjs`). Usuarios y retiro de versiones también se hacen en oficina, en "Administración"; clientes, sitios, visitas y el acceso al portal de cada contacto, en "Clientes" y "Visitas". Los comandos quedan para la primera persona administradora, la publicación de formatos y símbolos y la operación por consola.

| Comando | Qué hace |
|---|---|
| `migrar` | Aplica las migraciones (antes de cada versión) |
| `sembrar` | Datos de prueba. Solo en desarrollo o con `ENTORNO_DE_PRUEBAS=true`; nunca en producción |
| `sembrar-asistente` | `--organizacion <uuid> --tecnico <usuario> --revisor <usuario>`: los datos de ejemplo del asistente en esa organización, con el formato `prueba-ups` v10. Se puede repetir; la misma guarda que `sembrar` |
| `crear-organizacion` | Crea la organización de un entorno que no se siembra (producción); si ya existe, no la toca |
| `crear-usuario`, `restablecer-contrasena` | Usuarios internos y recuperación de acceso. No marcan la contraseña como temporal: quien corre el comando la elige |
| `desactivar-usuario` | Revoca: cierra sus sesiones, no vuelve a entrar y sus teléfonos borran sus datos al conectarse; lo que tenía en revisión queda sin tomar |
| `marcar-administrador` | Marca (o con `--quitar`, desmarca) a una persona de oficina como administradora; para administrar debe activar además el segundo factor en oficina |
| `crear-cliente` | Cliente con su primer sitio |
| `crear-visita`, `reasignar-visita` | Programa una visita para uno o varios técnicos, con su servicio (`--formato <clave>`, ADR-0057; o `--motivo` libre, sin servicio) (no valida cruces de horario); al reasignar, sale del teléfono de quien deja de tenerla. Al programar se le asigna el siguiente número de orden de servicio |
| `fijar-consecutivo-de-ordenes` | `--organizacion <uuid> --ultimo <n>`: la siguiente visita sigue desde el número de TEINS (ADR-0051). Nunca baja ni repite un número |
| `publicar-formato` | Publica una versión de formato desde un JSON; llega a los teléfonos en la siguiente bajada |
| `publicar-simbolos` | Publica la biblioteca de símbolos desde un JSON (ADR-0027): crea o cambia cada símbolo y retira los que ya no están. La de prueba es `@teins/dominio/formatos-de-prueba/simbolos-prueba.json`, que `sembrar` publica; la de TEINS, `@teins/dominio/biblioteca/simbolos-teins.json` |
| `ultimo-correo --para <correo>` | El último correo simulado que salió a esa dirección (asunto y texto): la prueba de extremo a extremo lee de aquí el código del portal (ADR-0053). Se niega en producción o con el correo real |
| `generar-claves-avisos` | Imprime un par de claves VAPID para `AVISOS_VAPID_PUBLICA` y `AVISOS_VAPID_PRIVADA` (ADR-0023). La privada es un secreto: va a las variables del entorno, nunca al repositorio. Sin claves, los avisos quedan apagados |
| `verificar-integridad` | Verifica todas las cadenas de la auditoría de una base; recibe la conexión del dueño en `DATABASE_URL`. Lo usa el simulacro de restauración (`docs/proceso/produccion.md`) |
| `preparar-ensayo` | La organización del ensayo de carga (`src/ensayo.ts`) con el formato de prueba y sus usuarios ficticios: `--tecnicos` (20) y `--oficina` (5), con la contraseña de `TEINS_CONTRASENA`. No toca lo que existe, así las sesiones guardadas del ensayo siguen sirviendo; con `--restablecer`, les pone esa contraseña. Solo en desarrollo o con `ENTORNO_DE_PRUEBAS=true` |

## Decisiones vigentes por módulo

### Identidad y cuenta propia (ADR-0009, ADR-0033)

- El permiso de trabajo sin conexión dura `DIAS_PERMISO_LOCAL` días (7 por defecto, de 1 a 30) desde el último contacto. Vencer nunca borra.
- `usuarios.debe_cambiar_contrasena` marca la contraseña que genera Administración al crear, restablecer o reactivar. Con la marca, `evaluar` (`plataforma/politicas.ts`) responde `cambio_de_contrasena_requerido` salvo en las políticas `conContrasenaTemporal` (leer la sesión y cambiar la contraseña), y el puente niega `RUTAS_CON_SESION` (llaves y activar el segundo factor).
- `POST /api/cuenta/contrasena` y `POST /api/cuenta/segundo-factor/quitar` llaman a Better Auth por su manejador HTTP con las cookies y la IP de la solicitud (`llamarAuth` en `modulos/identidad/index.ts`, sobre el `http` que `registrarOperacion` pasa a cada operación), así aplican su límite de intentos. Una credencial equivocada es `credencial_incorrecta` (422) con su campo.
- `POST /api/administracion/usuarios/{id}/reactivar` devuelve la temporal y deja las órdenes de borrado pendientes. Desactivar otra vez a quien se reactivó da una orden nueva a los teléfonos que ya cumplieron la anterior (`borrado_confirmado_en` vuelve a nulo); una pendiente se deja como está, y la auditoría (`usuario_desactivado`) cuenta todos sus teléfonos.
- La lista de teléfonos de Administración muestra los que tuvieron contacto en 90 días o tienen una orden de borrado sin confirmar; los teléfonos no se borran (ADR-0044).

### Archivos (ADR-0007)

- Una foto o un boceto guardado sin su fila (base restaurada, entorno limpio) se adopta como subido si es idéntico a lo declarado; un PDF sin fila se rechaza (no se distingue de uno generado).
- Al verificar un plano se cuentan las páginas que anexaría (`paginasDePlano` en `plataforma/pdf.ts`, los mismos pasos del worker; 0 si no se puede anexar) y se guardan en `archivos.paginas`; `estadoDePlano` las entrega a oficina.
- Las URL firmadas de descarga del PDF llevan `Content-Disposition: attachment` con un nombre legible (`firmarDescarga(clave, { descargarComo })`): oficina y el portal lo descargan sin salir de la pantalla. Fotos y bocetos van en línea.

### Datos de la visita, número de orden y cédula (ADR-0051)

- Migración `0040`: `clientes.clientes.nit`, `clientes.sitios.ciudad`, `visitas.visitas.solicitante_contacto_id`, `orden_de_servicio` (único por organización) y `referencia_cliente`, `visitas.consecutivos_de_orden` (con aislamiento por organización) e `identidad.usuarios.documento`.
- `visitas.crear` asigna el número con un upsert que incrementa el consecutivo en la misma transacción; reprogramar lo conserva y cancelar no lo libera. `fijarConsecutivoDeOrdenes` (comando `fijar-consecutivo-de-ordenes`) nunca baja ni repite. El solicitante se valida contra los contactos del mismo cliente por `clientesYSitios.contactos`; uno que oficina quitó conserva el nombre y pierde el celular.
- `documento` lo pone y lo ve solo quien administra (`fijarDocumentoDeUsuario`); `identidad.documentos` lo da al informe, que lo copia a la versión. El registro dice `documento_cambiado` con `tieneCedula`, nunca el valor.
- Al publicar un informe, `informes` copia el encabezado (`encabezadoDe`), las cédulas y `revisadoEn` (regla 7).

### Clientes y visitas (ADR-0035, ADR-0037, ADR-0041)

- `crearCliente` acepta el contacto principal (opcional en la API) y lo crea en la misma transacción.
- `editarCliente`, `editarSitio`, archivar y recuperar cada uno, con valor anterior y nuevo en la auditoría. No se archiva con visitas por hacer (`visitas.porHacer`) ni el único sitio activo. Un cliente archivado no recibe envíos (`paraEnviar`, `sigueRecibiendo`) ni sitios ni visitas nuevas; `listarClientes` toma `vista` (`activos` o `archivados`).
- Corregir el nombre del cliente o un sitio llama, en la misma transacción, a lo que `app.ts` pasa como `AlCorregir`: `visitas.avisarCorreccion` registra un cambio para los técnicos de sus visitas sin cancelar ni cerrar, y `renombrarClienteDelPortal` corrige la copia del nombre en `portal.accesos` (el rol del portal no lee los clientes).
- Crear una visita toma el cliente para compartir (`clientesYSitios.bloquear`) antes de leer si está archivado: archivar al mismo tiempo espera o se ve.
- **Horario:** `hora_inicio`, `hora_fin`, `terminada_en` y `terminada_por`. `intervaloDe` dice lo que ocupa una visita ese día. Programar, reprogramar y reasignar responden `tecnico_ocupado` ante un cruce (reprogramar solo mira a los técnicos activos; bloqueo `pg_advisory_xact_lock` por organización y día, que todas toman antes que el registro de cambios). `ocupacionDeTecnicos` y `terminarVisita` (técnico asignado, idempotente, evento `visita_terminada`). Los avisos dicen la hora.
- **Cierre:** antes de armar la bajada de un técnico, `cerrarAtendidas` (sincronización) cierra sus visitas de días anteriores terminadas o con algún levantamiento recibido (`visitas.porCerrar`, `cerrar`, `cerradas`; `cerrar` vuelve a exigir en su WHERE la fecha anterior a hoy y que no esté cancelada) y registra su salida en `visitas.visitas.cerrada_en`. Baja como `fuera_de_alcance` con motivo `atendida` solo a la app 15 o posterior (`APP_CON_CIERRE`). `asignadas` no devuelve las cerradas. Reprogramar reabre una visita cerrada (ADR-0042).

### Levantamientos, revisión y conversaciones (ADR-0035, ADR-0040, ADR-0045)

- Comentarios: `editarComentario`, `retirarComentario` y `restaurarComentario` (`corregirComentario` en `aplicacion/revision.ts`), solo su autor y hasta Revisado; la bajada deja fuera lo retirado y trae `editadoEn`.
- Conversaciones: `levantamientos.comentarios` tiene `en_respuesta_a`, `de` (`oficina` o `tecnico`) y `llave` (única); `levantamientos.lecturas` guarda hasta cuándo leyó cada persona (solo avanza; sin DELETE). `responderComentario` (técnico, idempotente por `llave`, evento `comentario_respondido`), `comentar` con `enRespuestaA` y `leerConversacion`; se cierran al marcar revisado (`estado_invalido`). `conversacionesDe` da el punto de "sin leer" a quien revisa o, si nadie lo ha tomado, a quien escribió el comentario; la bajada anida `respuestas` con `leido`.
- La bandeja marca `envioSinEntregar` solo con lo que se puede volver a enviar: el contacto sigue y recibe por ese canal (`contactosDelCliente.canales`).

### Informes (ADR-0013, ADR-0024, ADR-0026, ADR-0031, ADR-0039)

- Las plantillas del informe, de la cotización y de los mensajes viven en `paquetes/documentos`: el worker las llama con la salida `pdf` y oficina dibuja con ellas la vista en vivo. La impresión HTML a PDF está en `plataforma/pdf.ts`.
- El worker usa un Chromium por proceso, compartido por los documentos en curso (cada uno en su propio contexto) y cerrado tras un minuto sin documentos.
- Bocetos: cada hoja se convierte a SVG (`hojaASvg`, que también dibuja los símbolos copiados); las verticales van de a dos por fila y una apaisada ocupa la fila, con su nombre si hay varias. Las firmas van en una "Constancia de visita", sin cuadrícula y recortadas.
- `informes.informes.seleccion` guarda lo que oficina ocultó y volvió a mostrar. `guardarInforme` la recibe opcional (sin ella, se conserva la guardada) y `obtenerInforme` la devuelve; `publicarInforme` arma la copia con `aplicarSeleccion`, así que el PDF no incrusta lo oculto.

### Cotizaciones (ADR-0029, ADR-0034)

- La lista de precios vive en `catalogo.precios` (una fila por cambio, el vigente es el más reciente; cambiarla o importarla con precios exige administración con segundo factor). Las cotizaciones viven en el esquema `cotizaciones`; las versiones publicadas solo dejan cambiar las columnas de su PDF.
- `crearCotizacion` toma las cantidades de los levantamientos revisados (`levantamientos.cantidadesRevisadas`) con los precios vigentes; `publicarCotizacion` congela líneas, impuestos y totales, encola `cotizaciones.generarPdf` y programa los envíos con el mensaje de tipo `cotizacion`.
- `retirarVersionDeCotizacion` (administración, con motivo) marca `retirada_en`, cancela sus envíos en cola y deja vigente la anterior no retirada (`todasRetiradas` en la lista).

### La foto de llegada (ADR-0052)

- `GET /api/hora` da la hora oficial del servidor, la «hora de red» de la franja. `GET /api/mapa?lat&lon` da el mapa como imagen incrustada (`data:`) con su `centro`, `zoom` y `atribucion`; solo el técnico los pide.
- El mapa lo genera Geoapify Static Maps (`osm-bright`, zoom 16, 400 × 400 a escala 2, JPEG) desde `src/modulos/mapas`. El servidor **redondea las coordenadas a 3 decimales** antes de pedirlo, la llave (`GEOAPIFY_LLAVE`) nunca sale del servidor y las rutas de `/api/mapa` no entran en los registros de solicitudes, porque llevan las coordenadas en la dirección.
- Límite de 30 mapas por minuto y por técnico (`demasiadas_solicitudes`). Sin la llave, o si Geoapify falla o tarda más de 2,5 s, responde `no_disponible` (503) y la foto sale sin mapa.
- `GEOAPIFY_URL` solo cambia en pruebas (`pruebas/llegada.test.ts` levanta un Geoapify simulado). `GEOAPIFY_LLAVE` va en `.env.example` sin valor y en Railway; nunca en el repositorio.

### Envíos al cliente (ADR-0028, ADR-0034, ADR-0036, ADR-0047)

- Los contactos viven en `clientes.contactos` y los envíos en `envios.envios`. Publicar con `destinatarios` crea los envíos "En cola"; el worker los encola al marcar el PDF listo (`enviarAlQuedarListo`) y los manda con el trabajo `envios.enviar`.
- Sin `RESEND_CLAVE_API`, o sin `WHATSAPP_TOKEN` y `WHATSAPP_NUMERO_ID`, ese canal queda "No llegó: no está configurado".
- `ENVIOS_SIMULADOS` (`true`, `false`, `correo` o `whatsapp`): el canal simulado no sale del servidor, y una dirección con "rebota" o un celular que termina en 000 se rechazan. Solo en desarrollo, extremo a extremo y el entorno de pruebas; la configuración no arranca con él en producción.
- Los eventos de Resend llegan a `POST /api/envios/eventos/correo` (firma Svix con `RESEND_SECRETO_EVENTOS`) y los de Meta a `GET` y `POST /api/envios/eventos/whatsapp` (`WHATSAPP_TOKEN_VERIFICACION` y `WHATSAPP_SECRETO_APP`).
- Enviar otra vez (`enviarVersion`, `enviarCotizacion`) acepta una `llave`: el mismo pedido repetido no crea otro envío (regla 4).
- El correo propio: `mensaje` en publicar y enviar se copia a `envios.mensaje.personal` de cada envío por correo y el envío responde `personalizado`.
- Cancelar: el estado `cancelado` con `cancelado_por` y `cancelado_en`. `envios.cancelarEnvio` es `UPDATE … WHERE estado = 'en_cola' AND enviado_en IS NULL` y el worker marca `enviado_en` antes de llamar al proveedor, así que gana quien llega primero a la fila. `reanudarEnvio` lo devuelve a la cola y lo encola si el PDF está listo (eventos `envio_cancelado` y `envio_reanudado`). Retirar una versión cancela sus envíos en cola (`cancelarEnviosDeVersion`), por quien la retiró y con `error` = "Versión retirada"; no se reanudan, y uno que ya salía pasa a `enviado` si el proveedor lo acepta (ADR-0047).

### Sincronización y registro de cambios (ADR-0003, ADR-0038, ADR-0044)

- Época de la bajada: `cambios.epocas` (la aplicación solo la lee) y `leerEpoca`; `obtenerCambios` devuelve `epoca` ("inicial" sin fila). Solo la cambia `infra/limpieza/dejar-limpio.sql` (raíz del repositorio), en la transacción que borra: los teléfonos con la app 13 o posterior quitan lo que bajaron y bajan todo de nuevo.
- El registro de cambios tiene índices por destinatario y por entidad (migración `0038_registro_y_poda`). La tarea periódica lo compacta: borra las filas que ya tienen una más nueva para la misma entidad y el mismo destinatario.

### Avisos push (ADR-0023, ADR-0040)

Suscripciones por persona y navegador; un trabajo por suscripción, encolado en la transacción del hecho, enviado con VAPID en el worker. El texto no lleva datos del cliente, salvo los avisos `mensaje_de_oficina` y `respuesta_del_tecnico`, que llevan el cliente y el texto (excepción del ADR-0040). `avisos.enviar` acepta solo rutas relativas.

### Mantenimiento (ADR-0043, ADR-0044, ADR-0048, ADR-0055)

La tarea periódica `mantenimiento.recuperar` corre cada hora en el minuto 17 (`periodicas` en `tareas.ts`): vuelve a encolar lo que lleva más de 12 horas a medias (archivos, PDF de informes y cotizaciones), borra sesiones vencidas hace más de un día (oficina, campo y portal) y compacta el registro de cambios con la conexión del dueño.

También borra, con la conexión del dueño, la fila y el objeto de las fotos, bocetos y firmas sin actividad en 120 días que ningún levantamiento usa (`limpiarArchivosSinUso`, 500 por organización y pasada). Lo usado queda marcado en `archivos.en_uso_comprobado_en` y no se vuelve a mirar. Los planos y los PDF generados nunca entran. La limpieza bloquea las filas con `for update skip locked` y `archivos.estados` las lee con `for share`, así que un envío en curso nunca pierde un archivo.

Por último, quita los accesos al portal sin ingresos en 12 meses; si nunca entró, cuenta desde que se le dio (`quitarAccesosSinUso`, ADR-0055). Es lo mismo que cuando oficina lo quita: borra la fila con sus sesiones y su pedido, y registra `acceso_portal_quitado` en la historia del cliente con autor `sistema` y motivo `sin_uso`. Oficina lo devuelve con el interruptor de siempre.

### Portal (ADR-0053)

Un acceso por contacto, con correo; lo dan y lo quitan las rutas de clientes (`cambiarAccesoAlPortal`) por el puerto `PortalDeContactos`, que `app.ts` conecta con `accesosDelPortal`. Lo que cambia en el contacto (correo, nombre, qué recibe) cambia el acceso en la misma transacción; quitarlo borra sus sesiones y su pedido. El código (6 dígitos, 10 minutos, 5 intentos, un solo uso, atado a la cookie del navegador que lo pidió) se deriva con HMAC del id del pedido y un secreto por HKDF de `AUTH_SECRETO` (`portal/claves.ts`): no se guarda en la base ni pasa por la cola; el worker lo calcula al enviar el correo (`crearCorreosDelPortal`, trabajo `portal.correo`). Límite de pedidos por correo y de intentos por origen, y sesiones de 30 minutos desde el último uso, siempre con la conexión de `teins_portal`. El botón «Ver en el portal» de los correos de documentos sale solo si el contacto tiene acceso (`accesoAlPortal` en `crearEnvios`).

### Asistente de datos (ADR-0060)

- Tablas en el esquema `asistente` (migración 0044): `conversaciones`, `intercambios`, `ajustes` y `gastos` (preguntas y gasto por persona y mes AAAA-MM de Bogotá), con seguridad por fila. Además de la organización, toda lectura y escritura filtra por la persona: una conversación ajena responde `no_encontrado`. Eliminar es lógico (`eliminada_en`) y «Deshacer» la restaura.
- `preguntarAlAsistente` es idempotente por su `llave`, abre una conversación (su título es la primera pregunta, recortada) o sigue una propia, y encola `asistente.responder` en la misma transacción con **un solo intento**, en la cola `asistente:<organización>`: Graphile corre en serie los de una cola, así el asistente ocupa un solo cupo del worker por organización. Cada persona tiene como mucho dos respuestas en curso (`demasiadas_solicitudes`). Responde `estado_invalido` si ya hay una respuesta en curso en esa conversación (un índice único lo asegura también con pedidos a la vez), `tope_agotado` si el gasto del mes llegó al tope y `no_disponible` sin modelo.
- El bucle (`asistente/bucle.ts`) corre en el worker: historial compacto (preguntas y respuestas en texto, sin bloques de herramientas), y en cada vuelta revisa `detener_pedido` y el tope, llama al modelo, ejecuta en paralelo las herramientas pedidas (cada una en su `enOrganizacion` con la conexión de negocio) y guarda los pasos y el costo. Termina con `entregar_respuesta` (la respuesta se arma con los resultados guardados de los pasos citados; una referencia que no existe se descarta), con `end_turn` (el texto, sin referencias), en error con `refusal` o `max_tokens`, o a las 8 vueltas o 3 minutos. Nunca queda en curso: una excepción lo deja en error, y uno que venció (5 minutos desde que el worker lo tomó, o 30 desde creado si nunca arrancó) se cierra en error al leer la conversación o al preguntar; el bucle revisa el estado en cada vuelta y para si ya no está en curso. Por vuelta se ejecutan como mucho 5 herramientas; un resultado de más de 60 KB, o lo que pasa de 200 KB en la vuelta, le llega al modelo como error. `entregar_respuesta` va sola: junto con otras se rechaza. `pause_turn` y `end_turn` sin texto terminan en error.
- Las herramientas implementan `Herramienta` (`asistente/tipos.ts`). `worker.ts` las arma con `crearHerramientasDelAsistente` (`asistente/herramientas/`) y las pasa a `crearAsistente({ herramientas })`. La web no recibe modelo ni herramientas.
- `entregar_respuesta` destaca hasta dos cifras de un paso (`destacado: { paso, cifras }`): el servidor quita repetidas y las que no existen y corta en dos, porque el esquema estricto de la API no exige el máximo. La raya larga del texto pasa a viñeta al inicio de una línea y a coma en medio de una frase.
- Lo que recibe el modelo cuando algo falla: los problemas de su entrada (ruta y mensaje de Zod), el detalle de una herramienta que responde `entrada_invalida` o `no_encontrado` («acote el periodo…»), o «La consulta falló.» para lo demás, sin detalles internos. Si el resultado trae `etiqueta`, reemplaza la etiqueta hecha del paso.
- Conservación (Ley 1581, principio de temporalidad): al terminar, cada paso guarda solo herramienta, etiquetas, estado y resumen; el resultado completo se borra. La tarea periódica (`purgarConversacionesDelAsistente`) borra del todo, con sus intercambios, las conversaciones eliminadas hace más de un día y las que llevan un año sin actividad. El gasto vive en `gastos`: borrar nunca lo baja, y el tope y el uso leen de ahí. Por eso `teins_app` puede borrar en `conversaciones` e `intercambios`, y no en `gastos` ni `ajustes`.
- Costo y reintentos: la SDK reintenta una vez (`maxRetries: 1`). El gasto se suma con lo que informa cada respuesta, así que una vuelta cortada por tiempo (o un reintento que la API cobró sin devolver respuesta) no queda contada. El respaldo es el límite de gasto en la consola de Anthropic, que debe estar puesto. La caché leída se cobra 0,1 de la entrada en Haiku y 0,05 en Sonnet y Opus (`costo.ts`).
- Cambiar el tope queda en la auditoría de la organización (`tope_del_asistente_cambiado`), con quién y el valor anterior y el nuevo.
- Modelo: `modeloAnthropic` (Messages API, herramientas estrictas, caché del sistema y de la conversación) o `modeloSimulado`, un guion por palabras clave que pide las herramientas reales por nombre. Los precios por modelo están en `asistente/costo.ts`, en enteros; el costo de cada vuelta se guarda en decimal.
- Variables: `ANTHROPIC_API_KEY` (opcional, `sk-ant-…`) **solo en el worker**; `ASISTENTE_MODELO` (por omisión `claude-haiku-5-5`, debe tener precio en el código); `ASISTENTE_ACTIVO=true` en la web cuando el worker tiene llave (la web nunca la recibe, y `disponible` sale de ahí); `ASISTENTE_SIMULADO=true` en web y worker, solo fuera de producción o en el entorno de pruebas, con `ASISTENTE_SIMULADO_PAUSA_MS` (400 por omisión) entre vueltas.
- Los registros solo llevan ids, tokens, duración y códigos de error; nunca la pregunta ni los resultados (ADR-0017).

## Pruebas

`pnpm --filter @teins/servidor test` levanta PostgreSQL 18 y S3Mock con Testcontainers (`pruebas/preparar.ts`). Requiere Docker; con Colima se detecta solo. Una prueba por área en `pruebas/` (por ejemplo `bajada.test.ts`, `revision.test.ts`, `envios.test.ts`, `mantenimiento.test.ts`). `temporada-alta.test.ts` (QA-14) corre el escenario de temporada alta a la vez, con más personas que conexiones tiene el pool de prueba (5): una operación que pide una segunda conexión con su transacción abierta hace que todas se traben y fallen a los 10 s, y ahí se ve.

### Ensayo de carga (QA-14, iteración 51)

Lo que la prueba no mide (cuánto tarda cada cosa con servidores reales, la memoria del worker con Chromium) lo mide el ensayo, `ensayo/ensayo-de-carga.ts`. No corre en la integración continua: se corre a mano, en local o contra el entorno de pruebas, antes de una versión o después de cambiar la infraestructura. Habla con el servidor por el contrato de `protocolo`, como las apps: técnicos con señal que suben sus fotos de a una y envían, técnicos sin señal que la recuperan todos a la vez, y oficina que toma de la bandeja compartida, revisa, corrige y publica (cada informe, un PDF). Compara con las metas: cero errores del servidor y cero levantamientos perdidos, los que recuperan la señal recibidos en menos de 5 minutos, cada PDF en menos de 3 y las consultas de oficina en menos de 1 s.

```sh
TEINS_CONTRASENA=... pnpm --filter @teins/servidor preparar-ensayo     # una vez por entorno
TEINS_CONTRASENA=... pnpm --filter @teins/servidor ensayo-de-carga     # 10 con señal, 10 sin señal, 5 de oficina, 10 fotos
TEINS_CONTRASENA=... pnpm --filter @teins/servidor ensayo-de-carga --con-senal 2 --sin-senal 2 --oficina 1 --fotos 3   # prueba rápida
```

En local va al servidor del puerto 3000 (con `dev:web` y `dev:worker` corriendo). Contra el entorno de pruebas, con `E2E_CAMPO_URL` y `E2E_OFICINA_URL` (`docs/proceso/entorno-de-pruebas.md`, "Ensayo de carga"). Para que repetirlo cueste poco:

- Corre en su propia organización: nunca se mezcla con los datos de demostración, y cada corrida cancela sus visitas de hoy de la corrida anterior antes de programar las suyas.
- Guarda las sesiones fuera del repositorio (`$TMPDIR/teins-ensayo`): solo la primera corrida las inicia, con el límite de 5 por minuto por dirección (QA-7, unos 5 minutos). Después, el escenario completo tarda cerca de 30 s en local y de 1 a 1,5 minutos contra el entorno de pruebas.
- Genera una sola foto con Chromium (1600 px, calidad 0,8, como la cámara de campo, unos 550 KB) y saca las demás de ella con otra huella. El escenario por defecto sube unos 110 MB.
- Contra Railway, los tiempos que ve el ensayo incluyen el internet de quien lo corre: los veinte técnicos suben por una sola conexión. Por eso lee el tiempo dentro del servidor de los registros (`railway logs`, con la CLI enlazada a ese entorno) y evalúa con él la meta de oficina. La memoria y la CPU de cada servicio, con `railway metrics -s worker --memory --since <hora>`.

Con `--json <archivo>` deja el resultado para compararlo con el de otra corrida (fuera del repositorio, por ejemplo `~/ensayo-$(date +%F).json`). Sale con 1 si una meta no se cumple.

## Despliegue (ADR-0016)

Una imagen para todo: `docker build -t teins .` desde la raíz. Incluye el servidor compilado (`pnpm --filter @teins/servidor compilar`), sus migraciones, Chromium y las superficies `campo`, `oficina` y `portal`.

| Proceso | Comando | Réplicas |
|---|---|---|
| Migración, antes de cada versión | `node dist/cli/migrar.js` | Una vez, como paso de lanzamiento |
| Rol web (por defecto) | `node --enable-source-maps dist/web.js` | Una o más; sin estado |
| Rol worker | `node --enable-source-maps dist/worker.js` | Una o más |

Variables de entorno: las de `.env.example` más `NODE_ENV=production`, `PROXIES_DE_CONFIANZA` (cuántos proxies de la plataforma hay delante; en Railway, `2`), `SUPERFICIE_CAMPO_HOST`, `SUPERFICIE_OFICINA_HOST` y `SUPERFICIE_PORTAL_HOST` (por ejemplo `campo.<dominio>`), con `ORIGENES_CONFIABLES` en `https://` para campo y oficina. La configuración no arranca con orígenes `https` en modo de desarrollo (saldrían cookies sin `Secure`) ni en producción sin `PROXIES_DE_CONFIANZA` (todas las solicitudes compartirían un solo límite de intentos). Las contraseñas y el secreto van en el gestor de secretos de la plataforma, nunca en el repositorio.

Antes del primer despliegue en un entorno: crear el rol `teins_app` con `infra/roles.sql` y darle contraseña desde la consola del proveedor. CORS del almacenamiento: `S3_CONFIGURAR_CORS=true` si el token puede administrar el bucket; si no (R2 con token de objetos), en el panel del proveedor. Con Cloudflare R2, `S3_EXIGIR_HUELLA=false` (no admite la huella en la carga; la verifica el worker). `node dist/cli/sembrar.js` solo en pruebas, con `ENTORNO_DE_PRUEBAS=true`. Railway: [`docs/proceso/entorno-de-pruebas.md`](../../docs/proceso/entorno-de-pruebas.md) y [`docs/proceso/produccion.md`](../../docs/proceso/produccion.md).

Salud: `GET /salud` verifica la base de datos. El rol web detrás de un proxy confía en sus encabezados solo con `PROXIES_DE_CONFIANZA`: la IP del cliente es la que está justo antes de esos proxies en `X-Forwarded-For`, y lo que el cliente escriba antes se ignora. La correlación de cada solicitud (`x-correlacion`, la que va a la auditoría) la genera siempre el servidor. Toda respuesta de `/api` sale con `Cache-Control: no-store`, también los errores: nada de una persona queda en la caché de un navegador compartido ni de un proxy.
