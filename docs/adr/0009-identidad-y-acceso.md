# ADR-0009 · Sesiones revocables en servidor, autorización centralizada y seguridad por fila en el portal

- **Estado:** Aceptada
- **Fecha:** 2026-09-23
- **Impulsores:** QA-4, QA-5, QA-6, QA-7, QA-13, I-14, I-15, I-17, I-18, I-19, P35, P36, P37, R4, R6
- **Depende de:** ADR-0005

## Contexto

Cinco tipos de usuario, tres superficies y un requisito que tensiona todo: los técnicos trabajan sin conexión, pero la revocación debe ser inmediata (P36: "revocarle todos los permisos y todo el acceso"). Los técnicos no tienen correo empresarial propio y el cliente pidió "lo más práctico y seguro" (P35). El portal está expuesto a internet y la seguridad es primordial (P37).

La decisión tiene cuatro partes: **autenticación**, **sesiones**, **autorización** y **protección en el dispositivo**.

---

## Parte 1 · Autenticación

### Opciones

| Opción | Descripción |
|---|---|
| A. Construirla desde cero | Hash de contraseñas, sesiones y protecciones escritas a mano |
| **B. Biblioteca autoalojada (Better Auth)** | Framework de autenticación en TypeScript, con la base de datos propia y funciones por plugins (usuario sin correo, passkeys, TOTP, administración, límite de intentos) |
| C. Servicio gestionado (Auth0, Clerk, Firebase Auth…) | Terceros alojan usuarios y sesiones |
| D. Proveedor de identidad autoalojado (Keycloak, Zitadel, Authentik) | Servidor de identidad independiente con OIDC |

| Criterio | A | B | C | D |
|---|---|---|---|---|
| Usuarios sin correo (P35) | ● | ● | ◐ | ● |
| Passkeys y segundo factor | ○ | ● | ● | ● |
| Revocación inmediata de sesiones (QA-5) | ● | ● | ◐ | ● |
| Datos de usuarios en la base de TEINS (R10, Ley 1581) | ● | ● | ○ | ● |
| Sin servicio adicional que operar (R1, QA-19) | ● | ● | ● | ○ |
| Riesgo de errores de seguridad propios | ○ | ● | ● | ● |
| Costo | ● | ● | ◐ | ● |

**Decisión: B. Better Auth**, autoalojada, sobre la misma base PostgreSQL.

- **Frente a A:** la autenticación es genérica (ver `02-modelo-dominio.md`): construirla consume tiempo del núcleo y multiplica el riesgo de errores de seguridad.
- **Frente a C:** los datos de usuarios quedan en un tercero, fuera de la infraestructura de TEINS; hay costo por usuario y dependencia del proveedor.
- **Frente a D:** es la opción más completa, pero es otro servidor que TEINS debe operar, y OIDC entre servicios propios no aporta nada con un solo backend.
- Lucia, la alternativa minimalista histórica, fue discontinuada como biblioteca y convertida en guía; no es opción.

### Métodos de ingreso por tipo de usuario

| Usuario | Método | Justificación |
|---|---|---|
| Técnico | Nombre de usuario y contraseña; **passkey recomendada** (Face ID o huella) | Sin correo obligatorio (P35); la passkey es a la vez lo más práctico (sin escribir contraseñas en campo) y lo más seguro (resiste suplantación) |
| Oficina y supervisor | Usuario y contraseña; passkey opcional | Trabajan en escritorio |
| **Administrador** | Contraseña **más segundo factor obligatorio** (TOTP o passkey) | Puede revocar usuarios y retirar informes: su cuenta es la de mayor impacto si se compromete |
| Cliente | Acceso de cliente (Parte 4) | No es usuario interno |

Contraseñas con hash resistente a fuerza bruta, gestionado por la biblioteca. Recuperación de acceso: la hace el administrador, no un correo automático.

---

## Parte 2 · Sesiones

| Opción | Revocación inmediata | Uso sin conexión | Robo por XSS |
|---|---|---|---|
| JWT sin estado en `localStorage` | ○ (requiere lista negra) | ● | ○ |
| JWT en cookie | ○ | ● | ● |
| **Sesión opaca en servidor, en cookie `HttpOnly`** | ● | ◐ | ● |

**Decisión: sesión opaca almacenada en la base, enviada en cookie `HttpOnly`, `Secure`, `SameSite`.** Revocar es borrar la fila de sesión: efecto inmediato en la siguiente solicitud (QA-5). JavaScript nunca ve el identificador de sesión.

### El problema sin conexión y su solución: el permiso de trabajo local

Sin conexión no hay servidor que valide la sesión. En vez de un token de larga duración, el dispositivo recibe un **permiso de trabajo local**:

1. En cada sincronización exitosa, el servidor devuelve una fecha de vencimiento del permiso (por ejemplo, 7 días; configurable por TEINS).
2. Mientras no venza, la app funciona sin conexión.
3. Si vence sin contacto, la app **bloquea la captura pero conserva todos los datos**. Al recuperar señal, el técnico vuelve a ingresar y sigue. Vencer nunca borra trabajo.
4. **Revocación:** en el siguiente contacto, el servidor rechaza la sesión y ordena el borrado local (ADR-0003). Siguiendo P36, los borradores no enviados del usuario revocado **no se aceptan** y se borran.

