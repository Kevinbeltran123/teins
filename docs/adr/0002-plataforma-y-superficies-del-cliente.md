# ADR-0002 · PWA con tres superficies compiladas por separado

- **Estado:** Aceptada
- **Fecha:** 2026-09-23
- **Impulsores:** R3, R4, R9, QA-1, QA-4, QA-11, QA-16
- **Depende de:** ADR-0001

## Contexto

El sistema tiene tres tipos de usuario con necesidades opuestas: técnicos en campo (sin conexión, celular o tableta), oficina (en línea, escritorio) y clientes (en línea, acceso mínimo desde internet). No hay presupuesto para cuentas de desarrollador de Apple ni Google.

## Parte 1 · Tecnología del cliente de campo

| Criterio | PWA | PWA + Capacitor desde el inicio | React Native / Expo | Flutter | Nativo |
|---|---|---|---|---|---|
| Costo de distribución cero (R3) | ● | ○ | ○ | ○ | ○ |
| Una sola base de código (R4) | ● | ● | ● | ● | ○ |
| Durabilidad sin conexión en iPhone (QA-1) | ◐ | ● | ● | ● | ● |
| Actualizar sin revisión de tienda (QA-11) | ● | ◐ | ◐ | ○ | ○ |
| Mismo código para oficina y portal | ● | ● | ◐ | ◐ | ○ |
| Viable para una persona en dos meses | ● | ◐ | ◐ | ◐ | ○ |

**Decisión:** PWA instalable. Requisitos de uso: instalación obligatoria en la pantalla de inicio, almacenamiento persistente solicitado (en Safari depende del permiso de notificaciones) y actualización controlada (ADR-0015). **Salida prevista:** empaquetar la misma aplicación con Capacitor si TEINS paga la cuenta de Apple o si la prueba en iPhone falla.

**Por qué gana:** es la única opción que cumple R3. Su punto débil (durabilidad en iPhone) tiene mitigaciones y una prueba temprana que lo valida.

**Riesgos conocidos de Safari y su mitigación:**

| Riesgo | Mitigación |
|---|---|
| Borrado de datos bajo presión de espacio | Instalación obligatoria, almacenamiento persistente, aviso si no está concedido |
| Sin sincronización en segundo plano | Envío al abrir la app y al recuperar señal; contador visible de pendientes |
| Instalación manual | Guía de un minuto en la puesta en marcha |
| Espacio del dispositivo | Compresión al capturar; liberación de lo confirmado |

**Prueba técnica obligatoria (semana 1):** iPhone real, captura sin conexión durante horas, unas 50 fotos, cerrar la app, reiniciar el teléfono y verificar que no se perdió nada.

## Parte 2 · Tres superficies

| Opción | Descripción |
|---|---|
| A. Una aplicación con todo | Campo, oficina y portal en el mismo paquete, con acceso por rol |
| B. Tres repositorios | Independientes |
| **C. Un repositorio, tres puntos de entrada** | Código compartido; paquetes `campo`, `oficina` y `portal` compilados por separado |

**Decisión: C.**

- **Seguridad (QA-4):** con A, el navegador del cliente descargaría el código de oficina y administración. El portal debe ser el paquete más pequeño posible.
- **Rendimiento (QA-16):** `campo` solo lleva lo que el técnico necesita.
- **Alcance sin conexión:** solo `campo` tiene service worker y datos locales; reduce drásticamente lo que hay que probar sin conexión.
- **Frente a B:** tres repositorios duplican tipos, validaciones y componentes.

## Consecuencias

- **A favor:** costo de distribución cero; actualizaciones inmediatas; superficie de ataque del portal mínima; pruebas sin conexión acotadas a una superficie.
- **En contra:** dependencia del comportamiento de Safari; mitigada y validada con la prueba técnica, con Capacitor como salida.

## Cuándo revisarla

La prueba en iPhone falla; TEINS paga la cuenta de Apple; se necesita sincronización en segundo plano o notificaciones más confiables.
