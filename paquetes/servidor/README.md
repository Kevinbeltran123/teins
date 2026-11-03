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
    portal/          Accesos de cliente y rutas del portal, con la conexión de `teins_portal` (ADR-0009).
    avisos/          Avisos push (ADR-0023, ADR-0040).
    mantenimiento/   La tarea periódica: recupera trabajos a medias, poda y borra archivos sin uso (ADR-0043, ADR-0044, ADR-0048).
migraciones/    SQL generado por drizzle-kit más migraciones propias (permisos, cola). La última es 0039 (archivos sin uso, ADR-0048).
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
| Dueño (`DATABASE_URL_PROPIETARIO`) | Migraciones, cola de trabajos y compactar el registro de cambios. Solo la reciben el worker, `migrar`, `sembrar` y `crear-organizacion` (la exigen con `urlDelPropietario`); el rol web arranca sin ella | Dueño de los esquemas |
| `teins_portal` (`DATABASE_URL_PORTAL`) | Rutas del portal del cliente | Solo versiones publicadas con PDF listo del cliente de la sesión, sus accesos, sesiones e intentos, y registrar en auditoría |
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

`pnpm --filter @teins/servidor <comando>`; en un entorno desplegado, `node dist/cli/<comando>.js` (la imagen incluye todo `src/cli/`, `scripts/compilar.mjs`). Usuarios, accesos de clientes y retiro de versiones también se hacen en oficina, en "Administración"; clientes, sitios y visitas, en "Clientes" y "Visitas". Los comandos quedan para la primera persona administradora, la publicación de formatos y símbolos y la operación por consola.

| Comando | Qué hace |
|---|---|
| `migrar` | Aplica las migraciones (antes de cada versión) |
| `sembrar` | Datos de prueba. Solo en desarrollo o con `ENTORNO_DE_PRUEBAS=true`; nunca en producción |
| `crear-organizacion` | Crea la organización de un entorno que no se siembra (producción); si ya existe, no la toca |
| `crear-usuario`, `restablecer-contrasena` | Usuarios internos y recuperación de acceso. No marcan la contraseña como temporal: quien corre el comando la elige |
| `desactivar-usuario` | Revoca: cierra sus sesiones, no vuelve a entrar y sus teléfonos borran sus datos al conectarse; lo que tenía en revisión queda sin tomar |
| `marcar-administrador` | Marca (o con `--quitar`, desmarca) a una persona de oficina como administradora; para administrar debe activar además el segundo factor en oficina |
| `crear-cliente` | Cliente con su primer sitio |
| `crear-visita`, `reasignar-visita` | Programa una visita para uno o varios técnicos (no valida cruces de horario); al reasignar, sale del teléfono de quien deja de tenerla. Al programar se le asigna el siguiente número de orden de servicio |
| `fijar-consecutivo-de-ordenes` | `--organizacion <uuid> --ultimo <n>`: la siguiente visita sigue desde el número de TEINS (ADR-0051). Nunca baja ni repite un número |
| `publicar-formato` | Publica una versión de formato desde un JSON; llega a los teléfonos en la siguiente bajada |
| `publicar-simbolos` | Publica la biblioteca de símbolos desde un JSON (ADR-0027): crea o cambia cada símbolo y retira los que ya no están. La de prueba es `@teins/dominio/formatos-de-prueba/simbolos-prueba.json`, que `sembrar` publica |
| `crear-acceso-cliente`, `regenerar-acceso-cliente` | Acceso de un cliente al portal: muestra una sola vez identificador, clave y QR (`--qr archivo.svg` lo guarda); regenerar invalida el anterior y sus sesiones |
| `generar-claves-avisos` | Imprime un par de claves VAPID para `AVISOS_VAPID_PUBLICA` y `AVISOS_VAPID_PRIVADA` (ADR-0023). La privada es un secreto: va a las variables del entorno, nunca al repositorio. Sin claves, los avisos quedan apagados |
| `verificar-integridad` | Verifica todas las cadenas de la auditoría de una base; recibe la conexión del dueño en `DATABASE_URL`. Lo usa el simulacro de restauración (`docs/proceso/produccion.md`) |

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

### Mantenimiento (ADR-0043, ADR-0044, ADR-0048)

La tarea periódica `mantenimiento.recuperar` corre cada hora en el minuto 17 (`periodicas` en `tareas.ts`): vuelve a encolar lo que lleva más de 12 horas a medias (archivos, PDF de informes y cotizaciones), borra sesiones vencidas hace más de un día (oficina, campo y portal) y compacta el registro de cambios con la conexión del dueño.

También borra, con la conexión del dueño, la fila y el objeto de las fotos, bocetos y firmas sin actividad en 120 días que ningún levantamiento usa (`limpiarArchivosSinUso`, 500 por organización y pasada). Lo usado queda marcado en `archivos.en_uso_comprobado_en` y no se vuelve a mirar. Los planos y los PDF generados nunca entran. La limpieza bloquea las filas con `for update skip locked` y `archivos.estados` las lee con `for share`, así que un envío en curso nunca pierde un archivo.

### Portal (ADR-0009)

Accesos de cliente con scrypt, límite de intentos y sesiones cortas, siempre con la conexión de `teins_portal`.

## Pruebas

`pnpm --filter @teins/servidor test` levanta PostgreSQL 18 y S3Mock con Testcontainers (`pruebas/preparar.ts`). Requiere Docker; con Colima se detecta solo. Una prueba por área en `pruebas/` (por ejemplo `bajada.test.ts`, `revision.test.ts`, `envios.test.ts`, `mantenimiento.test.ts`).

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
