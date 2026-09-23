# ADR-0008 · Registro de cambios semántico con cadena de hashes por agregado

- **Estado:** Aceptada
- **Fecha:** 2026-09-23
- **Impulsores:** QA-8, QA-9, QA-25, F6, I-2, I-18, I-22, I-23, R1
- **Depende de:** ADR-0005

## Contexto

TEINS pidió registro de modificaciones con usuarios diferenciados. QA-8 exige que el 100 % de los cambios posteriores al envío queden con quién, cuándo, qué campo, valor anterior y nuevo. La Ley 1581 pide medidas que eviten la adulteración de registros y que la organización pueda demostrarlas.

Hay dos preguntas separadas:

1. **Qué se registra y cómo** (captura).
2. **Qué impide o detecta que el registro se altere** (integridad).

---

## Parte 1 · Captura

### Opciones

| Opción | Descripción |
|---|---|
| A. Columnas de auditoría básicas | `creado_por`, `modificado_por`, `modificado_en` en cada tabla |
| **B. Registro semántico desde la aplicación** | La aplicación escribe un registro de dominio por cada cambio, con campo, valores, autor e intención, en la misma transacción |
| C. Disparadores genéricos en la base | Cada INSERT/UPDATE/DELETE copia la fila antes y después |
| D. Event sourcing | El estado se reconstruye a partir de eventos |
| E. Tablas temporales | Versiones históricas automáticas de cada fila (en PostgreSQL requiere extensiones) |
| F. pgAudit | Registro de sentencias SQL ejecutadas |

### Evaluación

| Criterio | A | B | C | D | E | F |
|---|---|---|---|---|---|---|
| Valor anterior y nuevo por campo (QA-8) | ○ | ● | ◐ | ● | ◐ | ○ |
| Autor e intención (qué acción de negocio) | ◐ | ● | ◐ | ● | ○ | ○ |
| Legible para oficina y administración | ● | ● | ○ | ◐ | ○ | ○ |
| Captura cambios hechos fuera de la aplicación | ○ | ○ | ● | ○ | ● | ● |
| Complejidad para una persona (R1) | ● | ● | ◐ | ○ | ◐ | ● |

### Decisión

**B. Registro semántico escrito por la aplicación**, en la misma transacción que el cambio.

- **Frente a C:** los disparadores capturan todo, pero ven filas, no intención. Con el contenido del levantamiento en JSONB (ADR-0006), un disparador guardaría el documento completo antes y después, no "el campo potencia nominal pasó de 10 a 12 kVA"; y la identidad del usuario tendría que pasarse por variables de sesión. Su ventaja (capturar cambios fuera de la aplicación) se cubre de otra forma: el rol de la aplicación es el único que escribe datos de negocio, y los cambios directos de un administrador quedan fuera del alcance declarado.
- **Frente a D:** trazabilidad total, pero multiplica la complejidad de todo el sistema. B cumple QA-8 a una fracción del costo.
- **Frente a E y F:** E requiere extensiones y produce historia de filas, no de negocio. F sirve para cumplimiento operativo (qué SQL se ejecutó), no para que oficina entienda qué cambió en un levantamiento. Ambos pueden complementar más adelante.

### Qué se registra

| Etapa o categoría | Detalle |
|---|---|
| Borrador del técnico | Solo creación y envío (tensión resuelta en `01-impulsores.md`) |
| Desde el envío | Cada cambio por campo: ruta del campo, valor anterior, valor nuevo |
| Revisión | Toma, cambio de responsable y marca de revisado |
| Informes | Publicación, nueva versión y retiro |
| Seguridad | Inicios de sesión, revocaciones, regeneración de accesos de cliente, accesos y descargas del portal |

### Estructura de un registro

`id`, organización, tipo y id del agregado, **secuencia dentro del agregado**, tipo de evento, ruta del campo, valor anterior, valor nuevo, autor, **hora del servidor** (oficial), hora del dispositivo (si aplica, solo declarativa, I-2), id de correlación (la solicitud o comando que originó el cambio), motivo opcional, **versión del formato de registro**, hash anterior y hash propio.

