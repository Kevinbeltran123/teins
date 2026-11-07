# Documentación

Mapa de lo que hay en `docs/` y en la raíz (lo marcado «local» está en `.gitignore`: existe en la máquina de quien trabaja, no en un clon nuevo): qué responde cada documento y cuándo se actualiza. Cada dato vive en un solo lugar; los demás lo enlazan. Así una corrección se hace una vez.

## Por dónde empezar

| Quiero saber | Leo |
|---|---|
| Dónde va el proyecto y qué sigue | `proceso/plan-de-entrega.md` (local) |
| Qué problema resuelve y para quién | [`producto/contexto.md`](producto/contexto.md) |
| Cómo funciona hoy | [`arquitectura/03-como-funciona.md`](arquitectura/03-como-funciona.md) |
| Por qué se decidió algo | [`adr/README.md`](adr/README.md) y el ADR del área |
| Cómo se hizo una iteración y qué quedó fuera | `proceso/historia/` (local) |
| Cómo correr y verificar el código | [`AGENTS.md`](../AGENTS.md), sección "Comandos", y el README de cada paquete |

## Qué hay y cuándo se actualiza

| Documento | Responde | Se actualiza cuando |
|---|---|---|
| `proceso/plan-de-entrega.md` (local) | Estado actual, próximo paso y mapa de cortes. **Única fuente del estado** | Se cierra o se despliega una iteración, o cambia lo pendiente |
| `proceso/historia/` (local) | Alcance, "Terminado cuando", decisiones y lo que quedó fuera de cada corte o iteración | Se construye esa iteración. Después solo se agrega, no se reescribe |
| [`producto/contexto.md`](producto/contexto.md) | El cliente, su proceso y el problema | TEINS cambia algo de su proceso |
| `producto/preguntas-pendientes.md` (local) | Lo que falta que responda TEINS | Llega una respuesta o surge una pregunta |
| `producto/analisis-inicial.md` (local) | Análisis de la primera reunión | No cambia: es el punto de partida |
| [`arquitectura/01-impulsores.md`](arquitectura/01-impulsores.md) | Restricciones (R-n) y escenarios de calidad (QA-n) | Cambia una restricción o un escenario; con un ADR si cambia una decisión |
| [`arquitectura/02-modelo-dominio.md`](arquitectura/02-modelo-dominio.md) | Lenguaje común, agregados, reglas del negocio | Aparece un término o una regla nueva |
| [`arquitectura/03-como-funciona.md`](arquitectura/03-como-funciona.md) | Estados y flujos de hoy, en diagramas ligados al código | Cambia un estado, una transición o un flujo, **en el mismo commit** |
| [`adr/`](adr/README.md) | Cada decisión de arquitectura y su porqué | Se toma una decisión. Un ADR aceptado no se edita: se reemplaza con uno nuevo |
| [`../DESIGN.md`](../DESIGN.md) | Dirección visual, componentes, movimiento y "La regla" | Cambia la dirección o una pieza compartida |
| `videos/` (local) | Videos técnicos que explican cómo funciona el sistema, generados desde el código y los ADR | Cambia el código que un video muestra (la generación falla hasta actualizar la escena) o se agrega un video |
| `diseno/pendientes.md` (local) | Pantallas por diseñar, supuestos e insumos que faltan | Se diseña una pantalla o llega un insumo |
| `diseno/referencias.md` (local) | Qué se tomó de cada referencia | Se adopta una referencia nueva |
| `proceso/forma-de-trabajo.md` (local) | Cómo se construye: cortes verticales, contrato primero | Cambia la forma de trabajar |
| `proceso/herramientas-de-agentes.md` (local) | Qué skills, plugins y MCP usar, y cuándo | Se agrega o se quita una herramienta |
| [`proceso/entorno-de-pruebas.md`](proceso/entorno-de-pruebas.md) | El entorno de pruebas en Railway, cómo desplegar en él y el ensayo de carga con su línea de base | Cambia un servicio, una variable o el despliegue, o el ensayo da cifras nuevas |
| [`proceso/produccion.md`](proceso/produccion.md) | Montaje, respaldos, simulacro y cómo encender o apagar producción | Cambia la infraestructura o su estado |
| [`proceso/verificacion-manual.md`](proceso/verificacion-manual.md) | El recorrido a mano en un teléfono real | Una iteración agrega algo que solo se comprueba a mano |
| [`entrega/`](entrega/README.md) | Alcance de la versión 1, lo que falta de TEINS y el piloto con sus criterios de aceptación | Cambia el alcance, llega una respuesta de TEINS o avanza el piloto |
| [`manual/`](manual/) | Manuales para técnicos y oficina, en lenguaje no técnico, con capturas en `manual/capturas` | Cambia lo que ve o hace un usuario: un botón, un texto o un paso. Las capturas se regeneran con `pnpm --filter @teins/e2e capturas` |
| [`../AGENTS.md`](../AGENTS.md) | Reglas, convenciones y comandos para quien programa | Cambia una regla, la estructura o un comando |
| [`../README.md`](../README.md) | Qué es y qué hace el sistema, en grande | Cambia lo que el sistema hace en grande |
| `paquetes/*/README.md` | Qué contiene cada paquete y cómo se usa | Cambia el paquete |

## Al cerrar una iteración

Esta es la lista completa; `AGENTS.md` ("Al cerrar un corte") y el plan de entrega ("Cómo se mantiene") remiten a ella.

1. Su archivo en `proceso/historia/` (`NN-slug.md`): alcance, lo que quedó fuera, "Terminado cuando" con evidencia y "Decisiones tomadas al construirlo"; y su fila en `proceso/historia/README.md`.
2. `proceso/plan-de-entrega.md`: su fila del mapa, "Estado actual" y "Próximo paso". El próximo paso anterior pasa al archivo de historia, bajo "Al cerrarla".
3. `arquitectura/03-como-funciona.md` si cambió un estado, una transición o un flujo.
4. El README de cada paquete tocado y, si cambió un comando, "Comandos" de `AGENTS.md`.
5. `../README.md` solo si cambió lo que el sistema hace en grande; `proceso/verificacion-manual.md` si hay algo que solo se comprueba a mano. `manual/` si cambió lo que ve o hace un usuario.
6. Un ADR nuevo si una decisión cambia otra ya aceptada.

## Estilo

Español de Colombia, con el vocabulario de TEINS. Frases cortas, sin raya larga (—) ni relleno. Nunca datos reales de TEINS o sus clientes (R5).
