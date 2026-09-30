# ADR-0024 · Firma del cliente como constancia de la visita, guardada con el formato de los bocetos

- **Estado:** Aceptada
- **Fecha:** 2026-09-26
- **Impulsores:** QA-1, QA-8, QA-15, QA-17, R5, R7
- **Depende de:** ADR-0006, ADR-0007, ADR-0008, ADR-0019

## Contexto

Kevin pidió la firma del cliente en sitio (plan de las iteraciones 15 a 21). En Colombia una firma electrónica vale como la manuscrita si identifica a quien firma y garantiza que el mensaje no cambió (Ley 527 de 1999). Hay que decidir qué certifica, cómo se guarda y qué puede hacer oficina con ella.

Hechos:

- Oficina corrige datos después del envío, con trazabilidad (QA-8). Si la firma certificara el contenido técnico, cada corrección contradiría lo firmado.
- Los bocetos ya son trazos vectoriales con presión, dibujados con perfect-freehand, guardados como archivo inmutable por su huella, verificados por el worker y convertidos a SVG para oficina y el PDF (ADR-0019).
- La captura funciona sin conexión (QA-1): la firma también.

## Parte 1 · Qué certifica

| Opción | Consecuencia |
|---|---|
| **A. La visita** | Quien la recibió confirma que el técnico estuvo en el sitio ese día. Oficina corrige medidas sin invalidarla |
| B. El contenido | Firmar bloquearía el levantamiento; toda corrección posterior contradeciría lo firmado |

**Decisión: A** (Kevin, 2026-09-26). El texto de la constancia viene del formato (dato, regla 6; R7: TEINS no está en el código), con `{tecnico}`, `{sitio}` y `{fecha}`, y se guarda ya lleno junto a la firma: el PDF muestra exactamente lo que se leyó al firmar.

## Parte 2 · Cómo se guarda

| Opción | Descripción |
|---|---|
| **A. Documento de boceto (solo trazos, lienzo de la versión 1) + datos en el valor** | Reutiliza archivo, subida, verificación y SVG |
| B. Formato de archivo propio para firmas | Otro tipo de archivo, otra verificación, otro dibujo |
| C. Imagen PNG | No se puede recortar ni ampliar sin perder nitidez (QA-17) |

**Decisión: A.** El valor del campo es `{ firma: huella, nombre, cargo?, firmadoEn, declaracion }`; la huella apunta a un documento de boceto sin cuadrícula al dibujarlo y recortado a sus trazos. La huella entra al levantamiento, y el levantamiento a la cadena de auditoría (ADR-0008): cualquier cambio posterior se nota.

- **Frente a B:** el mismo resultado con el doble de código; el lienzo 4:3 del boceto alcanza para una firma.
- **Frente a C:** una imagen pierde nitidez al ampliarse y pesa más.

## Parte 3 · Reglas

1. **Tipo de campo `firma`** con `declaracion` opcional (hay un texto por defecto). Exige `appMinima` 7.
2. **Nombre obligatorio, cargo opcional, sin número de documento** (regla 18, datos mínimos) mientras TEINS no lo pida (P23).
3. **Oficina no corrige una firma;** puede comentarla. Sin firma, el campo obligatorio se marca "No se pudo obtener" con su motivo (regla 3).
4. **Volver a firmar reemplaza la firma** y pide confirmación; la anterior no se conserva en el teléfono (el levantamiento es borrador).
5. **Sube al enviar,** como los bocetos: mientras es borrador puede reemplazarse.

## Consecuencias

- **A favor:** sin dependencias ni formatos nuevos; la firma se ve nítida en oficina y en el PDF; oficina corrige sin tocar lo que certifica.
- **En contra:** no es una firma digital con certificado; su valor probatorio es el de una firma electrónica simple (identificación por nombre, momento y teléfono del técnico, integridad por la cadena). Si TEINS necesita más, se revisa.

## Cuándo revisarla

TEINS pide que el cliente firme el contenido técnico o una firma digital certificada; aparece la necesidad de identificar a quien firma con su documento.
