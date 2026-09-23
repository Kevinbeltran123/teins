# ADR-0020 · Marca por organización con tokens de diseño en variables CSS

- **Estado:** Aceptada
- **Fecha:** 2026-09-23
- **Impulsores:** QA-11, QA-13, QA-18, R7, R10
- **Depende de:** ADR-0002, ADR-0011, ADR-0013

## Contexto

La dirección visual Marquilla (`DESIGN.md`) usa la paleta del logo de TEINS: azul `#002B81` como superficie principal, gris `#525152` para texto secundario y amarillo señal como único acento de acción. El producto podría venderse a otras empresas (R7), cada una con su marca. La identidad aparece en cuatro lugares: `campo`, `oficina`, `portal` y la plantilla del PDF (ADR-0013).

Si los colores y el logo quedan escritos en los componentes, vender el producto a otra empresa exigiría revisar cada pantalla y el PDF.

## Opciones

| Opción | Descripción |
|---|---|
| A. Valores fijos en el código | Colores escritos en cada componente |
| B. Tema de Tailwind compilado | Colores definidos en la configuración de compilación |
| **C. Tokens en variables CSS, resueltos en tiempo de ejecución por organización** | El sistema de diseño usa solo variables; cada organización define sus valores |
| D. Hojas de estilo completas por cliente | Un CSS distinto por empresa |

## Evaluación

| Criterio | A | B | C | D |
|---|---|---|---|---|
| Cambiar de marca sin recompilar (QA-11, R7) | ○ | ○ | ● | ◐ |
| Una sola fuente para las tres superficies y el PDF | ○ | ◐ | ● | ○ |
| Consistencia garantizada (ninguna pantalla con colores propios) | ○ | ● | ● | ○ |
| Costo en tamaño del paquete (ADR-0011) | ● | ● | ● | ◐ |
| Mantenimiento (QA-18) | ○ | ● | ● | ○ |

## Decisión

**C.** Dos niveles de tokens:

1. **Tokens de marca** (por organización): `--marca-superficie`, `--marca-acento`, `--marca-texto-secundario` y el logo en sus dos versiones (color para fondos claros, blanco para fondos oscuros). Se guardan en la configuración de la organización.
2. **Tokens semánticos** (fijos en el sistema): superficie elevada, divisiones, texto sobre superficie, estados del documento, foco. **Se derivan de los de marca** mezclando con blanco en proporciones fijas, igual que el lienzo de diseño.

Reglas:

- Los componentes de `paquetes/ui` usan **solo** tokens semánticos. Una regla automática (ADR-0018) rechaza colores fijos en las aplicaciones.
- Los **colores de estado** (enviado, en revisión, revisado, publicado, anulado) **no cambian por organización**: su significado debe ser el mismo en todo el producto.
- Al guardar una marca nueva, el sistema **verifica el contraste**: texto blanco sobre la superficie y acento sobre la superficie deben superar los mínimos de `DESIGN.md`. Una combinación que no los cumple se rechaza, para que ninguna empresa pueda configurar una interfaz ilegible en campo.
- La plantilla del PDF lee los mismos tokens.
- En `campo`, los tokens de la organización se guardan con los datos de referencia para funcionar sin conexión.

Valores de TEINS: superficie `#002B81`, acento `#FFC21A`, texto secundario `#525152`.

## Por qué gana a cada alternativa

- **Frente a A:** es la causa exacta de interfaces inconsistentes y de rebrandings que tocan todo.
- **Frente a B:** garantiza consistencia, pero cada marca exige una compilación y un despliegue distintos.
- **Frente a D:** cada cliente tendría su propio CSS, que diverge con el tiempo.

## Consecuencias

- **A favor:** la marca se cambia con configuración; las tres superficies y el PDF comparten una fuente; la verificación de contraste protege la legibilidad en campo.
- **En contra:** los componentes deben escribirse contra tokens desde el principio, y la derivación de tonos debe mantenerse igual en navegador y PDF.

## Cuándo revisarla

Una organización necesita cambiar tipografía o formas, no solo colores y logo (ampliar los tokens de marca).
