# DESIGN.md · Marquilla

Dirección visual de TEINS. Todo trabajo de interfaz parte de este archivo y pasa después por el filtro antislop (ver `AGENTS.md`). Los valores de código viven en [`paquetes/ui/tokens.css`](paquetes/ui/tokens.css); este archivo explica qué son y por qué.

Lienzo de referencia: https://claude.ai/artifact/A77tYXi713xNbTMacNzM8v (privado).

## Lectura del diseño

Herramienta de trabajo para técnicos de Transporte de Datos y Transporte de Energía y su oficina, con lenguaje de señalización industrial.

**Niveles:** ENERGÍA 2 · RITMO 2 · MOVIMIENTO 2.

## Identidad

**Motivo: la marquilla.** Es la etiqueta que identifica cables y equipos en un cuarto técnico. En la interfaz es la forma de cada código, unidad y estado: un rectángulo con el extremo derecho en punta.

```css
clip-path: polygon(0 0, calc(100% - 7px) 0, 100% 50%, calc(100% - 7px) 100%, 0 100%);
```

La punta escala con el tamaño: 6 px en etiquetas de 24 px de alto, 8 px en 30 px, 12 px en 44 px, 18 px en 64 px. La marquilla **solo** se usa para identificar (códigos, unidades, estados, tipo de servicio), nunca como decoración ni como botón.

**Prueba de identidad:** si se cambian el logo y el nombre, la interfaz debe seguir siendo reconocible por la marquilla, la superficie azul y el acento amarillo.

## Color

Paleta tomada del logo de TEINS, más un acento de acción.

| Token | Valor | Uso | Proporción |
|---|---|---|---|
| Superficie de marca | `#002B81` | Franjas superiores, barra lateral, controles seleccionados, bordes de campos activos | 60 |
| Blanco | `#FFFFFF` | Fondo de campo y paneles | 30 |
| Acento señal | `#FFC21A` | **Solo** acción principal, foco y el dato focal de cada pantalla | 10 |
| Texto | `#15171A` | Texto principal sobre claro | |
| Texto secundario | `#525152` | Gris del logo | |
| Cemento | `#F3F1EC` | Fondo de oficina | |
| División | `#DEDBD3` | Líneas y bordes pasivos | |

Tonos derivados de la superficie (mezcla con blanco): elevada 12 % `#1F4490`, pista 24 % `#3D5E9F`, texto tenue 70 % `#B2BFD9`, texto suave 85 % `#D9DFEC`.

**Contrastes verificados:**

| Combinación | Contraste |
|---|---|
| Blanco sobre superficie | 12,6:1 |
| Acento sobre superficie | 7,8:1 |
| Texto sobre acento | 11,1:1 |
| Texto secundario sobre blanco | 7,9:1 |
| Texto secundario sobre cemento | 7,0:1 |

| Etiquetas de estado (texto sobre su fondo) | 6,4 a 7,7:1 |
| Texto tenue sobre superficie | 6,8:1 |

Mínimo en campo: **7:1** para texto corrido; las etiquetas de estado, que siempre son palabras cortas en negrita, aceptan 6:1. En oficina: 4,5:1 (WCAG AA).

**Estados del documento** (iguales para toda organización, ADR-0020):

| Estado | Fondo | Texto |
|---|---|---|
| Borrador | superficie pista | blanco |
| Enviado | `#E3ECFA` | `#1C4E9E` |
| En revisión | `#EEE6F7` | `#5B2E91` |
| Revisado | `#DDF1EB` | `#0B5E50` |
| Publicado | superficie de marca | blanco |
| Anulado | `#F8E0E4` | `#8E1D33` |

Cada estado lleva siempre su **texto**; el color nunca es la única señal.

## Tipografía

