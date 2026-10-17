# Diseño: pendientes, supuestos e insumos

## Pantallas por diseñar

La dirección vigente es **Precisión** (`DESIGN.md`, desde el 2026-09-29), sobre la estructura de Recorrido (iteraciones 22 y 23). Desde la iteración 22, cada cambio de interfaz se aprueba antes en un prototipo navegable de [`prototipos/`](../../prototipos/README.md). El lienzo de Claude guarda las direcciones comparadas al principio ("v0.3 · Direcciones") y la instalación guiada y los avisos ("v0.4 · Avisos e instalación"). Lo que queda:

1. **Logo en vector y su versión en negativo** (insumo de TEINS). Hoy se usa el PNG y, en oscuro, un filtro que lo pinta en blanco.
2. **Plantilla del PDF** (ADR-0013) con los mismos tokens, cuando TEINS responda P22, P23 y P26.

## Supuestos de diseño

Si alguno es falso, cambian tamaños y densidades, no el estilo.

- Los técnicos usan celulares de tamaño común y a veces tabletas.
- Trabajan con la mano desnuda, no con guantes gruesos.
- El tablero lo usa sobre todo oficina en un monitor de escritorio.
- Español de Colombia como único idioma.

## Insumos por pedir a TEINS

| Insumo | Para qué |
|---|---|
| Logo en vector y en negativo | Tema oscuro, sin el filtro que lo pinta en blanco |
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
| Fuentes | Geist, única familia, autoalojada con `@fontsource-variable/geist` |
| Tablas de oficina | `Tabla` de `ui`; TanStack Table + Virtual si una lista llega a miles de filas |
| Formularios | Estado local con validación al enviar y mensaje por campo; esquemas Zod de `protocolo` en el servidor |
| Notificaciones breves | `ProveedorNotificaciones` de `ui` (propio: CSS, sin dependencia) |
| Buscar en todo (oficina) | Propia, `pantallas/Paleta.tsx` sobre `<dialog>` con `useModal` de `ui` (iteración 37), sin cmdk |
| Gráficos del tablero | Gráficos de shadcn (Recharts), con los tokens |
| Movimiento | CSS y View Transitions en todas las superficies (`conTransicion`); sin Motion desde la iteración 27 (regla 10) |
| Fechas y números | API `Intl` con `es-CO` |
| Íconos de instalación PWA | Generador de recursos PWA |
| Accesibilidad | axe-core dentro de Playwright (WCAG 2.2 AA) |
| Regresión visual | Capturas con Playwright |
| Diseño | Lienzo de Claude (https://claude.ai/artifact/A77tYXi713xNbTMacNzM8v) |
