# ADR-0052 · Hora, ubicación y mapa en la foto de llegada

- **Estado:** Aceptada
- **Fecha:** 2026-10-29
- **Impulsores:** QA-23 (fotos sin metadatos), I-2 (doble hora), I-12, R5 (confidencialidad), R6
- **Depende de:** ADR-0007, ADR-0009 (reemplaza en parte su fila «sin GPS en fotos»), ADR-0050

## Contexto

TEINS pidió que la foto de llegada diga cuándo y dónde se tomó, y mostró como modelo una foto con una franja arriba a la derecha (hora, coordenadas, dirección) y un mapa pequeño arriba a la izquierda. Hoy rige «sin ubicación GPS» (decisión del cliente en `01-impulsores.md`, ADR-0009 y QA-23), y la Ley 1581 de 2012 trata la ubicación de una persona como un dato personal.

Condiciones:

- El técnico puede estar sin señal: la foto tiene que poder tomarse igual.
- La hora del teléfono puede estar mal o adulterada, y una PWA no puede detectar un GPS falso.
- Mapas: Google Maps Static prohíbe guardar la imagen; Mapbox Static Images también y exige que la solicitud salga del dispositivo.

## Opciones

| Opción | Descripción |
|---|---|
| **A. Franja dibujada en la foto al tomarla** | Hora de red, hora del teléfono, coordenadas, dirección registrada y mapa; la foto misma lleva la franja |
| B. Foto limpia, datos aparte | La franja se dibuja al mostrarla |
| C. Sin ubicación | Solo la hora |

## Evaluación

| Criterio (ligado a un impulsor) | A | B | C |
|---|---|---|---|
| Lo que pidió TEINS, como la foto de ejemplo | ● | ◐ | ○ |
| La foto reenviada conserva el dato | ● | ○ | ○ |
| Funciona sin señal | ◐ | ● | ● |
| Menos datos personales (Ley 1581) | ○ | ○ | ● |
| No cambia el contrato por foto | ● | ○ | ● |

## Decisión

**A**, solo en las fotos de campos con `sello` (ADR-0050).

- **Contenido de la franja**, en este orden: «Red» con la hora del servidor (sin señal: «Red: sin señal»); «Teléfono» con la hora del teléfono; coordenadas con su precisión (`sello.ubicacion`); la dirección registrada del sitio y su ciudad; «{organización} · {cliente} · {sitio}».
- **La dirección es la registrada**, no la que calcula el GPS: no funciona sin señal, cuesta y en Colombia sale imprecisa.
- **El mapa** (`sello.mapa`) solo sale si hay señal al tomar la foto. Lo genera Geoapify (datos de OpenStreetMap) por medio de nuestro servidor, que redondea las coordenadas a 3 decimales (unos 110 m) antes de pedirlo; el pin exacto lo dibuja campo. La llave nunca sale del servidor y las coordenadas nunca se registran en los logs.
- **Nunca se bloquea la foto** esperando ubicación, hora de red o mapa: como mucho 3 segundos y sale con lo que haya.
- **Los metadatos EXIF se siguen quitando** (QA-23): las coordenadas están dibujadas en la imagen, no en sus metadatos.
- **Solo las fotos con `sello`** llevan ubicación; el resto de las fotos no cambia.
- **Autorización:** TEINS debe tener la autorización previa de sus técnicos y decirles la finalidad antes de activar `sello.ubicacion` en producción (Ley 1581). Hasta entonces, los formatos reales se publican sin ubicación o en una producción apagada.
- **Geoapify** como encargado del tratamiento: la cuenta va a nombre de TEINS, que como responsable acepta sus términos (transmisión a un encargado, Decreto 1377 de 2013, art. 25). Aloja en la Unión Europea, que está en la lista de países adecuados de la SIC.

## Por qué gana a cada alternativa

- **Frente a B:** exige datos nuevos por foto en el contrato y en cada pantalla, y una foto reenviada por WhatsApp no llevaría nada.
- **Frente a C:** no responde al pedido de TEINS ni a la necesidad de saber dónde estaba el técnico.

## Consecuencias

- **A favor:** la foto es un documento por sí sola, como la de ejemplo.
- **En contra:** un error en la franja solo se arregla tomando la foto otra vez. Se mitiga mostrando el estado de la ubicación antes de tomarla («Ubicación lista (±12 m)»).
- **En contra:** un reloj o un GPS falsos no se pueden detectar desde una PWA. Se mitiga con las dos horas: la del servidor y la del teléfono, de modo que una diferencia grande se ve a simple vista.
- **En contra:** hay una dependencia externa (Geoapify). Si falla o no hay llave, el servidor responde `no_disponible` y la foto sale sin mapa; el respaldo es dibujar el mapa en el servidor con las teselas de OpenFreeMap.
- **Dato personal nuevo:** las coordenadas de un técnico al llegar. Quedan dentro de la imagen, que ya es privada (URL firmada de minutos, ADR-0007).

## Cuándo revisarla

- Los sitios guardan coordenadas: comprobar en el servidor que la foto se tomó cerca (hoy no se puede).
- Geoapify cambia sus términos o su plan gratis: pasar al respaldo.
- TEINS decide no activar la ubicación: se quita `sello.ubicacion` de los formatos y queda solo la hora.
