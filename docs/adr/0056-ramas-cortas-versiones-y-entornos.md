# ADR-0056 · Ramas cortas, versiones etiquetadas y producción solo desde una versión

- **Estado:** Aceptada
- **Fecha:** 2026-11-06
- **Impulsores:** QA-18 (desplegar un cambio con la documentación), QA-19 (costo bajo), R5, I-30 (licencias)
- **Depende de:** ADR-0018, ADR-0049 (reemplaza su regla «`corte-0` va a pruebas y `master` a producción»)

## Contexto

El producto se vende a TEINS, y el repositorio pasa a ser suyo cuando paguen. Hasta hoy:

- Se trabajaba en una rama larga, `corte-0`, y se llevaba a `master` con squash. Para que el siguiente pull request no chocara con el squash, después de cada fusión había que correr `git merge -s ours`. Los pull requests salían enormes: el #1 cubría de los cortes 0 a 5 y de la iteración 6 a la 24, y el #2, de la 24c a la 42. El historial detallado solo existía en `corte-0`.
- `master` exigía una aprobación. Con una sola persona trabajando, siempre se fusionaba saltándose la regla, y por el mismo camino se podía saltar la integración, que no era obligatoria.
- No había versiones: producción se desplegaba desde «el último commit de `master`», y nada decía qué versión estaba en producción ni qué traía.
- No había licencia, ni inventario de componentes de terceros, ni política de seguridad, ni actualización de dependencias.

Hay dos restricciones de costo. El plan Hobby de Railway no descarga imágenes de un registro privado (ADR-0049). Además, las reglas de protección en repositorios privados exigen GitHub Pro o una organización de pago.

## Opciones

| Opción | Descripción |
|---|---|
| A. Seguir igual | Rama larga, squash y `merge -s ours` |
| **B. Ramas cortas, versiones etiquetadas** | Una rama por cambio desde `master`; versiones vX.Y.Z publicadas desde `master`; producción solo desde una versión |
| C. GitFlow | Ramas `develop`, `release/*` y `hotfix/*` además de `master` |
| D. Un entorno más (preproducción aparte de pruebas) | Tres proyectos de Railway |

## Evaluación

| Criterio (ligado a un impulsor) | A | B | C | D |
|---|---|---|---|---|
| Se sabe qué está en producción y qué trae (QA-18) | ○ | ● | ● | ● |
| Pull requests revisables y historial que no depende de una rama | ○ | ● | ◐ | — |
| Sin pasos de más para una persona (QA-19) | ◐ | ● | ○ | ○ (un proyecto más que pagar) |
| La integración no se puede saltar | ○ | ● | ● | — |

## Decisión

1. **Ramas cortas.** Cada cambio sale de `master` en su rama (`iteracion-NN-tema`, `fix/tema`, `chore/tema`) y vuelve con un pull request de fusión squash. La rama se borra al fusionar. `corte-0` se archiva como la etiqueta `archivo/corte-0`.
2. **Reglas de `master` (ruleset), sin excepciones ni para el administrador:**
   - pasar las seis comprobaciones de la integración y la del título;
   - historial lineal, sin forzar y sin borrar la rama;
   - **0 aprobaciones** mientras trabaje una persona. Cuando haya equipo se sube a 1 y se activa CODEOWNERS.
3. **El título del pull request sigue Conventional Commits** (flujo «Título»): es el mensaje del commit en `master` y la línea de las notas de la versión.
4. **Versiones:** el flujo «Publicar versión» corre desde `master` con una versión X.Y.Z. Comprueba que el commit pasó la integración y crea la etiqueta `vX.Y.Z` y la versión de GitHub, con sus notas (los títulos de los pull requests desde la anterior), el SBOM (CycloneDX) y los avisos de terceros (`scripts/inventario-de-terceros.mjs`). Las etiquetas `v*` no se borran ni se mueven.
5. **Dos entornos:**
   - **`pruebas`, la preproducción:** acepta cualquier rama con la integración en verde, también una sin fusionar, para probarla antes;
   - **`produccion`:** solo acepta una etiqueta `v*`, con la confirmación escrita. El entorno de GitHub también lo exige.
   Se sigue desplegando por lotes (ADR-0049).
6. **Archivos del repositorio:**
   - `LICENSE` propietario;
   - `SECURITY.md` y `.github/CODEOWNERS`, este último listo para cambiar el usuario por el equipo de TEINS;
   - Dependabot mensual y agrupado, para npm y para las acciones;
   - las acciones fijadas por commit;
   - `.mailmap` con una sola identidad de autor;
   - la configuración personal de herramientas (`.claude/`, `.codegraph/`), fuera de git.

## Por qué gana a cada alternativa

- **Frente a A:** el `merge -s ours` era un parche para un flujo equivocado, y la regla de aprobación se saltaba siempre.
- **Frente a C:** GitFlow existe para mantener varias versiones a la vez. Aquí hay un solo cliente y una sola versión en producción: sus ramas extra serían trabajo sin beneficio.
- **Frente a D:** `pruebas` ya es una copia de producción con datos ficticios. Un tercer proyecto duplica el costo sin probar nada distinto.

## Consecuencias

- **A favor:** cada versión en producción tiene nombre, notas, inventario y licencias. La integración no se puede saltar, y los pull requests se pueden revisar.
- **En contra:** cada pull request corre la integración completa (unos 130 minutos de Actions; el plan incluye 3000 al mes). Se mitiga con Dependabot mensual y agrupado, y con pull requests por iteración, no por commit.
- **En contra:** lo que se despliega no es exactamente la imagen que se probó: Railway la vuelve a construir (ADR-0049). Construir una vez y desplegar la misma imagen exige el plan Pro de Railway; se decide cuando el costo lo permita.
- **Pendiente con costo:** pasar el repositorio a una organización. En el plan gratuito de organizaciones, un repositorio privado pierde estas reglas; conservarlas cuesta el plan Team. Se decide al transferirlo a TEINS.

## Cuándo revisarla

- Entra una segunda persona: 1 aprobación obligatoria y CODEOWNERS por carpeta.
- El presupuesto permite el plan Pro de Railway: construir una vez y desplegar la misma imagen (opción D de ADR-0049).
- Los minutos de Actions no alcanzan: separar las pruebas de extremo a extremo para que corran solo al fusionar.
