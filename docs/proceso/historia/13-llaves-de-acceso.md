[Plan de entrega](../plan-de-entrega.md) · Anterior: [Iteración 12 · Cifrado local en campo](12-cifrado-local.md) · Siguiente: [Iteración 14 · Interfaz con la dirección Consola](14-interfaz-consola.md)

# Iteración 13 · Llaves de acceso (passkeys)

**Estado en el mapa al 2026-10-16:** Terminada y desplegada en el entorno de pruebas; falta la prueba en iPhone

**Estado:** terminada el 2026-09-25 y desplegada en el entorno de pruebas (`llaves.spec.ts` en Chromium contra el entorno, verde). Falta la prueba en iPhone (fase 13 de la guía), en espera con las de las iteraciones 9 a 12.

**Para qué:** que el técnico entre con Face ID, huella o el PIN del teléfono en lugar de escribir una contraseña en campo, y que oficina pueda hacer lo mismo. Una llave de acceso no se puede suplantar desde otro sitio web (ADR-0009, parte 1: "passkey recomendada" para técnicos, opcional para oficina).

## Alcance

- **Servidor:** plugin de llaves de acceso de Better Auth (`@better-auth/passkey`, MIT) con la tabla `identidad.llaves_de_acceso`. Crear y quitar una llave queda en la auditoría.
- **Campo:** "Entrar con llave de acceso" en el inicio de sesión. Después de entrar con la contraseña, la app propone crear la llave ("Ahora no" la oculta en ese teléfono).
- **Oficina:** "Entrar con llave de acceso" y "Mi cuenta" (el nombre en el encabezado) para crear y quitar llaves.
- **Administración:** restablecer el acceso de una persona también quita sus llaves (teléfono perdido).

## Fuera de la iteración 13

| Qué | Dónde se resuelve |
|---|---|
| Autocompletar la llave en el campo de usuario (mediación condicional) | Cuando se vea en el iPhone si hace falta: el botón ya evita escribir |
| Llave como segundo factor sin TOTP para administrar | Se revisa si TEINS lo pide: hoy administrar exige el TOTP activo (respaldo si se pierde el teléfono) |
| Llave compartida entre campo y oficina | Con el dominio propio de TEINS (un solo `rpID` padre); hoy cada superficie tiene su dominio gratuito |

## Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Técnico y oficina crean una llave y entran sin contraseña | Hecho: `e2e/pruebas/llaves.spec.ts` (Chromium con autenticador virtual) y `servidor/pruebas/llaves-de-acceso.test.ts` (autenticador de software) |
| 2. Sin verificar a la persona (solo un toque) no se entra | Hecho: `llaves-de-acceso.test.ts` |
| 3. Un usuario desactivado no entra con su llave; restablecer el acceso invalida la llave del teléfono perdido | Hecho: `llaves-de-acceso.test.ts` |
| 4. Nadie quita la llave de otra persona; crear y quitar quedan en la auditoría | Hecho: `llaves-de-acceso.test.ts` |
| 5. Lo anterior sigue igual y el presupuesto de campo se respeta | Hecho: verificación completa en el orden de la integración continua (dominio 73, protocolo 18, oficina 4, campo 47, servidor 93, extremo a extremo 24 y 2 omitidas); campo 117,3 de 120 KB |

## Decisiones tomadas al construirlo

- **Una instancia de Better Auth por dominio de superficie.** Una llave queda ligada al dominio donde se creó (`rpID`), y el plugin solo lo toma de una URL base fija; la nuestra sale del host de cada solicitud (ADR-0016). Cada superficie tiene su instancia con su `rpID`; todas comparten la base, el secreto y las sesiones, y la solicitud va a la de su host. Consecuencia: la llave de campo no sirve en oficina y viceversa, hasta tener un dominio propio.
- **Siempre con verificación de la persona** (Face ID, huella o PIN): se exige al crearla y al entrar (el plugin solo la prefería). Así la llave vale por dos factores, como pide ADR-0009 para quien administra.
- **Detectable (`residentKey: required`):** se entra sin escribir el usuario.
- **El nombre que muestra el teléfono es el usuario** (`tecnico.prueba`), no el correo interno `usuario@<organización>.invalid`. Lo pone el servidor.
- **Un usuario desactivado no entra con su llave:** la regla ya vivía en la creación de la sesión (regla 13), por donde pasa también la llave.
- **Restablecer el acceso quita todas las llaves** de la persona y lo registra (`llavesQuitadas`): es lo que hace quien administra cuando alguien pierde el teléfono.
- **Administrar sigue exigiendo el TOTP activo.** Entrar con la llave cuenta como segundo factor (ADR-0009), pero el TOTP es el respaldo si se pierde el dispositivo con la llave.
- **La biblioteca del navegador (`@simplewebauthn/browser`, MIT) se carga solo al usar una llave:** 2,8 KB comprimidos fuera del JavaScript inicial de campo. La propuesta de crearla también se carga aparte.
- **Pruebas sin navegador:** un autenticador WebAuthn de software (`servidor/pruebas/autenticador.ts`, clave P-256 y el CBOR mínimo) prueba las reglas de seguridad en el servidor. WebKit no tiene autenticador virtual: esa parte se prueba en Chromium y en el iPhone.

## Al cerrarla

**Iteración 13 terminada el 2026-09-25:** llaves de acceso en campo y oficina, desplegadas en el entorno de pruebas y verificadas allí con `llaves.spec.ts` (cada superficie con su dominio). Con ella se completa la lista de iteraciones por riesgo que se trazó al cerrar el corte 5. La prueba en iPhone (fase 13 de la guía) queda en espera con las de las iteraciones 9 a 12.

Siguiente, por riesgo (recomendación, a decidir con Kevin): lo que falta para el piloto no es código sino TEINS: su cuenta en Railway (para transferir producción), sus formatos reales (P7, P8), el formato del informe (P22, P23, P26) y su catálogo y columnas de Excel (P28, P29). Secciones repetibles, bocetos y cantidades ya están. Las iteraciones por riesgo que se trazaron están completas (6 a 13). Lo que más reduce el riesgo ahora no es código nuevo: **la prueba en iPhone de las fases 9 a 13** (en espera por Kevin) y **actualizar producción** a esta versión (también en espera). Mientras TEINS responde, lo siguiente en código es la **instalación guiada de la PWA en iPhone** (`docs/diseno/pendientes.md`, punto 4): hoy es un aviso con pasos, y es lo primero que ve un técnico nuevo.
