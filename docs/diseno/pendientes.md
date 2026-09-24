# Diseño: pendientes, supuestos e insumos

## Pantallas por diseñar

En orden de prioridad. Todas parten de `DESIGN.md`.

1. **Oficina · Revisión:** detalle del levantamiento, corrección por campo, historial de cambios, comentarios al técnico, toma de revisión.
2. **Estados de las pantallas existentes:** hechos en el corte 1 para la lista y la captura de campo, el ingreso y la bandeja y el detalle de oficina. Cada pantalla nueva los trae desde el principio.
3. **Campo · Editor de bocetos** (ADR-0019).
4. **Ingreso:** con usuario y contraseña, hecho en el corte 1. Faltan la passkey (ADR-0009) y la instalación guiada de la PWA en iPhone (hoy es un aviso con los pasos).
5. **Portal del cliente:** acceso con QR y clave, lista y descarga de informes.
6. **Plantilla del PDF** (ADR-0013), con los mismos tokens.
7. **Oficina · Composición y publicación del informe.**
8. **Administración:** usuarios, accesos de cliente, dispositivos, formatos.

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
| Base de componentes | shadcn/ui (Base UI), copiada a `paquetes/ui` y reestilizada |
| Iconos | Lucide |
| Fuentes | Atkinson Hyperlegible Next, única familia, autoalojada con Fontsource |
| Tablas de oficina | TanStack Table + TanStack Virtual |
| Formularios | React Hook Form + esquemas Zod de `protocolo` |
| Notificaciones breves | Sonner |
| Paleta de comandos (oficina) | cmdk |
| Gráficos del tablero | Gráficos de shadcn (Recharts), con los tokens |
| Movimiento | CSS y View Transitions en campo; Motion solo en oficina |
| Fechas y números | API `Intl` con `es-CO` |
| Íconos de instalación PWA | Generador de recursos PWA |
| Catálogo de componentes | Storybook |
| Accesibilidad | axe-core dentro de Playwright (WCAG 2.2 AA) |
| Regresión visual | Capturas con Playwright |
| Diseño | Lienzo de Claude (https://claude.ai/artifact/A77tYXi713xNbTMacNzM8v) o Figma |