| Familia | Uso | Razón |
|---|---|---|
| Barlow Condensed (600 a 800) | Títulos, horas, cifras grandes | Heredada de la señalización vial: se lee de lejos y cabe en poco ancho |
| Atkinson Hyperlegible Next (400 a 700) | Todo el texto de uso | Diseñada para máxima legibilidad, necesaria bajo el sol |
| Atkinson Hyperlegible Mono (400 a 600) | Códigos, unidades, marquillas | Distingue 0/O y 1/I/l |

Las tres se **alojan localmente** (subconjunto latino, fuentes variables) para funcionar sin conexión. Cifras siempre con `font-variant-numeric: tabular-nums`.

**Escala en campo:** texto 17 · etiqueta 17 negrita · ayuda 15 · título de pantalla 44 · cifra focal 76.
**Escala en oficina:** texto 14 · tabla 14 · título 44 · cifra focal 104.

## Forma y espacio

- Base de 4 px.
- Radio 6 px en controles, 8 px en paneles. Nada con forma de píldora salvo el interruptor.
- **Sin sombras** salvo en capas superpuestas (menús, diálogos). **Sin degradados. Sin fondos de cuadrícula.**
- Bordes: 2 px en controles activos de campo; 1,5 px en controles pasivos; 1 px en divisiones.
- Zonas táctiles: mínimo 44 px, **58 px en campo**.

## Jerarquía: un punto focal por pantalla

| Pantalla | Punto focal |
|---|---|
| Campo · Mis visitas | La siguiente visita, en la franja azul, con hora grande y la acción "Continuar levantamiento" |
| Campo · Captura | El nombre del área y el campo activo con halo amarillo |
| Oficina · Tablero | El panel "Esperando revisión" con el levantamiento que más lleva esperando y "Tomar para revisar" |

Todo lo demás en la pantalla es visiblemente secundario.

## Movimiento

Cada animación tiene un propósito escrito. En `campo` **todo el movimiento es CSS** (cero JavaScript de animación); Motion solo se usa en `oficina`.

| Momento | Movimiento | Propósito | Dónde |
|---|---|---|---|
| Enviando | Giro del icono de sincronización | Mostrar que hay trabajo en curso | Campo |
| Recibido | El giro se convierte en un trazo de verificación | Confirmar sin texto extra | Campo |
| Cargando lista | Esqueleto con la forma real, luego cruce al contenido | Evitar saltos de diseño | Todas |
| Error de validación | Sacudida corta del campo | Señalar dónde está el error | Todas |
| Cambio de pestaña | Indicador que se desliza | Mostrar de dónde a dónde | Todas |
| Conteos | Cifras que giran al cambiar | Hacer notar un cambio de estado | Oficina |

**Duraciones:** 120 ms (pulsación), 200 ms (paneles), 280 ms (pantalla). **Curva:** `cubic-bezier(0.2, 0, 0, 1)`. Con `prefers-reduced-motion`, todo se desactiva.

Fuente principal de patrones: transitions.dev (versiones CSS). beUI solo en `oficina`. Rare UI no aplica a una herramienta de trabajo.

## Iconos

Una sola familia: **Lucide**, trazo 1,8 a 2. Iconos del dominio (UPS, fibra, tablero) dibujados con la misma retícula. Nunca emojis.

## Textos

- Español de Colombia, con el vocabulario de TEINS: *levantamiento*, *visita*, *Transporte de Datos*, *Transporte de Energía*, *Energía Solar*.
- **Sin raya larga (—)** en textos de interfaz.
- Acciones específicas: "Continuar levantamiento", "Enviar a oficina", "Tomar para revisar". Nunca "Empezar" o "Ver más".
- Nada inventado: cifras, nombres y logos faltantes se muestran como marcadores explícitos (`[N]`, `[LOGO]`).

## Estados obligatorios

Toda vista con datos diseña **vacío, cargando, error y sin conexión**. En campo, además: **pendiente de enviar** y **enviando**.

## Logo

- A color (`#002B81`, `#1773B0`, `#76AADB`, gris `#525152`) sobre fondos claros.
- En blanco sobre la superficie de marca. **Pendiente:** obtener de TEINS la versión en blanco en vector.
