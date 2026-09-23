# ADR-0007 · Almacenamiento de objetos, direccionado por contenido, con carga directa desde el cliente

- **Estado:** Aceptada
- **Fecha:** 2026-09-23
- **Impulsores:** QA-2, QA-4, QA-10, QA-14, QA-16, QA-19, QA-23, I-12, I-13, R6
- **Depende de:** ADR-0003, ADR-0005

## Contexto

Las fotos son el único volumen grande del sistema (≈ 175 GB por año en el escenario diez veces mayor de ADR-0001). Llegan desde celulares con señal débil, pueden contener metadatos de ubicación y dispositivo, y deben servirse de forma segura a oficina y, dentro de los PDF, a clientes. Oficina además adjunta planos.

## Parte 1 · Dónde se guardan

| Opción | Descripción |
|---|---|
| A. En la base de datos | Binarios como columnas de PostgreSQL |
| B. En el disco del servidor | Sistema de archivos local |
| C. Almacenamiento de objetos pasando por el servidor | El cliente sube al servidor y este reenvía |
| **D. Almacenamiento de objetos con carga directa** | El servidor autoriza con una URL firmada y el cliente sube directamente |
| E. Almacenamiento de un BaaS o de Google Drive | Servicio de terceros con su propio modelo de permisos |

| Criterio | A | B | C | D | E |
|---|---|---|---|---|---|
| Costo por GB y copias de seguridad livianas (QA-10, QA-19) | ○ | ◐ | ● | ● | ◐ |
| Varias instancias web sin rediseño (ADR-0001) | ● | ○ | ● | ● | ● |
| El servidor no carga el tráfico de fotos (QA-14) | ○ | ○ | ○ | ● | ● |
| Autorización controlada por la aplicación (QA-4) | ● | ● | ● | ● | ◐ |
| Portabilidad entre proveedores (R6) | ● | ● | ● | ● | ○ |

**Decisión: D**, con cualquier proveedor compatible con la API de S3 (el proveedor se elige en ADR-0016: puede ser gestionado o instalado por TEINS).

- **Frente a A:** las fotos inflarían la base y cada copia de seguridad; el almacenamiento de base de datos cuesta varias veces más por GB.
- **Frente a B:** rompe la regla de "ningún archivo en disco local" que permite escalar (ADR-0001).
- **Frente a C:** el servidor gastaría ancho de banda y memoria reenviando fotos sin agregar valor; la autorización se logra igual con URLs firmadas.
- **Frente a E:** el modelo de permisos del tercero no es el nuestro y ata el sistema a un proveedor.

## Parte 2 · Cómo se suben

| Opción | Descripción |
|---|---|
| **Carga única por archivo** | Una solicitud por archivo; si falla, se reintenta completo |
| Carga por partes (*multipart*) | El archivo se divide y cada parte se reintenta por separado |
| Protocolo reanudable (tus) | Servidor especializado que retoma donde quedó |

**Decisión: carga única.** Con la compresión en el dispositivo, una foto pesa unos cientos de KB: reintentarla completa cuesta menos que operar un protocolo reanudable o gestionar partes. Esto **precisa QA-2**: "un archivo interrumpido se reintenta sin reenviar lo ya confirmado" se cumple a nivel de archivo, no de bytes.

Se revisa si aparecen archivos grandes desde campo (video, fotos sin comprimir).

## Parte 3 · Flujo completo

**En el dispositivo, al capturar:**

1. Se aplica la orientación de la cámara y se **recodifica** la imagen (JPEG o WebP, lado mayor limitado, calidad ajustada). La recodificación **elimina todos los metadatos**, incluida la ubicación (QA-23), y normaliza formatos como HEIC.
2. Se calcula la huella SHA-256 del resultado.
3. Se guarda en IndexedDB junto con su metadato, en la misma transacción que la respuesta que la referencia (ADR-0004).

**Al haber señal (por adelantado, ADR-0003):**

4. El cliente pide autorización para subir. El servidor verifica permisos y devuelve una URL firmada de corta duración, **limitada en tamaño y tipo**, para la clave `organizacion/sha256`.
5. El cliente sube directamente al almacenamiento.
6. **El servidor no confía en el cliente** (I-13). El proceso *worker* verifica la firma interna del archivo (no la extensión ni el tipo declarado), el tamaño y la huella. Si el proveedor permite exigir la suma SHA-256 en la propia carga, se exige en la URL firmada.
7. El archivo pasa por los estados **pendiente → subido → verificado**. `EnviarLevantamiento` solo se acepta si todos sus archivos están verificados.
8. El *worker* genera miniaturas para oficina y para el PDF.

**Al descargar:**

9. El almacenamiento es **privado**. Toda descarga pasa por una verificación de permisos en la aplicación, que devuelve una URL firmada de pocos minutos. El portal del cliente nunca expone claves ni archivos sueltos: solo el PDF de versiones publicadas de su cliente.

## Parte 4 · Direccionamiento por contenido e inmutabilidad

La clave de cada archivo es su huella SHA-256. Consecuencias:

| Propiedad | Beneficio |
|---|---|
| Un contenido idéntico nunca se sube dos veces | Reintentos y reenvíos son idempotentes por construcción (QA-2) |
| Un objeto nunca se sobrescribe | Se puede cachear indefinidamente; no hay versiones inconsistentes |
| La integridad se verifica recalculando la huella | Detección de corrupción |

**Coherencia con las copias de seguridad (I-29):** como los objetos nunca se modifican, una restauración de la base a un punto anterior sigue encontrando sus archivos, **siempre que no se hayan borrado**. De ahí la regla de limpieza:

- Un archivo sin referencias se borra solo después de un plazo **mayor que la retención de las copias de la base**. Si la base se restaura a un punto en que el archivo sí estaba referenciado, el archivo todavía existe.
- Un archivo referenciado por una versión publicada **nunca se borra**.

## Parte 5 · Planos de oficina

- Tipos aceptados para incluir en informes: PDF e imagen. Otros formatos (por ejemplo DWG) se aceptan solo como adjuntos internos descargables, porque no pueden incrustarse en el PDF.
- Límite de tamaño por archivo, definido en configuración.
- Oficina trabaja en línea: los planos no pasan por el flujo sin conexión.

## Consecuencias

- **A favor:** el servidor no carga el tráfico de fotos; costos por GB bajos; privacidad por defecto; idempotencia e integridad por construcción; copias coherentes; proveedor intercambiable.
- **En contra:** más pasos que "subir al servidor" (autorización, verificación asíncrona, estados del archivo); la verificación de la firma interna y las miniaturas agregan trabajo al *worker*.

## Cuándo revisarla

Se capturan videos o archivos grandes en campo (carga por partes); TEINS exige que ningún archivo salga de su propia infraestructura (almacenamiento compatible con S3 instalado localmente); el costo de transferencia supera lo previsto (CDN o caché de miniaturas).
