# servidor

Monolito modular (ADR-0001): un código con dos roles de ejecución, `web` (API) y `worker` (trabajos).

**Dependencias:** `dominio` y `protocolo`. Nunca `campo`, `oficina`, `portal` ni `ui`.

**ADR relevantes:** 0001, 0003, 0005, 0007, 0008, 0009, 0010, 0012, 0014, 0016, 0017

## Estructura

```
src/
  plataforma/   Lo que usan todos los módulos: base de datos, transacción por organización,
                errores, rutas con política, cola, almacenamiento.
  modulos/
    identidad/       Usuarios, sesiones (Better Auth), resolución del actor, desactivación,
                     dispositivos (secreto, informe de salud, orden de borrado), llaves de acceso
                     (una instancia de Better Auth por dominio de superficie: cada llave queda ligada al suyo).
    formatos/        Versiones de formato inmutables y meta-esquema.
    archivos/        Subida firmada, verificación en el worker, descarga firmada.
    auditoria/       Registro semántico con cadena de hashes.
    cambios/         Registro de cambios para la bajada, serializado por organización (punto de control seguro).
    clientes/        Clientes y sitios, datos mínimos.
    visitas/         Visitas programadas y técnicos asignados.
    levantamientos/  Recepción idempotente del envío (núcleo hexagonal) y bandeja de oficina.
                     Proyecta las líneas de cantidad a `lineas_cantidad`, donde vive su vínculo al catálogo.
    catalogo/        Ítems del catálogo (código, descripción, unidad), importación en bloque por código.
                     Cada ítem creado, editado o importado se registra para la bajada (ADR-0025).
    sincronizacion/  Bajada: compone los cambios del técnico con las interfaces de los demás módulos.
    informes/        Informe por visita, versiones publicadas inmutables y su PDF (plantilla HTML,
                     Chromium y pdf-lib en el worker, ADR-0013). Las firmas van en una "Constancia de
                     visita", sin cuadrícula y recortadas (ADR-0024).
    portal/          Accesos de cliente (scrypt, límite de intentos, sesiones cortas) y rutas del portal,
                     siempre con la conexión del rol teins_portal (ADR-0009, partes 3 y 4).
    avisos/          Avisos push (ADR-0023): suscripciones por persona y navegador, un trabajo por
                     suscripción encolado en la transacción del hecho, envío con VAPID en el worker.
    cotizaciones/    Cotizaciones desde las cantidades revisadas (ADR-0029): borrador, consecutivo por año,
                     versiones inmutables con su PDF (cola `pdf`) y envío por `envios`.
    envios/          Informe al cliente por correo (Resend) y WhatsApp (Cloud API de Meta), ADR-0028:
                     un envío por contacto y canal, que sale al quedar listo el PDF; eventos firmados
                     de los proveedores y proveedores simulados (ENVIOS_SIMULADOS).
  app.ts        Composición del rol web.
  web.ts        Punto de entrada del rol web.
  worker.ts     Punto de entrada del rol worker.
  tareas.ts     Trabajos de la cola: todo trabajo declarado debe tener manejador.
migraciones/    SQL generado por drizzle-kit más migraciones propias (permisos, cola).
infra/          SQL que ejecuta la infraestructura, no las migraciones (rol de la aplicación).
pruebas/        Integración con PostgreSQL y S3Mock reales en contenedores.
```

Reglas de la estructura:

- Un módulo solo importa la interfaz pública de otro (`modulos/<nombre>/index.ts`), nunca sus tablas.
- Todo dato de negocio se lee y escribe dentro de `enOrganizacion`: la seguridad por fila de la base filtra por organización.
- Toda ruta declara su política; una ruta sin política impide arrancar.
- Todo cambio de esquema es de expansión (ADR-0015): columnas nuevas con valor por defecto o anulables.

## Roles de base de datos

