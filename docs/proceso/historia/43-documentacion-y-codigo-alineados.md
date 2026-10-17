[Plan de entrega](../plan-de-entrega.md) · Anterior: [Iteración 42 · Lo que se ve sale de lo guardado](42-lo-que-se-ve-sale-de-lo-guardado.md)

# Iteración 43 · Lo que dice la documentación es lo que hace el código

**Estado:** pedido de Kevin el 2026-10-16. Pidió reorganizar la documentación para que sea fácil de leer y de mantener («Reorganizar toda la documentación de la manera más óptima pero que claramente siga siendo bien completa»). Al dibujar los estados contra el código aparecieron 8 diferencias con `02-modelo-dominio.md` y los ADR. Kevin aprobó cerrarlas todas de una vez («Si, ejecuta todo eso, de una vez»), incluido el cambio que se ve en oficina: los envíos de una versión retirada ya no aparecen como «No llegó». Las revisiones de esos cambios encontraron dos fallos más, también arreglados.

## Alcance

**Documentación (pull request #4):**

- El estado vive en un solo lugar, `plan-de-entrega.md`, que pasó de 2377 a unas 95 líneas. `AGENTS.md` y `README.md` lo enlazan.
- La historia de cada corte o iteración, en esta carpeta. Un script comprobó que ninguna línea del plan original se perdió.
- `docs/README.md`: qué responde cada documento y cuándo se actualiza. Es la única lista de qué tocar al cerrar una iteración.
- `docs/arquitectura/03-como-funciona.md`: los estados y flujos de hoy en diagramas Mermaid, cada transición con su código y su ADR.
- Los README de los paquetes, el índice de ADR (agrupado por área), la verificación manual, el diseño y `DESIGN.md`, corregidos contra el código.

**Las 8 diferencias** (tabla en "Diferencias encontradas" de `03-como-funciona.md`):

- `02-modelo-dominio.md` dice lo que hace el código: sin "Anulado", `revisado` es final, soltar una revisión solo al desactivar al revisor, el envío del teléfono, las marcas de la visita, los módulos que existen y los eventos con sus nombres reales.
- ADR-0046: en campo también se descarta un envío en `error` que oficina nunca recibió. Amplía el 0035.
- ADR-0047: al retirar una versión, sus envíos que no han salido quedan `cancelado` con «Versión retirada» y no se reanudan. Uno que ya estaba saliendo puede terminar `enviado` o `entregado`; si el proveedor lo rechaza, sigue cancelado. Lo que ya había quedado `fallido` por un retiro anterior no cambia.

**Fallos encontrados al revisar:**

- `descartar` en el repositorio de campo no negaba descartar lo que oficina ya recibió; solo la pantalla lo impedía. Ahora lo niega también dentro de la transacción, como `volverABorrador`.
- Los archivos sin uso nunca se borraban del servidor, aunque ADR-0007 lo prometía. ADR-0048: la tarea periódica borra la fila y el objeto de fotos, bocetos y firmas que ningún levantamiento usa y que llevan 120 días sin actividad (la copia más vieja de la base dura 3 meses, más un mes de margen). Planos y PDF no se tocan. Migración `0039`.

## Fuera de la iteración 43

- Los objetos de S3 sin fila no se buscan: listar el depósito es costoso y no se distinguen de un PDF generado (ADR-0048).
- Las fases de la verificación manual para las iteraciones 20 a 42.
- `CampoFlotante` se exporta desde `paquetes/ui` y nadie lo usa; su comentario habla de un borde amarillo que Precisión prohíbe.

## Terminado cuando

| Criterio | Evidencia |
|---|---|
| El estado vive en un solo lugar y nada se perdió | Script de comparación contra el plan original; revisión con ojos nuevos |
| Los diagramas dicen lo que hace el código | Los 8 bloques se dibujan con mermaid-cli; unas 60 referencias `ruta:símbolo` comprobadas |
| Retirar una versión cancela sus envíos | Pruebas del servidor en `envios.test.ts` (retiro antes del PDF, retiro mientras sale y rechazo) y de oficina en `envios.test.ts` |
| Descartar no toca lo que oficina recibió | Prueba en `campo/src/datos/repositorio.test.ts` |
| Los archivos sin uso se borran, y nada más | Prueba "archivos sin uso" en `servidor/pruebas/mantenimiento.test.ts`: huérfano viejo, reciente, en uso, en versión publicada y plano |
| Verificación completa | `pnpm typecheck`, `pnpm arquitectura`, `pnpm licencias` (325 paquetes) y las pruebas de los paquetes: dominio 121, protocolo 29, documentos 11, campo 144, oficina 64 y servidor 247. Presupuesto de campo: 134,7 de 135 KB |
| Desplegada en el entorno de pruebas | 2026-10-16: `campo` (aplicó la `0039`), `oficina`, `portal` y `worker`; las tres superficies responden en `/salud` y el worker arrancó con su tarea periódica |

## Decisiones tomadas al construirlo

- El motivo «Versión retirada» va en la columna `error` que ya existía: sin migración ni cambio de forma del protocolo.
- Un archivo en uso se marca una vez (`en_uso_comprobado_en`) y no se vuelve a revisar: un levantamiento recibido nunca se borra en el servidor y sus fotos no se corrigen.
- La limpieza bloquea las filas candidatas (`for update skip locked`) y `archivos.estados` lee con `for share`: un envío en curso nunca pierde un archivo a medio camino.
- Las referencias del plan dentro de ADR aceptados no se cambiaron: los títulos de las secciones se conservaron en la historia.
- La integración no corría las pruebas de `oficina` ni de `documentos`; ahora van en el paso rápido. La prueba de propiedades del motor de campo tiene 30 s, porque con más paquetes a la vez pasaba de los 5 s.
- Después de fusionar con squash, `git merge -s ours origin/master` en `corte-0` (con los árboles iguales) evita que el siguiente pull request choque. Está en `AGENTS.md`.