**Riesgo residual declarado:** un dispositivo revocado que nunca vuelve a conectarse conserva sus datos locales hasta que vence su permiso, y después quedan bloqueados pero presentes (cifrados, Parte 5).

---

## Parte 3 · Autorización

### Modelo

**Roles con permisos por acción, más reglas de alcance sobre el recurso:**

- **Rol → acciones:** la tabla de permisos de `02-modelo-dominio.md`.
- **Alcance:** el técnico solo sus levantamientos; el revisor solo edita lo que tomó; el cliente solo su cliente; todos solo su organización.

### Aplicación

1. **Un módulo de políticas central** decide cada acción. Ningún controlador verifica permisos por su cuenta.
2. **Denegar por defecto:** una ruta sin política declarada no responde. Una **prueba automática recorre todas las rutas** y falla si alguna no declara su política (ADR-0018).
3. **Segunda barrera en la base (seguridad por fila):**

| Barrera | Alcance | Justificación |
|---|---|---|
| **Aislamiento por organización** | Todas las tablas de negocio; la transacción fija la organización y la base filtra | Prepara la multiempresa (QA-13) con costo casi nulo mientras solo exista TEINS |
| **Rol de base de datos exclusivo del portal** | Solo lectura sobre versiones publicadas y vigentes, filtradas por el cliente de la sesión | El portal es la única superficie abierta a internet. Aunque su código tenga un error, **la base no le devuelve** datos de otro cliente ni nada que no esté publicado (QA-4) |

**Por qué no seguridad por fila en todo con reglas finas:** replicar la tabla completa de permisos en políticas de base duplicaría la lógica y haría difícil probarla. Se aplica donde el daño de un error sería mayor: entre organizaciones y en el portal.

---

## Parte 4 · Acceso de cliente (portal)

- Cada cliente tiene un acceso con un **identificador aleatorio no adivinable** y una **clave**.
- El QR contiene la URL del portal con el identificador precargado. **Nunca contiene la clave:** el QR solo lleva a la puerta.
- El portal vive en un **subdominio propio**, con su cookie de sesión aislada de la de oficina.
- **Límite de intentos** por identificador y por origen, con espera creciente (QA-7).
- Sesiones cortas; regenerar el acceso invalida el QR anterior y todas sus sesiones.
- Cada ingreso y descarga queda en el registro de seguridad (ADR-0008).

---

## Parte 5 · Protección de datos en el dispositivo

- Los datos locales se cifran con AES-GCM mediante WebCrypto. La clave es **no extraíble** y se genera por usuario y dispositivo.
- **El beneficio principal no es la confidencialidad sino el borrado:** destruir una clave de 256 bits vuelve ilegible todo al instante, aunque borrar cientos de fotos tarde o se interrumpa. La orden de borrado del servidor destruye primero la clave y después borra los datos.
- **Límite declarado:** protege contra la copia casual de archivos del navegador; no protege contra alguien con el teléfono desbloqueado y la sesión abierta. La defensa principal es el bloqueo del dispositivo y el permiso de trabajo local.

---

## Parte 6 · Modelo de amenazas (STRIDE, superficies principales)

| Amenaza | Superficie | Control |
|---|---|---|
| **S**uplantación | Ingreso de técnicos y clientes | Passkeys, límite de intentos, segundo factor para administrador |
| **T**ampering (alteración) | Envíos de campo; archivos | Validación completa en servidor (ADR-0006); verificación de firma y huella (ADR-0007) |
| **R**epudio | Correcciones de oficina | Registro semántico con cadena de hashes (ADR-0008) |
| **I**nformation disclosure (fuga) | Portal; URLs de archivos | Rol del portal con seguridad por fila; archivos privados con URL firmada de minutos; sin GPS en fotos |
| **D**enegación de servicio | Portal; carga de archivos | Límites de tasa; límites de tamaño en URLs firmadas |
| **E**levación de privilegios | API de oficina y administración | Políticas centrales, denegar por defecto, prueba de cobertura de rutas |

**Lista de verificación:** OWASP ASVS nivel 2 como objetivo, revisado antes del piloto.

## Consecuencias

- **A favor:** revocación inmediata y real; trabajo sin conexión con vencimiento que nunca borra trabajo; el portal no puede filtrar datos aunque su código falle; usuarios en la base de TEINS; passkeys como camino práctico y seguro.
- **En contra:** fijar la organización en cada transacción agrega una regla de infraestructura; la seguridad por fila exige pruebas propias; el riesgo residual de dispositivos que nunca vuelven a conectarse se acepta y se documenta.

## Cuándo revisarla

Se agrega una segunda organización (activar gestión de organizaciones); TEINS integra un proveedor de identidad corporativo (OIDC); un cliente exige cuentas individuales por persona en el portal.
