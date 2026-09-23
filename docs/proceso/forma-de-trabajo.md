# Forma de trabajo

## Orden de construcción

**Cortes verticales, no capas.** Cada funcionalidad se termina completa (tabla, endpoint, política de permisos, auditoría, pantalla, pruebas) antes de pasar a la siguiente. No se construye primero todo el backend y después el frontend: buena parte de la lógica difícil vive en el cliente (base local, outbox, reintentos) y la integración tardía es donde aparecen los problemas más caros.

1. **Primero, un recorrido delgado de punta a punta:** capturar un levantamiento mínimo sin conexión, enviarlo, revisarlo, publicarlo y descargarlo en el portal. Valida la arquitectura como conjunto.
2. **Después, iteraciones ordenadas por riesgo**, cada una con un entregable demostrable a TEINS.
3. **Lo riesgoso primero:** la prueba de durabilidad en un iPhone real va en la semana 1 (ADR-0002), cuando cambiar a Capacitor todavía es barato.

## Contrato primero

En cada corte, los esquemas de `paquetes/protocolo` se definen antes que el endpoint y la pantalla. Si algo cambia, falla la compilación, no la integración.

## Sistema de diseño antes que pantallas

Los tokens, los componentes base de `paquetes/ui` y los patrones de pantalla existen antes del primer corte. Ninguna pantalla define estilos propios: si hace falta un componente nuevo, primero se agrega a `ui` y luego se usa. La integración continua lo verifica (ADR-0018).

## Preguntas al cliente, justo a tiempo

Cada iteración identifica qué preguntas de `docs/producto/preguntas-pendientes.md` necesita resueltas y se piden a TEINS antes de empezarla, no todas al inicio.

## Cambios de arquitectura

Un ADR aceptado no se edita para cambiar la decisión: se escribe uno nuevo que lo reemplaza, con la plantilla de `docs/adr/0000-plantilla.md`.

## Pendiente

El **plan de entrega** (recorrido delgado e iteraciones de las ocho semanas) es el siguiente documento de esta carpeta.
