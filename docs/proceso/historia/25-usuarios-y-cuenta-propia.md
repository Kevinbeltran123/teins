[Plan de entrega](../plan-de-entrega.md) · Anterior: [Iteración 24 · Robustez y protección](24-robustez-y-proteccion.md) · Siguiente: [Iteración 26 · Vista en vivo de los documentos](26-vista-en-vivo.md)

# Iteración 25 · Usuarios y cuenta propia

**Estado en el mapa al 2026-10-16:** Terminada, desplegada en el entorno de pruebas y en producción (2026-10-01)

**Estado:** prototipo aprobado por Kevin el 2026-10-01 (`prototipos/cuenta/prototipo.html`), construida, verificada, desplegada en el entorno de pruebas y llevada a producción ese día.

**Para qué (ADR-0033):** que la contraseña que entrega administración deje de servir al primer ingreso, que cada persona cambie la suya, que quien no administra pueda quitar su segundo factor y que un usuario desactivado por error vuelva con su misma cuenta. Kevin pidió que la seguridad no baje: cada regla la exige el servidor, aunque se llame a la API sin pasar por la pantalla.

## Alcance

- **Contraseña temporal:** la que se entrega al crear, restablecer o reactivar desde Administración queda marcada (`debe_cambiar_contrasena`, migración 0030). Con la marca, el servidor responde `cambio_de_contrasena_requerido` (403) a toda operación salvo leer la sesión y cambiar la contraseña, y el puente de Better Auth niega registrar llaves y activar el segundo factor. Oficina muestra "Cree su contraseña" sin menú; campo, "Crea tu contraseña" dentro del ingreso, sin guardar el usuario en el teléfono hasta cambiarla.
- **Cambiar la propia contraseña** (`POST /api/cuenta/contrasena`): con la actual; la nueva de 10 a 128 caracteres y distinta de la actual. Cierra las demás sesiones (siempre: lo decide el servidor) y deja abierta la que la cambió, con el segundo factor y las llaves intactos. En oficina, hoja lateral en "Mi cuenta › Acceso"; en campo, "Tu cuenta › Cambiar contraseña", que sin señal no se abre.
- **Quitar el propio segundo factor** (`POST /api/cuenta/segundo-factor/quitar`): con la contraseña y un código vigente de la app; nunca para quien administra (403 aunque se llame directo). Cierra las demás sesiones.
- **Reactivar** (`POST /api/administracion/usuarios/{id}/reactivar`): en la fila del desactivado, con consecuencias; entrega una temporal una sola vez. No devuelve sesiones, llaves, segundo factor ni avisos, y las órdenes de borrado pendientes de sus teléfonos siguen.
- Restablecer la propia contraseña desde Administración se niega también en el servidor (antes solo la pantalla no lo ofrecía).

## Fuera de la iteración 25

- Activar el segundo factor quien no administra: el prototipo dibuja "Activar" en "Mi cuenta", pero el ADR no lo pide y hoy solo se activa al entrar a Administración. Queda "Sin activar" sin botón; se decide cuando haga falta.
- "Llaves de acceso" como una fila con "Administrar" (prototipo): se conserva la lista completa de 13 que ya tenía "Mi cuenta", debajo de "Acceso".
- Recuperar la contraseña sin administración (correo o SMS): ADR-0009 deja la recuperación en manos de quien administra.

## Terminado cuando

| Criterio | Evidencia |
|---|---|
| 1. El servidor exige cada regla sin la pantalla | `servidor/pruebas/cuenta.test.ts` (9 pruebas): la temporal solo lee la sesión y la cambia (sincronizar y registrar una llave dan 403); igual a la temporal no sirve; restablecer desde Administración la marca y el comando del servidor no; Better Auth no expone `/change-password` ni `/two-factor/disable`; la actual equivocada da 422 en su campo; otras sesiones se cierran; mismo límite de intentos que el ingreso (429); quitar el segundo factor pide código y contraseña y se niega a quien administra; reactivar exige administración con segundo factor, marca la temporal, no deshace la orden de borrado y no se repite; quien administra no restablece la suya |
| 2. Oficina y campo como el prototipo | Capturas en claro y oscuro de las ocho pantallas comparadas con el prototipo |
| 3. Recorrido de punta a punta | `e2e/pruebas/cuenta.spec.ts` (temporal en oficina, cambio desde "Mi cuenta", quien administra sin botón para quitar el factor; reactivar y crear la propia en campo, y cambiarla desde "Tu cuenta") y `administracion.spec.ts` actualizado |
| 4. Verificación completa en local | Typecheck, arquitectura, licencias, auditoría, pruebas de paquetes (servidor 197, campo 84, protocolo 25, oficina 11, dominio 111), presupuesto (126,7 de 135 KB) y el extremo a extremo completo: 97 pasan y 3 se saltan, en Chromium y WebKit |
| 5. Desplegada en el entorno de pruebas | 2026-10-01, desde el commit bd86295: `campo` aplicó la 0030 y después `oficina`, `portal` y `worker`, los cuatro en `SUCCESS`. Salud y las 7 cabeceras en las tres superficies, `verificar-exposicion.sh`, `/api/cuenta/contrasena` sin sesión da 401 y `/api/auth/change-password` 404. Extremo a extremo allí en Chromium, un archivo por minuto: `cuenta.spec` (2), `administracion.spec` (2), `llaves.spec` (1) y `proteccion-campo.spec` (9; dos chocaron con el límite de 5 ingresos por minuto y solas pasaron) |
| 6. En producción | 2026-10-01, desde el commit 101fbcf. Kevin corrió las escrituras: respaldo `20261001T042956Z` (listo), `campo` (aplicó la 0030) y después `oficina`, `portal` y `worker`, los cuatro en `SUCCESS`. Verificado: salud y las 7 cabeceras en las tres superficies, `/api/cuenta/contrasena` y `reactivar` sin sesión dan 401, `/api/auth/change-password` 404, el código nuevo servido ("Cree su contraseña" en oficina y "Crea tu contraseña" en el fragmento de ingreso de campo, el mismo `index` que la compilación local), `verificar-exposicion.sh` y el worker sin errores. En producción no se corre el extremo a extremo (ADR-0021) |

## Decisiones tomadas al construirlo

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
