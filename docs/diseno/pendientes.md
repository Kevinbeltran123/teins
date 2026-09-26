# Diseño: pendientes, supuestos e insumos

## Pantallas por diseñar

La dirección cambió a **Consola** en la iteración 14 (`DESIGN.md`); el lienzo guarda las tres direcciones comparadas en la página "v0.3 · Direcciones". Todas las pantallas existentes se rehicieron con ella. Lo que queda:

1. **Instalación guiada de la PWA en iPhone:** hoy es un aviso con los pasos.
2. **Lienzo con el juego completo de Consola:** el lienzo tiene la dirección elegida en dos pantallas (accesos de clientes y captura); falta pasar al lienzo las demás tal como quedaron en código, para revisar con TEINS.
3. **Nombre del formato en la bandeja:** la columna "Formato" muestra la clave (`prueba-ups`), no el nombre que ve el técnico; el nombre solo viaja en el detalle.
4. **Logo en vector** (insumo de TEINS): con todas las superficies claras sirve la versión a color.
5. **Plantilla del PDF** (ADR-0013) con los mismos tokens, cuando TEINS responda P22, P23 y P26.

## Supuestos de diseño

Si alguno es falso, cambian tamaños y densidades, no el estilo.

- Los técnicos usan celulares de tamaño común y a veces tabletas.
- Trabajan con la mano desnuda, no con guantes gruesos.
- El tablero lo usa sobre todo oficina en un monitor de escritorio.
- Español de Colombia como único idioma.

## Insumos por pedir a TEINS

| Insumo | Para qué |
|---|---|
| Logo en blanco, en vector | Superficies azules |
| Formato físico actual (P6) e informes entregados (P22) | Renderizador de formatos y plantilla del PDF |
| Qué quieren ver en el tablero y qué deciden con eso | Contenido del tablero |
| Modelos de celulares y tabletas; uso de lápiz | Tamaños, zonas táctiles, rendimiento de referencia |
| Condiciones de campo: sol, guantes, una mano, alturas | Contraste y tamaño de controles |
| Perfil de los usuarios | Densidad de información y guía en pantalla |
| Vocabulario que usan | Textos de la interfaz |
| Acceso a un técnico unos 20 minutos | Probar el prototipo de campo antes de programarlo |

## Herramientas de interfaz

| Necesidad | Herramienta |
|---|---|
| Base de componentes | Propia, en `paquetes/ui`, sobre los elementos del navegador (`<dialog>`, popover) y los tokens |
| Iconos | Lucide (`lucide-react`, ISC), reexportado desde `@teins/ui` |
| Fuentes | Atkinson Hyperlegible Next, única familia, autoalojada con Fontsource |
| Tablas de oficina | `Tabla` de `ui`; TanStack Table + Virtual si una lista llega a miles de filas |
| Formularios | Estado local con validación al enviar y mensaje por campo; esquemas Zod de `protocolo` en el servidor |
| Notificaciones breves | `ProveedorNotificaciones` de `ui` (propio: CSS, sin dependencia) |
| Paleta de comandos (oficina) | cmdk, cuando haga falta |
| Gráficos del tablero | Gráficos de shadcn (Recharts), con los tokens |
| Movimiento | CSS en todas las superficies; Motion disponible solo para oficina |
| Fechas y números | API `Intl` con `es-CO` |
| Íconos de instalación PWA | Generador de recursos PWA |
| Accesibilidad | axe-core dentro de Playwright (WCAG 2.2 AA) |
| Regresión visual | Capturas con Playwright |
| Diseño | Lienzo de Claude (https://claude.ai/artifact/A77tYXi713xNbTMacNzM8v) |
