[Plan de entrega](../plan-de-entrega.md) · Anterior: [Iteración 10 · Bocetos](10-bocetos.md) · Siguiente: [Iteración 12 · Cifrado local en campo](12-cifrado-local.md)

# Iteración 11 · Cantidades con catálogo

**Estado en el mapa al 2026-10-16:** Terminada y desplegada en el entorno de pruebas; falta la prueba en iPhone

**Estado:** terminada el 2026-09-25 y desplegada en el entorno de pruebas (formato de prueba v6 sembrado). Falta la prueba en iPhone (fase 11 de la guía), en espera con las de las iteraciones 9 y 10.

**Para qué:** que los materiales y trabajos que el técnico anota en campo no se vuelvan a digitar para cotizar: oficina los vincula al catálogo de TEINS, los suma por visita y los exporta a Excel (F9, P27, P28; reglas 6 y 7 del modelo de dominio).

## Alcance

- **Formato:** tipo de campo `cantidades` con sus unidades permitidas (`unidades`, como la medida). Exige app 6.
- **Campo (app 6):** tabla de líneas: descripción, cantidad (decimal, mayor que cero), unidad y observación opcional; agregar y quitar líneas. Texto libre: el técnico no elige del catálogo (regla 6).
- **Servidor:** al recibir el levantamiento, y después de cada corrección, las líneas se proyectan a una tabla relacional en la misma transacción (ADR-0006, parte 2). Allí vive el vínculo al catálogo. Una línea que desaparece se marca como quitada, nunca se borra (regla 14).
- **Catálogo:** pantalla de oficina para crear, editar y desactivar ítems (código, descripción, unidad) e importarlos en bloque desde CSV (TEINS ya tiene su lista, P28).
- **Revisión:** quien tiene la revisión corrige las líneas (con historial) y vincula cada una a un ítem del catálogo (queda en la auditoría).
- **Exportación:** por visita, dos CSV que Excel en español abre directo: el detalle de líneas y el resumen sumado por ítem de catálogo (o por descripción y unidad si no está vinculado). Sin precios (regla 7).
- **Informe:** la tabla de cantidades en el PDF.

## Supuestos mientras TEINS responde

| Pregunta | Supuesto |
|---|---|
| P28: ¿qué columnas tiene su catálogo? | Código, descripción y unidad |
| P29: ¿qué columnas necesita el Excel? | Visita, cliente, sitio, levantamiento, técnico, sección, descripción, cantidad, unidad, observación, código y descripción del catálogo; el resumen suma por ítem y unidad |

## Fuera de la iteración 11

| Qué | Dónde se resuelve |
|---|---|
| Sugerencias del catálogo en campo mientras se escribe | Cuando TEINS lo pida: exige bajar el catálogo al teléfono |
| Precios y presupuestos | Módulo futuro (QA-12); nunca en la línea de cantidad (regla 7) |
| Archivo .xlsx con formato | Cuando TEINS responda P29; mientras, CSV |

## Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Extremo a extremo: el técnico anota líneas y envía; oficina importa un catálogo, vincula una línea, corrige otra y exporta el detalle y el resumen de la visita; el PDF trae la tabla | Hecho: `e2e/pruebas/cantidades.spec.ts` en Chromium y WebKit en local, y en Chromium contra el entorno de pruebas; la tabla del PDF, en `servidor/pruebas/cantidades.test.ts` |
| 2. El servidor rechaza líneas sin descripción, con cantidad cero o con una unidad no permitida | Hecho: `cantidades_invalidas` en `dominio/src/cantidades.test.ts` y en el envío (`servidor/pruebas/cantidades.test.ts`) |
| 3. La tabla relacional sigue al documento: corregir agrega, cambia o marca quitadas las líneas y conserva los vínculos | Hecho: `servidor/pruebas/cantidades.test.ts` (proyección, corrección y exportación) |
| 4. Vincular solo lo hace quien tiene la revisión, y queda en la auditoría | Hecho: sin revisión responde `estado_invalido`, un ítem desactivado `entrada_invalida`, el técnico no ve el catálogo (403); `linea_vinculada` en la auditoría con el ítem anterior y el nuevo |
| 5. Lo anterior sigue igual y el presupuesto de campo se respeta | Hecho: verificación completa en el orden de la integración continua (dominio 73, protocolo 18, oficina 4, campo 41, servidor 89, extremo a extremo 21 y 1 omitida); campo 115,4 de 120 KB |

