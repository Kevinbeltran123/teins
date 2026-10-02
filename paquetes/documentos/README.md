# @teins/documentos

Los documentos que recibe el cliente (ADR-0031): las plantillas del informe y de la cotización, y los mensajes de envío (correo y WhatsApp). TypeScript puro: solo depende de `dominio` (regla `documentos-solo-dominio` de `.dependency-cruiser.cjs`).

Los usan dos paquetes con el mismo código, así que la vista previa y el PDF no se pueden apartar:

- **servidor:** el worker imprime el PDF con Chromium (ADR-0013) y el módulo de envíos arma el correo y las variables de WhatsApp.
- **oficina:** dibuja la vista en vivo mientras se escribe (cotización, informe, el capítulo en la revisión y lo que recibe cada contacto), en un marco del mismo origen y sin scripts. Las plantillas se cargan aparte, al abrir un documento.

## Una plantilla, dos salidas

Cada plantilla recibe `salida`:

| Salida | Estilos y fuente | Para |
|---|---|---|
| `{ tipo: "pdf", fuente }` | En `<style>`, con Geist incrustada en base64 | El PDF: no pide nada a la red |
| `{ tipo: "vista" }` | `<link rel="stylesheet" href="/documentos/informe.css">` (o `cotizacion.css`) | Oficina, cuya CSP solo admite estilos del propio origen |

El cuerpo es el mismo; una prueba lo compara (`src/documentos.test.ts`). La vista no lleva estilos en línea.

La hoja de la vista la arma `hojaDeLaVista(documento, ESTILOS_…)`: los estilos del PDF, la fuente por archivo (`geist.woff2`, junto a la hoja) y lo propio de la pantalla (hoja continua de 816 px con los márgenes que en el PDF pone `@page`, una franja donde el PDF salta de página, el destello de lo que cambió, el capítulo solo para la revisión y las fichas de los planos anexos). El plugin `teins-documentos` de `paquetes/oficina/vite.config.ts` la sirve en desarrollo y la deja en `dist/documentos/` al compilar.

## Qué exporta

| Exportación | Qué es |
|---|---|
| `plantillaInforme`, `piePagina`, `ESTILOS_INFORME`, `nombreDelPdfDeInforme` | El informe técnico. Cada fila de datos lleva `data-dato="sección/campo"` y cada parte su `id` (`introduccion`, `capitulo-…`, `conclusiones`, `planos`): la vista los usa para resaltar lo corregido e ir a una parte; el PDF los ignora |
| `plantillaCotizacion`, `piePaginaCotizacion`, `ESTILOS_COTIZACION`, `nombreDelPdfDeCotizacion`, `ContenidoCotizacion` | La cotización. Una línea sin precio (solo existe en el borrador) va como `[Precio]` |
| `asunto`, `textoDeCorreo`, `htmlDeCorreo`, `variablesDeWhatsapp`, `plantillaDeWhatsapp`, `MensajeDeEnvio` | Los mensajes de envío. `plantillaDeWhatsapp` es el texto que se registra en Meta, con `{{1}}` a `{{4}}` en el orden de las variables |
| `escapar`, `LOGO_TEINS` | El escape de todo texto que viene de personas y el logo oficial en base64 |
| `hojaDeLaVista`, `RUTA_DOCUMENTOS`, `ARCHIVO_FUENTE`, `Salida` | Lo de la salida de vista |

## Comandos

- `pnpm --filter @teins/documentos typecheck`
- `pnpm --filter @teins/documentos test`
- Iteración 30 (ADR-0036): `MensajeDeEnvio.personal` (`TextoPropio`: asunto y texto que escribió oficina) cambia el asunto y el texto entre el saludo y el pie en `htmlDeCorreo` y `textoDeCorreo`; `asuntoBase` y `textoBase` son los de TEINS, que se ofrecen para editar. El bloque editable va marcado `data-editable="texto"`. La tabla de cantidades del informe tiene columnas de ancho fijo (iteración 29).
