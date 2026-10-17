[Plan de entrega](../plan-de-entrega.md) · Anterior: [Iteración 15 · Avisos push e instalación guiada](15-avisos-push.md) · Siguiente: [Iteración 17 · Catálogo en el teléfono](17-catalogo-en-el-telefono.md)

# Iteración 16 · Firma del cliente

**Estado en el mapa al 2026-10-16:** Terminada y desplegada en el entorno de pruebas; falta la prueba en iPhone

**Estado:** terminada el 2026-09-26, verificada en local y desplegada en el entorno de pruebas (los cuatro servicios, el formato de prueba v7 sembrado y los 14 archivos del extremo a extremo en verde contra el entorno). Falta la prueba en iPhone. Maquetas aprobadas por Kevin en el lienzo (página "v0.5 · Firma del cliente", "Yeah i liked it").

**Para qué:** que quien recibe la visita firme en el teléfono del técnico una constancia de que estuvo en el sitio, que llegue a oficina y al PDF del cliente, sin papel. Certifica la visita, no el contenido técnico (Kevin, 2026-09-26; ADR-0024).

## Alcance

- **Dominio y contrato:** tipo de campo `firma` con `declaracion` opcional (`{tecnico}`, `{sitio}`, `{fecha}`); valor `{ firma: huella, nombre, cargo?, firmadoEn, declaracion }`; validación (`firma_invalida`), no corregible por oficina, exige `appMinima` 7. Formato de prueba v7 con "Cierre de la visita".
- **Campo (app 7):** "Pedir la firma" abre la constancia a pantalla completa (nombre, cargo opcional, recuadro para firmar con dedo o lápiz, "Borrar" y "Firmar"); firmada, se ve con quién y cuándo, y "Volver a firmar" pide confirmar. Los trazos se guardan como un boceto y suben al enviar.
- **Oficina:** la firma en la revisión, con quién, cuándo, en el teléfono de qué técnico y la constancia; se comenta, no se corrige.
- **PDF:** "Constancia de visita" con lo que se leyó, la firma recortada, el nombre, el cargo y la hora.

## Fuera de la iteración 16

| Qué | Dónde se resuelve |
|---|---|
| Firma de quien responde por el informe en TEINS (el marcador `[FIRMA]` del PDF) | Cuando TEINS responda P23 |
| Documento de identidad de quien firma | Solo si TEINS lo pide (regla 18, datos mínimos) |
| Firma digital con certificado | ADR-0024, "Cuándo revisarla" |

## Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Kevin aprueba las maquetas | Hecho el 2026-09-26 |
| 2. Una firma válida se envía y una incompleta o con datos de más se rechaza; oficina no la corrige | Hecho: `dominio/src/firma.test.ts` (8 pruebas) y `servidor/pruebas/firmas.test.ts` |
| 3. Los trazos se guardan en el teléfono, volver a firmar los reemplaza y suben al enviar | Hecho: `campo/src/datos/repositorio.test.ts` |
| 4. El PDF muestra la constancia; sin firma, el dato como cualquier otro | Hecho: `firmas.test.ts` |
| 5. Extremo a extremo: firmar en el teléfono, enviar y verla en oficina sin poder corregirla | Hecho en Chromium y WebKit (`e2e/pruebas/firma.spec.ts`) |
| 6. Lo anterior sigue igual y el presupuesto de campo se respeta | Hecho: tipos, arquitectura, licencias y auditoría en verde; dominio 81, protocolo 18, oficina 4, campo 52, servidor 112; extremo a extremo 28 y 3 omitidas en Chromium y WebKit (ver la nota de `repeticiones.spec.ts` abajo); campo 117,4 de 120 KB |
| 7. Desplegada en el entorno de pruebas | Hecho el 2026-09-26: los cuatro servicios en `SUCCESS`, salud en 200, `sembrar` publicó el formato v7 y los 14 archivos del extremo a extremo contra el entorno en Chromium, 16 pruebas en verde |
| 8. Probada en el iPhone | Pendiente: fase 16 de [`verificacion-manual.md`](../verificacion-manual.md) |

## Decisiones tomadas al construirlo

- **La firma es un documento de boceto:** el mismo archivo, la misma subida al enviar, la misma verificación en el worker y el mismo dibujo. Por eso el recuadro es 4:3 (el lienzo de la versión 1); se muestra recortado a los trazos, sin cuadrícula (`Firma` de `ui` y `firmaASvg` para el PDF).
- **La constancia se llena en el teléfono y se guarda ya llena:** el PDF muestra lo que se leyó, aunque después cambie el nombre del sitio o el formato. El texto por defecto no nombra a la organización (R7); el del formato de prueba sí dice "de TEINS", porque es un dato del formato.
- **La pantalla de la firma trata de usted:** la lee el cliente, no el técnico (el resto de campo tutea).
- **Los errores se dicen al tocar "Firmar"** ("Escriba su nombre.", "Firme en el recuadro."), como en los formularios de oficina; "Firmar" no se deshabilita, porque un botón gris no explica qué falta.
- **La firma en el formato de prueba v7 es opcional:** así los demás recorridos de extremo a extremo no tienen que firmar; `firmas.test.ts` prueba la obligatoria.
- **El contorno de los trazos pasó a `campo/src/dibujo/trazo.ts`,** que usan el editor de bocetos y la firma: los dos se cargan aparte y comparten ese fragmento.
- **En el extremo a extremo en WebKit (iPhone 13) el recuadro queda bajo el pliegue:** la prueba se desplaza hasta él, como la persona.
- **Observado el 2026-09-26:** en la corrida completa, justo después de las pruebas de integración, `repeticiones.spec.ts` en Chromium agotó su tiempo una vez (1,5 minutos). No se reprodujo: 3 de 3 sola y 16 de 16 en la corrida completa de Chromium siguiente. Se vigila como el caso de `envio.spec.ts` del 2026-09-25; la integración continua reintenta una vez.
