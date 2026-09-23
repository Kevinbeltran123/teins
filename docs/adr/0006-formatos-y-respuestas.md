# ADR-0006 · Formatos como esquema de dominio versionado; respuestas en modelo híbrido

- **Estado:** Aceptada
- **Fecha:** 2026-09-23
- **Impulsores:** QA-11, QA-12, QA-15, QA-16, QA-18, F1, F2, F9, R2
- **Depende de:** ADR-0004, ADR-0005

## Contexto

Dos decisiones ligadas:

1. **Cómo se define un formato** (UPS, datos, energía…) para que agregar un servicio o un campo no requiera publicar una versión nueva de la app (QA-11).
2. **Cómo se guardan las respuestas** de un levantamiento para que oficina pueda consultarlas, corregirlas y exportarlas, y para que un módulo futuro de presupuestos las use.

El vocabulario del dominio incluye conceptos que no son "campos de formulario" genéricos: medida con unidad obligatoria, secciones repetibles con etiqueta (Piso 1, Piso 2), boceto, tabla de cantidades con catálogo, y la marca "no se pudo obtener" con motivo (regla 3 del modelo).

---

## Parte 1 · Definición de formatos

### Opciones

| Opción | Descripción |
|---|---|
| A. Formatos en código | Un componente por formato |
| B. JSON Schema + UI Schema | Estándar de validación de datos más un documento de presentación, con un renderizador genérico (JSON Forms, RJSF) |
| C. SurveyJS Form Library | Biblioteca MIT que renderiza formularios definidos en su propio JSON; editor visual de pago |
| **D. Esquema de dominio propio** | Definición JSON con el vocabulario de TEINS, validada por un meta-esquema en código |
| E. Definición en tablas (EAV) | Formatos, secciones y campos como filas de la base de datos |

### Evaluación

| Criterio | A | B | C | D | E |
|---|---|---|---|---|---|
| Nuevo formato o campo sin publicar la app (QA-11) | ○ | ● | ● | ● | ● |
| Vocabulario del dominio sin forzarlo | ● | ◐ | ◐ | ● | ◐ |
| Una definición para campo, oficina, PDF y validación en servidor | ◐ | ◐ | ◐ | ● | ◐ |
| Peso del paquete de campo (QA-16) | ● | ◐ | ◐ | ● | ● |
| Control del formato histórico almacenado (versiones de años) | ● | ● | ◐ | ● | ◐ |
| Editor visual disponible a futuro (P10) | ○ | ◐ | ● (licencia) | ◐ | ◐ |
| Esfuerzo inicial | ◐ | ◐ | ● | ◐ | ○ |
| Sin dependencia de licencias comerciales | ● | ● | ◐ | ● | ● |

### Decisión

**D. Esquema de dominio propio, versionado e inmutable.**

Estructura (ilustrativa):

```json
{
  "formato": "ups",
  "version": 3,
  "secciones": [
    {
      "clave": "ubicacion_equipo",
      "titulo": "Ubicación del equipo",
      "repetible": { "etiqueta": "Área", "min": 1 },
      "campos": [
        { "clave": "potencia_nominal", "etiqueta": "Potencia nominal", "tipo": "medida",
          "unidades": ["kVA", "kW"], "obligatorio": true },
        { "clave": "estado_baterias", "etiqueta": "Estado de baterías", "tipo": "seleccion",
          "opciones": ["Bueno", "Regular", "Malo"], "obligatorio": true },
        { "clave": "foto_placa", "etiqueta": "Placa del equipo", "tipo": "foto", "min": 1 },
        { "clave": "croquis", "etiqueta": "Croquis del cuarto", "tipo": "boceto" },
        { "clave": "materiales", "etiqueta": "Materiales", "tipo": "cantidades" }
      ]
    }
  ]
}
```

**Tipos de campo iniciales:** `texto`, `texto_largo`, `numero`, `medida` (con unidades permitidas), `seleccion`, `seleccion_multiple`, `si_no`, `fecha`, `foto`, `boceto`, `cantidades`, `nota` (texto informativo sin captura).

Reglas:

