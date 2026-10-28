# ADR-0049 · Despliegue manual por lotes desde GitHub

- **Estado:** Aceptada
- **Fecha:** 2026-10-27
- **Impulsores:** QA-18 (desplegar un cambio con la documentación), QA-19 (costo bajo), R5 (confidencialidad), I-16 (secretos por entorno)
- **Depende de:** ADR-0016 (reemplaza solo su punto 2 de "Integración y despliegue continuos": el despliegue automático en Pruebas), ADR-0018, ADR-0021

## Contexto

ADR-0016 pedía construir la imagen en la integración continua, desplegarla automáticamente en Pruebas y llevarla a Producción con aprobación manual. Hoy se despliega desde un computador con `railway up`, servicio por servicio y en un orden que hay que recordar (campo primero, porque migra en su pre-deploy). Tres hechos lo condicionan:

- **Costo:** cada despliegue en Railway construye la imagen una vez por servicio. Pruebas se despliega por lotes, uno por grupo de mejoras, no uno por cambio; un despliegue automático en cada `push` multiplicaría el gasto.
- **Imágenes privadas:** el plan Hobby de Railway no puede descargar imágenes de un registro privado (solo el plan Pro). El repositorio es privado y R5 prohíbe publicar la imagen, así que "construir una vez, subirla a GHCR y que los servicios la descarguen" no es posible en el espacio de trabajo de Kevin.
- **Aprobación:** en un repositorio privado con GitHub Pro, los entornos de GitHub tienen secretos propios y reglas de rama, pero no revisores obligatorios (solo en repositorios públicos o con GitHub Enterprise).

## Opciones

| Opción | Descripción |
|---|---|
| A. Seguir desde el computador | `railway up` por servicio, a mano, como hoy |
| **B. Flujo manual en GitHub Actions** | `workflow_dispatch` que elige entorno, comprueba que el commit pasó la integración continua y corre `railway up --ci` en el orden de `montar.sh` |
| C. Despliegue automático en Pruebas | Lo que decía ADR-0016: cada `push` a la rama despliega |
| D. Imagen única en GHCR | Construir la imagen una vez, publicarla en un registro privado y que los servicios la descarguen |

## Evaluación

| Criterio (ligado a un impulsor) | A | B | C | D |
|---|---|---|---|---|
| Despliega solo lo que pasó la integración continua (QA-18) | ○ | ● | ● | ● |
| Un despliegue por lote, no por cambio (QA-19) | ● | ● | ○ | ● |
| Posible con el plan Hobby de Railway, sin imágenes públicas (R5) | ● | ● | ● | ○ |
| Otra persona despliega sin conocer el orden ni tener la CLI enlazada (QA-18) | ○ | ● | ● | ● |

## Decisión

**B.** `.github/workflows/desplegar.yml`, lanzado a mano desde la pestaña Actions:

- Se elige la rama en «Use workflow from» y el entorno (`pruebas` o `produccion`). Despliega el último commit de esa rama, y se detiene si ese commit no tiene una corrida exitosa de `integracion.yml`.
- Orden de `infra/railway/montar.sh`: `campo` (migra en su pre-deploy), `oficina`, `portal`, `worker` y `respaldos` (con `infra/respaldos --path-as-root`). Cada `railway up --ci` espera su construcción y detiene el flujo si falla.
- El token es un token de proyecto de Railway guardado como secreto `RAILWAY_TOKEN` del entorno de GitHub del mismo nombre (`pruebas`, `produccion`); nunca en el repositorio (I-16).
- **Producción** se despliega solo desde `master` y escribiendo `produccion` en la confirmación; el entorno `produccion` de GitHub, además, limita sus despliegues a `master`. Esa es la aprobación manual de ADR-0016 mientras no haya revisores obligatorios.
- `railway up` desde el computador sigue siendo el respaldo si GitHub Actions no está disponible.

## Por qué gana a cada alternativa

- **Frente a A:** el orden y la comprobación de la integración continua quedan en el repositorio, no en la memoria de quien despliega.
- **Frente a C:** desplegar en cada cambio cuesta una construcción por servicio cada vez; el lote lo decide una persona.
- **Frente a D:** con el plan Hobby no se puede sin publicar la imagen, y R5 lo impide. Queda diferida hasta que el proyecto pase al espacio de trabajo Pro de TEINS (ADR-0021).

## Consecuencias

- **A favor:** desplegar es elegir rama y entorno; queda registro de quién desplegó qué commit y cuándo.
- **En contra:** cada servicio sigue construyendo la imagen por su cuenta (cinco construcciones por despliegue). Se mitiga con el orden de capas del `Dockerfile` (las dependencias se reutilizan si no cambia el lockfile) y desaparece con D.
- **En contra:** la confirmación de producción no es una aprobación de otra persona. Hoy despliega una sola persona; con GitHub Enterprise o un repositorio de TEINS con revisores, se agrega la regla al entorno sin cambiar el flujo.

## Cuándo revisarla

- El proyecto pasa al espacio de trabajo Pro de TEINS (ADR-0021): construir una vez, imagen privada en GHCR y los servicios la descargan (opción D).
- El repositorio pasa a una cuenta con revisores obligatorios en entornos privados: se agregan al entorno `produccion`.
- Pruebas deja de pagarse por construcción o hay más de una persona integrando a diario: reconsiderar C para Pruebas.
