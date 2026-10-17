[Plan de entrega](../plan-de-entrega.md) · Siguiente: [Corte 1 · Envío a oficina](01-envio-a-oficina.md)

# Corte 0 · Captura sin conexión y prueba de durabilidad en iPhone

**Estado en el mapa al 2026-10-16:** Terminado

**Para qué:** validar QA-1 con el almacenamiento real de `campo` antes de construir encima (ADR-0002, ADR-0004).

**Alcance:** formato ficticio de una sección con campos `texto`, `medida` y `foto`; levantamiento en borrador con guardado automático; fotos recodificadas sin metadatos con huella SHA-256 en la misma transacción que su referencia; IndexedDB con Dexie detrás de un puerto; PWA instalable con actualización ofrecida; panel de diagnóstico.

**Procedimiento de la prueba (ADR-0002):**

1. Instalar la app en la pantalla de inicio y abrirla desde ahí. Confirmar en el diagnóstico que el almacenamiento es persistente.
2. Activar modo avión.
3. Crear levantamientos y capturar unas 50 fotos repartidas entre ellos durante varias horas, con texto y medidas.
4. Cerrar la app desde el selector de apps. Reiniciar el teléfono.
5. Abrir la app sin conexión. En el diagnóstico, "Verificar fotos" debe informar todas las fotos íntegras y los textos deben estar completos.

**Resultados:**

| Fecha | Dispositivo | Sistema | Persistente | Fotos | Íntegras | Resultado |
|---|---|---|---|---|---|---|
| 2026-09-24 | iPhone [modelo por registrar] | iOS [versión por registrar] | [por registrar] | [N] | [N] | Sin pérdida, según Kevin |
| 2026-09-25 | iPhone 15 Pro | iOS 26.6.1 | Sí | 3 | 3 | Sin pérdida tras reiniciar el teléfono sin señal (verificación manual, fase 1) |

**Decisión:** se mantiene la PWA (ADR-0002); Capacitor no es necesario. Pendiente: completar la fila con los datos exactos y repetir en Android.
