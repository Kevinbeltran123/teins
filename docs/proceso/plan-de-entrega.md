# Plan de entrega

Borrador. Por ahora solo define el corte 0; el recorrido delgado y las iteraciones de las ocho semanas se agregan antes de terminar el corte 0.

## Corte 0 · Captura sin conexión y prueba de durabilidad en iPhone

**Para qué:** validar QA-1 con el almacenamiento real de `campo` antes de construir encima (ADR-0002, ADR-0004). Si falla, se pasa a Capacitor mientras cambiar todavía es barato.

**Alcance:**

- Un formato ficticio de una sección con tres tipos de campo: `texto`, `medida` y `foto` (subconjunto de ADR-0006). Datos ficticios (R5).
- Crear un levantamiento en borrador; guardado automático en cada cambio.
- Fotos recodificadas en el dispositivo (sin metadatos, QA-23), con huella SHA-256, guardadas en la misma transacción que su referencia (ADR-0004, ADR-0007).
- IndexedDB con Dexie detrás de un puerto de repositorio.
- PWA instalable con actualización ofrecida, nunca forzada (ADR-0015); solicitud de almacenamiento persistente.
- Panel de diagnóstico: almacenamiento persistente sí o no, espacio usado y verificación de la huella de cada foto guardada.

**Fuera del corte:** servidor, `protocolo`, envío, identidad, secciones repetibles, bocetos, cantidades, enrutador, reglas de arquitectura en integración continua.

**Terminado cuando:**

1. Pasan las pruebas de `dominio` y del repositorio de `campo`.
2. La app instalada en un iPhone real pasa el procedimiento de abajo y el resultado queda registrado en este archivo.
3. Lo mismo en un Android real.

**Procedimiento de la prueba (ADR-0002):**

1. Instalar la app en la pantalla de inicio y abrirla desde ahí. Confirmar en el diagnóstico que el almacenamiento es persistente.
2. Activar modo avión.
3. Crear levantamientos y capturar unas 50 fotos repartidas entre ellos durante varias horas, con texto y medidas.
4. Cerrar la app desde el selector de apps. Reiniciar el teléfono.
5. Abrir la app sin conexión. En el diagnóstico, "Verificar fotos" debe informar todas las fotos íntegras y los textos deben estar completos.

**Resultados:**

| Fecha | Dispositivo | Sistema | Persistente | Fotos | Íntegras | Resultado |
|---|---|---|---|---|---|---|
| | | | | | | |
