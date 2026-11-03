# ADR-0050 · Selección, horario, tablas de medidas y sello en los formatos

- **Estado:** Aceptada
- **Fecha:** 2026-10-29
- **Impulsores:** QA-11 (un campo nuevo no exige código), QA-12, QA-15, R2, R7, I-13 (compatibilidad con apps anteriores)
- **Depende de:** ADR-0006 (la amplía), ADR-0015, ADR-0024

## Contexto

TEINS entregó sus dos formatos de papel: el de visita técnica (dos hojas) y el de servicio de UPS. El meta-esquema de ADR-0006 no puede expresar cuatro cosas que ambos piden:

- **Elegir entre opciones fijas**, una (Totalmente, Parcialmente…) o varias (Control de acceso, CCTV, UPS…), con «Otro» escrito a mano. Hoy solo hay `texto` con `valoresComunes`, que no obliga a una de ellas ni se lee como casillas en el informe.
- **Una hora de llegada y una de salida** con el total calculado.
- **Mediciones por fase** (F1, F2, F3) en una tabla de filas y columnas. Hoy cada medida es un campo suelto en una lista.
- **La franja de la foto de llegada** y **la cédula de quien firma**, que son propiedades de campos que ya existen (`foto` y `firma`).

Condiciones: la regla 6 (los formatos son datos, no código), la regla 7 (las versiones publicadas son inmutables) y que una app anterior (ADR-0015) no debe recibir un formato que no sabe dibujar.

## Opciones

| Opción | Descripción |
|---|---|
| **A. Tipos nuevos más presentación separada** | `opcion`, `opciones` y `horario` como tipos; `tablas` en la sección solo dice cómo acomodar campos `medida` que ya existen |
| B. Un tipo «tabla» con su propio valor | Una tabla es un campo cuyo valor es una matriz |
| C. Expresiones y visibilidad condicional | Como SurveyJS o XLSForm: fórmulas, «mostrar si» |
| D. Plantillas HTML por formato | Cada formato trae su pantalla y su informe |

## Evaluación

| Criterio (ligado a un impulsor) | A | B | C | D |
|---|---|---|---|---|
| Un formato nuevo no exige código (QA-11, regla 6) | ● | ● | ● | ○ |
| Validación, correcciones e historial por campo siguen funcionando (regla 8) | ● | ○ | ◐ | ○ |
| Una app anterior rechaza lo que no sabe dibujar (ADR-0015) | ● | ● | ◐ | ○ |
| Solo se agrega lo que piden los formatos hoy | ● | ◐ | ○ | ● |

## Decisión

**A.**

- **Los tres tipos y sus valores:**
  - `opcion` es un `string`: una de `opciones` o, si el campo tiene `otro: true`, el texto de «Otro».
  - `opciones` es `{ elegidas: string[]; otro?: string }`. Es un objeto, no un arreglo, para que nunca se confunda con una lista de huellas de fotos.
  - `horario` es `{ desde: "HH:MM"; hasta?: "HH:MM" }`. Si `hasta` es menor que `desde`, la salida fue al día siguiente. El total se calcula, no se guarda.
- **Son datos simples** (`DATO_SIMPLE`): van en la tabla de datos, en el mismo paso que los demás y se corrigen en oficina como cualquier dato (regla 8).
- **Sí/No y Bueno/Regular/Malo** son conjuntos de opciones, no tipos aparte.
- **`tablas` en la sección:** cada una declara sus columnas (de 1 a 4, solo encabezados) y sus filas (la etiqueta y los campos de esa fila). Los campos siguen siendo `medida`, uno por celda, con su unidad; la tabla es solo presentación. Dentro de una tabla no hay «No se pudo obtener»: una celda vacía es una celda vacía.
- **`documento` en la firma:** omitido, `"opcional"` u `"obligatorio"`. El valor de la firma gana `documento?` (5 a 12 dígitos).
- **`sello` en la foto:** `{ ubicacion?: boolean; mapa?: boolean }`. Si está presente, la foto lleva la franja (ADR-0052).
- **Sin visibilidad condicional ni fórmulas.** El único cálculo que piden los formatos es el total del horario, que va dentro de su tipo. «¿Se emplearon materiales?» es un Sí/No más la tabla de cantidades que ya existe.
- **Compatibilidad:** `appMinima` de 16 o más para toda versión que use cualquiera de estas piezas; el servidor no se la baja a una app de menor versión (mismas reglas de `meta-esquema.ts` que ya existen para firmas y cantidades).

## Por qué gana a cada alternativa

- **Frente a B:** el dato seguiría siendo una medida por campo; con una matriz se pierden la validación por celda, la corrección por campo y su historial.
- **Frente a C:** nada de los dos formatos lo necesita, y un lenguaje de expresiones es una superficie de errores y de seguridad que no se justifica todavía.
- **Frente a D:** rompe R7 (el producto se puede vender a otras empresas) y se rompe con cada versión del formato.

## Consecuencias

- **A favor:** los formatos de TEINS son JSON publicados con `publicar-formato`; lo dudoso se corrige publicando otra versión, sin tocar código.
- **A favor:** un formato nuevo con selección, horario o tablas no exige que cambie nada más.
- **En contra:** hay cuatro controles nuevos que mantener en campo, oficina y el informe. Se mitiga con que cada uno vive en `paquetes/ui` con sus pruebas y con que `describirValor` es la única fuente del texto de un valor.
- **En contra:** el contrato y la validación de los tipos nuevos viajan en el JavaScript inicial de campo (la bajada valida los formatos antes de abrir la captura): el presupuesto de ADR-0030 sube de 135 a 136 KB. Los controles van en la captura, que se carga aparte.
- **En contra:** una tabla no puede tener celdas obligatorias. Se acepta: en el papel, una celda en blanco es válida.

## Cuándo revisarla

- Un formato necesita mostrar u ocultar un campo según otro: abrir un ADR de visibilidad condicional.
- Un formato necesita sumas o promedios por tabla: ver si caben en el informe antes de pensar en fórmulas.
