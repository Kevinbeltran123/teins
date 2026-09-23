# ADR-0001 · Monolito modular con dos roles de ejecución

- **Estado:** Aceptada
- **Fecha:** 2026-09-23
- **Impulsores:** QA-9, QA-10, QA-12, QA-14, QA-18, QA-19, R1, R2, R6
- **Depende de:** —

## Contexto

Hay que decidir cómo se organiza y despliega el servidor. Publicar un informe es una operación que debe ser atómica (copia congelada, evento y registro de cambios). Lo construye una persona en dos meses y lo mantendrá TEINS.

## Opciones

| Opción | Descripción |
|---|---|
| A. Monolito por capas | Un código organizado en controladores, servicios y repositorios globales |
| B. Monolito modular | Un despliegue dividido en módulos con fronteras explícitas, que se comunican por interfaces públicas y eventos |
| C. Microservicios | Un servicio por módulo, con base de datos y despliegue propios |
| D. Funciones *serverless* | Cada operación es una función ejecutada bajo demanda |
| E. Backend como servicio | La lógica vive en reglas de base de datos, funciones pequeñas o el cliente |

## Evaluación

| Criterio | A | B | C | D | E |
|---|---|---|---|---|---|
| Velocidad para una persona en dos meses (R1, R2) | ● | ● | ○ | ◐ | ● |
| Operación atómica al publicar (QA-9) | ● | ● | ○ | ◐ | ◐ |
| Fronteras que se mantienen con el tiempo (QA-12) | ○ | ● | ● | ◐ | ○ |
| Mantenible por un tercero (QA-18) | ◐ | ● | ○ | ◐ | ○ |
| Lógica de negocio protegida y probable (QA-20) | ● | ● | ● | ● | ○ |
| Trabajos largos: PDF, imágenes (QA-17) | ● | ● | ● | ○ | ◐ |
| Costo de operación (QA-19) | ● | ● | ○ | ● | ● |
| Portabilidad entre proveedores (R6) | ● | ● | ◐ | ○ | ○ |

## Decisión

**B. Monolito modular**, con rigor proporcional al tipo de módulo (ver `02-modelo-dominio.md`):

- Núcleo (Levantamientos, Formatos): arquitectura hexagonal; el dominio no conoce base de datos, framework ni red.
- Soporte (Visitas, Clientes, Informes, Portal): capas simples.
- Genéricos (Identidad, Archivos): adaptadores delgados sobre servicios existentes.

Reglas:

1. Cada módulo es dueño de sus tablas, en un esquema propio de la base de datos. Ningún módulo lee tablas de otro; usa su interfaz pública.
2. La comunicación que no necesita respuesta inmediata va por eventos de dominio; los que deben sobrevivir fallas pasan por el outbox (ADR-0012).
3. Las fronteras se verifican con pruebas automáticas (ADR-0018).
4. **Un código, dos roles de ejecución:** proceso *web* (solicitudes) y proceso *worker* (PDF, imágenes, trabajos). Mismo despliegue, distinto punto de entrada.
5. **Para poder escalar después:** proceso web sin estado (sesiones fuera de memoria), ningún archivo en disco local, trabajos en cola persistente.

## Por qué gana a cada alternativa

- **Frente a A:** misma velocidad inicial, pero sin fronteras nada impide que Informes lea tablas de Levantamientos; con el tiempo todo depende de todo. La disciplina de B la verifican pruebas, no la memoria.
- **Frente a C:** resuelve problemas que TEINS no tiene (equipos independientes, escalado por partes) y crea uno que sí importa: publicar dejaría de ser una transacción y pasaría a ser una transacción distribuida con compensaciones.
- **Frente a D:** la generación de PDF choca con los límites de tiempo de las funciones; el outbox y los trabajos quedan forzados; el código se ata a un proveedor (R6).
- **Frente a E:** obliga a expresar la máquina de estados, las reglas, la trazabilidad y la idempotencia en reglas de base de datos o en el cliente. Sus piezas buenas (base de datos, autenticación y almacenamiento gestionados) se pueden usar como infraestructura debajo de B (ADR-0016).

## Estimación de capacidad

Escenario diez veces mayor al actual: 50 personas en oficina y 100 técnicos.

| Recurso | Estimación | Lectura |
|---|---|---|
| Solicitudes de oficina | ≈ 10 por segundo en el peor momento | Un servidor modesto atiende cientos |
| Sincronización | < 2 por segundo | Despreciable |
| Datos estructurados | < 1 GB por año | Trivial para una base relacional |
| Fotos | ≈ 175 GB por año | No pasan por el servidor (ADR-0007) |
| PDF | Decenas al día, 10 a 30 s de CPU cada uno | Aislado en el rol *worker* |

Palancas de escalado, de la más barata a la más cara: servidor más grande → más *workers* → varias instancias *web* con balanceador → réplica de lectura para reportes → extraer un módulo. Ninguna requiere reescribir.

## Consecuencias

- **A favor:** una transacción para operaciones críticas; un despliegue; depuración simple; fronteras listas para extraer un módulo si hiciera falta.
- **En contra:** exige disciplina en las fronteras (mitigada con pruebas automáticas); todo escala junto (aceptable según la estimación).

## Cuándo revisarla

Un módulo necesita escalar o estar disponible de forma radicalmente distinta al resto, o más de un equipo empieza a trabajar en el código.
