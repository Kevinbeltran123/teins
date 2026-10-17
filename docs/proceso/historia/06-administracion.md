[Plan de entrega](../plan-de-entrega.md) · Anterior: [Corte 5 · Portal del cliente](05-portal-del-cliente.md) · Siguiente: [Iteración 7 · Gestión de visitas y clientes](07-visitas-y-clientes.md)

# Iteración 6 · Administración

**Estado en el mapa al 2026-10-16:** Terminada y desplegada en el entorno de pruebas

**Estado:** terminada y desplegada el 2026-09-25 (Kevin pidió avanzar con la siguiente iteración; administración era la recomendada).

**Para qué:** que TEINS opere el piloto sin comandos: una persona administradora, con segundo factor obligatorio (ADR-0009), gestiona usuarios, ve la salud de los teléfonos (ADR-0017), entrega los accesos de sus clientes con su QR y retira una versión del portal si hace falta.

## Alcance

- **Administrador = persona de oficina con la marca `administrador`.** El modelo de dominio dice que los roles son un conjunto asignable; en TEINS quien administra también revisa, así que no necesita dos cuentas. La primera persona administradora se marca por comando.
- **Segundo factor obligatorio (ADR-0009):** TOTP con el plugin de Better Auth (app autenticadora y códigos de respaldo). Sin segundo factor activo, ninguna acción de administración responde; la pantalla guía la activación. El ingreso pide el código después de la contraseña.
- **Usuarios:** lista, crear (técnico u oficina, con contraseña temporal que se muestra una vez), restablecer contraseña, desactivar (revocación del corte 2), marcar o quitar administrador.
- **Dispositivos (ADR-0017, parte 3):** panel con la salud de cada teléfono (versión de la app, pendientes y el más antiguo, espacio, persistente, último error, último contacto, orden de borrado) y alerta de pendientes viejos.
- **Accesos de clientes:** lista de clientes con su acceso; crear o regenerar muestra una vez código, clave y QR.
- **Retirar una versión del portal** (modelo de dominio, estado "versión retirada"): con motivo, queda en la auditoría; el cliente pasa a ver la anterior vigente.

## Fuera de la iteración 6

| Qué | Dónde se resuelve |
|---|---|
| Crear y programar clientes, sitios y visitas desde oficina | Iteración de gestión de visitas y clientes (la siguiente recomendada) |
| Editar formatos y catálogo | Cuando TEINS lo pida (P10) |
| Passkeys | Iteración 13 |
| Rol supervisor | Cuando TEINS defina qué hace |

## Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Una persona administradora sin segundo factor no puede administrar; lo activa y desde entonces el ingreso le pide el código | Cumplido en integración (`pruebas/administracion.test.ts`) y extremo a extremo por la interfaz (`e2e/pruebas/administracion.spec.ts`) |
| 2. Extremo a extremo: la administradora crea un técnico, ve su teléfono en el panel tras la primera sincronización, crea el acceso de un cliente con QR y retira una versión del portal | Cumplido en Chromium y WebKit en local y en Chromium contra el entorno (`administracion.spec.ts`; el retiro, al final de `portal.spec.ts`) |
| 3. Oficina sin marca de administrador y técnicos no acceden a nada de administración | Cumplido en integración (403 `sin_permiso`; un técnico tampoco puede activar el segundo factor) |
| 4. Cada acción queda en la auditoría | Cumplido en integración: creación, restablecimiento, desactivación, marca, activación del segundo factor y retiro con su motivo |
| 5. Desplegado en el entorno de pruebas con el extremo a extremo en verde contra él | Cumplido el 2026-09-25 (migraciones 0011 y 0012 aplicadas por `campo`) |

## Decisiones tomadas al construirlo

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
