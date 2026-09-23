# ADR-0011 · React con Vite, estado según la superficie y presupuesto de rendimiento verificado

- **Estado:** Aceptada
- **Fecha:** 2026-09-23
- **Impulsores:** QA-15, QA-16, QA-18, R2, R4, R6
- **Depende de:** ADR-0002, ADR-0004, ADR-0010

## Contexto

Tres superficies con necesidades distintas (ADR-0002). `campo` corre en celulares de gama media, sin conexión, con la base local como fuente de datos. `oficina` es una aplicación de trabajo intensivo en escritorio. `portal` es mínima y pública.

## Opciones

| Opción | Descripción |
|---|---|
| **A. React** | La biblioteca más extendida; experiencia previa del desarrollador |
| B. Vue | Progresiva, con buena ergonomía |
| C. Svelte | Compila a código mínimo; paquetes pequeños |
| D. Angular | Framework completo con convenciones fuertes |
| E. SolidJS | Reactividad fina, muy rápido |
| F. Preact | API de React en un paquete mucho menor |

## Evaluación

| Criterio | A | B | C | D | E | F |
|---|---|---|---|---|---|---|
| Rendimiento y peso en celular de gama media (QA-16) | ◐ | ● | ● | ○ | ● | ● |
| Experiencia previa (R2) | ● | ○ | ○ | ○ | ○ | ◐ |
| Personas disponibles para mantenerlo (R6) | ● | ● | ◐ | ● | ○ | ◐ |
| Ecosistema: componentes accesibles, dibujo, integración con Dexie | ● | ● | ◐ | ◐ | ◐ | ◐ |
| Compatibilidad con el resto del stack elegido | ● | ● | ● | ◐ | ● | ◐ |

## Decisión

**A. React con Vite y TypeScript**, con decisiones distintas por superficie:

| Aspecto | `campo` | `oficina` | `portal` |
|---|---|---|---|
| Fuente del estado | **Base local** (Dexie) con consultas en vivo: la interfaz se actualiza sola cuando cambia IndexedDB | Estado del servidor con TanStack Query | TanStack Query, mínimo |
| Service worker | Sí (vite-plugin-pwa con Workbox, actualización controlada en ADR-0015) | No | No |
| Estilos | Tailwind + componentes accesibles sin estilo, compartidos en `ui` | Igual | Igual |
| Enrutamiento | TanStack Router, con rutas tipadas | Igual | Igual |

**En `campo` no hay una capa de estado global aparte.** La base local ya es la fuente de verdad (ADR-0004): duplicarla en memoria abriría la puerta a que ambas diverjan.

### Presupuesto de rendimiento verificado

`campo` tiene un límite de JavaScript inicial comprimido, fijado en la primera semana a partir de la medición del prototipo en un celular de gama media. **La compilación falla en integración continua si se supera.** Esto convierte QA-16 en una regla automática en lugar de una intención.

### Criterios de uso en campo

Botones grandes para uso con una mano, alto contraste para luz solar, entrada con dedo y con lápiz mediante Pointer Events (bocetos, ADR-0019), selección de unidades en lugar de texto libre (QA-15) y estado de sincronización siempre visible.

## Por qué gana a cada alternativa

- **Frente a C y E:** producen paquetes más pequeños y más rápidos, y esa es su ventaja real para `campo`. Pero exigen aprender un framework nuevo dentro de los dos meses y reducen el grupo de personas que puede mantenerlo. El presupuesto de rendimiento es alcanzable con React dividiendo el código por rutas; si no lo fuera, se revisa esta decisión.
- **Frente a B:** calidad comparable, sin ventaja de experiencia.
- **Frente a D:** el más pesado para `campo` y ajeno a la experiencia del desarrollador.
- **Frente a F:** es el plan B si el presupuesto no se cumple: la capa de compatibilidad permite cambiar `campo` a Preact con cambios acotados.

## Consecuencias

- **A favor:** velocidad desde el primer día; mayor grupo de personas para mantenerlo; `campo` sin estado duplicado; rendimiento vigilado por la integración continua.
- **En contra:** React es más pesado que Svelte o Solid; se compensa con el presupuesto, la división del código y Preact como salida.

## Cuándo revisarla

El presupuesto de rendimiento no se cumple en el celular de referencia, o la medición en campo muestra tiempos de respuesta mayores a QA-16.
