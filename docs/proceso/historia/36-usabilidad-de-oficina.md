[Plan de entrega](../plan-de-entrega.md) · Anterior: [Iteraciones 34 y 35 · Firma en una pantalla y qué sale en el informe](34-firma-y-que-sale-en-el-informe.md) · Siguiente: [Iteración 37 · Buscar en todo y revisar con el teclado](37-buscar-en-todo.md)

# Iteración 36 · Usabilidad de oficina

**Estado en el mapa al 2026-10-16:** Desplegada en el entorno de pruebas (2026-10-04)

**Estado:** prototipo `prototipos/usabilidad-oficina/prototipo.html` (https://claude.ai/artifact/EQDmHRyzPDiWvDmdsQdBDw) aprobado por Kevin el 2026-10-04 ("Me gusta, pero esos comandos tienen que estar y entenderse también para usuarios de windows"): la versión 2 del prototipo muestra los atajos en Mac y en Windows. Construida, verificada y desplegada en el entorno de pruebas el mismo día (solo `oficina`, sin migración).

**Para qué:** que oficina no pierda trabajo ni espacio: el informe y la cotización se guardan solos, la hoja se acomoda a lo que se está haciendo, el menú se pliega, cada persona vuelve a donde quedó y el orden se cambia arrastrando.

## Alcance (solo oficina y `paquetes/ui`, sin servidor ni migración)

- **Vista previa** (`EditorConVista`, `useVistaPrevia` y `BotonMostrarVista` en `oficina/src/pantallas/Lienzo.tsx`): «Ampliar» y «Ocultar» en la cabecera de la hoja; divisor que se arrastra o se mueve con las flechas, con doble clic para volver al ancho de siempre; la hoja desde 360 px y el editor desde 520 (660 en la cotización). Se recuerdan si va oculta y su ancho; la ampliación no.
- **Guardado automático** (`oficina/src/guardado.ts`, `pantallas/Guardado.tsx`): 1,5 s después de dejar de escribir y al salir; los guardados van en cola, cada uno sobre la versión que dejó el anterior (`useBorrador` lee la versión y el contenido vigentes sin esperar a pintar). Copia en el equipo mientras no se guarda; sin conexión, reintento al volver; con la sesión vencida, reintento después de ingresar; conflicto con «Guardar la mía encima» (usa la `versionActual` del 409) o «Cargar la guardada». Se quitan «Guardar borrador» y `useSalidaProtegida` (`salida.tsx`).
- **Menú plegable** (`Marco.tsx`): «Plegar el menú» al pie y ⌘B / Ctrl + B.
- **Lo que se recuerda** (`oficina/src/preferencias.ts`, `PersonaDeOficina` en `rutas.tsx`): pestañas de Levantamientos, Clientes, Visitas y del carril de la revisión; búsquedas de las cinco listas mientras dure la pestaña del navegador; la fila abierta marcada en la bandeja (`FilaTabla marcada`).
- **Ordenar arrastrando** (`ListaOrdenable`, `destinoAlArrastrar` y `moverEnLista` en `paquetes/ui`): los levantamientos incluidos y los planos anexos del informe, con el puntero y con el teclado; sin bibliotecas.
- **Atajos en Mac y Windows** (`paquetes/ui/src/teclas.ts`): ⌘ y ↵ en Mac, «Ctrl + …» y «Enter» en Windows, también en el ↵ de las confirmaciones de oficina.

## Fuera de la iteración 36

| Qué | Cuándo |
|---|---|
| ⌘K / Ctrl + K para buscar en todo (operación nueva `buscar`) | Iteración 37 |
| Atajos para revisar en serie (J, K, Enter, T, R, S, /) y su lista con «?» | Iteración 37 |
| Decir quién guardó en el aviso de conflicto («Cargar la de Laura»): el servidor no guarda quién guardó el borrador | Si oficina lo pide (necesita una columna y el dato en `obtenerInforme` y `obtenerCotizacion`) |
| Arrastrar las líneas de la cotización | Si oficina lo pide |

## Terminado cuando

| Criterio | Evidencia |
|---|---|
| 1. Como el prototipo | Capturas en Chromium a 1440 px: el informe con la hoja y sus botones, la hoja ampliada con «Volver al editor», la hoja oculta con «Mostrar la vista previa» en la barra, el menú plegado y el asa de los planos. Diferencias: el aviso de conflicto no nombra a la otra persona (ver arriba); el editor sin la hoja usa el ancho de siempre (1144 px) |
| 2. Pruebas de paquetes | `oficina/src/usabilidad.test.ts` (9, escritas antes del código): atajos en Mac y Windows, el destino al arrastrar (falló primero por un caso mal planteado en la prueba), preferencias por persona y sin almacenamiento, estados del guardado y la copia del equipo. Oficina 27, dominio 116, documentos 11, protocolo 25, campo 107, servidor 215 (`informes.test.ts` falló una vez por tiempos y pasa 11 de 11 sola; es la inestable conocida) |
| 3. Extremo a extremo | `borradores.spec.ts` reescrita para el guardado automático (8: se guarda solo, fallo de red, conflicto, publicar, sesión vencida, salir sin preguntar, copia sin conexión y copia de antes de otro guardado) y `usabilidad.spec.ts` nueva (4: vista previa, menú y atajo, lo recordado, ordenar con puntero y teclado), más `informe.spec.ts`, `informe-al-cliente.spec.ts`, `cotizaciones.spec.ts` y `revision.spec.ts`: 34 de 34 en Chromium y WebKit. Suite completa en local: 111 pasan, 3 omitidas y 2 fallan, las dos `administracion.spec.ts` (Chromium y WebKit) por tiempo: la lista de accesos de clientes de Administración, con los miles de clientes de prueba de la base local (la lentitud conocida; esta iteración no toca Administración) |
| 3b. Reglas | `pnpm typecheck`, `pnpm arquitectura` sin violaciones, `pnpm licencias`, `pnpm audit` sin vulnerabilidades; presupuesto de campo 132,0 de 135 KB (nada de lo nuevo entra a campo) |
| 4. Desplegada | Entorno de pruebas el 2026-10-04 desde el commit 7956826 (subido a GitHub): `oficina` en `SUCCESS` (Kevin corrió `railway up`; el control de permisos no me dejó). Verificado: salud 200, la misma compilación que la local (`index-DFQS79ZV.js`, con «Plegar el menú» y «Guardar la mía encima») y `verificar-exposicion.sh`. Falta que Kevin la pruebe |

## Decisiones tomadas al construirlo

- **La plataforma se lee de `userAgentData.platform` y, si viene vacía, de `navigator.platform`.** Cualquier otro sistema (Windows, Linux, Android) usa Ctrl. En Mac no se toma Ctrl, que en los campos borra hasta el final de la línea.
- **Los guardados automáticos van en cola** y cada uno lee la versión vigente de una referencia, no de lo pintado: dos guardados seguidos sin una pintada en medio chocaban consigo mismos (409).
- **Lo que falla igual no se reintenta a cada momento:** un error de validación espera a que cambie lo escrito; sin respuesta del servidor o con la sesión vencida, se reintenta cada 10 s.
- **La ampliación es la misma hoja en posición fija**, no otra copia: el marco no se vuelve a dibujar, y lo de atrás queda `inert` mientras tanto.
- **En las pruebas, la tecla del atajo depende del sistema que ve la página:** el proyecto emula un teléfono Android, así que la app espera Ctrl aunque la prueba corra en un Mac.

## Al cerrarla

**Iteración 36 (usabilidad de oficina) construida, verificada y desplegada en el entorno de pruebas el 2026-10-04** (sección "Iteración 36"). Kevin aprobó el prototipo `prototipos/usabilidad-oficina/prototipo.html` (https://claude.ai/artifact/EQDmHRyzPDiWvDmdsQdBDw) pidiendo que los atajos se entiendan en Windows (versión 2). Sigue: que Kevin la pruebe (en Mac y, si puede, en un equipo con Windows), y la iteración 37 (⌘K / Ctrl + K y los atajos para revisar en serie, con la operación nueva `buscar`).
