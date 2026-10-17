[Plan de entrega](../plan-de-entrega.md) · Anterior: [Iteración 36 · Usabilidad de oficina](36-usabilidad-de-oficina.md) · Siguiente: [Iteraciones 38 y 39 · La revisión al lado y las conversaciones con campo](38-revision-al-lado-y-conversaciones.md)

# Iteración 37 · Buscar en todo y revisar con el teclado

**Estado en el mapa al 2026-10-16:** Desplegada en el entorno de pruebas (2026-10-04)

**Estado:** del mismo prototipo aprobado que la 36 (`prototipos/usabilidad-oficina`, casos «Buscar e ir» y «Revisar con el teclado», con los atajos en Mac y Windows). Kevin pidió seguir el 2026-10-04 ("Sigue"). Construida, verificada y desplegada en el entorno de pruebas el mismo día (solo `oficina`).

## Alcance (solo oficina y `paquetes/ui`, sin servidor ni migración)

- **Buscar en todo** (`oficina/src/busqueda.ts`, `pantallas/Paleta.tsx`): ⌘K / Ctrl + K o «Buscar» en el menú; recientes (`useRecientes`, `useAnotarReciente` al abrir un levantamiento, un informe, una cotización o un cliente), acciones («Programar visita», «Nuevo cliente», «Nueva cotización» abren su formulario por el estado del enrutador `abrir`; «Tomar el más antiguo»), secciones y resultados por grupo. Una visita abre Visitas buscando ese cliente.
- **Revisar con el teclado** (`oficina/src/atajos.ts`, `useTeclaSuelta`): J, K, ↓, ↑, Enter y «/» en la bandeja (mueven la fila marcada de la 36); T, R, S y Esc en la revisión; «?» y «Atajos del teclado» abren la lista (`pantallas/Atajos.tsx`). Cada botón con atajo muestra su tecla.

## Fuera de la iteración 37

| Qué | Cuándo |
|---|---|
| Buscar en las visitas anteriores y canceladas, y en los clientes archivados | Si oficina lo pide: la búsqueda usa las consultas de las listas, y Visitas trae las próximas |
| Atajos en otras pantallas (cotización, informe) | Si oficina lo pide |

## Terminado cuando

| Criterio | Evidencia |
|---|---|
| 1. Como el prototipo | Capturas en Chromium a 1440 px: la búsqueda vacía con las acciones, con resultados y sin nada, la lista de atajos y la bandeja con la fila marcada |
| 2. Pruebas de paquetes | `oficina/src/busqueda.test.ts` (7, escritas antes del código): grupos y orden, varias palabras sin tildes, los levantamientos que ya vienen buscados, y las teclas sueltas sin modificadores, fuera de campos y sin diálogos. Oficina 34, dominio 116, documentos 11, protocolo 25, campo 107; servidor 214 de 215 (falla la de `informes.test.ts` que ya era inestable; no se tocó el servidor) |
| 3. Extremo a extremo | `usabilidad.spec.ts` suma dos (buscar con el atajo, ir a un cliente, recientes y «Programar visita»; la serie J, Enter, T, R, Enter, S y Esc, y «?»): 12 de 12 en Chromium y WebKit. `revision.spec.ts`, `programacion.spec.ts`, `correcciones.spec.ts`, `cotizaciones.spec.ts` y `borradores.spec.ts`: 26 de 26 |
| 3b. Reglas | `pnpm typecheck`, `pnpm arquitectura` sin violaciones, `pnpm licencias`, `pnpm audit` sin vulnerabilidades; presupuesto de campo 132,1 de 135 KB |
| 4. Desplegada | Entorno de pruebas el 2026-10-04 desde el commit 5448f78 (subido a GitHub): `oficina` en `SUCCESS` (Kevin corrió `railway up`). Verificado: salud 200, la misma compilación que la local (`index-BgazDbpn.js`, con «Buscar en oficina» y «Atajos del teclado») y `verificar-exposicion.sh`. Falta que Kevin la pruebe |

## Decisiones tomadas al construirlo

- **Sin operación nueva en el servidor** (el prototipo proponía `buscar`): informes, cotizaciones y clientes ya llegan completos a oficina, y los levantamientos ya se buscan en el servidor (`listarLevantamientos` con `buscar` y `limite: 4`, uno por estado). La búsqueda usa esas consultas: ve lo mismo que las listas, con sus mismos permisos, y la iteración solo despliega `oficina`.
- **Un diálogo que se está cerrando no cuenta como abierto:** su copia (`capa-saliendo`) dura 200 ms, y sin esto la primera tecla después de Esc se perdía.
- **Enter y Espacio sobre un botón o un enlace hacen lo suyo,** no abren la fila marcada.
- **Esc en la revisión vuelve a la bandeja** solo fuera de los campos y sin diálogos (Esc en un diálogo lo cierra).
- **Atajos a la vista, después de verlo Kevin en el entorno de pruebas** ("¿es estético que se vean los comandos? ¿esto se usa realmente en la industria?"): solo «Buscar» muestra «⌘K»; «Plegar el menú» es un icono junto al logo; «Atajos del teclado» sale del menú (queda con «?» y en la búsqueda); los botones de la revisión llevan su tecla en la ayuda al pasar el cursor. El pie del menú vuelve a ser solo la cuenta.
- **La lista de la búsqueda se aplastaba en Safari** (`flex: 1` con base 0 en un diálogo sin alto fijo; el WebKit de Playwright no lo reprodujo): ahora `flex: 1 1 auto`. Desplegado en el entorno de pruebas el 2026-10-04 desde 9588b51 (`index-DECwusc1.js`, igual a la local).
- **Pruebas:** el servidor de vista previa de oficina se llama `vite.js preview`; `pkill -f "vite preview"` no lo cierra y Playwright lo reutiliza con la compilación vieja (`reuseExistingServer`). Ciérrelo con `pkill -f "vite.js preview"` antes de correr el extremo a extremo.

## Al cerrarla

**Iteración 37 (buscar en todo y revisar con el teclado) construida, verificada y desplegada en el entorno de pruebas el 2026-10-04** (sección "Iteración 37"), sin operación nueva en el servidor. Sigue: que Kevin pruebe la 36 y la 37, en Mac y, si puede, en Windows.
