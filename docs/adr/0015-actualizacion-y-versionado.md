# ADR-0015 · Actualización controlada de la PWA y compatibilidad N-1 entre versiones

- **Estado:** Aceptada
- **Fecha:** 2026-09-23
- **Impulsores:** QA-1, QA-11, QA-21, QA-22, I-5, I-6
- **Depende de:** ADR-0002, ADR-0003, ADR-0004, ADR-0006

## Contexto

En una aplicación web normal, recargar la página trae la versión nueva. En una PWA sin conexión, un técnico puede pasar días con una versión vieja y borradores sin enviar mientras el servidor ya cambió.

El service worker nuevo se instala y **queda en espera** hasta que se cierran todas las ventanas controladas por el anterior. Forzar la activación inmediata puede romper la app si las páginas abiertas esperan archivos de la versión previa.

Coexisten **cuatro versiones** que deben ser compatibles:

| Versión | Qué describe | Dónde vive |
|---|---|---|
| Versión de la app | El código de `campo` | Service worker del dispositivo |
| Versión del protocolo | Comandos y respuestas de sincronización | Paquete `protocolo` |
| Versión del esquema local | Estructura de IndexedDB | Dexie (ADR-0004) |
| Versión de formato | Definición de un formato de levantamiento | Datos (ADR-0006) |

## Opciones de actualización

| Opción | Descripción |
|---|---|
| A. Activación inmediata siempre | El service worker nuevo toma control apenas se instala |
| B. Esperar a que se cierren todas las ventanas | Comportamiento por defecto del navegador |
| **C. Actualización ofrecida en momento seguro** | La app detecta la versión nueva y la aplica cuando no hay edición en curso |

**Decisión: C.** A puede romper una captura en curso; con B, en una PWA instalada que casi nunca se cierra, las actualizaciones pueden no llegar nunca.

## Decisión

### 1. Ciclo de actualización de la app

1. La app busca actualizaciones al abrir y al recuperar conexión.
2. Si hay versión nueva, se descarga en segundo plano y queda en espera.
3. Se ofrece aplicarla **solo en pantallas sin edición activa** (lista de visitas, inicio). Nunca dentro de un levantamiento abierto.
4. Al aceptar: activación, recarga y, si corresponde, migración del esquema local **conservando los pendientes** (ADR-0004).
5. Los datos nunca viven en la caché del service worker: el service worker solo guarda la aplicación. Los datos están en IndexedDB, así que actualizar la app no los toca.

### 2. Compatibilidad del protocolo: regla N-1

- El servidor acepta la versión actual del protocolo **y la anterior**.
- La respuesta de bajada informa una **versión mínima**. Si el dispositivo está por debajo:
  - **Puede seguir capturando**, porque capturar no depende del servidor.
  - **No puede enviar** hasta actualizar.
  - **Nunca pierde datos.**
- **Actualización obligatoria por seguridad:** el servidor sube la versión mínima y la app muestra un aviso que bloquea el envío, no la captura.

### 3. Migraciones del servidor en dos fases (expandir y contraer)

Para que la regla N-1 sea posible, los cambios de base de datos se despliegan en dos pasos:

1. **Expandir:** se agrega lo nuevo (columnas, campos opcionales) sin quitar nada; el servidor acepta ambas formas.
2. **Contraer:** cuando ninguna versión en uso depende de lo viejo, se retira en un despliegue posterior.

Un cambio que rompe compatibilidad nunca va en un solo despliegue.

### 4. Formatos que requieren una versión de la app

Un formato nuevo con un **tipo de campo nuevo** (ADR-0006) solo lo puede mostrar una app que conozca ese tipo. Cada versión de formato declara la **versión mínima de app** que necesita, y la bajada **no entrega** esa versión de formato a dispositivos más viejos. El técnico sigue usando la versión anterior del formato hasta actualizar. Así, un dispositivo nunca recibe algo que no puede mostrar.

### 5. Primera instalación

Requiere conexión: instalar, iniciar sesión, conceder permisos y descargar datos de referencia. La guía de puesta en marcha lo indica.

## Consecuencias

- **A favor:** ninguna actualización interrumpe una captura ni borra pendientes; clientes viejos siguen funcionando dentro de la regla N-1; formatos nuevos no rompen dispositivos viejos.
- **En contra:** cada cambio incompatible exige dos despliegues; el servidor mantiene código para dos versiones del protocolo; la matriz de compatibilidad se prueba en integración continua (ADR-0018).

## Cuándo revisarla

La app se empaqueta con Capacitor (ADR-0002) y las actualizaciones pasan a depender de las tiendas, o se necesita soportar más de una versión anterior porque hay dispositivos que pasan semanas sin conexión.
