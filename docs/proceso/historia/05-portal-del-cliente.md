[Plan de entrega](../plan-de-entrega.md) · Anterior: [Corte 4 · Informe](04-informe.md) · Siguiente: [Iteración 6 · Administración](06-administracion.md)

# Corte 5 · Portal del cliente

**Estado en el mapa al 2026-10-16:** Terminado y desplegado en el entorno de pruebas

**Estado:** construido y desplegado en el entorno de pruebas el 2026-09-25.

**Para qué:** que el cliente de TEINS descargue el PDF vigente de sus informes con un QR y una clave, sin ver jamás nada de otro cliente aunque el código del portal tenga un error (QA-4, ADR-0009), y sin que se pueda adivinar una clave (QA-7). Con este corte queda completo el recorrido delgado.

## Alcance

**Acceso de cliente (ADR-0009, parte 4):** identificador aleatorio no adivinable y clave con hash (scrypt); el QR lleva la URL del portal con el identificador y nunca la clave. Se crea y se regenera por comando (no hay rol administrador todavía); regenerar invalida el QR anterior, la clave y todas las sesiones.

**Barrera en la base (ADR-0009, parte 3):** rol `teins_portal` con conexión propia. Solo lee las versiones publicadas con PDF listo del cliente de la sesión (seguridad por fila por organización y cliente) y las tablas del propio portal. No tiene permiso sobre levantamientos, usuarios, visitas ni nada más.

**Protección:** límite de intentos por identificador y por origen con espera creciente; sesión corta (30 minutos desde el último uso) en cookie `HttpOnly`, `Secure`, `SameSite=Strict`, en el host propio del portal. Cada ingreso y cada descarga quedan en la cadena de auditoría del acceso.

**Vigente:** por cada informe del cliente, la versión publicada más reciente con su PDF listo (ADR-0013: "publicada" y "visible para el cliente" son distintos).

**Portal (paquete `portal`, el más pequeño, ADR-0002):** ingreso (identificador precargado desde el QR), lista de informes vigentes con su descarga, salir; estados vacío, cargando, error y sin conexión.

**Despliegue:** cuarto servicio web `portal` en Railway con su dominio.

## Fuera del corte 5

| Qué | Dónde se resuelve |
|---|---|
| Pantalla de administración de accesos de cliente | Iteración de administración (con el rol administrador) |
| Versiones anteriores visibles para el cliente | Solo la vigente, por la regla 12; si TEINS las pide, se agregan |
| Retirar una versión del portal | Con el rol administrador |
| Aviso al cliente por correo de un informe nuevo | Después del piloto (ADR-0014) |

## Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Extremo a extremo: con el QR y la clave, el cliente ve su informe vigente y descarga el PDF | Cumplido en Chromium y WebKit, en local y contra el entorno (`e2e/pruebas/portal.spec.ts`, el recorrido delgado completo) |
| 2. Cero accesos cruzados (QA-4): un cliente no ve ni descarga informes de otro, ni adivinando identificadores; probado también directo en la base con el rol del portal | Cumplido en integración (API y base) y extremo a extremo |
| 3. Intentos fallidos bloquean con espera creciente por identificador y por origen (QA-7); la clave se guarda con hash | Cumplido en integración |
| 4. Regenerar el acceso invalida el identificador anterior, la clave y las sesiones abiertas | Cumplido en integración |
| 5. Ingresos y descargas quedan en la auditoría | Cumplido en integración, con la cadena verificada |
| 6. Desplegado en el entorno de pruebas con el extremo a extremo en verde contra él | Cumplido el 2026-09-25 (servicio `portal`) |

## Decisiones tomadas al construirlo

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

## Al cerrarlo

**El recorrido delgado está completo (cortes 0 a 5, 2026-09-25)** y desplegado en el entorno de pruebas. Antes de la primera demostración a TEINS:

1. **Verificación manual hecha por Kevin el 2026-09-25** en un iPhone 15 Pro con iOS 26.6.1 (fases 1 a 7 de [`verificacion-manual.md`](../verificacion-manual.md); producción quedó para después). Todo funcionó salvo dos avisos que no aparecían, corregidos con su prueba de extremo a extremo y confirmados por Kevin en el iPhone el mismo día: "Oficina canceló esta visita" en el bloque azul de campo y "Su sesión se cerró" en el portal. Falta la fase 8 (producción), que Kevin dejó para después.
2. **Respuestas de TEINS** para ajustar el informe (P22, P23, P26, formato de los planos) y las preguntas P2, P5, P7, P8 y P9.

**Observado en la verificación del 2026-09-25:** una vez, en la corrida completa del extremo a extremo, `envio.spec.ts` en WebKit falló con "Falta 1 dato por completar" después de llenar todo; no se reprodujo (12 de 12 con 4 trabajadores en paralelo, y verde en todas las corridas completas antes y después). Se vigila; la integración continua reintenta una vez. Las pruebas de oficina ahora cargan más páginas de la bandeja hasta encontrar su levantamiento (`filaDeLaBandeja`): en un entorno con datos de corridas anteriores, el recién enviado quedaba fuera de la primera página de 50.
