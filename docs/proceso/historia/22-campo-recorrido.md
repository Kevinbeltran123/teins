[Plan de entrega](../plan-de-entrega.md) · Anterior: [Iteración 21 · Cotizaciones desde las cantidades](21-cotizaciones.md) · Siguiente: [Iteración 23 · Oficina con la identidad Recorrido](23-oficina-recorrido.md)

# Iteración 22 · Campo rehecho con la dirección Recorrido

**Estado en el mapa al 2026-10-16:** Terminada, desplegada en el entorno de pruebas y aprobada por Kevin en su iPhone

**Estado:** terminada, desplegada en el entorno de pruebas y aprobada por Kevin en su iPhone el 2026-09-27.

**Para qué:** Kevin juzgó la interfaz "demasiado fea". En el teléfono todo era una lista larga de campos, y lo único que le gustaba era el croquis.

## Cómo se hizo

1. **Línea base:** 21 pantallas de campo en tamaño iPhone y 21 problemas numerados (artifact "Línea base de campo").
2. **Crítica con impeccable:** 22/40 y veredicto "genérica". Lo más grave (P0) era la captura en un solo desplazamiento.
3. **Referencias de Mobbin:** 15 búsquedas en apps reales (Jobber, Lloyds, Hevy, Gojek, Vestiaire y otras).
4. **Prototipo navegable** con la mezcla B+A: estructura de recorrido y lenguaje del croquis (`prototipos/campo/prototipo.html`). Kevin lo aprobó.

## Terminado cuando

| Criterio | Evidencia |
|---|---|
| La captura va por pasos: recorrido, un paso por sección, tarjetas para lo repetido, revisar antes de enviar | `Captura.tsx` (`Borrador`, `Repeticiones`, `Repeticion`); pruebas de extremo a extremo de envío, repeticiones, firma y cifrado |
| El recorrido sale de las secciones del formato, sin código por formato (regla 6) | Los pasos se arman con `formato.secciones` |
| Paleta oscura en campo; croquis, firma y miniaturas sobre papel claro | `tokens.css` (`[data-superficie="campo"]`, `[data-tema="claro"]`) |
| El movimiento es CSS (regla 10) | View Transitions y `@keyframes` en `tema.css`; el JavaScript solo cambia de pantalla |
| Presupuesto de peso | 120,1 KB de 135 KB (ADR-0030) |
| Verificación | Tipos, arquitectura, licencias, pruebas rápidas y extremo a extremo en Chromium y WebKit (39 pasan, 3 omitidas) |

## Decisiones tomadas al construirlo

- Un levantamiento nuevo abre en su primer paso; uno con datos, en el recorrido.
- Avanzar no se bloquea. Lo que falta se ve en el recorrido y se lista en Revisar, donde cada dato lleva a su paso.
- La unidad elegida se pinta con el color del texto, para que el azul quede solo en la acción que avanza.
- El aviso de instalar es una línea. Un enviado ya no repite su estado en una insignia.
- "Guardado en este teléfono" se muestra en el recorrido, no en cada paso.

## Corrección del 2026-09-27

Al probarlo en el iPhone, Kevin vio que el contador de pasos no avanzaba y que la firma se veía lavada. También vio que varias pantallas del prototipo quedaron comprimidas en una. Pidió que quedara igual al prototipo, sin recortar nada.

Se agregó lo que faltaba:
- el formato v8 con los pasos del prototipo (Llegada, Cuarto técnico, Tableros, Materiales, Croquis, Firma del cliente), valores comunes y fotos por puesto;
- el campo de medida grande;
- materiales con − y + y el catálogo alto;
- el croquis y la firma como pasos propios;
- la pantalla de enviado del prototipo;
- el saludo y la cuenta en Mis visitas;
- el inicio de sesión rediseñado.

El contador cuenta también los pasos por los que ya se pasó. El texto de lo que se dibuja o se firma toma el color de la paleta clara. "Diagnóstico del teléfono" pasó al botón de la cuenta.

## Fuera de la iteración 22

Oficina y portal siguen con Consola: el mismo método empieza por cotizaciones.

## Al cerrarla

**Rediseño de campo (iteración 22, 2026-09-27).** Kevin dijo que todo funciona pero que la app es "demasiado fea". Se hizo una línea base con 21 problemas, una crítica con impeccable, referencias de Mobbin y un prototipo navegable (`prototipos/campo/prototipo.html`). Kevin aprobó la dirección Recorrido y quedó construida en campo y desplegada en el entorno de pruebas. Kevin la probó en el iPhone y aprobó el resultado. La identidad visual quedó anotada en `DESIGN.md` ("Identidad visual Recorrido") para llevarla a oficina más adelante; oficina no se toca hasta que Kevin lo pida. Siguiente: oficina con el mismo método, empezando por cotizaciones, cuando Kevin lo decida.