1. **Un meta-esquema en código** valida cada definición antes de publicarla. Una definición inválida nunca llega a un dispositivo.
2. **La misma definición gobierna todo:** captura en campo, revisión en oficina, validación en el servidor y composición del PDF. Con un solo lenguaje en cliente y servidor (ADR-0010), el mismo código valida en los tres lugares.
3. **Versiones inmutables** con huella digital. Un borrador en curso termina con la versión con que empezó; los levantamientos nuevos usan la vigente.
4. **Claves estables entre versiones:** si un campo conserva su significado, conserva su clave; si cambia de significado, recibe una clave nueva. Esto permite estadísticas entre versiones (QA-12).
5. **Límite honesto de QA-11:** un formato nuevo o un campo nuevo **de un tipo existente** no requiere publicar la app. Un **tipo de campo nuevo** sí requiere código.
6. **Punto de extensión reservado:** `visibleSi` (campos condicionales) queda reservado en el meta-esquema pero no se implementa en la primera versión.
7. **Interoperabilidad:** de la definición se puede generar JSON Schema si algún sistema externo lo necesita.

### Por qué gana a cada alternativa

- **Frente a A:** cada formato nuevo sería una versión de la app. Incumple QA-11 directamente.
- **Frente a B:** JSON Schema describe validez de datos, no conceptos de captura. Secciones repetibles con etiqueta, medida con unidad, boceto y "no se pudo obtener" exigen extensiones propias más un UI Schema: dos documentos que mantener sincronizados. El trabajo termina siendo parecido a D, con un renderizador genérico más pesado. Se conserva como formato de exportación.
- **Frente a C (alternativa más fuerte):** la biblioteca es MIT, madura, con captura de imagen y soporte sin conexión. Pero el formato histórico de todas las versiones quedaría en el JSON de SurveyJS para siempre; los conceptos del dominio se implementarían como tipos personalizados; la validación en servidor requiere su motor; y su editor visual y su generador de PDF requieren licencia comercial por desarrollador. **Queda registrada como plan B** si TEINS necesita un editor visual pronto y acepta pagar la licencia: comprar en lugar de construir, con esta decisión como punto de comparación.
- **Frente a E:** definir formatos como filas hace pesadas las consultas y la validación, y no aporta nada que un documento versionado no dé.

---

## Parte 2 · Almacenamiento de respuestas

### Opciones

| Opción | Descripción |
|---|---|
| 1. Una tabla por formato | Columnas tipadas por campo |
| 2. EAV | Una fila por respuesta (levantamiento, campo, valor) |
| 3. Documento JSONB completo | Todo el levantamiento en un documento |
| **4. Híbrido** | Documento JSONB para el contenido variable; columnas relacionales para metadatos consultables; tabla relacional para líneas de cantidad |

### Evaluación

| Criterio | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| Formato nuevo sin migrar la base (QA-11) | ○ | ● | ● | ● |
| Leer y guardar el agregado completo de una vez (ADR-0003) | ◐ | ○ | ● | ● |
| Consultas de oficina por estado, visita, técnico, fecha | ● | ◐ | ◐ | ● |
| Cantidades normalizables, exportables y agregables (F9, QA-12) | ● | ◐ | ○ | ● |
| Simplicidad | ◐ | ○ | ● | ◐ |

### Decisión

**4. Híbrido**, donde cada parte se guarda según cómo se usa:

| Parte del levantamiento | Almacenamiento | Razón |
|---|---|---|
| Estado, visita, técnico, versión de formato, fechas, versión optimista | Columnas relacionales | Filtros y listados de oficina; concurrencia optimista (ADR-0005) |
| Secciones, respuestas, referencias a evidencias | Documento JSONB | Estructura variable según el formato |
| Líneas de cantidad | Tabla relacional | Oficina las normaliza contra el catálogo, se exportan a Excel, se suman entre levantamientos y el futuro módulo de presupuestos las cruzará con precios |

Todo se escribe en la misma transacción: sigue siendo un solo agregado.

**Representación de valores:**

- Medida: `{ "valor": "12.50", "unidad": "m" }`. **El número va como texto decimal**, no como número JSON, para no introducir errores de coma flotante en medidas de ingeniería.
- Dato no obtenido: `{ "noObtenido": true, "motivo": "Sin acceso al tablero" }`.
- Evidencia: referencia al identificador del archivo (ADR-0007), nunca el binario.

## Consecuencias

- **A favor:** formatos y campos nuevos sin publicar la app ni migrar la base; una sola definición para cuatro usos; cantidades listas para presupuestos; control total del formato histórico.
- **En contra:** hay que construir el meta-esquema y los renderizadores de cada tipo; los tipos nuevos requieren código; no hay editor visual en la primera versión (mitigado por el plan B con SurveyJS Creator).

## Cuándo revisarla

TEINS necesita editar formatos sin un desarrollador (P10) antes de lo previsto; los formatos requieren lógica condicional compleja; aparece un tipo de campo que no encaja en el meta-esquema.
