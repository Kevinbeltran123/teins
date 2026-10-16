# ADR-0033 · Reactivar usuarios y administrar la cuenta propia

- **Estado:** Aceptada (Kevin, 2026-10-01: "es primordial"; primero en el orden)
- **Fecha:** 2026-10-01
- **Impulsores:** QA-5, QA-6, I-14, I-18 a I-22
- **Depende de:** ADR-0009 (identidad y acceso), ADR-0022 (cifrado local)

## Contexto

Las auditorías de la iteración 24 encontraron tres funciones de identidad que faltan:

1. **Reactivar un usuario.** Desactivar es definitivo en la app: quien vuelve (una licencia, un error al desactivar) necesita un usuario nuevo, y su autoría queda partida entre dos cuentas. Desactivar además cierra sus sesiones y ordena borrar los datos de TEINS en su teléfono (regla 13, QA-5).
2. **Cambiar la propia contraseña.** Hoy solo la restablece quien administra, y restablecer quita también el segundo factor y las llaves de acceso (iteración 24c lo hizo visible). La contraseña temporal que se entrega no se puede cambiar después.
3. **Desactivar el propio segundo factor.** Quien no administra puede activarlo pero no quitarlo. Quien administra lo necesita siempre (ADR-0009).

Restricciones: la recuperación la hace quien administra, no un correo automático (ADR-0009). La autoría de un usuario desactivado se conserva (regla 13). Nada se borra en el servidor (regla 14).

## Opciones

| Opción | Descripción |
|---|---|
| A. Reactivar como se desactiva | Un comando en administración vuelve a activar la cuenta, con contraseña temporal nueva; el teléfono ya borrado empieza de cero |
| B. Usuario nuevo vinculado al anterior | Quien vuelve recibe una cuenta nueva y oficina las enlaza para la historia |
| C. Cuenta propia en "Mi cuenta" | Cambiar la contraseña (con la actual) y quitar el segundo factor si no administra (con un código vigente) |

A y B resuelven la reactivación; C, la cuenta propia. Se evalúan A y B, y C por su lado.

## Evaluación

| Criterio (ligado a un impulsor) | A | B |
|---|---|---|
| La autoría queda en una sola cuenta (regla 13, I-22) | ● | ◐ |
| El teléfono del desactivado no recupera nada (QA-5, QA-6) | ● | ● |
| Cambio acotado en identidad | ● | ○ |

## Decisión

**A para reactivar y C para la cuenta propia.**

1. **Reactivar:**
   - En Administración, "Reactivar usuario" en la fila de un desactivado. Es una confirmación con consecuencias.
   - Genera una contraseña temporal que se entrega una sola vez, como al crearlo.
   - No devuelve sesiones, llaves ni segundo factor: entra como un usuario nuevo con su misma identidad.
   - El teléfono que se borró no recupera nada (ADR-0022: la clave se destruyó). Lo que bajó antes vuelve a bajar del servidor al iniciar sesión.
   - Queda registrado como evento del usuario.
2. **Cambiar la propia contraseña:** en "Mi cuenta", con la contraseña actual y la nueva dos veces (mínimo de 10 caracteres, como hoy). Cierra las demás sesiones y conserva la actual, el segundo factor y las llaves. Si la persona olvidó la actual, sigue siendo quien administra quien la restablece.
3. **Quitar el propio segundo factor:** solo para quien no administra, con un código vigente de la app autenticadora. A quien administra no se le ofrece (ADR-0009).
4. **Contraseña temporal:** al entrar con una, la app pide cambiarla antes de seguir. Así deja de ser cierto que "se entrega una sola vez" pero se usa para siempre.

## Por qué gana a cada alternativa

- **Frente a B:** dos cuentas para la misma persona parten la autoría (regla 13) y obligan a una relación nueva entre usuarios solo para la historia.

## Consecuencias

- **A favor:** quien vuelve conserva su historia. La contraseña temporal deja de durar para siempre. Restablecer queda solo para quien la olvidó, que es cuando tiene sentido quitar el segundo factor.
- **En contra:** reactivar devuelve el acceso a alguien a quien se le quitó (mitigación: solo quien administra, con segundo factor; confirmación con consecuencias; queda registrado). Cambiar la contraseña con la actual expone un punto más a intentos (mitigación: el mismo límite de intentos del ingreso, QA-7).

## Cuándo revisarla

- Si TEINS pide recuperación por correo: contradice ADR-0009 y va en otro ADR.
- Si un usuario reactivado necesita conservar lo que tenía en el teléfono: no es posible por diseño (ADR-0022), y la respuesta es enviar antes de desactivar.

## Notas para construirla

- La API de autenticación solo deja pasar una lista cerrada de rutas (`RUTAS_DE_AUTENTICACION`, `modulos/identidad/index.ts`). Cambiar la contraseña (`/change-password`) y quitar el segundo factor (`/two-factor/disable`) se agregan a esa lista, con el mismo límite de intentos del ingreso (QA-7). A quien administra, el servidor le rechaza quitar el segundo factor.
- El cambio obligatorio de la temporal necesita una marca en el usuario (migración nueva), que se pone al crearlo, al restablecerle la contraseña y al reactivarlo, y se quita al cambiarla. Mientras la tenga, las políticas del servidor solo le dejan cambiar la contraseña y cerrar sesión (denegar por defecto, regla 9 de AGENTS.md).
- Reactivar es una operación nueva del módulo de identidad: borra la fecha de desactivación, genera la temporal y lo registra. Las órdenes de borrado de sus teléfonos ya cumplidas no se deshacen.