| Rol | Uso | Permisos |
|---|---|---|
| Dueño (`DATABASE_URL_PROPIETARIO`) | Migraciones y cola de trabajos. Solo la reciben el worker, `migrar`, `sembrar` y `crear-organizacion` (la exigen con `urlDelPropietario`); el rol web arranca sin ella | Dueño de los esquemas |
| `teins_portal` (`DATABASE_URL_PORTAL`) | Rutas del portal del cliente | Solo versiones publicadas con PDF listo del cliente de la sesión, sus accesos, sesiones e intentos, y registrar en auditoría |
| `teins_app` (`DATABASE_URL`) | Solicitudes y trabajos de negocio | Mínimos por tabla; sujeto a seguridad por fila; solo inserta y lee en auditoría, formatos y el registro de cambios; no borra en ninguna tabla de negocio |

`teins_app` lo crea la infraestructura con `infra/roles.sql` (en local lo hace Docker Compose).

## Desarrollo local

```sh
docker compose up -d --wait          # desde la raíz: PostgreSQL y S3Mock
cp paquetes/servidor/.env.example paquetes/servidor/.env   # y ponga AUTH_SECRETO
pnpm --filter @teins/servidor migrar
pnpm --filter @teins/servidor sembrar     # organización, formatos de prueba, dos usuarios (muestra sus contraseñas) y un cliente con una visita
pnpm --filter @teins/servidor dev:web     # http://localhost:3000
pnpm --filter @teins/servidor dev:worker
```

Comandos de administración (uso en el encabezado de cada archivo de `src/cli/`). Todo esto también se hace en oficina: usuarios, accesos de clientes y retiro de versiones en "Administración" (iteración 6); clientes, sitios y visitas en "Clientes" y "Visitas" (iteración 7). Los comandos quedan para la primera persona administradora, la publicación de formatos y la operación por consola:

| Comando | Qué hace |
|---|---|
| `crear-usuario`, `restablecer-contrasena` | Usuarios internos y recuperación de acceso |
| `desactivar-usuario` | Revoca: cierra sus sesiones, no vuelve a entrar y sus teléfonos borran sus datos al conectarse |
| `crear-organizacion` | Crea la organización de un entorno que no se siembra (producción); si ya existe, no la toca |
| `generar-claves-avisos` | Imprime un par de claves VAPID para `AVISOS_VAPID_PUBLICA` y `AVISOS_VAPID_PRIVADA` (ADR-0023). La privada es un secreto: va a las variables del entorno, nunca al repositorio. Sin claves, los avisos quedan apagados |
| `verificar-integridad` | Verifica todas las cadenas de la auditoría de una base con la conexión del dueño (`DATABASE_URL`); lo usa el simulacro de restauración (`docs/proceso/produccion.md`) |
| `marcar-administrador` | Marca (o con `--quitar`, desmarca) a una persona de oficina como administradora; para administrar debe activar además el segundo factor en oficina |
| `crear-cliente` | Cliente con su primer sitio |
| `crear-visita`, `reasignar-visita` | Programa una visita para uno o varios técnicos; al reasignar, sale del teléfono de quien deja de tenerla |
| `publicar-formato` | Publica una versión de formato desde un JSON; llega a los teléfonos en la siguiente bajada |
| `publicar-simbolos` | Publica la biblioteca de símbolos de los bocetos desde un JSON (ADR-0027): crea o cambia cada símbolo y retira los que ya no están; llega a la app 10 en la siguiente bajada. La de prueba es `@teins/dominio/formatos-de-prueba/simbolos-prueba.json`, que `sembrar` publica |
| `crear-acceso-cliente`, `regenerar-acceso-cliente` | Acceso de un cliente al portal: muestra una sola vez identificador, clave y QR (`--qr archivo.svg` lo guarda); regenerar invalida el anterior y sus sesiones |

El permiso de trabajo sin conexión dura `DIAS_PERMISO_LOCAL` días (7 por defecto) desde el último contacto.

