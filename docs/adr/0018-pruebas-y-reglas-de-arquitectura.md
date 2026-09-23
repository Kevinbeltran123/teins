# ADR-0018 · Pruebas guiadas por riesgo y reglas de arquitectura ejecutables

- **Estado:** Aceptada
- **Fecha:** 2026-09-23
- **Impulsores:** QA-1, QA-2, QA-3, QA-4, QA-11, QA-18, QA-20, QA-21, QA-22, QA-25, I-27, I-28, I-30
- **Depende de:** todas las anteriores

## Contexto

Con una persona y dos meses no se puede probar todo con el mismo rigor. La pregunta no es "¿cuánta cobertura?" sino **"¿dónde un error haría más daño y sería más difícil de detectar?"**. Las respuestas están en los impulsores (A, A): pérdida de datos en la sincronización, formatos mal validados, clientes desactualizados, fuga de datos entre clientes.

Además, varias decisiones de arquitectura solo sobreviven si se verifican automáticamente: fronteras entre módulos, autorización en todas las rutas, presupuesto de rendimiento, licencias de dependencias.

## Opciones de estrategia

| Opción | Descripción |
|---|---|
| A. Meta de cobertura global (por ejemplo, 80 %) | Un porcentaje para todo el código |
| B. Pirámide clásica uniforme | Muchas pruebas unitarias, menos de integración, pocas de extremo a extremo, en todos los módulos por igual |
| C. Extremo a extremo primero | Probar sobre todo desde la interfaz |
| **D. Guiada por riesgo, con reglas de arquitectura ejecutables** | Intensidad proporcional al daño posible; invariantes probadas con generación de casos; reglas de diseño como pruebas |

**Decisión: D.**

- **Frente a A:** un porcentaje premia probar código fácil; la sincronización puede quedar mal probada con 90 % de cobertura global.
- **Frente a B:** aplicar la misma intensidad a un listado de clientes que a la idempotencia desperdicia el tiempo escaso.
- **Frente a C:** lento y frágil, y no puede inducir fallas de red a mitad de una carga con precisión.

## Decisión

### Nivel 1 · Dominio (paquete `dominio`)

| Qué | Técnica | Por qué |
|---|---|---|
| Máquina de estados del levantamiento e informe | **Pruebas basadas en propiedades** (fast-check): generar miles de secuencias de acciones aleatorias y verificar que las invariantes se cumplen siempre | Las invariantes (un editor por estado, versiones inmutables) deben valer para cualquier secuencia, no solo para los casos que alguien imaginó |
| Validador de formatos | **Casos de conformidad** compartidos: definición + respuestas + resultado esperado, en archivos JSON | Especifican el comportamiento de forma independiente del código; si algún día hay otro validador (ADR-0010), debe pasar los mismos casos |
| Reglas de negocio 1 a 19 | Pruebas unitarias | Rápidas y exhaustivas |

### Nivel 2 · Integración con PostgreSQL real

Con Postgres real en contenedores (Testcontainers), nunca con simuladores de base de datos, porque lo que se prueba es comportamiento de la base:

| Escenario | Qué se verifica |
|---|---|
| Dos envíos simultáneos del mismo levantamiento | Se procesa uno solo; ambos reciben el mismo resultado (ADR-0005) |
| Dos revisores guardan a la vez | El segundo recibe conflicto; nada se pierde (QA-25) |
| Transacciones que confirman fuera de orden | La bajada nunca se salta un cambio (punto de control seguro, ADR-0005) |
| El rol del portal consulta datos de otro cliente o no publicados | La base no devuelve nada (QA-4, ADR-0009) |
| Alteración manual de un registro de auditoría | La verificación de la cadena la detecta (ADR-0008) |
| Encolado dentro de una transacción revertida | El trabajo no existe (ADR-0012) |

### Nivel 3 · Sincronización con fallas inducidas

Un **arnés determinista** entre el cliente de sincronización y el servidor inyecta fallas:

- Corte de red a mitad de la carga de un archivo o de un comando.
- Respuesta perdida después de que el servidor confirmó (el cliente reintenta algo ya procesado).
- Entrega duplicada y en desorden.
- Cierre de la app entre guardar localmente y encolar.

**Invariante verificada en cada caso:** todo levantamiento enviado llega exactamente una vez y completo; nada se pierde; nada se duplica. Con pruebas basadas en propiedades, el arnés combina fallas al azar durante miles de ejecuciones.

### Nivel 4 · Compatibilidad entre versiones (QA-21, QA-22)

- **Migraciones locales:** cada migración de Dexie se prueba sobre una base de la versión anterior **con borradores y pendientes**, y se verifica que todos sobreviven.
- **Protocolo N-1:** la suite de sincronización de la versión anterior del cliente se ejecuta contra el servidor nuevo en cada cambio.

### Nivel 5 · Extremo a extremo

- Playwright en **Chromium y WebKit** (el motor de Safari) sobre los flujos críticos: capturar sin conexión, enviar, revisar, publicar, descargar desde el portal.
- **WebKit de escritorio no es Safari de iPhone:** cada versión candidata pasa una **lista de verificación manual en un iPhone y un Android reales**, incluida la prueba de durabilidad de ADR-0002.

### Reglas de arquitectura ejecutables

Fallan la integración continua si se violan:

| Regla | Herramienta o técnica | Protege |
|---|---|---|
| Dependencias entre paquetes y módulos (ADR-0001, ADR-0010) | dependency-cruiser | Fronteras del monolito modular |
| Toda ruta declara su política de autorización (ADR-0009) | Prueba que recorre el registro de rutas | Denegar por defecto |
| Presupuesto de JavaScript inicial de `campo` (ADR-0011) | Medición del paquete compilado | QA-16 |
| Licencias de dependencias sin AGPL ni restricciones comerciales (I-30) | Verificador de licencias | R7 |
| El rol *web* no escribe en disco local (ADR-0001) | Regla de análisis estático | Escalado horizontal |
| Secretos fuera del repositorio | Escáner de secretos | I-16 |
| Dependencias sin vulnerabilidades conocidas graves | Auditoría de dependencias | Seguridad |

### Orden en la integración continua

1. Tipos, formato y análisis estático (segundos).
2. Reglas de arquitectura y licencias.
3. Dominio y casos de conformidad.
4. Integración con Postgres y arnés de sincronización.
5. Compatibilidad entre versiones.
6. Extremo a extremo.
7. Presupuesto de rendimiento sobre la compilación final.

Lo barato falla primero, así que los errores simples no esperan a las pruebas lentas.

## Consecuencias

- **A favor:** el esfuerzo de pruebas se concentra donde está el riesgo real; las decisiones de arquitectura quedan protegidas por la integración continua y no por la memoria; quien herede el código recibe las reglas junto con el código (QA-18).
- **En contra:** el arnés de fallas y las pruebas basadas en propiedades requieren inversión inicial; los módulos de soporte tienen menos pruebas, de forma deliberada.

## Cuándo revisarla

Aparecen errores en producción en módulos de soporte (subir su intensidad); el tiempo de integración continua supera lo tolerable (paralelizar o separar suites).
