# ADR-0010 · TypeScript de extremo a extremo, en un monorepo con paquetes de dominio compartidos

- **Estado:** Aceptada
- **Fecha:** 2026-09-23
- **Impulsores:** QA-2, QA-11, QA-18, QA-19, QA-20, QA-21, R1, R2, R6
- **Depende de:** ADR-0001, ADR-0003, ADR-0006

## Contexto

El cliente es una PWA, así que en el navegador se usa TypeScript sí o sí. La pregunta es qué lenguaje usa el servidor.

Tres decisiones anteriores crean una presión concreta:

- **ADR-0006:** la misma definición de formato debe validar respuestas en el dispositivo y en el servidor. Si ambos validan distinto, un técnico puede enviar sin conexión un levantamiento que el servidor rechaza cuando ya está bloqueado para edición.
- **ADR-0003:** el protocolo de sincronización (comandos, respuestas, versiones) existe en ambos extremos.
- **ADR-0001:** el monolito modular necesita fronteras verificadas y un mecanismo confiable de eventos.

El desarrollador conoce React con TypeScript en el frontend y Spring Boot con Java en el backend. TEINS mantendrá el sistema (R6); todavía no se sabe con qué perfil técnico.

## Opciones

| Opción | Descripción |
|---|---|
| **A. TypeScript en Node.js** | Un lenguaje en todo el sistema; paquetes de dominio y protocolo compartidos |
| B. Java con Spring Boot y Spring Modulith | El stack que el desarrollador ya usa en backend, con soporte específico para monolitos modulares |
| C. C# con ASP.NET Core | Plataforma madura y tipada |
| D. Python con Django o FastAPI | Productivo, con administración incluida (Django) |
| E. Go | Binario liviano y rápido |
| F. Elixir con Phoenix | Concurrencia y sincronización en tiempo real |

## Evaluación

| Criterio | A | B | C | D | E | F |
|---|---|---|---|---|---|---|
| Una sola implementación de validación y protocolo en cliente y servidor (QA-11, QA-21) | ● | ◐ | ◐ | ◐ | ◐ | ◐ |
| Un solo lenguaje para una persona y para quien mantenga (R1, R6) | ● | ◐ | ◐ | ◐ | ◐ | ◐ |
| Soporte de fábrica para monolito modular: verificación de fronteras, eventos persistidos | ◐ | ● | ◐ | ◐ | ○ | ◐ |
| Experiencia previa del desarrollador (R2) | ● | ● | ○ | ◐ | ○ | ○ |
| Consumo de memoria en instancias baratas (QA-19) | ● | ◐ | ◐ | ● | ● | ● |
| Personas disponibles para mantenerlo en Colombia (R6) | ● | ● | ◐ | ◐ | ◐ | ○ |
| Ecosistema para PDF, imágenes y autenticación | ● | ● | ● | ● | ◐ | ◐ |

## Decisión

**A. TypeScript en Node.js**, organizado como monorepo.

### Estructura

```
paquetes/
  dominio/     TypeScript puro: reglas del levantamiento, meta-esquema de formatos,
               validadores. Sin dependencias de framework, red ni base de datos.
  protocolo/   Esquemas de comandos y respuestas de sincronización, con su versión.
  servidor/    API y worker (roles web y worker, ADR-0001), módulos y adaptadores.
  campo/       PWA de campo.
  oficina/     Aplicación de oficina.
  portal/      Portal del cliente.
  ui/          Componentes visuales compartidos.
```

**Reglas de dependencia,** verificadas automáticamente (ADR-0018):

- `dominio` no depende de nada.
- `protocolo` solo depende de `dominio`.
- `portal` nunca importa `oficina` ni `campo`.
- Dentro de `servidor`, cada módulo solo expone su interfaz pública.

### Herramientas

| Necesidad | Elección | Alternativa considerada | Razón |
|---|---|---|---|
| Framework HTTP | **Fastify** | NestJS | Liviano, con encapsulamiento por plugins que calza con los módulos y validación por esquema. NestJS aporta convenciones e inyección de dependencias, familiares para quien viene de Spring, pero es más pesado y sus módulos tampoco imponen fronteras. Como el núcleo es hexagonal, el framework es solo un adaptador y se puede cambiar. |
| Validación y tipos compartidos | **Zod** | JSON Schema con Ajv | Un esquema da tipos y validación a la vez, y corre igual en navegador y servidor. |
| Acceso a datos | **Drizzle** | Kysely | Esquema en código con migraciones generadas, soporte de esquemas de Postgres y SQL directo cuando hace falta (bloqueos consultivos, `SKIP LOCKED`, `SET LOCAL`, JSONB). Kysely es igual de cercano a SQL, pero sin migraciones generadas. |
| Monorepo | **pnpm workspaces** | Turborepo, Nx | Suficiente para seis paquetes; se agrega orquestación solo si los tiempos de compilación lo piden. |
| Entorno de ejecución | Node.js, versión LTS vigente | Bun, Deno | Máxima compatibilidad y conocimiento disponible para quien lo mantenga. |

## Por qué gana a cada alternativa

- **Frente a B (la alternativa más fuerte):** Spring Modulith trae de fábrica exactamente lo que ADR-0001 y ADR-0012 piden: verificación de la estructura de módulos y un registro de publicación de eventos que se escribe en la misma transacción del negocio y garantiza la entrega aunque la aplicación caiga. Además, el desarrollador ya conoce Spring. Pero:
  1. **Dos implementaciones del validador.** El núcleo del riesgo del proyecto está en que cliente y servidor validen igual. Con Java, el meta-esquema y el validador existirían en dos lenguajes; la divergencia se mitiga con un conjunto de casos de prueba compartidos que ambos deben pasar, pero es trabajo doble y un punto de falla permanente.
  2. **Dos lenguajes para quien mantenga.** TEINS mantendrá el sistema; exigir TypeScript y Java duplica el perfil necesario.
  3. **Memoria.** La JVM consume más en instancias pequeñas, y TEINS paga la infraestructura.
  4. **Lo que se pierde se recupera con poco:** la verificación de fronteras se replica con reglas de dependencias (ADR-0018) y el registro de eventos con la cola transaccional de ADR-0012. **Se adoptan las ideas de Spring Modulith sin su plataforma.**
- **Frente a C:** comparte la desventaja de dos lenguajes y el desarrollador no lo conoce.
- **Frente a D:** Django trae administración lista, pero repite el problema de dos lenguajes y dos validadores.
- **Frente a E:** binario muy eficiente, pero sin ventaja para esta carga, con dos lenguajes y sin experiencia previa.
- **Frente a F:** su fortaleza (tiempo real masivo) no es un impulsor de TEINS, y el mercado para mantenerlo en Colombia es muy reducido.

## Consecuencias

- **A favor:** una sola implementación de las reglas más riesgosas del sistema; un lenguaje para una persona y para quien herede el código; tipos que cruzan del servidor a la PWA sin generación intermedia; menor consumo de memoria.
- **En contra:** las fronteras y el registro de eventos que Spring Modulith daría de fábrica hay que imponerlos con herramientas y convenciones propias (ADR-0012, ADR-0018); menos estructura por defecto que en un framework con convenciones fuertes, lo que se compensa documentando la estructura.

## Cuándo revisarla

Si TEINS llega a contratar el mantenimiento con un equipo especializado en Java, B pasa a ser la mejor opción: el costo de dos validadores se paga una vez, y el de un lenguaje ajeno al equipo se paga siempre. A la fecha, el cliente indicó que quién mantenga el sistema no condiciona la decisión.