Cotizaciones (iteración 21, ADR-0029): la lista de precios vive en `catalogo.precios` (una fila por cambio, el vigente es el más reciente; cambiarla o importarla con precios exige administración con segundo factor) y las cotizaciones en el esquema `cotizaciones` (migraciones `0026` y `0027`: las versiones publicadas solo dejan cambiar las columnas de su PDF). `crearCotizacion` toma las cantidades de los levantamientos revisados (`levantamientos.cantidadesRevisadas`) con los precios vigentes; `publicarCotizacion` congela líneas, impuestos y totales, encola `cotizaciones.generarPdf` y programa los envíos con el mensaje de tipo `cotizacion`. La impresión HTML a PDF está en `plataforma/pdf.ts` y la usan el informe y la cotización. `GET /api/cotizaciones/{id}/vista-previa` (iteración 24) devuelve el borrador guardado con la misma plantilla, como documento HTML para un marco de oficina: `registrarDocumento` (`plataforma/rutas.ts`) le pone su propia CSP, sin scripts ni conexiones.

Envíos al cliente (iteración 20, ADR-0028): los contactos viven en `clientes.contactos` y los envíos en `envios.envios` (migraciones `0024` y `0025`). Publicar con `destinatarios` crea los envíos "En cola"; el worker los encola al marcar el PDF listo (`enviarAlQuedarListo`) y los manda con el trabajo `envios.enviar`. Sin `RESEND_CLAVE_API` o sin `WHATSAPP_TOKEN` y `WHATSAPP_NUMERO_ID`, ese canal queda "No llegó: no está configurado"; con `ENVIOS_SIMULADOS=true` (desarrollo, extremo a extremo y entorno de pruebas; nunca en producción) nada sale del servidor y una dirección con "rebota" o un celular que termina en 000 se rechazan. Los eventos de Resend llegan a `POST /api/envios/eventos/correo` (firma Svix con `RESEND_SECRETO_EVENTOS`) y los de Meta a `GET` y `POST /api/envios/eventos/whatsapp` (`WHATSAPP_TOKEN_VERIFICACION` y `WHATSAPP_SECRETO_APP`). Todas las variables están en `.env.example`. Enviar otra vez (`enviarVersion`, `enviarCotizacion`) acepta una `llave`: el mismo pedido repetido no crea otro envío (regla 4, migración `0029`).

Símbolos (iteración 19, ADR-0027): módulo `simbolos` con su tabla por organización (migraciones `0022` y `0023`); `publicar` valida la biblioteca con `validarBiblioteca` del dominio y registra un cambio `simbolo` por símbolo tocado, que la sincronización entrega a la app 10 o posterior. En el PDF, el símbolo copiado en el boceto se dibuja con `hojaASvg`.

Bocetos en el PDF (iteración 18, ADR-0026): cada hoja se convierte a SVG (`hojaASvg`); las verticales van de a dos por fila y una apaisada ocupa la fila, con su nombre si hay varias. El worker valida la versión 2 desde ya: el servidor se despliega antes que la app 9.

PDF del informe: las URL firmadas de descarga llevan `Content-Disposition: attachment` con un nombre legible (`firmarDescarga(clave, { descargarComo })`, iteración 14), así que oficina y el portal lo descargan sin salir de la pantalla; fotos y bocetos siguen en línea. El worker usa Chromium: uno por proceso, compartido por los documentos en curso (cada uno en su propio contexto) y cerrado tras un minuto sin documentos. En la imagen es el de Alpine (`CHROMIUM_RUTA=/usr/bin/chromium`); en desarrollo, sin esa variable, el que instala Playwright (`pnpm --filter @teins/e2e exec playwright install chromium` si falta).