## Decisiones tomadas al construirlo

- **La cantidad es un decimal en texto** ("12.5"), mayor que cero, como la medida (ADR-0006): nada de coma flotante en lo que se cotiza. Campo y oficina aceptan "12,5" y guardan el canónico; lo que no se puede leer se guarda tal cual y la validación del envío lo marca (`cantidades_invalidas`).
- **Cada línea tiene un id de 8 caracteres** que genera quien la crea. El vínculo al catálogo y las correcciones siguen la línea por su id, no por su posición: reordenar o quitar otra línea no cambia a qué ítem está vinculada.
- **El vínculo no está en las respuestas, está en la proyección** (`levantamientos.lineas_cantidad`, clave levantamiento, sección, campo y línea). Lo que escribió el técnico no cambia al vincular; la proyección se actualiza en la misma transacción que el envío y que cada corrección, y una línea que desaparece queda marcada `quitada_en` con su vínculo (regla 14).
- **Vincular es una acción de revisión:** solo quien tiene la revisión, sube la versión del levantamiento (dos pestañas no se pisan, QA-25) y queda en la auditoría como `linea_vinculada` con el ítem anterior y el nuevo. Un ítem desactivado no se vincula, pero las líneas que ya lo tenían lo conservan.
- **Módulo `catalogo` propio** (esquema `catalogo`, RLS por organización), con interfaz pública `items(ids)`: levantamientos no lee su tabla. Un ítem nunca se borra; se desactiva. La importación actualiza por código (el último del archivo manda) y reactiva lo que estaba desactivado.
- **El CSV lo arma el navegador;** el servidor entrega los datos (`cantidadesDeVisita`). Punto y coma, coma decimal, BOM y CRLF para que Excel en español lo abra con doble clic. Una celda de texto libre que empieza por `=`, `+`, `-` o `@` lleva un apóstrofo delante: Excel no la ejecuta como fórmula.
- **La exportación incluye levantamientos sin revisar,** con un aviso: oficina puede querer cotizar antes de cerrar la revisión. El resumen suma por ítem y unidad; lo no vinculado, por descripción (sin distinguir mayúsculas ni espacios) y unidad.
- **Elegir el ítem es una lista nativa** con todos los activos ("C-12 · Cable THHN 12 AWG (m)"), sin filtrar por la unidad de la línea: el técnico puede escribir "und" donde el catálogo dice "UN". Si el catálogo real es de miles de ítems y la lista se vuelve lenta, se cambia por un buscador.
- **Contra el entorno de pruebas, un navegador y una prueba a la vez:** tres pruebas seguidas chocan con el límite de 5 inicios de sesión por minuto (QA-7) y la de repeticiones venció esperando la bandeja; sola pasó en 28 s.
- **oficina estrena pruebas unitarias** (`src/csv.test.ts`): la lectura del catálogo y la escritura de los CSV no se prueban bien solo de punta a punta.

## Al cerrarla

**Iteración 11 terminada el 2026-09-25:** cantidades con catálogo de campo a Excel, desplegadas en el entorno de pruebas con el formato de prueba v6 ("Materiales"). Las columnas del catálogo y de los CSV son supuestas (P28, P29) hasta que TEINS responda. La prueba en iPhone de las iteraciones 9 a 11 está en espera (fases 9 a 11 de la guía).