El id de correlación permite ver "estos 12 cambios fueron un solo guardado" en lugar de 12 cambios sueltos.

---

## Parte 2 · Integridad

### Opciones, en orden de garantía

| Nivel | Mecanismo | Qué garantiza |
|---|---|---|
| 0 | Tabla normal | Nada: quien tenga acceso puede reescribir la historia |
| 1 | **Rol de la aplicación con permiso solo de insertar y leer** en tablas de auditoría | La aplicación, aunque tenga un error o sea comprometida, no puede modificar ni borrar registros |
| 2a | Cadena de hashes global | Cualquier modificación o borrado se detecta, pero todas las escrituras de auditoría se serializan en un punto |
| **2b** | **Cadena de hashes por agregado** | Lo mismo que 2a, sin punto global de contención |
| 3 | Anclaje externo de la cabeza de la cadena | Detecta incluso una reescritura completa hecha por un administrador de la base |

### Decisión

**Niveles 1 y 2b.** El nivel 3 queda fuera de alcance, con un camino barato registrado.

- **Nivel 1:** separación de roles en la base. La aplicación inserta y lee; nunca actualiza ni borra auditoría.
- **Nivel 2b:** cada registro incluye el hash del anterior **del mismo agregado**. `hash = SHA-256(hash_anterior ‖ serialización canónica del registro)`.
  - **Por agregado y no global:** los cambios de un levantamiento ya se serializan por la concurrencia optimista (ADR-0005), así que encadenar por agregado no agrega contención. Una cadena global serializaría todas las escrituras de auditoría del sistema.
  - Los eventos de seguridad, que no pertenecen a un agregado, usan una cadena por organización. Su volumen es bajo, así que la serialización no pesa.
  - **Serialización canónica con versión:** cada registro guarda la versión del formato con que se calculó su hash. Si mañana cambia la serialización, la verificación aplica la regla vigente cuando se escribió cada registro, sin falsos positivos.
  - **Verificación:** un trabajo periódico y una verificación bajo demanda por levantamiento recalculan la cadena y reportan el primer eslabón roto.

### Límite declarado

La cadena hace **detectable** una alteración; **no la impide**. Alguien con acceso de superusuario a la base podría reescribir toda la cadena de forma consistente, y eso solo se detecta con un anclaje externo (nivel 3). Camino barato si algún día se necesita: enviar periódicamente las cabezas de las cadenas a un medio que el administrador de la base no controle, como un correo a la gerencia de TEINS o un almacenamiento con bloqueo de objetos.

## Consecuencias

- **A favor:** historia legible por campo y por acción de negocio; cumple QA-8 y sirve como evidencia de responsabilidad demostrada (Ley 1581); la integridad es verificable con costo mínimo (una columna y una función).
- **En contra:** la aplicación debe registrar cada cambio de forma explícita (mitigado centralizando la escritura de agregados en el módulo núcleo); los cambios hechos directamente en la base por un administrador no quedan registrados (fuera de alcance, declarado).
- **Tensión con la Ley 1581 (I-20):** los valores registrados pueden contener datos personales y el registro es inmutable. Se mitiga con la minimización de datos personales del modelo de dominio. La salida técnica conocida es el borrado criptográfico: guardar los valores con datos personales cifrados con una clave por titular y, ante una supresión procedente, destruir la clave. Como la cadena se calcula sobre el valor cifrado, sigue siendo válida. **Condición:** solo funciona si el cifrado se aplica desde que se escribe el registro; agregarlo después obligaría a reescribir registros y rompería la cadena. Como TEINS aplazó su política de tratamiento, no se implementa ahora y se asume ese costo si llega a necesitarse.

## Cuándo revisarla

TEINS o un cliente exige garantías frente al propio administrador de la base (nivel 3); se vuelven frecuentes los cambios fuera de la aplicación (agregar disparadores como red de seguridad); una supresión procedente obliga a implementar el borrado criptográfico.