Cuenta propia (iteración 25, ADR-0033): `usuarios.debe_cambiar_contrasena` (migración `0030`) marca la contraseña que genera Administración al crear, restablecer o reactivar; `crear-usuario` y `restablecer-contrasena` no la marcan (quien corre el comando la elige). Con la marca, `evaluar` (`plataforma/politicas.ts`) responde `cambio_de_contrasena_requerido` salvo en las políticas `conContrasenaTemporal` (leer la sesión y cambiar la contraseña), y el puente niega `RUTAS_CON_SESION` (llaves y activar el segundo factor). `POST /api/cuenta/contrasena` y `POST /api/cuenta/segundo-factor/quitar` llaman a Better Auth por su manejador HTTP con las cookies y la IP de la solicitud (`llamarAuth` en `modulos/identidad/index.ts`, sobre el `http` que `registrarOperacion` pasa a cada operación), así aplican su límite de intentos; una credencial equivocada es `credencial_incorrecta` (422) con su campo. `POST /api/administracion/usuarios/{id}/reactivar` devuelve la temporal y deja las órdenes de borrado pendientes.

Nueva migración: cambie el esquema del módulo y ejecute `pnpm --filter @teins/servidor generar-migracion --name <nombre>`. Los permisos de una tabla nueva van en una migración propia (`--custom`).

## Pruebas

`pnpm --filter @teins/servidor test` levanta PostgreSQL 18 y S3Mock con Testcontainers. Requiere Docker; con Colima se detecta solo.

## Despliegue (ADR-0016)

Una imagen para todo: `docker build -t teins .` desde la raíz. Incluye el servidor compilado (`pnpm --filter @teins/servidor compilar`), sus migraciones y las superficies `campo` y `oficina`.

| Proceso | Comando | Réplicas |
|---|---|---|
| Migración, antes de cada versión | `node dist/cli/migrar.js` | Una vez, como paso de lanzamiento |
| Rol web (por defecto) | `node --enable-source-maps dist/web.js` | Una o más; sin estado |
| Rol worker | `node --enable-source-maps dist/worker.js` | Una o más |

Variables de entorno: las de `.env.example` más `NODE_ENV=production`, `PROXIES_DE_CONFIANZA` (cuántos proxies de la plataforma hay delante; en Railway, `2`), `SUPERFICIE_CAMPO_HOST` y `SUPERFICIE_OFICINA_HOST` (por ejemplo `campo.<dominio>` y `oficina.<dominio>`), con `ORIGENES_CONFIABLES` en `https://` para esos mismos hosts. La configuración no arranca con orígenes `https` en modo de desarrollo (saldrían cookies sin `Secure`) ni en producción sin `PROXIES_DE_CONFIANZA` (todas las solicitudes compartirían un solo límite de intentos). Las contraseñas y el secreto van en el gestor de secretos de la plataforma, nunca en el repositorio.

Antes del primer despliegue en un entorno: crear el rol `teins_app` con `infra/roles.sql` y darle contraseña desde la consola del proveedor. CORS del almacenamiento: `S3_CONFIGURAR_CORS=true` si el token puede administrar el bucket; si no (R2 con token de objetos), en el panel del proveedor. Con Cloudflare R2, `S3_EXIGIR_HUELLA=false` (no admite la huella en la carga; la verifica el worker). `node dist/cli/sembrar.js` solo en pruebas, con `ENTORNO_DE_PRUEBAS=true`; nunca corre en producción. Entorno de pruebas en Railway (servicios, variables, operación): [`docs/proceso/entorno-de-pruebas.md`](../../docs/proceso/entorno-de-pruebas.md). La imagen incluye todo comando de `src/cli/` (`scripts/compilar.mjs`).

Salud: `GET /salud` verifica la base de datos. El rol web detrás de un proxy confía en sus encabezados solo con `PROXIES_DE_CONFIANZA`: la IP del cliente es la que está justo antes de esos proxies en `X-Forwarded-For`, y lo que el cliente escriba antes se ignora. La correlación de cada solicitud (`x-correlacion`, la que va a la auditoría) la genera siempre el servidor.
