# Plan de entrega

Cortes verticales ordenados por riesgo (`forma-de-trabajo.md`). Cada corte termina completo: esquema en `protocolo`, endpoint, política, auditoría, pantalla, estados y pruebas. Lo que un corte deja fuera queda escrito en su sección, con el corte que lo resuelve.

## Mapa

| Corte | Entregable demostrable | Riesgo que cierra | Estado |
|---|---|---|---|
| 0 | Captura sin conexión con fotos, instalada en iPhone | Durabilidad de la PWA en Safari (QA-1, ADR-0002) | Terminado |
| 1 | El técnico inicia sesión, envía el levantamiento y oficina lo ve en su bandeja | Entrega completa, sin duplicados y con archivos verificados (QA-2), idempotencia, aislamiento por organización | Terminado y desplegado en el entorno de pruebas; probado en iPhone el 2026-09-25 |
| 2 | Bajada: formatos como datos, visitas asignadas, estado de mis levantamientos, permiso de trabajo local, revocación con borrado | Punto de control seguro (ADR-0005), revocación sin conexión (QA-5), formatos sin publicar la app (QA-11) | Terminado y desplegado en el entorno de pruebas; probado en iPhone el 2026-09-25 |
| 3 | Revisión: tomar, corregir con trazabilidad por campo, comentar al técnico, marcar revisado | Concurrencia en oficina (QA-25), trazabilidad (QA-8) | Terminado y desplegado en el entorno de pruebas; probado en iPhone el 2026-09-25 |
| 4 | Informe: composición mínima, publicación inmutable y PDF | Versiones inmutables (QA-9), PDF reproducible en segundo plano (QA-17) | Terminado y desplegado en el entorno de pruebas, con supuestos de P22, P23 y P26 |
| 5 | Portal: acceso con QR y clave, descarga del informe vigente | Cero accesos cruzados entre clientes (QA-4, QA-7) | Terminado y desplegado en el entorno de pruebas |
| Iteración 6 | Administración con segundo factor: usuarios, teléfonos, accesos de clientes, retiro de versiones | Cuenta de mayor impacto protegida (ADR-0009), operar el piloto sin comandos | Terminada y desplegada en el entorno de pruebas |
| Iteración 7 | Gestión de visitas y clientes desde oficina | Operar el piloto sin comandos; cambios de agenda que llegan solos a los teléfonos | Terminada y desplegada en el entorno de pruebas; probada en iPhone el 2026-09-25 (el aviso de visita cancelada se corrigió y se confirmó ese día) |
| Iteración 8 | Producción provisional (transferible), respaldos diarios y simulacro | Copias probadas y entorno recreable antes del piloto (QA-10, QA-18) | Terminada; producción sin datos reales hasta transferirla a TEINS (ADR-0021) |
| Iteración 9 | Secciones repetibles (pisos, áreas, tableros) | Formatos reales de TEINS como datos, no código (F2, QA-11) | Terminada y desplegada en el entorno de pruebas; falta la prueba en iPhone |
| Iteración 10 | Bocetos sobre cuadrícula (ADR-0019) | El croquis en papel pasa al teléfono, nítido en oficina y en el PDF (F3, P14) | Terminada y desplegada en el entorno de pruebas; falta la prueba en iPhone |
| Iteración 11 | Cantidades con catálogo y exportación a Excel | Los materiales anotados en campo no se vuelven a digitar para cotizar (F9, P27 a P29) | Terminada y desplegada en el entorno de pruebas; falta la prueba en iPhone |
| Iteración 12 | Cifrado local en campo (ADR-0022) | Un teléfono perdido no entrega datos de clientes y el borrado por revocación es instantáneo (QA-5, I-15) | Terminada y desplegada en el entorno de pruebas; falta la prueba en iPhone |
| Iteración 13 | Llaves de acceso (passkeys) | Entrar con Face ID, huella o PIN, sin contraseñas que se puedan suplantar (ADR-0009) | Terminada y desplegada en el entorno de pruebas; falta la prueba en iPhone |
| Iteración 14 | Interfaz rehecha con la dirección Consola (`DESIGN.md`) | Una herramienta que la gente quiera usar: jerarquía clara, confirmaciones donde hay consecuencias, resultados junto a la acción | Terminada y desplegada en el entorno de pruebas; falta la prueba en iPhone |
| Iteración 15 | Avisos push (técnicos y oficina) e instalación guiada de la app | El técnico se entera de su visita sin abrir la app; nadie captura en Safari lo que la app instalada no ve (ADR-0002) | Terminada y desplegada en el entorno de pruebas; falta la prueba en iPhone |
| Iteración 16 | Firma del cliente en sitio | Constancia de la visita firmada en el teléfono, íntegra (Ley 527) | Terminada y desplegada en el entorno de pruebas; falta la prueba en iPhone |
| Iteración 17 | Catálogo en el teléfono al anotar cantidades | Líneas que llegan vinculadas: menos digitación y cotización casi automática (P28) | Terminada y desplegada en el entorno de pruebas; falta la prueba en iPhone |
| Iteración 18 | Bocetos: pantalla completa, hojas con nombre, enderezar trazos, formas, mover, cotas | Croquis limpios y grandes, un piso por hoja (F3) | Terminada y desplegada en el entorno de pruebas; falta la prueba en iPhone |
| Iteración 19 | Biblioteca de símbolos en los bocetos | Tableros, UPS, tomas y demás con un toque, iguales en todo croquis | Terminada y desplegada en el entorno de pruebas; falta la prueba en iPhone |
| Iteración 20 | Contactos del cliente e informe por correo y WhatsApp | El informe le llega al cliente por donde lo espera, con PDF adjunto (P17) | Terminada y desplegada en el entorno de pruebas; el correo sale de verdad por Resend, WhatsApp sigue simulado hasta tener el número de prueba de Meta |
| Iteración 21 | Cotizaciones desde las cantidades | De la visita a la cotización sin volver a digitar (P27, QA-12) | Terminada y desplegada en el entorno de pruebas (precios de prueba; faltan los de TEINS) |

Con el corte 5 queda el **recorrido delgado** completo. Después, iteraciones por riesgo: secciones repetibles, bocetos (ADR-0019), cantidades con catálogo y exportación, passkeys y segundo factor, cifrado local, gestión de visitas y clientes, administración de usuarios y dispositivos, salud de dispositivos (ADR-0017), entorno de producción y simulacro de restauración (ADR-0016).

## Próximo paso

**Plan acordado con Kevin el 2026-09-26: iteraciones 15 a 21** (sección "Iteraciones 15 a 21"). Kevin eligió siete funciones después de una investigación de producto (envío del informe por WhatsApp y correo, firma del cliente, símbolos y enderezado en los bocetos, ítems frecuentes en cantidades, avisos push y cotizaciones) y pidió terminar primero la PWA de campo. **Iteración 15 terminada y desplegada en el entorno de pruebas el 2026-09-26** (avisos push, ADR-0023, e instalación guiada; maquetas en el lienzo, página "v0.4 · Avisos e instalación"). Falta la prueba en iPhone (fase 15 de la guía, junto con las fases 9 a 14). **Iteración 16 (firma del cliente, ADR-0024) terminada y desplegada en el entorno de pruebas el 2026-09-26**, con el formato de prueba v7; falta la prueba en iPhone (fase 16 de la guía). **Iteración 17 (catálogo en el teléfono, ADR-0025) terminada y desplegada en el entorno de pruebas el 2026-09-26**; falta la prueba en iPhone (fase 17 de la guía). **Iteración 18 (croquis a pantalla completa con hojas, ADR-0026) terminada y desplegada en el entorno de pruebas el 2026-09-26** (maquetas aprobadas en la página "v0.8 · Croquis a pantalla completa"); falta la prueba en iPhone (fase 18 de la guía). **Iteración 19 (símbolos en el croquis, ADR-0027) terminada y desplegada en el entorno de pruebas el 2026-09-26**, con la biblioteca de prueba publicada; falta la prueba en iPhone (fase 19 de la guía) y la lista de símbolos de TEINS. **Iteración 20 (contactos del cliente e informe por correo y WhatsApp, ADR-0028) construida el 2026-09-27** con maquetas aprobadas (página "v1.0 · Informe por correo y WhatsApp"), y desplegada en el entorno de pruebas: el correo sale de verdad por Resend (dominio de pruebas `deportur.tech`) y WhatsApp sigue simulado hasta tener el número de prueba de Meta con la plantilla `informe_publicado` aprobada (sección "Iteración 20", "Fuera"). WhatsApp queda en espera: el 2026-09-27 Kevin avisó un problema con su cuenta de Meta. **Iteración 21 (cotizaciones desde las cantidades, ADR-0029) construida el 2026-09-27** con maquetas aprobadas (página "v1.1 · Cotizaciones") y precios de prueba: con ella se cierra el plan de las iteraciones 15 a 21. Siguiente: la prueba en iPhone de las fases 9 a 19 (antes, revisar por qué `bajada.spec` falla contra el entorno), la cuenta de Meta para WhatsApp, y lo que TEINS entregue: lista de precios, plantilla de la cotización (P29), tratamiento tributario, numeración y lista de símbolos. Pendiente menor: las fallas intermitentes de `repeticiones.spec` (WebKit, local) y `bajada.spec` (entorno). El JavaScript inicial de campo está en 119,9 de 120 KB: cualquier cosa nueva de campo debe cargarse aparte.

**El recorrido delgado está completo (cortes 0 a 5, 2026-09-25)** y desplegado en el entorno de pruebas. Antes de la primera demostración a TEINS:

1. **Verificación manual hecha por Kevin el 2026-09-25** en un iPhone 15 Pro con iOS 26.6.1 (fases 1 a 7 de [`verificacion-manual.md`](verificacion-manual.md); producción quedó para después). Todo funcionó salvo dos avisos que no aparecían, corregidos con su prueba de extremo a extremo y confirmados por Kevin en el iPhone el mismo día: "Oficina canceló esta visita" en el bloque azul de campo y "Su sesión se cerró" en el portal. Falta la fase 8 (producción), que Kevin dejó para después.
2. **Respuestas de TEINS** para ajustar el informe (P22, P23, P26, formato de los planos) y las preguntas P2, P5, P7, P8 y P9.

**Iteración 14 terminada el 2026-09-26:** la interfaz de campo, oficina y portal rehecha con la dirección Consola, elegida por Kevin entre tres comparadas en el lienzo, más la columna "Visita" en la bandeja. Desplegada en el entorno de pruebas y verificada allí con los 12 archivos del extremo a extremo en Chromium (13 pruebas, uno por minuto por el límite de inicios de sesión). Falta probarla en el iPhone junto con las fases 9 a 13.

**Iteración 13 terminada el 2026-09-25:** llaves de acceso en campo y oficina, desplegadas en el entorno de pruebas y verificadas allí con `llaves.spec.ts` (cada superficie con su dominio). Con ella se completa la lista de iteraciones por riesgo que se trazó al cerrar el corte 5. La prueba en iPhone (fase 13 de la guía) queda en espera con las de las iteraciones 9 a 12.

**Iteración 12 terminada el 2026-09-25:** cifrado local en campo (ADR-0022), desplegado en el entorno de pruebas y verificado allí con `cifrado.spec.ts`. Lo guardado antes se cifra solo al abrir la app nueva, sin perder nada. La prueba en iPhone (fase 12 de la guía, antes de aceptar la actualización) queda en espera con las de las iteraciones 9 a 11.

**Iteración 11 terminada el 2026-09-25:** cantidades con catálogo de campo a Excel, desplegadas en el entorno de pruebas con el formato de prueba v6 ("Materiales"). Las columnas del catálogo y de los CSV son supuestas (P28, P29) hasta que TEINS responda. La prueba en iPhone de las iteraciones 9 a 11 está en espera (fases 9 a 11 de la guía).

**Iteración 10 terminada el 2026-09-25:** bocetos de campo al PDF, desplegados en el entorno de pruebas con el formato de prueba v5 ("Croquis del cuarto"). La prueba en iPhone de las iteraciones 9 y 10 está en espera (fases 9 y 10 de la guía).

**Iteración 9 terminada el 2026-09-25:** secciones repetibles de campo al PDF, desplegadas en el entorno de pruebas con el formato de prueba v4 ("Tableros"). Falta probarlas en el iPhone (fase 9 de la guía). Producción sigue con la versión anterior.

**Iteración 8 terminada el 2026-09-25:** producción provisional montada en `teins-produccion` con dominios gratuitos, recreable desde el repositorio, con respaldo diario y simulacro verificado; sin datos reales hasta transferirla a TEINS (ADR-0021, [`produccion.md`](produccion.md)). La rama está en GitHub (pull request #1, en borrador) con la integración continua en verde.

**Iteraciones 6 (administración) y 7 (visitas y clientes) terminadas el 2026-09-25** y desplegadas. Con ellas, TEINS opera el piloto desde las pantallas: solo la primera persona administradora y la publicación de formatos siguen por comando. En el entorno de pruebas, `oficina.prueba` tiene la marca de administrador (activa su segundo factor la primera vez que abre "Administración").

Siguiente, por riesgo (recomendación, a decidir con Kevin): lo que falta para el piloto no es código sino TEINS: su cuenta en Railway (para transferir producción), sus formatos reales (P7, P8), el formato del informe (P22, P23, P26) y su catálogo y columnas de Excel (P28, P29). Secciones repetibles, bocetos y cantidades ya están. Las iteraciones por riesgo que se trazaron están completas (6 a 13). Lo que más reduce el riesgo ahora no es código nuevo: **la prueba en iPhone de las fases 9 a 13** (en espera por Kevin) y **actualizar producción** a esta versión (también en espera). Mientras TEINS responde, lo siguiente en código es la **instalación guiada de la PWA en iPhone** (`docs/diseno/pendientes.md`, punto 4): hoy es un aviso con pasos, y es lo primero que ve un técnico nuevo.

**Entorno local, tal como quedó:** Docker Compose con PostgreSQL y S3Mock (`docker compose up -d --wait`); `paquetes/servidor/.env` creado a partir de `.env.example` (no versionado); base migrada y sembrada con la organización de desarrollo, los formatos de prueba v1, v2 y v3, los usuarios `tecnico.prueba` y `oficina.prueba`, y un cliente de prueba con una visita para `tecnico.prueba`. Las fotos subidas antes del 2026-09-24 se perdieron en local (S3Mock no guardaba en su volumen; ver decisiones del corte 2): la base las da por verificadas, así que esos levantamientos viejos muestran fotos rotas en oficina. Sus contraseñas no están en el repositorio: se fijan con `TEINS_CONTRASENA=... pnpm --filter @teins/servidor restablecer-contrasena --usuario <usuario>`. Docker corre sobre Colima; si las pruebas del servidor dicen "Could not find a working container runtime strategy", ejecutar `colima start`.

**Observado en la verificación del 2026-09-25:** una vez, en la corrida completa del extremo a extremo, `envio.spec.ts` en WebKit falló con "Falta 1 dato por completar" después de llenar todo; no se reprodujo (12 de 12 con 4 trabajadores en paralelo, y verde en todas las corridas completas antes y después). Se vigila; la integración continua reintenta una vez. Las pruebas de oficina ahora cargan más páginas de la bandeja hasta encontrar su levantamiento (`filaDeLaBandeja`): en un entorno con datos de corridas anteriores, el recién enviado quedaba fuera de la primera página de 50.

**Pendientes que no bloquean el cierre del corte 2:**

- Completar la fila de resultados del corte 0 (modelo de iPhone, versión de iOS, persistente, fotos íntegras) y repetir esa prueba en Android.
- Medir el presupuesto de JavaScript de campo en un celular de gama media (ADR-0011).
- La rama `corte-0` tiene los cortes 0, 1 y 2 sin fusionar ni subir: al subirla corre por primera vez la integración continua de GitHub Actions.

**Preguntas a TEINS antes del corte 3:** P7 y P8 (formatos y campos obligatorios reales), P9 (errores frecuentes). **Antes del corte 4:** P22, P23 y P26 (informe). **Antes del piloto:** P40 a P43.

---

## Corte 0 · Captura sin conexión y prueba de durabilidad en iPhone

**Para qué:** validar QA-1 con el almacenamiento real de `campo` antes de construir encima (ADR-0002, ADR-0004).

**Alcance:** formato ficticio de una sección con campos `texto`, `medida` y `foto`; levantamiento en borrador con guardado automático; fotos recodificadas sin metadatos con huella SHA-256 en la misma transacción que su referencia; IndexedDB con Dexie detrás de un puerto; PWA instalable con actualización ofrecida; panel de diagnóstico.

**Procedimiento de la prueba (ADR-0002):**

1. Instalar la app en la pantalla de inicio y abrirla desde ahí. Confirmar en el diagnóstico que el almacenamiento es persistente.
2. Activar modo avión.
3. Crear levantamientos y capturar unas 50 fotos repartidas entre ellos durante varias horas, con texto y medidas.
4. Cerrar la app desde el selector de apps. Reiniciar el teléfono.
5. Abrir la app sin conexión. En el diagnóstico, "Verificar fotos" debe informar todas las fotos íntegras y los textos deben estar completos.

**Resultados:**

| Fecha | Dispositivo | Sistema | Persistente | Fotos | Íntegras | Resultado |
|---|---|---|---|---|---|---|
| 2026-09-24 | iPhone [modelo por registrar] | iOS [versión por registrar] | [por registrar] | [N] | [N] | Sin pérdida, según Kevin |
| 2026-09-25 | iPhone 15 Pro | iOS 26.6.1 | Sí | 3 | 3 | Sin pérdida tras reiniciar el teléfono sin señal (verificación manual, fase 1) |

**Decisión:** se mantiene la PWA (ADR-0002); Capacitor no es necesario. Pendiente: completar la fila con los datos exactos y repetir en Android.

---

## Corte 1 · Envío a oficina

**Para qué:** que un levantamiento capturado sin conexión llegue al servidor **completo, una sola vez y con sus fotos verificadas**, aunque la señal se corte a mitad (QA-2), y que oficina lo vea. Es el primer corte con servidor, así que también deja la base de toda la arquitectura del servidor.

### Alcance

**Servidor, base de la arquitectura (ADR-0001, ADR-0010, ADR-0017)**

- Monolito modular con módulos `identidad`, `formatos`, `levantamientos`, `archivos` y `auditoria`. Cada módulo expone solo su interfaz pública; los núcleos (`levantamientos`, `formatos`) son hexagonales.
- Un código y dos roles de ejecución: `web` (API) y `worker` (trabajos).
- Configuración por variables de entorno validada al arrancar; el proceso no arranca con configuración inválida.
- Registros JSON con id de correlación por solicitud; nunca contenido de levantamientos ni secretos.
- Errores en formato Problem Details (RFC 9457) con códigos del dominio.
- Apagado ordenado: termina las solicitudes y trabajos en curso antes de salir.

**Base de datos (ADR-0005, ADR-0009)**

- PostgreSQL con un esquema por módulo y migraciones de Drizzle, siempre de expansión (ADR-0015).
- Organización en todas las tablas de negocio, con seguridad por fila: cada transacción fija la organización con `SET LOCAL` y la base filtra.
- El rol de la aplicación solo inserta y lee en auditoría; nunca actualiza ni borra.

**Identidad y autorización (ADR-0009)**

- Better Auth con usuario y contraseña; sesiones opacas en cookie `HttpOnly`, `Secure`, `SameSite`; revocar es borrar la sesión.
- Roles técnico y oficina; usuarios creados por un comando de administración (la pantalla llega en una iteración posterior).
- Módulo central de políticas. Toda ruta declara su política o no responde; una prueba recorre el registro de rutas y falla si alguna no la declara.

**Protocolo (ADR-0003, ADR-0014, ADR-0015)**

- Esquemas Zod versionados en `protocolo`: `EnviarLevantamiento`, autorización de subida y respuestas. La versión viaja en una cabecera; el servidor acepta la actual y la anterior.
- Especificación OpenAPI generada desde los esquemas.

**Archivos (ADR-0007)**

- Autorización de subida: URL firmada de corta duración, limitada en tamaño y tipo, para la clave `organizacion/sha256`.
- Carga directa desde el dispositivo al almacenamiento.
- Verificación en el `worker`: firma interna del archivo, tamaño y huella. Estados pendiente, subido y verificado.

**Recepción del envío (ADR-0003, ADR-0005, ADR-0008, ADR-0012)**

- `POST /api/sync/comandos` con `EnviarLevantamiento`, en una sola transacción: política, versión del protocolo, validación completa con el mismo validador de `dominio`, presencia y verificación de todos los archivos, guardado del agregado (columnas relacionales más documento JSONB) y auditoría de creación y envío con cadena de hashes. `LevantamientoEnviado` todavía no encola trabajos: su única reacción hoy es la bandeja, que es una consulta; el primer consumidor asíncrono (métricas del piloto) lo encolará con el puerto de la cola ya probado.
- Idempotencia completa: llave única derivada del levantamiento y resultado guardado; un reintento, incluso días después, recibe la misma respuesta.
- Si falta un archivo, la respuesta dice cuáles y el dispositivo los sube antes de reintentar.

**Dominio**

- Validador de respuestas contra la versión de formato: obligatorios (regla 3) y unidades (regla 5). El mismo código valida en el dispositivo y en el servidor.
- Marca "no se pudo obtener" con motivo para datos obligatorios (regla 3): sin ella, un técnico que no pudo medir no podría enviar.
- Transición borrador → enviado.

**Campo (ADR-0003, ADR-0004, ADR-0015)**

- Inicio de sesión (requiere conexión, como toda primera instalación).
- Outbox en Dexie con una migración a la versión 2 probada sobre borradores pendientes.
- Fotos que suben por adelantado cuando hay señal.
- "Enviar a oficina" con validación local previa; el levantamiento enviado queda de solo lectura.
- Estado de sincronización siempre visible: pendiente de enviar, enviando, recibido, error.
- Reintentos con espera exponencial y aleatoria al abrir la app y al recuperar señal; un error permanente se muestra al técnico y no se reintenta.

**Oficina**

- Inicio de sesión y bandeja de solo lectura "Esperando revisión", con el detalle del levantamiento y sus fotos. La revisión llega en el corte 3.

**Desarrollo local (ADR-0016)**

- Docker Compose con PostgreSQL y un almacenamiento compatible con S3 de licencia permisiva.
- Datos de prueba ficticios con un comando.

**Pruebas (ADR-0018)**

- Dominio: validador con casos de conformidad y máquina de estados con pruebas basadas en propiedades.
- Integración con PostgreSQL real en contenedores: dos envíos simultáneos del mismo levantamiento se procesan una vez; envío con archivo faltante; aislamiento entre organizaciones; auditoría que no se puede modificar; cadena de hashes que detecta una alteración; trabajo que no existe si la transacción se revierte.
- Arnés de fallas del cliente de sincronización: corte a mitad de una carga, respuesta perdida después de confirmar, entrega duplicada, cierre de la app entre guardar y encolar.
- Extremo a extremo con Playwright: capturar sin conexión, recuperar señal, enviar y verlo en la bandeja de oficina.

**Reglas de arquitectura en integración continua (ADR-0018)**

- Tipos, pruebas, dependencias entre paquetes y módulos (dependency-cruiser), cobertura de políticas en rutas y licencias sin AGPL, en GitHub Actions.

### Fuera del corte 1

| Qué | Dónde se resuelve |
|---|---|
| Bajada: formatos desde el servidor, visitas, estado de mis levantamientos | Corte 2. Mientras tanto, el formato ficticio se siembra en el servidor y `campo` lo trae incluido, con la misma versión |
| Permiso de trabajo local y borrado por revocación | Corte 2 (viajan con la bajada) |
| Passkeys y segundo factor | Segundo factor en la iteración 6; passkeys en la iteración 13 |
| Cifrado local (ADR-0009, parte 5) | Iteración 12 (ADR-0022) |
| Miniaturas | Corte 4, cuando el PDF las necesite |
| Informe de salud del dispositivo | Corte 2, con la bajada (ADR-0017) |
| Seguimiento de errores con servicio externo | Antes del piloto, con la decisión de TEINS sobre terceros |
| Entorno de pruebas con servidor desplegado | Al cerrar el corte 1: requiere elegir proveedor según la lista de ADR-0016 |

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. El recorrido extremo a extremo pasa en Chromium y WebKit | Cumplido en local |
| 2. Pasan las pruebas de los cuatro niveles y las reglas de arquitectura en integración continua | Cumplido en local; el flujo de GitHub Actions corre al subir la rama |
| 3. Pantallas solo con componentes de `ui` y estados vacío, cargando, error y sin conexión | Cumplido |
| 4. Probado en un iPhone real: captura sin conexión, recuperar señal, enviar con fotos y verlo en oficina | Cumplido el 2026-09-25 en un iPhone 15 Pro con iOS 26.6.1 (verificación manual, fase 1) |

### Entorno de pruebas (propuesta original; lo montado está en `entorno-de-pruebas.md`)

Datos ficticios, cuentas de Kevin, región en Estados Unidos (Ley 1581). Verificado contra la lista de ADR-0016 el 2026-09-24:

| Pieza | Propuesta | Costo estimado | Por qué |
|---|---|---|---|
| Rol web, rol worker y PostgreSQL | Railway, plan Hobby, región US East (Virginia) | USD 5 a 8 al mes: el plan cuesta USD 5 e incluye USD 5 de uso; web, worker y base en reposo usan poco | Corre la misma imagen para ambos roles; PostgreSQL en la misma red privada con conexión directa (LISTEN/NOTIFY para la cola) y sin apagarse |
| Archivos | Cloudflare R2 | USD 0: 10 GB, 1 millón de escrituras y 10 millones de lecturas gratis al mes; sin cargo por salida | Compatible con S3, URL firmadas, CORS |
| Superficies | Dos servicios web con la misma imagen (uno por host), o un dominio propio con subdominios `campo.` y `oficina.` | Unos USD 1 a 2 más con dos servicios | ADR-0016 exige un host por superficie; no se confirmó en la documentación de Railway cuántos dominios admite un servicio |

**Descartados al verificar:**

- **Neon, plan gratuito:** apaga la base a los 5 minutos sin actividad y no se puede desactivar en ese plan; al apagarse termina las conexiones LISTEN de la cola, y el sondeo del worker agotaría las 100 horas de cómputo del mes.
- **Cloudflare R2 para exigir la huella en la subida:** R2 no admite `x-amz-checksum-sha256` en PutObject (solo `Content-MD5`, que el navegador no calcula). ADR-0007 lo contempla: exigir la huella en la carga es opcional "si el proveedor lo permite"; la garantía es la verificación del worker (firma interna, tamaño y huella; lo inválido se rechaza y se elimina). Con R2 hace falta una opción de configuración para no firmar esa cabecera. Si se prefiere exigirla también en la carga, la alternativa es Amazon S3 en `us-east-1`, con costo de centavos al mes a este volumen.

**Pasos al aprobar:** la guía completa está en [`entorno-de-pruebas.md`](entorno-de-pruebas.md). Hecho en código (2026-09-24): `S3_EXIGIR_HUELLA` para no firmar la huella con R2, cliente S3 sin sumas de verificación propias en las URL firmadas (el SDK agregaba un CRC32 del cuerpo vacío), y `ENTORNO_DE_PRUEBAS` para sembrar aunque el entorno corra con `NODE_ENV=production`, con sus pruebas. Falta: subir la rama, crear las cuentas (Kevin), seguir la guía y repetir el extremo a extremo contra el entorno (hay que parametrizar sus URL).

### Decisiones tomadas al construirlo

- **Almacenamiento S3 local: S3Mock (Apache-2.0).** MinIO se descartó por AGPL (regla 12). S3Mock rechaza un contenido distinto a la huella firmada, igual que un proveedor real; no admite configurar CORS (ya permite todo), por eso `S3_CONFIGURAR_CORS=false` en local.
- **TypeScript 6.** TypeScript 7 aún no publica la API de compilador que usan las reglas de arquitectura; con él, dependency-cruiser no analizaba ningún archivo. Se revisa cuando la publique.
- **Formatos de prueba v1 y v2.** v2 agrega obligatorios; los borradores del corte 0 terminan con v1 (ADR-0006, regla 3).
- **Responsable local del levantamiento.** Un teléfono compartido solo envía y sube fotos con la sesión de quien creó cada levantamiento (regla 1). Los borradores del corte 0 pasan a quien inicia sesión primero.
- **Conexión real, no solo `navigator.onLine`.** El motor registra si el servidor respondió; la interfaz dice "sin conexión" aunque el navegador diga lo contrario (red sin internet, portal cautivo).
- **Presupuesto de campo: 120 KB de JavaScript inicial comprimido,** medido en 108 KB. El código de red se carga después del primer dibujo; el service worker lo guarda para usarlo sin señal. Falta confirmarlo con una medición en un celular de gama media (ADR-0011).
- **WebKit de Playwright** bloquea las URL `blob:` sin red (Safari real no); en WebKit la prueba corta la red después de la foto. La captura completa sin red la cubren Chromium y el iPhone real.
- **Tokens neutros por superficie.** Oficina redefine tamaños con `data-superficie`, sin duplicar componentes.

---

## Corte 2 · Bajada

**Estado:** Kevin pidió empezar el 2026-09-24 sin responder las tres decisiones abiertas; se tomaron las propuestas por defecto (visitas por comando, secreto de dispositivo, un solo corte), que puede revisar. Construido y verificado en local el mismo día; falta cerrar los puntos de "Próximo paso".

**Para qué:** que el dispositivo reciba del servidor lo que necesita para trabajar (formatos como datos, visitas asignadas, estado de mis levantamientos) con un punto de control que nunca se salta un cambio (ADR-0005, patrón 3), que pueda trabajar sin conexión solo mientras su permiso local esté vigente, y que un usuario revocado pierda sus datos en el dispositivo al siguiente contacto (QA-5). Cierra también QA-11: un formato nuevo llega a campo sin publicar la app.

**Punto de partida:** hoy no existen visitas, clientes, sitios ni dispositivos en ningún paquete; el levantamiento no tiene visita y `campo` trae los formatos v1 y v2 incluidos en el código.

### Alcance

**Protocolo (contrato primero; ADR-0003, ADR-0014, ADR-0015)**

- `GET /api/sync/cambios?desde=<punto>`: cambios del alcance del usuario, marcas de borrado, salidas del alcance, nuevo punto de control, `hayMas` para paginar, vencimiento del permiso de trabajo local y versión mínima del protocolo.
- `POST /api/sync/salud`: informe de salud del dispositivo, enviado en el mismo ciclo que la bajada. ADR-0014 fija la bajada como `GET` y ADR-0017 pide que la salud viaje con ella; un `GET` no lleva cuerpo, así que van en dos llamadas del mismo ciclo, sin tocar ninguno de los dos ADR.
- `EnviarLevantamiento` agrega `visitaId` **opcional** (expansión, ADR-0015): los borradores de los cortes 0 y 1 no tienen visita y se siguen enviando. La versión del protocolo no cambia.
- Identificación del dispositivo y consulta de su orden de borrado (ver "Revocación").

**Dominio**

- Visita: cliente, sitio, motivo, fecha programada, técnicos asignados. Su avance se deduce; solo "cancelada" es explícito (modelo de dominio, sección 5).
- Levantamiento con `visitaId`. Regla 17: reasignar una visita no invalida levantamientos ya iniciados.
- Versión de formato con `appMinima` opcional en el meta-esquema (ADR-0015, punto 4).
- Permiso de trabajo local: vigente, vencido. Vencer bloquea la captura, nunca borra (ADR-0009, parte 2).

**Servidor**

- Módulos nuevos `clientes` (clientes y sitios, datos mínimos) y `visitas`, de capas simples. Módulo `sincronizacion` con el registro de cambios: inserción serializada con `pg_advisory_xact_lock` para que el orden de la secuencia coincida con el de confirmación (ADR-0005, patrón 3). Los demás módulos registran cambios por su interfaz pública, en su misma transacción.
- Alcance por técnico: sus visitas asignadas con su cliente y sitio, versiones de formato compatibles con su app y estado de sus levantamientos. Al reasignar una visita, el técnico anterior recibe su salida del alcance.
- Entidad Dispositivo en `identidad`: usuario, última sincronización, informe de salud y orden de borrado.
- Desactivar usuario (regla 13): no autentica, se borran sus sesiones, sus dispositivos quedan marcados para borrado y sus envíos pendientes se rechazan (P36). Su autoría se conserva.
- Comandos de administración, como en el corte 1 con los usuarios: `crear-cliente`, `crear-visita`, `reasignar-visita`, `publicar-formato <archivo>`, `desactivar-usuario`. Las pantallas de oficina para esto llegan con "gestión de visitas y clientes".

**Campo**

- Dexie versión 3: formatos, visitas, estado de mis levantamientos, punto de control, permiso y dispositivo. La migración copia los formatos incluidos a la tabla nueva, para que ningún borrador pierda su formato. Se prueba sobre borradores y envíos pendientes.
- Bajada al abrir la app, al recuperar señal y después de enviar, con la misma espera exponencial del outbox.
- Inicio con "Mis visitas": cada visita muestra cliente, sitio, fecha y sus levantamientos; desde ella se inicia un levantamiento con un formato bajado.
- Estado de mis levantamientos según el servidor (hoy "recibido por oficina"; el corte 3 agrega "en revisión" y "revisado").
- Permiso vencido: aviso que bloquea crear y editar, conserva todo y pide iniciar sesión.
- Revocación: pantalla de acceso cerrado; se borran solo los datos del usuario revocado (fotos, borradores, envíos, visitas), no los de otro usuario del mismo teléfono.

### Revocación: cómo se entera el dispositivo

Revocar borra las sesiones, así que el siguiente contacto responde "no autenticado", igual que una sesión que simplemente venció. Para distinguirlos, el dispositivo se registra al iniciar sesión y recibe un **secreto de dispositivo** propio (guardado en IndexedDB, solo su huella en el servidor). Ante "no autenticado", el dispositivo consulta con ese secreto si tiene orden de borrado: si la tiene, borra; si no, pide iniciar sesión. Sin esto, un exempleado nunca volvería a iniciar sesión y la orden nunca llegaría.

### Fuera del corte 2

| Qué | Dónde se resuelve |
|---|---|
| Comentarios de oficina al técnico | Corte 3, viajan por esta misma bajada |
| Catálogo de ítems y unidades en la bajada | Iteración de cantidades con catálogo |
| Visita no programada creada en campo | Solo si TEINS responde P2 distinto al supuesto |
| Pantallas de oficina para clientes, sitios y visitas | Iteración de gestión de visitas y clientes |
| Panel de salud de dispositivos | Iteración de administración de usuarios y dispositivos; en este corte se guarda y se prueba |
| Cifrado local: el borrado por revocación elimina los registros, no destruye una clave | Resuelto en la iteración 12: primero se destruye la clave (ADR-0022) |
| Aviso push de visitas nuevas | Después del piloto (ADR-0014) |
| Cancelar una visita | Iteración de gestión de visitas y clientes |
| Oficina ve la visita (cliente y sitio) de cada levantamiento | Corte 3 (revisión) o corte 4 (el informe es por visita) |
| Crear un levantamiento sin visita | Solo si P2 lo pide; los que ya existían sin visita se siguen enviando |
| Un teléfono que se revoca antes de registrarse (nunca bajó después de actualizar) no recibe la orden: sus datos quedan bloqueados al vencer el permiso | Riesgo residual declarado en ADR-0009. Desde la iteración 12 están cifrados, pero la clave sigue en ese teléfono: protege contra la copia de los archivos del navegador, no contra quien lo tenga desbloqueado |

### Preguntas a TEINS

- **P2** (quién asigna las visitas y si se programan con fecha). Supuesto mientras tanto: oficina programa y asigna; el técnico no crea visitas.
- **P5** (visitas repetidas al mismo sitio). Supuesto: el sitio es entidad; con otra respuesta se vuelve opcional sin cambiar la bajada.

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Extremo a extremo en Chromium y WebKit: se asigna una visita por comando, el técnico la ve, captura con un formato bajado, envía y ve "recibido por oficina" | Cumplido en local (`e2e/pruebas/envio.spec.ts`) |
| 2. Un formato publicado por comando llega a campo sin publicar la app; uno con `appMinima` mayor no llega a una app vieja | Cumplido en integración (`servidor/pruebas/bajada.test.ts`) y en el motor (`campo`, app actualizada baja desde cero). Sin extremo a extremo: cada corrida dejaría un formato de más en la base de desarrollo |
| 3. Punto de control seguro: con dos transacciones que confirman fuera de orden, ningún cambio se pierde (integración con PostgreSQL real) | Cumplido (`servidor/pruebas/plataforma.test.ts`) |
| 4. Revocación: el siguiente contacto borra los datos del usuario revocado y conserva los de otro usuario del mismo teléfono; sus envíos pendientes se rechazan | Cumplido: integración del servidor, motor con teléfono compartido y extremo a extremo en Chromium y WebKit (`e2e/pruebas/bajada.spec.ts`) |
| 5. Permiso vencido: bloquea la captura, conserva los datos y se reanuda al iniciar sesión | Cumplido en extremo a extremo en Chromium, en local y contra el entorno de pruebas. WebKit de Playwright no recarga sin red, y en el iPhone exigiría 7 días sin señal: no se prueba ahí |
| 6. La migración de Dexie a la versión 3 conserva borradores, envíos pendientes y formatos | Cumplido (`campo/src/datos/repositorio.test.ts`) |
| 7. El informe de salud se guarda en el dispositivo del servidor | Cumplido (integración del servidor y motor de campo) |
| 8. Pantallas solo con componentes de `ui` y estados vacío, cargando, error y sin conexión; reglas de arquitectura en verde | Cumplido |
| 9. Entorno de pruebas desplegado y prueba en iPhone de los cortes 1 y 2 (decisión del 2026-09-24) | Entorno desplegado en Railway el 2026-09-25 y extremo a extremo en verde contra él (Chromium 3 de 3, WebKit 2 de 2 más el salto conocido). Prueba en iPhone cumplida el 2026-09-25: bajada, estado según el servidor y revocación con borrado confirmado por el teléfono (verificación manual, fases 1 y 2) |

### Orden de construcción

1. Protocolo y dominio (contrato, visita, `appMinima`, permiso).
2. Servidor: registro de cambios con su prueba de orden de confirmación, clientes y visitas, bajada, dispositivos y salud.
3. Servidor: desactivación y orden de borrado.
4. Campo: migración a Dexie 3, bajada, formatos como datos, "Mis visitas", estado de mis levantamientos.
5. Campo: permiso vencido y revocación con borrado.
6. Extremo a extremo, cierre de documentación, entorno de pruebas e iPhone.

### Decisiones tomadas al construirlo

- **Bajada `GET` e informe de salud en `POST` aparte.** ADR-0014 fija `GET /sync/cambios` y ADR-0017 pide que la salud viaje con la bajada; van en dos llamadas del mismo ciclo. `POST /api/sync/dispositivo` también registra el dispositivo, así un teléfono que venía del corte 1 queda registrado en su primera bajada.
- **Dos módulos para la bajada.** `cambios` guarda qué cambió y para quién (como `auditoria`, lo usan los demás); `sincronizacion` arma la bajada leyendo el contenido actual de cada módulo por su interfaz. En un solo módulo habría un ciclo con `visitas`.
- **Bloqueo consultivo por organización** hasta el final de la transacción: el orden de la secuencia es el de confirmación y otra organización no espera. Por eso el cambio se registra al final de cada transacción.
- **El último cambio de cada entidad manda:** varios cambios de la misma visita bajan una sola vez con su estado actual. Una visita que ya no está asignada al técnico baja como "fuera de alcance".
- **La migración rellena el registro** con los formatos ya publicados y los levantamientos ya recibidos; sin eso, nunca bajarían.
- **Técnicos asignados como lista en la visita**, que se reemplaza al reasignar; la auditoría guarda el antes y el después. Una tabla de asignaciones obligaría a borrar filas (regla 14).
- **`appMinima` y app actualizada:** la bajada no entrega lo que la app no sabe mostrar, y el punto de control avanza igual. Por eso campo guarda con qué versión bajó y, si cambia, baja desde cero. `VERSION_APP` es un entero en `campo/src/version.ts`.
- **Visita reasignada con algo empezado** se conserva en el teléfono, marcada, para terminar y enviar (regla 17); sin nada empezado, se retira.
- **Revocación:** el secreto del dispositivo (32 bytes, el servidor guarda su huella) autentica `POST /api/sync/dispositivo/ordenes` con la política `secreto_de_dispositivo`. Campo consulta cuando el servidor rechaza la sesión; borra en una transacción solo lo del usuario revocado (un archivo que usa otra persona se conserva) y confirma el borrado, que queda en auditoría. Desactivar marca al usuario, borra sus sesiones y ordena el borrado en una sola transacción.
- **Un usuario desactivado que intenta entrar** recibe la misma respuesta que una contraseña equivocada.
- **Cadencia de la bajada:** al abrir, al recuperar señal, al volver a la app, al iniciar sesión y después de un envío recibido; si no, cada 5 minutos. Con la sesión vencida no insiste en cada ciclo.
- **Permiso local:** lo renueva cada bajada y el inicio de sesión (`Sesion.permisoLocalHasta`). La migración a Dexie 3 da 7 días a quien ya tenía sesión, para no bloquearlo si actualiza sin señal. Vencido, los borradores se ven en solo lectura.
- **Formatos con nombre:** `nombre` es opcional porque v1 y v2 no se pueden modificar; se publicó la v3 de prueba con nombre y campo toma el nombre de cualquier versión del mismo formato.
- **Orden de "Mis visitas"** (`campo/src/visitas.ts`; Kevin pidió la recomendación y que se implementara, 2026-09-24; puede ajustarse cuando TEINS responda P2): primero la visita con un borrador a medias, aunque sea de otro día; después las de hoy, las atrasadas y las futuras sin atender, cada grupo por fecha; al final las atendidas (algo enviado y nada a medias), para que el foco pase a la siguiente visita. La primera es el punto focal.
- **Solo se crean levantamientos desde una visita** (supuesto de P2). Los que no tienen visita aparecen en "Otros levantamientos en este teléfono".
- **El estado según el servidor manda** sobre el de envío del teléfono en la lista; en el corte 3 agrega "en revisión" y "revisado".
- **Salud sin contenido:** el último error viaja solo como código.
- **Entorno local, corregido:** S3Mock guardaba en `/tmp` del contenedor y no en su volumen; al recrearlo se perdían las fotos que la base daba por verificadas. `docker-compose.yml` ahora fija `COM_ADOBE_TESTING_S3MOCK_STORE_ROOT`. La foto del extremo a extremo es única por corrida: una repetida no se vuelve a subir y la prueba no ejercitaba la carga.
- **Presupuesto de campo:** 110 KB de JavaScript inicial comprimido (antes 108).
- **Entorno de pruebas en Railway, sin Cloudflare** (2026-09-25, a pedido de Kevin, todo desde la CLI): el almacenamiento de Railway exige la huella y el tamaño firmados y acepta CORS por API, así que reemplaza a R2 y conserva la garantía completa de ADR-0007. Se despliega con `railway up` desde la carpeta local, sin conectar GitHub todavía.
- **Cliente S3 sin sumas propias:** con la configuración por defecto, el SDK de AWS agregaba a la URL firmada un CRC32 del cuerpo vacío; ahora solo calcula sumas cuando la operación las exige. `S3_EXIGIR_HUELLA=false` queda para proveedores sin la huella (R2).
- **`ENTORNO_DE_PRUEBAS`:** permite sembrar con `NODE_ENV=production` en un entorno ficticio; producción real nunca la tiene.
- **La imagen incluye todo `src/cli/`:** los comandos del corte 2 no estaban en la lista fija de `compilar.mjs` y faltaban en la imagen.
- **Railway prueba la salud en `PORT`:** los servicios web fijan `PORT=3000`.
- **Extremo a extremo contra un entorno:** con `E2E_CAMPO_URL` y `E2E_OFICINA_URL`, usa esas direcciones y corre los comandos de administración con `railway ssh`.

---

## Corte 3 · Revisión

**Estado:** construido y desplegado en el entorno de pruebas el 2026-09-25. Kevin pidió continuar sin revisar el alcance antes; puede ajustarlo sobre esta sección.

**Para qué:** que oficina revise un levantamiento enviado sin pisarse entre personas (QA-25, I-1) y que cada corrección quede con quién, cuándo, qué campo, valor anterior y nuevo, verificable (QA-8, ADR-0008). El técnico ve el estado y los comentarios en su teléfono.

### Alcance

**Dominio:** estados enviado → en revisión → revisado. Corrección de un campo con el mismo validador de campo y de envío (reglas 3 y 5), que devuelve el cambio (ruta, anterior, nuevo). Marcar revisado exige respuestas válidas.

**Protocolo (tareas explícitas, ADR-0014):** tomar para revisar (con reasignación explícita si otra persona la tiene), corregir campos, marcar revisado, comentar, historial del levantamiento. Cada guardado lleva la versión que la persona tenía abierta; si otra guardó antes, se rechaza con `conflicto_de_version` (ADR-0005, patrón 2). La bandeja filtra por estado y muestra quién tiene la toma.

**Servidor:** estados y responsable de la revisión en `levantamientos`; comentarios como tabla propia (solo insertar y leer); auditoría por campo en la misma transacción (toma, reasignación, corrección, marca de revisado, comentario); historial legible con verificación de la cadena. Cambios de estado y comentarios bajan al técnico; una app anterior (versión 2) recibe "enviado" para no romper su contrato (ADR-0015, N-1).

**Oficina:** bandeja con "Esperando revisión", "En revisión" y "Revisados"; el punto focal es el más antiguo con "Tomar para revisar" (DESIGN.md). Pantalla de revisión: toma, corrección por campo con motivo opcional, aviso cuando otra persona guardó antes, marcar revisado, comentarios al técnico e historial de cambios.

**Campo:** estado según el servidor ("En revisión en oficina", "Revisado por oficina") y comentarios de oficina en el levantamiento enviado. `VERSION_APP` pasa a 3.

### Fuera del corte 3

| Qué | Dónde se resuelve |
|---|---|
| Reabrir un levantamiento revisado | Corte 4: depende de si ya está en un informe publicado |
| Corregir fotos desde oficina (quitar o agregar) | Iteración posterior; hoy solo texto, medida y "no se pudo obtener" |
| Devolución formal al técnico | Fuera de alcance del modelo de dominio; el comentario no reabre el borrador |
| Rol supervisor | Cuando TEINS defina qué hace |
| Verificación periódica de las cadenas en el worker | Iteración de operación; hoy la verificación es por levantamiento, bajo demanda |

### Preguntas a TEINS

P7, P8 y P9 (formatos prioritarios, obligatorios reales y errores frecuentes). No bloquean: el corte se construye con el formato de prueba.

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Extremo a extremo: oficina toma, corrige una medida, comenta y marca revisado; el técnico ve "Revisado por oficina" y el comentario | Cumplido en Chromium y WebKit, en local y contra el entorno (`e2e/pruebas/revision.spec.ts`) |
| 2. Dos personas de oficina: el segundo guardado sobre la misma versión se rechaza y se avisa, sin perder nada (QA-25), en integración y en extremo a extremo | Cumplido: guardados simultáneos en `servidor/pruebas/revision.test.ts` y reasignación con guardado en curso en el extremo a extremo |
| 3. Cada corrección queda en auditoría con ruta, valor anterior y nuevo, autor y correlación; la cadena del levantamiento verifica íntegra (QA-8) | Cumplido en integración y visible en el historial de oficina |
| 4. Solo quien tomó la revisión corrige y marca revisado; el técnico no; la reasignación queda registrada | Cumplido en integración y extremo a extremo |
| 5. Una app de campo versión 2 sigue leyendo la bajada | Cumplido en integración (recibe "enviado", sin comentarios) |
| 6. Pantallas solo con componentes de `ui`, con estados vacío, cargando, error y sin conexión; reglas de arquitectura en verde | Cumplido |
| 7. Desplegado en el entorno de pruebas con el extremo a extremo en verde contra él | Cumplido el 2026-09-25; la regresión de los cortes 1 y 2 también pasa contra el entorno |

### Decisiones tomadas al construirlo

- **Tareas explícitas con la versión vista en el cuerpo** (`tomar`, `correcciones`, `marcar-revisado`, `comentarios`, ADR-0014). El servidor compara la versión y actualiza con `WHERE version = ?`: el primer chequeo da un aviso claro y el `UPDATE` resuelve la carrera entre dos guardados simultáneos. El rechazo lleva `versionActual`.
- **Toma de revisión:** tomar lo propio otra vez responde el estado sin cambiar nada; quitársela a otra persona exige `reasignar` y queda como `revision_reasignada` con el responsable anterior y el nuevo. El rechazo `tomado_por_otro` dice quién la tiene.
- **Corrección:** mismas reglas del envío por campo (`validarCampo` de `dominio`); reescribir el mismo valor no es un cambio ni deja registro; las fotos no se corrigen desde oficina (`no_corregible`); un registro de auditoría por campo, todos con la correlación del guardado y el motivo opcional.
- **Marcar revisado** exige respuestas válidas contra su formato.
- **Comentarios:** cualquier persona de oficina comenta, aunque no tenga la revisión; no cambian la versión ni el estado; pueden apuntar a un campo, que se valida contra el formato. Tabla propia de solo insertar y leer, y evento `comentario_agregado` en la cadena.
- **N-1 en la bajada:** `APP_CON_REVISION = 3`. A una app de campo versión 2 se le manda "enviado" y sin comentarios, porque su contrato no conoce los estados nuevos y rechazaría la bajada entera. Probado en integración.
- **Campo sin versión nueva de Dexie:** estado y comentarios viven en `estadosServidor`, sin índices nuevos.
- **Historial legible:** oficina ve nombres, no identificadores, y la verificación de la cadena del levantamiento en cada consulta ("Historial íntegro").
- **`ui` crece:** `Pestanas` (patrón WAI-ARIA), `CampoTextoLargo` (acepta `ref`) y los tonos de marquilla "revision" y "revisado", que ya existían en los tokens.
- **Extremo a extremo remoto con reintentos:** `railway ssh` falla de vez en cuando; los comandos de administración de la prueba se repiten hasta tres veces (uno ya aplicado falla al repetirse, no duplica).
- **Una sola acción amarilla:** en la revisión es "Tomar para revisar" o "Marcar revisado"; "Guardar corrección" es secundaria. Los botones nombran el dato ("Corregir potencia nominal", "Comentar potencia nominal").

---

## Corte 4 · Informe

**Estado:** construido y desplegado en el entorno de pruebas el 2026-09-25, con supuestos (Kevin pidió avanzar sin esperar a TEINS). Confirmado por Kevin: lo que recibe el cliente es un PDF.

**Para qué:** que oficina componga el informe de una visita con sus levantamientos revisados, lo publique como una versión que nunca cambia (QA-9) y que el PDF se genere en segundo plano y quede guardado tal como se entregó (QA-17, ADR-0013).

### Supuestos mientras TEINS responde

| Pregunta | Supuesto | Si la respuesta es distinta |
|---|---|---|
| P26: ¿informe por visita o varias? | Uno por visita, con sus levantamientos revisados (regla 9) | La regla pasa a "mismo cliente"; el modelo no cambia |
| P23: secciones, logo, firmas, datos legales | Portada (organización, cliente, sitio, visita, versión), introducción, un capítulo por levantamiento con sus datos y fotos, conclusiones y planos anexos. Logo, firma y datos legales como marcadores `[LOGO]`, `[FIRMA]`, `[DATOS LEGALES]` | Cambia la plantilla HTML, no el modelo |
| P22: informes de ejemplo | Plantilla propia con la dirección de `DESIGN.md` | Se ajusta la plantilla |
| Formato de los planos | PDF, anexado como páginas del mismo documento (ADR-0013) | Imágenes: se incrustan como una página cada una; DWG: TEINS exporta a PDF |

### Alcance

**Dominio:** informe (visita, levantamientos incluidos en orden, introducción, conclusiones, planos en orden, versión optimista); solo incluye levantamientos revisados de la misma visita (regla 9); publicar crea la versión n+1 con una copia congelada (regla 10).

**Protocolo:** listar informes, abrir el informe de una visita (lo crea si no existe), guardar el borrador, publicar y descargar el PDF de una versión. Los planos suben como PDF por el mismo camino que las fotos (ADR-0007), solo desde oficina.

**Servidor:** módulo `informes`. La versión publicada guarda la copia congelada; la aplicación no puede modificarla (solo puede escribir las columnas del PDF). Publicar encola `informes.generarPdf` en la misma transacción (ADR-0012), en la cola `pdf` de a uno. El trabajo arma el HTML desde la copia congelada (fotos incrustadas, fuente incrustada), lo imprime con Chromium, anexa los planos con pdf-lib, guarda el PDF por su huella y lo registra en la versión. Nunca se regenera un PDF listo. Publicación en la cadena de auditoría del informe.

**Oficina:** lista de informes; desde un levantamiento revisado con visita, "Abrir el informe de esta visita"; composición (textos, levantamientos incluidos y su orden, planos); publicar con confirmación; versiones con su estado ("Generando PDF", "Descargar PDF", "No se pudo generar").

**Imagen:** Chromium dentro de la imagen de despliegue, con su versión fijada por la de Alpine.

### Fuera del corte 4

| Qué | Dónde se resuelve |
|---|---|
| El cliente descarga el PDF | Corte 5 (portal) |
| Retirar una versión publicada | Cuando exista el rol administrador |
| Marca por organización en la plantilla (ADR-0020) | Iteración de administración; hoy usa los valores de TEINS |
| Miniaturas en resolución de impresión | Cuando el tamaño del PDF lo pida; hoy van las fotos recodificadas |
| Tablas de cantidades y bocetos en el PDF | Con sus iteraciones |
| Planos como imagen | Si TEINS no los tiene en PDF |

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Extremo a extremo: oficina compone el informe de una visita con un levantamiento revisado y un plano, lo publica y descarga el PDF | Cumplido en Chromium y WebKit, en local y contra el entorno (`e2e/pruebas/informe.spec.ts`) |
| 2. Publicar otra versión deja la anterior intacta y descargable (QA-9); la base no deja modificar una versión publicada | Cumplido en integración (permiso por columna) y en el extremo a extremo |
| 3. El PDF se genera en segundo plano, tiene los datos, las fotos y las páginas del plano, y no se vuelve a generar (QA-17) | Cumplido en integración con Chromium real (título, páginas del plano, huella estable) y en el worker de Railway |
| 4. Solo entran levantamientos revisados de la misma visita (regla 9) | Cumplido en dominio e integración |
| 5. Pantallas solo con componentes de `ui` y sus estados; reglas de arquitectura en verde | Cumplido |
| 6. Desplegado en el entorno de pruebas con el extremo a extremo en verde contra él | Cumplido el 2026-09-25, con la regresión de envío y revisión |

### Decisiones tomadas al construirlo

- **Falla del corte 2 encontrada aquí y corregida:** campo nunca mandaba `visitaId` en el envío, así que ningún levantamiento llegaba con su visita. Las pruebas del servidor armaban el comando a mano y las de campo no miraban su contenido. Ahora hay una prueba del comando en campo y el extremo a extremo del envío comprueba que oficina ve la visita. Los levantamientos ya recibidos sin visita siguen así: no se puede saber a qué visita pertenecían.
- **Uno por visita, abierto desde oficina:** "Abrir el informe de esta visita" crea el borrador si no existe (restricción única por organización y visita) y devuelve el mismo si ya existe.
- **Publicar reserva la versión del borrador:** el mismo `UPDATE … WHERE version = ?` del corte 3 evita que dos personas publiquen dos veces desde el mismo borrador. Lo que se publica es lo guardado; la pantalla guarda antes si hay cambios.
- **Copia congelada completa:** la versión guarda la definición del formato, las respuestas, los nombres de quien capturó y revisó, la visita, los textos y los planos. El PDF se arma solo desde ella.
- **Inmutabilidad en la base:** `informes.versiones` solo admite `INSERT` y `UPDATE` de las columnas del PDF (permiso por columna). Probado: modificar el contenido da "permission denied".
- **PDF en la cola `pdf`, de a uno, con 5 intentos:** al agotarlos queda "No se pudo generar el PDF" a la vista; un PDF listo nunca se vuelve a generar. La cola ahora le dice al manejador si es su último intento.
- **Plantilla:** HTML sin JavaScript ni red (Chromium con JavaScript apagado, sin conexión y con toda solicitud bloqueada), fuente Atkinson Hyperlegible Next y fotos incrustadas, tamaño carta, fechas en hora de Colombia fija. Marcadores `[LOGO]`, `[FIRMA]`, `[DATOS LEGALES]` y `[FOTO]` para lo que falta. Valores de marca de TEINS fijos hasta la configuración por organización (ADR-0020).
- **Planos:** solo PDF y solo desde oficina (campo solo sube JPEG), por el mismo camino de las fotos; el worker verifica que sea PDF. Se anexan con pdf-lib; la numeración "Página X de Y" del pie cuenta las páginas del informe, no las de los planos.
- **PDF guardado por su huella** junto a las fotos (`organizacion/sha256`), sin fila en `archivos.archivos`: la versión registra la huella.
- **Chromium en la imagen:** `apk add chromium` en Alpine, `CHROMIUM_RUTA=/usr/bin/chromium`. Probado dentro del contenedor (Chromium 152). La imagen pasa a 1,6 GB. En desarrollo y pruebas se usa el Chromium de Playwright 1.62.1, la misma versión del extremo a extremo.
- **`ui` crece:** `Casilla` y `SelectorDeArchivo`.

---

## Corte 5 · Portal del cliente

**Estado:** construido y desplegado en el entorno de pruebas el 2026-09-25.

**Para qué:** que el cliente de TEINS descargue el PDF vigente de sus informes con un QR y una clave, sin ver jamás nada de otro cliente aunque el código del portal tenga un error (QA-4, ADR-0009), y sin que se pueda adivinar una clave (QA-7). Con este corte queda completo el recorrido delgado.

### Alcance

**Acceso de cliente (ADR-0009, parte 4):** identificador aleatorio no adivinable y clave con hash (scrypt); el QR lleva la URL del portal con el identificador y nunca la clave. Se crea y se regenera por comando (no hay rol administrador todavía); regenerar invalida el QR anterior, la clave y todas las sesiones.

**Barrera en la base (ADR-0009, parte 3):** rol `teins_portal` con conexión propia. Solo lee las versiones publicadas con PDF listo del cliente de la sesión (seguridad por fila por organización y cliente) y las tablas del propio portal. No tiene permiso sobre levantamientos, usuarios, visitas ni nada más.

**Protección:** límite de intentos por identificador y por origen con espera creciente; sesión corta (30 minutos desde el último uso) en cookie `HttpOnly`, `Secure`, `SameSite=Strict`, en el host propio del portal. Cada ingreso y cada descarga quedan en la cadena de auditoría del acceso.

**Vigente:** por cada informe del cliente, la versión publicada más reciente con su PDF listo (ADR-0013: "publicada" y "visible para el cliente" son distintos).

**Portal (paquete `portal`, el más pequeño, ADR-0002):** ingreso (identificador precargado desde el QR), lista de informes vigentes con su descarga, salir; estados vacío, cargando, error y sin conexión.

**Despliegue:** cuarto servicio web `portal` en Railway con su dominio.

### Fuera del corte 5

| Qué | Dónde se resuelve |
|---|---|
| Pantalla de administración de accesos de cliente | Iteración de administración (con el rol administrador) |
| Versiones anteriores visibles para el cliente | Solo la vigente, por la regla 12; si TEINS las pide, se agregan |
| Retirar una versión del portal | Con el rol administrador |
| Aviso al cliente por correo de un informe nuevo | Después del piloto (ADR-0014) |

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Extremo a extremo: con el QR y la clave, el cliente ve su informe vigente y descarga el PDF | Cumplido en Chromium y WebKit, en local y contra el entorno (`e2e/pruebas/portal.spec.ts`, el recorrido delgado completo) |
| 2. Cero accesos cruzados (QA-4): un cliente no ve ni descarga informes de otro, ni adivinando identificadores; probado también directo en la base con el rol del portal | Cumplido en integración (API y base) y extremo a extremo |
| 3. Intentos fallidos bloquean con espera creciente por identificador y por origen (QA-7); la clave se guarda con hash | Cumplido en integración |
| 4. Regenerar el acceso invalida el identificador anterior, la clave y las sesiones abiertas | Cumplido en integración |
| 5. Ingresos y descargas quedan en la auditoría | Cumplido en integración, con la cadena verificada |
| 6. Desplegado en el entorno de pruebas con el extremo a extremo en verde contra él | Cumplido el 2026-09-25 (servicio `portal`) |

### Decisiones tomadas al construirlo

- **Conexión propia del portal:** el rol web abre una segunda conexión con `DATABASE_URL_PORTAL` (rol `teins_portal`) y todas las rutas del portal usan solo esa. Sin esa variable, el rol web no atiende el portal: en Railway solo el servicio `portal` la tiene.
- **Qué puede el rol del portal:** leer accesos (para el ingreso), manejar sus sesiones y su límite de intentos, registrar en la auditoría y leer `informes.versiones`, donde la seguridad por fila exige organización, cliente y PDF listo. Probado: con el rol del portal, la base no devuelve versiones de otro cliente ni sin cliente fijado, y niega levantamientos, usuarios, clientes, informes y visitas.
- **La versión guarda su cliente** al publicar (`cliente_id`); las publicadas antes se completaron desde su visita en la migración.
- **Accesos:** identificador de 20 caracteres (unos 99 bits) y clave de 12 en grupos de cuatro (unos 59 bits), sin caracteres que se confunden; la clave se puede escribir en minúsculas o sin guiones. scrypt con sal propia. Un identificador desconocido se verifica igual contra un hash de relleno: la respuesta no revela si existe.
- **Límite de intentos:** desde el quinto fallo con un identificador o el vigésimo desde un origen, espera de 1, 2, 4… minutos hasta una hora; los fallos se olvidan tras una hora. Mientras dura la espera, ni la clave correcta entra.
- **Sesión:** token aleatorio en cookie `__Host-teins-portal` (`HttpOnly`, `Secure`, `SameSite=Strict`, en producción); la base guarda su huella. 30 minutos desde el último uso. La cookie de oficina no sirve en el portal.
- **Vigente para el cliente:** la versión más reciente con PDF listo; mientras la nueva genera su PDF, el cliente sigue viendo la anterior.
- **Auditoría del acceso:** cadena por acceso de cliente con `acceso_cliente_creado`, `acceso_cliente_regenerado`, `ingreso_portal` y `descarga_portal`. Los fallos de ingreso no van a la cadena (un ataque la llenaría); quedan en el límite de intentos.
- **Comandos:** `crear-acceso-cliente` y `regenerar-acceso-cliente` muestran una sola vez el identificador, la clave y la URL, e imprimen el QR en la terminal (sirve por `railway ssh`); con `--qr` lo guardan como SVG. Dependencia nueva: `qrcode` (MIT).
- **Portal mínimo:** React, TanStack Query y `ui`, sin enrutador ni service worker; 111 KB de JavaScript comprimido, casi todo el validador del contrato. Escala de tokens de campo, porque el cliente llega desde el celular con el QR.
- **Pruebas en paralelo y cola compartida:** `procesarCola` de las pruebas repite hasta que no quede trabajo listo ni en curso; el PDF, lento y de a uno, hizo visible una carrera entre archivos de prueba.

---

## Iteración 6 · Administración

**Estado:** terminada y desplegada el 2026-09-25 (Kevin pidió avanzar con la siguiente iteración; administración era la recomendada).

**Para qué:** que TEINS opere el piloto sin comandos: una persona administradora, con segundo factor obligatorio (ADR-0009), gestiona usuarios, ve la salud de los teléfonos (ADR-0017), entrega los accesos de sus clientes con su QR y retira una versión del portal si hace falta.

### Alcance

- **Administrador = persona de oficina con la marca `administrador`.** El modelo de dominio dice que los roles son un conjunto asignable; en TEINS quien administra también revisa, así que no necesita dos cuentas. La primera persona administradora se marca por comando.
- **Segundo factor obligatorio (ADR-0009):** TOTP con el plugin de Better Auth (app autenticadora y códigos de respaldo). Sin segundo factor activo, ninguna acción de administración responde; la pantalla guía la activación. El ingreso pide el código después de la contraseña.
- **Usuarios:** lista, crear (técnico u oficina, con contraseña temporal que se muestra una vez), restablecer contraseña, desactivar (revocación del corte 2), marcar o quitar administrador.
- **Dispositivos (ADR-0017, parte 3):** panel con la salud de cada teléfono (versión de la app, pendientes y el más antiguo, espacio, persistente, último error, último contacto, orden de borrado) y alerta de pendientes viejos.
- **Accesos de clientes:** lista de clientes con su acceso; crear o regenerar muestra una vez código, clave y QR.
- **Retirar una versión del portal** (modelo de dominio, estado "versión retirada"): con motivo, queda en la auditoría; el cliente pasa a ver la anterior vigente.

### Fuera de la iteración 6

| Qué | Dónde se resuelve |
|---|---|
| Crear y programar clientes, sitios y visitas desde oficina | Iteración de gestión de visitas y clientes (la siguiente recomendada) |
| Editar formatos y catálogo | Cuando TEINS lo pida (P10) |
| Passkeys | Iteración 13 |
| Rol supervisor | Cuando TEINS defina qué hace |

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Una persona administradora sin segundo factor no puede administrar; lo activa y desde entonces el ingreso le pide el código | Cumplido en integración (`pruebas/administracion.test.ts`) y extremo a extremo por la interfaz (`e2e/pruebas/administracion.spec.ts`) |
| 2. Extremo a extremo: la administradora crea un técnico, ve su teléfono en el panel tras la primera sincronización, crea el acceso de un cliente con QR y retira una versión del portal | Cumplido en Chromium y WebKit en local y en Chromium contra el entorno (`administracion.spec.ts`; el retiro, al final de `portal.spec.ts`) |
| 3. Oficina sin marca de administrador y técnicos no acceden a nada de administración | Cumplido en integración (403 `sin_permiso`; un técnico tampoco puede activar el segundo factor) |
| 4. Cada acción queda en la auditoría | Cumplido en integración: creación, restablecimiento, desactivación, marca, activación del segundo factor y retiro con su motivo |
| 5. Desplegado en el entorno de pruebas con el extremo a extremo en verde contra él | Cumplido el 2026-09-25 (migraciones 0011 y 0012 aplicadas por `campo`) |

### Decisiones tomadas al construirlo

- **Marca, no rol nuevo:** columna `administrador` en `identidad.usuarios`, solo con efecto para oficina (un técnico marcado por error no administra). La política `administrador` exige rol oficina, la marca y el segundo factor activo; sin segundo factor responde `segundo_factor_requerido` (403) y la pantalla guía la activación. Nadie se quita la marca a sí mismo ni se desactiva a sí mismo: así la organización no se queda sin quien administre. La primera persona administradora se marca con `marcar-administrador`.
- **Segundo factor con el plugin `twoFactor` de Better Auth:** TOTP (SHA-1, 6 dígitos, 30 s, emisor "TEINS") y 10 códigos de respaldo, cifrados con `AUTH_SECRETO` en `identidad.segundos_factores`. El factor no cuenta hasta confirmarlo con un código. Con el factor activo, la contraseña sola no crea sesión: responde `twoFactorRedirect` con una cookie de desafío de 10 minutos y la sesión nace al verificar. Cinco códigos equivocados invalidan el desafío; diez seguidos bloquean la cuenta 15 minutos. Las rutas `/two-factor/*` tienen el mismo límite por origen que el ingreso (`INICIOS_DE_SESION_POR_MINUTO`). Sin "recordar este dispositivo".
- **Solo oficina activa el segundo factor:** campo no sabe pedir el código, así que un técnico que lo activara quedaría por fuera; el servidor lo rechaza (403).
- **Un solo campo para el código** en el ingreso: seis dígitos van a la app autenticadora; cualquier otra cosa se prueba como código de respaldo.
- **Contraseñas temporales** de 16 caracteres (96 bits) generadas en el servidor y mostradas una sola vez; restablecer cierra las sesiones del usuario. El nombre de usuario es único en todo el sistema (con él se inicia sesión).
- **Retirar una versión** escribe solo tres columnas nuevas (`retirada_en`, `retirada_por`, `motivo_retiro`) con permiso de columna; la copia congelada sigue sin permiso de escritura (probado). La barrera del portal en la base exige además `retirada_en is null`, así que el cliente pasa a ver la versión anterior sin retirar, o nada. Retirar es definitivo: para volver a entregar se publica una versión nueva (regla 10). En oficina, "vigente" es la más reciente sin retirar.
- **Accesos de clientes desde oficina** con el mismo código del comando (`crearAccesosDeClientes`) y la URL de `PORTAL_URL`; el QR lo dibuja oficina en el navegador (`qrcode`, cargado solo al necesitarlo) y se puede descargar como SVG.
- **Panel de teléfonos:** alerta cuando el pendiente más antiguo lleva más de un día sin subir y cuando el almacenamiento no es persistente; se relee cada minuto.
- **Auditoría:** `usuario_creado`, `contrasena_restablecida`, `usuario_desactivado`, `administrador_cambiado`, `segundo_factor_activado` y `segundo_factor_desactivado` en la cadena de cada usuario; `version_retirada` con su motivo en la del informe; accesos como en el corte 5.
- **Oficina se prueba en escritorio:** en el viewport de celular el encabezado de oficina desborda (oficina se usa en monitor, `docs/diseno/pendientes.md`); las pruebas de oficina usan 1366 × 900.

---

## Iteración 7 · Gestión de visitas y clientes

**Estado:** terminada y desplegada el 2026-09-25 (Kevin aceptó la recomendación: "Ok. Hazlo").

**Para qué:** que oficina programe el trabajo de campo sin comandos: clientes con sus sitios, visitas con fecha, motivo y técnicos, y los cambios de agenda (reasignar, reprogramar, cancelar) llegando solos a los teléfonos por la bajada del corte 2.

### Alcance

- **Quién:** cualquier persona de oficina (programar es trabajo de oficina, no de administración). Supuesto de P2 vigente: oficina programa y asigna; el técnico no crea visitas.
- **Clientes:** lista con sus sitios; crear un cliente con su primer sitio; agregar sitios. Datos mínimos (regla 18): nombre del cliente, nombre y dirección del sitio.
- **Visitas:** lista en tres vistas (próximas, anteriores, canceladas) con técnicos y avance deducido de sus levantamientos (modelo de dominio, sección 5); programar (cliente, sitio, motivo, fecha, técnicos); reasignar técnicos (regla 17); reprogramar fecha y motivo; cancelar con motivo, el único estado explícito.
- **Campo:** una visita cancelada sale del teléfono como una reasignada; si ya tenía levantamientos empezados, se conservan y se pueden enviar (regla 17), con el aviso "Oficina canceló esta visita".
- **Concurrencia:** cada cambio de una visita lleva la versión que se tenía abierta; si otra persona la cambió antes, se rechaza (QA-25).
- **Auditoría:** cliente creado, sitio agregado, visita creada, reasignada, reprogramada y cancelada.

### Fuera de la iteración 7

| Qué | Dónde se resuelve |
|---|---|
| Corregir el nombre de un cliente o la dirección de un sitio | Cuando TEINS lo pida; exige avisar a los teléfonos con visitas de ese sitio |
| Contactos del cliente | Cuando TEINS diga qué datos necesita el técnico (regla 18) |
| Calendario semanal o por técnico | Después del piloto, si la lista no alcanza |
| Visita no programada creada en campo | Solo si TEINS responde P2 distinto al supuesto |
| Aviso push de visitas nuevas | Después del piloto (ADR-0014) |

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Extremo a extremo: oficina crea un cliente con su sitio, programa una visita y el técnico la ve en su teléfono; la reprograma y el teléfono muestra la fecha nueva; la cancela y sale del teléfono | Cumplido en Chromium y WebKit en local y en Chromium contra el entorno (`e2e/pruebas/programacion.spec.ts`) |
| 2. Reasignar y cancelar conservan los levantamientos empezados, que se pueden enviar | Cumplido en integración (`pruebas/visitas.test.ts`: envío a una visita reasignada y cancelada) y en campo (`motor.test.ts`: la visita cancelada con algo empezado se queda con su motivo) |
| 3. Dos personas cambiando la misma visita: la segunda recibe "otra persona la cambió" | Cumplido en integración (409 `conflicto_de_version`) |
| 4. Técnicos no programan; nada cruza organizaciones; cada cambio queda en la auditoría | Cumplido en integración, con las cadenas de cliente y de visita verificadas |
| 5. Desplegado en el entorno de pruebas con el extremo a extremo en verde contra él | Cumplido el 2026-09-25 (migración 0013 aplicada por `campo`) |

### Decisiones tomadas al construirlo

- **Cancelar reutiliza la salida del alcance** del corte 2: el teléfono ya sabe retirar una visita y conservarla si tiene algo empezado. La bajada agrega `motivo` (`reasignada` o `cancelada`) a `fuera_de_alcance`, como expansión (ADR-0015): una app anterior no lo lee y muestra "se asignó a otra persona"; la nueva dice "Oficina canceló esta visita". La versión de la app no cambia (sigue en 3).
- **Una visita cancelada no vuelve a los teléfonos:** `asignadas` la excluye aunque luego llegue otro cambio, y no se puede reasignar, reprogramar ni volver a cancelar (`estado_invalido`). Cancelar es definitivo; si hace falta, se programa otra. Los levantamientos de una visita cancelada se siguen recibiendo (regla 17) y cuentan en su avance.
- **Reprogramar** cambia fecha y motivo y avisa a los técnicos asignados con un cambio de la visita; el teléfono la reemplaza en la siguiente bajada.
- **Concurrencia:** reasignar, reprogramar y cancelar llevan la versión de la visita (la columna ya existía); con otra versión, `conflicto_de_version` (409) con `versionActual`. El formulario queda abierto y reintenta con la versión recién leída. El comando `reasignar-visita` sigue sin versión.
- **Avance deducido** con un conteo por estado que aporta `levantamientos` (`conteosPorVisita`). `visitas` no importa `levantamientos` (sería un ciclo, porque `levantamientos` usa `visitas`): recibe esa función al componer el rol web en `app.ts`.
- **Técnicos asignables:** solo técnicos activos de la organización, validados en el servidor contra `identidad.tecnicosActivos`; nueva operación `listarTecnicos` para oficina.
- **Vistas:** "próximas" desde hoy (fecha del navegador, que envía oficina en la consulta: el servidor no supone zona horaria), completas y por fecha ascendente; "anteriores" y "canceladas", las 100 más recientes. Índice nuevo por organización y fecha.
- **Motivo:** en oficina, las tres opciones del lenguaje común (mantenimiento, cotización, modificación); el contrato lo sigue aceptando como texto, por las visitas que ya existían.
- **Componentes nuevos en `ui`:** `CampoSeleccion` (lista nativa, para clientes y sitios) y fecha en `CampoTexto`.
- **Auditoría:** `cliente_creado` y `sitio_agregado` en la cadena del cliente; `visita_reprogramada` (antes y después) y `visita_cancelada` (con su motivo) en la de la visita, junto a las que ya existían.

---

## Iteración 8 · Producción provisional, copias y simulacro

**Estado:** terminada el 2026-09-25; producción provisional montada y respaldada, sin datos reales (ADR-0021). Kevin pidió subir la rama y montar producción con un dominio gratuito mientras TEINS no tiene dominio ni cuenta; eligió un proyecto aparte y transferible, sin datos reales hasta la transferencia (ADR-0021), y abrir un pull request en borrador para que corra la integración continua.

**Para qué:** que producción exista, se pueda recrear desde el repositorio y tenga copias probadas antes del piloto, de modo que el día que TEINS tenga cuenta solo haya que transferirla (ADR-0016, QA-10, QA-18). Procedimiento completo en [`produccion.md`](produccion.md).

### Alcance

- Rama `corte-0` en GitHub con la integración continua en verde (pull request #1, en borrador).
- `.railway/railway.ts`: infraestructura como código de Railway, la misma para pruebas y producción, sin secretos.
- `infra/railway/montar.sh`: monta un entorno desde cero (secretos generados sin mostrarse, roles, dominios gratuitos, despliegue, copias y primera persona administradora).
- Copias en los cuatro niveles de ADR-0016: recuperación a un punto en el tiempo y copias del volumen (Railway); servicio `respaldos` con volcado diario y copia de archivos a otro proyecto y otra región; simulacro con verificación de cadenas y archivos (`infra/respaldos/simulacro.sh`, `verificar-integridad`).

### Fuera de la iteración 8

| Qué | Dónde se resuelve |
|---|---|
| Destino de los respaldos en otro proveedor (nivel 2 completo) | Cuando Kevin o TEINS abran una cuenta compatible con S3; solo cambian variables |
| Dominio propio | Cuando TEINS lo tenga; se agrega junto al de Railway |
| Datos reales | Después de transferir a TEINS o con su autorización escrita (ADR-0021) |
| Despliegue automático desde GitHub | Al fusionar a `master` (ADR-0016: pruebas automático, producción con aprobación) |

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. La rama está en GitHub y la integración continua pasa completa | Cumplido el 2026-09-25: pull request #1, los cinco trabajos en verde (tipos y reglas, secretos, servidor con PostgreSQL y S3, imagen, extremo a extremo) |
| 2. `railway config plan` no muestra diferencias después de aplicar | Cumplido el 2026-09-25 en pruebas y en producción ("already up to date") |
| 3. Producción montada con `montar.sh`, con dominios gratuitos, y verificada | Cumplido el 2026-09-25: las tres superficies responden, la primera persona administradora entra y administrar le exige el segundo factor. Se verificó con una prueba de humo, no con el extremo a extremo: este crea usuarios, clientes y visitas ficticios, y producción debe quedar limpia |
| 4. El servicio `respaldos` corre en pruebas y en producción y deja el volcado y los archivos en `teins-respaldos` | Cumplido el 2026-09-25 en los dos entornos (volcado con su SHA-256 y archivos copiados) |
| 5. Simulacro correcto contra la copia real de cada entorno, anotado en `produccion.md` | Cumplido el 2026-09-25: pruebas (75 cadenas y 23 archivos) y producción (2 cadenas); en local detectó 4 fotos que ya faltaban en el origen |

### Decisiones tomadas al construirlo

- **Infraestructura como código de Railway** (`.railway/railway.ts`, paquete `railway`, MIT) y no `railway.json`: el formato anterior deja de leerse el 2026-12-01. Las conexiones se arman con referencias (`${{Postgres.PGHOST}}`, `${{teins-pruebas.ENDPOINT}}`, `${{portal.RAILWAY_PUBLIC_DOMAIN}}`); los secretos quedan como `preserve()`. El plan contra pruebas mostró que el archivo reproduce el proyecto: solo cambian los dominios escritos a mano por referencias equivalentes y salen cuatro variables de host que cada servicio no usaba.
- **Un solo archivo para los dos proyectos:** `ctx.projectName` elige el almacenamiento y quita `ENTORNO_DE_PRUEBAS` en producción, así que `sembrar` nunca corre allí.
- **Secretos por la entrada estándar:** `montar.sh` los genera con `openssl` y los fija con `railway variable set --stdin`; las contraseñas de los roles se aplican dentro del contenedor de Postgres. Nada queda en la terminal ni en el repositorio.
- **Respaldo con `pg_dump` y `rclone`** (MIT) en una imagen propia sobre `postgres:18-alpine`: el volcado se lee con `pg_restore --list` antes de subirlo y viaja con su SHA-256; los archivos se copian con `--immutable` (nunca se reemplaza ni se borra nada en el destino). Retención de volcados: 35 días.
- **Destino en otro proyecto y otra región** (`teins-respaldos`, US West) mientras no haya cuenta de otro proveedor: sobrevive a que se borre producción, no a perder la cuenta (lo dice ADR-0021).
- **Simulacro verificable:** restaura en un PostgreSQL desechable con los roles de `infra/roles.sql`, verifica todas las cadenas de la auditoría con el código del servidor y compara los archivos referenciados con los copiados. Corre en el computador de quien lo lanza con `railway run`, que le pasa las credenciales sin mostrarlas. Usa una carpeta temporal bajo `~/.cache`, porque Colima y Docker Desktop no siempre comparten `/tmp` con los contenedores.
- **Contraseñas de los roles:** la primera corrida de `montar.sh` en pruebas dejó vacías las contraseñas de `teins_app` y `teins_portal`: el contenedor de Postgres no veía las variables, porque se agregaron después de que arrancó (un contenedor solo ve las que tenía al desplegarse). Las conexiones abiertas siguieron funcionando y el único despliegue que falló (campo) no reemplazó al anterior; se corrigió desde el contenedor del portal, tomando cada contraseña de su conexión ya resuelta. Desde entonces `montar.sh` redespliega Postgres si no ve las contraseñas y nunca aplica una vacía.
- **Región de la base:** el `apply` inicial creó el Postgres de producción en `us-west2` (la región por defecto del espacio de trabajo), lejos de los servicios en `us-east4`. El plan lo detectó y se movió con la base casi vacía y respaldada; los datos se verificaron después (ingreso y cadenas íntegras). `respaldos` sigue en `us-west2`: Railway no aplica la región declarada a un servicio programado; el volcado cruza de región una vez al día.
- **Archivo de la recuperación a un punto en el tiempo:** Railway elige su región al activarla (`iad` en pruebas, `sjc` en producción) y no se puede cambiar; el archivo la declara por proyecto.
- **Organización de producción:** producción nunca se siembra, así que la crea el comando nuevo `crear-organizacion` (mismo identificador que en pruebas, nombre "TEINS").
- **Copias programadas del volumen:** con el plan Hobby, Railway no deja programarlas; queda la recuperación a un punto en el tiempo, y `montar.sh` lo avisa sin detenerse.
- **Correr un respaldo ya:** `infra/respaldos/ahora.sh` (la API de Railway ejecuta el servicio programado sin esperar a su hora).
- **Pruebas del PDF bajo carga:** esperar los PDF por tiempo (hasta 90 s, procesando la cola) y no por 20 vueltas: un PDF que falla una vez bajo carga vuelve a la cola segundos después (`esperarPdf` en las pruebas del servidor).
- **Integración continua:** el trabajo del servidor instala el Chromium de `playwright-core` (sin él no se generaban los PDF), y gitleaks recibió permiso para leer el pull request.

---

## Iteración 9 · Secciones repetibles

**Estado:** terminada y desplegada en el entorno de pruebas el 2026-09-25 (Kevin: "Yes. start.", después de validar el iPhone); falta la prueba en el iPhone. Producción sigue con la versión anterior hasta que Kevin decida actualizarla.

**Para qué:** que un formato tenga secciones que el técnico repite cuantas veces haga falta (pisos, áreas, tableros), cada una con su nombre y los mismos campos (F2 en `01-impulsores.md`; ADR-0006 ya reserva `repetible` en el formato). Los formatos reales de TEINS casi seguro lo necesitan: con esto, llegan como datos y no como código (QA-11).

### Alcance

- **Formato:** una sección puede declarar `repetible: { etiqueta, min, max }`, por ejemplo `{ "etiqueta": "Tablero", "min": 0, "max": 20 }`. El meta-esquema lo valida y exige `appMinima` 4: una app anterior no lo recibe (ADR-0015, punto 4).
- **Campo (app 4):** en una sección repetible, "Agregar tablero", cada repetición con su nombre (por defecto "Tablero 1", "Tablero 2"; se puede cambiar) y "Quitar" con confirmación. El levantamiento nace con las `min` repeticiones.
- **Validación, en el teléfono y en el servidor:** cada repetición con sus campos obligatorios, y el número de repeticiones entre `min` y `max`.
- **Oficina:** revisa y corrige cada repetición por separado; el historial dice en cuál ("Tableros · Tablero 2 · Corriente nominal"). Oficina no agrega ni quita repeticiones: eso es captura.
- **Informe y PDF:** cada repetición con su nombre, en orden.

### Fuera de la iteración 9

| Qué | Dónde se resuelve |
|---|---|
| Secciones repetibles dentro de otra repetible (pisos con áreas) | Cuando un formato real de TEINS lo pida |
| Reordenar repeticiones | Cuando TEINS lo pida; hoy quedan en el orden en que se agregan |
| Bocetos | Iteración siguiente (ADR-0019) |

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Extremo a extremo: el técnico agrega dos tableros, los llena y envía; oficina ve los dos con su nombre, corrige uno y el historial dice cuál; el PDF los muestra en orden | Cumplido el 2026-09-25 en Chromium y WebKit en local y en Chromium contra el entorno (`e2e/pruebas/repeticiones.spec.ts`); el orden en el PDF, en integración (`pruebas/repeticiones.test.ts`) |
| 2. Un formato con sección repetible no llega a una app anterior, y una definición inválida no se publica | Cumplido en integración (la bajada con app 3 no lo trae; sin `appMinima` 4 no se publica) |
| 3. El servidor rechaza repeticiones de menos o de más, campos obligatorios vacíos en una repetición y claves de repetición que no existen | Cumplido en integración y en `dominio` |
| 4. Los formatos y levantamientos sin secciones repetibles funcionan igual que antes | Cumplido: toda la suite anterior en verde (17 de 17 en el extremo a extremo, más el salto conocido) |
| 5. Probado en el iPhone | Pendiente: fase 9 de [`verificacion-manual.md`](verificacion-manual.md) |

### Decisiones tomadas al construirlo

- **Cómo se guardan las respuestas:** cada repetición es una clave más del mismo mapa de respuestas, `seccion~id` (por ejemplo `tableros~k3f9x2ab`), y el levantamiento lleva aparte la lista ordenada `repeticiones` con el id y el nombre de cada una. Se descartó guardar un arreglo por sección: cambiaba la forma de las respuestas en todo el sistema y la ruta de una corrección dependería de la posición, que cambia al quitar una repetición. Con un id estable, la auditoría y las correcciones siguen diciendo `seccion.campo`, y las fotos, la validación y el almacenamiento casi no cambian. `~` no es válido en una clave de sección, así que nunca choca.
- **App 4:** `campo` sube a `VERSION_APP = 4`. El meta-esquema exige `appMinima` 4 a todo formato con secciones repetibles, así que la bajada nunca se lo entrega a una app anterior (probado). Un levantamiento sin secciones repetibles viaja igual que antes: el comando solo lleva `repeticiones` si las tiene (ADR-0015, expansión).
- **Ids de repetición:** 8 caracteres en base 36 al azar, generados en `campo`; `dominio` sigue siendo TypeScript puro y los recibe como parámetro. El levantamiento nace con las `min` repeticiones.
- **Nombres:** por defecto "Tablero 1", "Tablero 2"; al agregar se usa el primer número libre, así que quitar "Tablero 2" y agregar otro no repite un nombre. Un nombre vacío no se guarda: se conserva el anterior.
- **Quitar** pide confirmación y borra las respuestas de esa repetición; las fotos quedan en el teléfono hasta que nada las use, como siempre.
- **Oficina** ve cada repetición como una sección con su nombre y, si la sección quedó vacía, "El técnico no agregó ninguno". Corrige y comenta solo en repeticiones que existen; el servidor rechaza una clave de repetición que no está en la lista. La auditoría guarda la ruta con el id (`tableros~id.ubicacion`) y oficina y campo la muestran con el nombre ("Tableros · Tablero 2 · Ubicación del tablero").
- **Límites:** hasta 50 repeticiones por sección si el formato no pide menos; nombre de hasta 120 caracteres. `LIMITES` pasó a su propio archivo en `dominio` para no crear un ciclo entre `levantamiento` y `validacion`.
- **Formato de prueba v4:** `prueba-ups` v3 más la sección repetible "Tableros" (0 a 10, con ubicación y corriente obligatorias y una foto opcional). Con mínimo 0, los recorridos existentes no cambian.

---

## Iteración 10 · Bocetos

**Estado:** terminada y desplegada en el entorno de pruebas el 2026-09-25 (Kevin: "We can have the validation on stand by. Continue with the next step"); la prueba en iPhone, de esta y de la iteración 9, queda en espera. Producción sigue con la versión anterior.

**Para qué:** que el técnico dibuje en el teléfono, sobre cuadrícula, el croquis que hoy hace en papel (P14, F3), y que llegue nítido a oficina y al PDF. Las decisiones grandes ya están en ADR-0019: trazos vectoriales propios con perfect-freehand, seis herramientas, y subida al enviar.

### Alcance

- **Formato:** tipo de campo `boceto` (ADR-0006). Exige app 5 (`appMinima` 5).
- **Campo (app 5):** el campo muestra la miniatura y abre el editor a pantalla completa: trazo libre, línea recta, texto, borrador por trazo, deshacer y rehacer, cuadrícula; lápiz con presión y rechazo de la palma; zoom y desplazamiento con dos dedos. Cada trazo se guarda al terminarlo, sin conexión.
- **Archivo:** el boceto es un documento JSON (trazos, líneas y textos) guardado como archivo inmutable direccionado por su huella (ADR-0007), igual que una foto. La respuesta guarda `{ boceto: huella }`. A diferencia de las fotos, sube solo cuando el levantamiento se envía (ADR-0019, parte 3).
- **Servidor:** acepta el tipo de archivo del boceto, verifica su estructura en el worker y lo exige completo antes de registrar el envío (QA-2).
- **Oficina y PDF:** el boceto se ve como imagen vectorial; no se corrige desde oficina (como las fotos).

### Fuera de la iteración 10

| Qué | Dónde se resuelve |
|---|---|
| Formas, capas, escalas y medición | Fuera de alcance por ADR-0019 (terreno del plano de oficina) |
| Dibujar sobre una foto | Cuando TEINS lo pida |
| Probar el lápiz en tabletas reales | Prueba en dispositivo, junto con la del iPhone |

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Extremo a extremo: el técnico dibuja un trazo, una línea y un texto, deshace y rehace, envía; oficina ve el boceto y el PDF lo incluye | Cumplido el 2026-09-25 en Chromium y WebKit en local y en Chromium contra el entorno (`e2e/pruebas/bocetos.spec.ts`, hasta publicar el informe) |
| 2. El boceto no sube mientras es borrador; sube al enviar y el envío espera a que esté verificado | Cumplido en campo (`repositorio.test.ts`, `motor.test.ts`) y en integración (`pruebas/bocetos.test.ts`) |
| 3. El servidor rechaza un boceto con estructura inválida y un formato con bocetos sin `appMinima` 5 | Cumplido en integración |
| 4. Lo anterior sigue igual: toda la suite en verde y el presupuesto de campo respetado | Cumplido: 19 de 19 en el extremo a extremo (más el salto conocido); campo en 114,1 KB de 120 |
| 5. Probado en el iPhone (y con lápiz, si hay una tableta) | Pendiente: fase 10 de [`verificacion-manual.md`](verificacion-manual.md), en espera por decisión de Kevin |

### Decisiones tomadas al construirlo

- **El boceto es un archivo, como una foto:** documento JSON (`formato: "teins-boceto"`, versión 1) con lienzo lógico de 1000 × 750 (4:3), cuadrícula de 25 y tres clases de elemento: trazo, línea y texto. La respuesta guarda `{ boceto: huella }`; el documento vive en el archivo, direccionado por su huella (ADR-0007). La serialización es canónica (orden de claves fijo, un decimal), así que el mismo dibujo da siempre la misma huella.
- **El contorno se calcula en campo:** cada trazo guarda sus puntos (con presión) y el contorno que calcula perfect-freehand (MIT) al terminarlo. Así el SVG sale de una función pura de `dominio` (`bocetoASvg`) y oficina, el PDF y el componente `Boceto` de `ui` lo dibujan sin la biblioteca de dibujo; solo `campo` la usa.
- **Sube al enviar (ADR-0019, parte 3):** cada cambio guarda una versión nueva del archivo en el teléfono y borra la anterior si nada la usa; la cola de subidas solo toma los bocetos de levantamientos ya enviados. El envío espera, como con las fotos, a que el boceto llegue y se verifique (QA-2).
- **Verificación en el worker:** un boceto no tiene firma de tipo; se lee completo (hasta 2 MB) y se valida con `validarBoceto` de `dominio`. Solo campo sube bocetos (oficina, no); un contenido inválido se rechaza y se borra, como cualquier archivo.
- **Oficina lo pide al servidor ya verificado** (`GET /api/archivos/{huella}/boceto`) en vez de descargarlo del almacenamiento: no hace falta abrir CORS de lectura al bucket y nunca se dibuja algo sin validar. Un boceto no se corrige desde oficina, como las fotos.
- **Editor cargado aparte:** el editor (con perfect-freehand) es un fragmento propio de 4,5 KB comprimidos que se carga al tocar "Dibujar boceto"; el JavaScript inicial de campo quedó en 114,1 KB de 120.
- **Entrada:** trazo, línea, texto (se toca la hoja y se escribe), borrador por elemento (toque o arrastre), deshacer y rehacer (en memoria, durante la edición), zoom de 1× a 4× y desplazamiento con dos dedos. Rechazo de la palma: desde que aparece un lápiz, el dedo no dibuja.
- **App 5:** `campo` sube a `VERSION_APP = 5` y el meta-esquema exige `appMinima` 5 a un formato con bocetos. Formato de prueba v5: v4 más "Croquis del cuarto" (opcional).
- **Un error encontrado al probar:** el motor de sincronización pedía subir todo archivo como `image/jpeg`; el worker rechazaba el boceto (con razón) y el envío quedaba esperando. Ahora cada archivo sube con su tipo; lo cubre una prueba del motor.

---

## Iteración 11 · Cantidades con catálogo

**Estado:** terminada el 2026-09-25 y desplegada en el entorno de pruebas (formato de prueba v6 sembrado). Falta la prueba en iPhone (fase 11 de la guía), en espera con las de las iteraciones 9 y 10.

**Para qué:** que los materiales y trabajos que el técnico anota en campo no se vuelvan a digitar para cotizar: oficina los vincula al catálogo de TEINS, los suma por visita y los exporta a Excel (F9, P27, P28; reglas 6 y 7 del modelo de dominio).

### Alcance

- **Formato:** tipo de campo `cantidades` con sus unidades permitidas (`unidades`, como la medida). Exige app 6.
- **Campo (app 6):** tabla de líneas: descripción, cantidad (decimal, mayor que cero), unidad y observación opcional; agregar y quitar líneas. Texto libre: el técnico no elige del catálogo (regla 6).
- **Servidor:** al recibir el levantamiento, y después de cada corrección, las líneas se proyectan a una tabla relacional en la misma transacción (ADR-0006, parte 2). Allí vive el vínculo al catálogo. Una línea que desaparece se marca como quitada, nunca se borra (regla 14).
- **Catálogo:** pantalla de oficina para crear, editar y desactivar ítems (código, descripción, unidad) e importarlos en bloque desde CSV (TEINS ya tiene su lista, P28).
- **Revisión:** quien tiene la revisión corrige las líneas (con historial) y vincula cada una a un ítem del catálogo (queda en la auditoría).
- **Exportación:** por visita, dos CSV que Excel en español abre directo: el detalle de líneas y el resumen sumado por ítem de catálogo (o por descripción y unidad si no está vinculado). Sin precios (regla 7).
- **Informe:** la tabla de cantidades en el PDF.

### Supuestos mientras TEINS responde

| Pregunta | Supuesto |
|---|---|
| P28: ¿qué columnas tiene su catálogo? | Código, descripción y unidad |
| P29: ¿qué columnas necesita el Excel? | Visita, cliente, sitio, levantamiento, técnico, sección, descripción, cantidad, unidad, observación, código y descripción del catálogo; el resumen suma por ítem y unidad |

### Fuera de la iteración 11

| Qué | Dónde se resuelve |
|---|---|
| Sugerencias del catálogo en campo mientras se escribe | Cuando TEINS lo pida: exige bajar el catálogo al teléfono |
| Precios y presupuestos | Módulo futuro (QA-12); nunca en la línea de cantidad (regla 7) |
| Archivo .xlsx con formato | Cuando TEINS responda P29; mientras, CSV |

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Extremo a extremo: el técnico anota líneas y envía; oficina importa un catálogo, vincula una línea, corrige otra y exporta el detalle y el resumen de la visita; el PDF trae la tabla | Hecho: `e2e/pruebas/cantidades.spec.ts` en Chromium y WebKit en local, y en Chromium contra el entorno de pruebas; la tabla del PDF, en `servidor/pruebas/cantidades.test.ts` |
| 2. El servidor rechaza líneas sin descripción, con cantidad cero o con una unidad no permitida | Hecho: `cantidades_invalidas` en `dominio/src/cantidades.test.ts` y en el envío (`servidor/pruebas/cantidades.test.ts`) |
| 3. La tabla relacional sigue al documento: corregir agrega, cambia o marca quitadas las líneas y conserva los vínculos | Hecho: `servidor/pruebas/cantidades.test.ts` (proyección, corrección y exportación) |
| 4. Vincular solo lo hace quien tiene la revisión, y queda en la auditoría | Hecho: sin revisión responde `estado_invalido`, un ítem desactivado `entrada_invalida`, el técnico no ve el catálogo (403); `linea_vinculada` en la auditoría con el ítem anterior y el nuevo |
| 5. Lo anterior sigue igual y el presupuesto de campo se respeta | Hecho: verificación completa en el orden de la integración continua (dominio 73, protocolo 18, oficina 4, campo 41, servidor 89, extremo a extremo 21 y 1 omitida); campo 115,4 de 120 KB |

### Decisiones tomadas al construirlo

- **La cantidad es un decimal en texto** ("12.5"), mayor que cero, como la medida (ADR-0006): nada de coma flotante en lo que se cotiza. Campo y oficina aceptan "12,5" y guardan el canónico; lo que no se puede leer se guarda tal cual y la validación del envío lo marca (`cantidades_invalidas`).
- **Cada línea tiene un id de 8 caracteres** que genera quien la crea. El vínculo al catálogo y las correcciones siguen la línea por su id, no por su posición: reordenar o quitar otra línea no cambia a qué ítem está vinculada.
- **El vínculo no está en las respuestas, está en la proyección** (`levantamientos.lineas_cantidad`, clave levantamiento, sección, campo y línea). Lo que escribió el técnico no cambia al vincular; la proyección se actualiza en la misma transacción que el envío y que cada corrección, y una línea que desaparece queda marcada `quitada_en` con su vínculo (regla 14).
- **Vincular es una acción de revisión:** solo quien tiene la revisión, sube la versión del levantamiento (dos pestañas no se pisan, QA-25) y queda en la auditoría como `linea_vinculada` con el ítem anterior y el nuevo. Un ítem desactivado no se vincula, pero las líneas que ya lo tenían lo conservan.
- **Módulo `catalogo` propio** (esquema `catalogo`, RLS por organización), con interfaz pública `items(ids)`: levantamientos no lee su tabla. Un ítem nunca se borra; se desactiva. La importación actualiza por código (el último del archivo manda) y reactiva lo que estaba desactivado.
- **El CSV lo arma el navegador;** el servidor entrega los datos (`cantidadesDeVisita`). Punto y coma, coma decimal, BOM y CRLF para que Excel en español lo abra con doble clic. Una celda de texto libre que empieza por `=`, `+`, `-` o `@` lleva un apóstrofo delante: Excel no la ejecuta como fórmula.
- **La exportación incluye levantamientos sin revisar,** con un aviso: oficina puede querer cotizar antes de cerrar la revisión. El resumen suma por ítem y unidad; lo no vinculado, por descripción (sin distinguir mayúsculas ni espacios) y unidad.
- **Elegir el ítem es una lista nativa** con todos los activos ("C-12 · Cable THHN 12 AWG (m)"), sin filtrar por la unidad de la línea: el técnico puede escribir "und" donde el catálogo dice "UN". Si el catálogo real es de miles de ítems y la lista se vuelve lenta, se cambia por un buscador.
- **Contra el entorno de pruebas, un navegador y una prueba a la vez:** tres pruebas seguidas chocan con el límite de 5 inicios de sesión por minuto (QA-7) y la de repeticiones venció esperando la bandeja; sola pasó en 28 s.
- **oficina estrena pruebas unitarias** (`src/csv.test.ts`): la lectura del catálogo y la escritura de los CSV no se prueban bien solo de punta a punta.

## Iteración 12 · Cifrado local en campo

**Estado:** terminada el 2026-09-25 y desplegada en el entorno de pruebas (`cifrado.spec.ts` en Chromium contra el entorno, verde). Falta la prueba en iPhone (fase 12 de la guía), en espera con las de las iteraciones 9 a 11.

**Para qué:** que un teléfono perdido o copiado no entregue datos de clientes, y que la orden de borrado de un técnico revocado vuelva ilegible todo lo suyo al instante, aunque borrar cientos de fotos se interrumpa (ADR-0009, parte 5; QA-5; I-15).

### Alcance

- **Clave:** AES-GCM de 256 bits, no extraíble, una por técnico en el teléfono.
- **Sellado:** respuestas y repeticiones, fotos y bocetos, el comando del outbox, las visitas y los comentarios de oficina (ADR-0022, punto 1).
- **Migración sin pérdida:** lo guardado antes del cifrado se sella en segundo plano, registro por registro (regla 5).
- **Borrado por revocación:** primero la clave, después los registros; si se interrumpe, se termina antes de confirmarlo al servidor.
- **Diagnóstico:** "Datos cifrados: Todos" o cuántos faltan.

### Fuera de la iteración 12

| Qué | Dónde se resuelve |
|---|---|
| Cifrado en `oficina` y en el portal | No aplica: no guardan datos en el dispositivo |
| Clave ligada a la biometría del teléfono | Cuando la web lo permita (ADR-0022, "Cuándo revisarla") |
| Passkeys | Iteración 13 |

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. En la base del teléfono no se lee nada de lo capturado ni de la visita, en Chromium y WebKit, y todo se lee igual al volver a abrir y se envía | Hecho: `e2e/pruebas/cifrado.spec.ts` lee IndexedDB directamente; `campo/src/datos/cifrado.test.ts` recorre todas las tablas |
| 2. La clave no se puede exportar y un sellado copiado a otro registro no abre | Hecho: `cifrado.test.ts` |
| 3. Un teléfono con datos de la iteración 11 conserva todo: se cifra lo que tiene responsable, con su estado de subida y su envío; lo del corte 0 espera a su responsable | Hecho: `cifrado.test.ts`, migración de la versión 3 a la 4 |
| 4. La orden de borrado destruye primero la clave; interrumpida, deja todo ilegible y se termina; no le quita a otro técnico una foto compartida | Hecho: `cifrado.test.ts` y las pruebas de revocación del motor |
| 5. Escrituras seguidas o desde dos pestañas no se pisan y la última tecla es la que queda | Hecho: `cifrado.test.ts` |
| 6. Lo anterior sigue igual y el presupuesto de campo se respeta | Hecho: verificación completa en el orden de la integración continua (dominio 73, protocolo 18, oficina 4, campo 47, servidor 89, extremo a extremo 23 y 1 omitida); campo 117,2 de 120 KB |

### Decisiones tomadas al construirlo

- **Sellar fuera de la transacción y escribir con comprobación optimista** (ADR-0022): WebCrypto no cabe en una transacción de IndexedDB. Se descartaron `Dexie.waitFor` (consultas de relleno, frágil en Safari) y el cifrado síncrono en JavaScript (la clave quedaría legible en la base).
- **Las escrituras de un levantamiento van en fila dentro de la pestaña.** Solo con la comprobación optimista, ocho escrituras a la vez se estorbaban hasta agotar los reintentos, y una tecla vieja podía guardarse después de una nueva. La fila las pone en orden; entre pestañas decide la comprobación.
- **Las huellas de los archivos de cada levantamiento quedan a la vista**, junto al sellado: subir, borrar y decidir si otro usa una foto no exige abrir nada, y eso sí cabe en una transacción.
- **Índice `cifrado` en los archivos:** saber qué fotos faltan por sellar sin cargar los bytes de todas en memoria.
- **La migración no está en `upgrade` de Dexie** (no admite WebCrypto): la versión 4 solo agrega la tabla y el índice, y el sellado corre al abrir la app y al iniciar sesión. Se puede interrumpir y repetir.
- **Una foto compartida por dos técnicos pasa a la clave del otro** antes de destruir la del revocado: el borrado de uno nunca le quita datos al otro, como antes del cifrado.
- **Quedan 2,8 KB del presupuesto de campo** (117,2 de 120): la próxima iteración que toque campo empieza por revisar qué se puede cargar aparte, como ya se hizo con el editor de bocetos.
- **Las pantallas no saben del cifrado:** leen por el repositorio y por `datos/lecturas.ts`, que abren lo sellado dentro de `useLiveQuery`.

## Iteración 13 · Llaves de acceso (passkeys)

**Estado:** terminada el 2026-09-25 y desplegada en el entorno de pruebas (`llaves.spec.ts` en Chromium contra el entorno, verde). Falta la prueba en iPhone (fase 13 de la guía), en espera con las de las iteraciones 9 a 12.

**Para qué:** que el técnico entre con Face ID, huella o el PIN del teléfono en lugar de escribir una contraseña en campo, y que oficina pueda hacer lo mismo. Una llave de acceso no se puede suplantar desde otro sitio web (ADR-0009, parte 1: "passkey recomendada" para técnicos, opcional para oficina).

### Alcance

- **Servidor:** plugin de llaves de acceso de Better Auth (`@better-auth/passkey`, MIT) con la tabla `identidad.llaves_de_acceso`. Crear y quitar una llave queda en la auditoría.
- **Campo:** "Entrar con llave de acceso" en el inicio de sesión. Después de entrar con la contraseña, la app propone crear la llave ("Ahora no" la oculta en ese teléfono).
- **Oficina:** "Entrar con llave de acceso" y "Mi cuenta" (el nombre en el encabezado) para crear y quitar llaves.
- **Administración:** restablecer el acceso de una persona también quita sus llaves (teléfono perdido).

### Fuera de la iteración 13

| Qué | Dónde se resuelve |
|---|---|
| Autocompletar la llave en el campo de usuario (mediación condicional) | Cuando se vea en el iPhone si hace falta: el botón ya evita escribir |
| Llave como segundo factor sin TOTP para administrar | Se revisa si TEINS lo pide: hoy administrar exige el TOTP activo (respaldo si se pierde el teléfono) |
| Llave compartida entre campo y oficina | Con el dominio propio de TEINS (un solo `rpID` padre); hoy cada superficie tiene su dominio gratuito |

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Técnico y oficina crean una llave y entran sin contraseña | Hecho: `e2e/pruebas/llaves.spec.ts` (Chromium con autenticador virtual) y `servidor/pruebas/llaves-de-acceso.test.ts` (autenticador de software) |
| 2. Sin verificar a la persona (solo un toque) no se entra | Hecho: `llaves-de-acceso.test.ts` |
| 3. Un usuario desactivado no entra con su llave; restablecer el acceso invalida la llave del teléfono perdido | Hecho: `llaves-de-acceso.test.ts` |
| 4. Nadie quita la llave de otra persona; crear y quitar quedan en la auditoría | Hecho: `llaves-de-acceso.test.ts` |
| 5. Lo anterior sigue igual y el presupuesto de campo se respeta | Hecho: verificación completa en el orden de la integración continua (dominio 73, protocolo 18, oficina 4, campo 47, servidor 93, extremo a extremo 24 y 2 omitidas); campo 117,3 de 120 KB |

### Decisiones tomadas al construirlo

- **Una instancia de Better Auth por dominio de superficie.** Una llave queda ligada al dominio donde se creó (`rpID`), y el plugin solo lo toma de una URL base fija; la nuestra sale del host de cada solicitud (ADR-0016). Cada superficie tiene su instancia con su `rpID`; todas comparten la base, el secreto y las sesiones, y la solicitud va a la de su host. Consecuencia: la llave de campo no sirve en oficina y viceversa, hasta tener un dominio propio.
- **Siempre con verificación de la persona** (Face ID, huella o PIN): se exige al crearla y al entrar (el plugin solo la prefería). Así la llave vale por dos factores, como pide ADR-0009 para quien administra.
- **Detectable (`residentKey: required`):** se entra sin escribir el usuario.
- **El nombre que muestra el teléfono es el usuario** (`tecnico.prueba`), no el correo interno `usuario@<organización>.invalid`. Lo pone el servidor.
- **Un usuario desactivado no entra con su llave:** la regla ya vivía en la creación de la sesión (regla 13), por donde pasa también la llave.
- **Restablecer el acceso quita todas las llaves** de la persona y lo registra (`llavesQuitadas`): es lo que hace quien administra cuando alguien pierde el teléfono.
- **Administrar sigue exigiendo el TOTP activo.** Entrar con la llave cuenta como segundo factor (ADR-0009), pero el TOTP es el respaldo si se pierde el dispositivo con la llave.
- **La biblioteca del navegador (`@simplewebauthn/browser`, MIT) se carga solo al usar una llave:** 2,8 KB comprimidos fuera del JavaScript inicial de campo. La propuesta de crearla también se carga aparte.
- **Pruebas sin navegador:** un autenticador WebAuthn de software (`servidor/pruebas/autenticador.ts`, clave P-256 y el CBOR mínimo) prueba las reglas de seguridad en el servidor. WebKit no tiene autenticador virtual: esa parte se prueba en Chromium y en el iPhone.

## Iteraciones 15 a 21 · Plan acordado el 2026-09-26

**Por qué estas:** Kevin pidió funciones útiles en la vida real de TEINS; se investigaron aplicaciones de campo comparables (SafetyCulture, CompanyCam, magicplan, Bluebeam, software de mantenimiento de UPS) y se descartaron las que la plataforma no permite (medir con la cámara o LiDAR y medidores por Bluetooth: Safari no tiene WebXR ni Web Bluetooth) o que el teléfono ya resuelve (dictado por voz, que el teclado ya hace). Kevin eligió siete.

**Orden:** campo primero, porque Kevin quiere la PWA terminada. La 15 cierra lo último que le faltaba a la PWA (la instalación guiada) y monta los avisos; la 17 va antes de la 21 porque las líneas que llegan vinculadas vuelven casi automática la cotización; la 20 va antes de la 21 para enviar las cotizaciones por los mismos canales. Cada iteración empieza con maquetas en el lienzo, luego el ADR, el código, las pruebas de extremo a extremo y el despliegue en el entorno de pruebas. La prueba en iPhone de las iteraciones 9 a 14 sigue pendiente y es la que más riesgo reduce: cada iteración de campo se suma a ella.

| # | Qué | Versión de la app | Qué hace falta de fuera |
|---|---|---|---|
| 15 | Avisos push (Web Push con VAPID y el formato declarativo de Safari 18.4) e instalación guiada | Sin cambio de protocolo | Nada |
| 16 | Firma del cliente: tipo de campo `firma`, guardado como documento de boceto de solo trazos | 7 | TEINS confirma el texto de la constancia |
| 17 | Catálogo en la bajada; sugerencias, frecuentes y recientes al escribir; la línea lleva el ítem | 8 | Catálogo real de TEINS (P28); con el de prueba se construye |
| 18 | Mantener para enderezar (línea, polilínea, rectángulo, elipse), ajuste de ángulos y extremos, mover, rotar, duplicar, cota y flecha; documento de boceto versión 2 | 9 | Nada |
| 19 | Símbolos como datos (trazado SVG, nombre, categoría, código de catálogo opcional), publicados como los formatos y copiados dentro del boceto que los usa | 10 | Lista de símbolos de TEINS |
| 20 | Contactos del cliente; el informe publicado sale por correo (Resend, por HTTPS) y WhatsApp (Cloud API de Meta, plantilla de utilidad con el PDF) con estado por envío | Sin cambio | Cuenta de Resend y número de prueba de Meta para el entorno de pruebas; dominio de TEINS y cuenta de WhatsApp Business a su nombre para producción (R10) |
| 21 | Módulo de cotizaciones: lista de precios con historia, cotización desde las cantidades revisadas, IVA o AIU por cotización, versiones inmutables, PDF y envío | Sin cambio | Precios, plantilla (P29), tratamiento tributario y numeración |

**Decisiones de Kevin (2026-09-26):**

- **El informe se envía con el PDF adjunto** y el enlace al portal, no solo con el enlace: es lo que el cliente espera (P17). Consecuencia aceptada: "Retirar del portal" no recupera las copias ya enviadas, y el diálogo de retiro lo dirá.
- **La firma del cliente certifica la visita, no el contenido técnico:** oficina puede corregir medidas sin invalidarla, y firmar no bloquea el levantamiento.
- **El orden de la tabla.**

**Hallazgos que cambian el diseño:**

- **Railway bloquea SMTP en los planes Hobby y Free:** el correo sale por la API HTTPS del proveedor, no por SMTP.
- **El portal oculta una versión hasta que su PDF está listo:** el envío al cliente se encola cuando el PDF queda listo, no al publicar.
- **Los clientes no tienen contactos en ninguna parte** (solo `nombre`): la iteración 20 empieza por ellos. Para la SIC, los datos de contacto corporativos quedan fuera de la Ley 1581; Meta igual exige la autorización para WhatsApp, que se registra con quién y cuándo.
- **El AIU no aplica a la instalación ni al mantenimiento de redes eléctricas** según la doctrina de la DIAN: la cotización admite IVA sobre el subtotal o AIU con IVA sobre la utilidad, y el contador de TEINS decide en cada caso.
- **En iPhone, la app instalada no comparte datos con Safari** y los avisos solo llegan a la app instalada: la instalación va antes de iniciar sesión.
- **La biblioteca `web-push` es MPL-2.0,** que la verificación de licencias ya admite.

## Iteración 21 · Cotizaciones desde las cantidades

**Estado:** terminada el 2026-09-27, verificada en local y desplegada en el entorno de pruebas (ver "Terminado cuando"). Maquetas aprobadas por Kevin en el lienzo (página "v1.1 · Cotizaciones", "Sí, aprobadas"); decidió que los precios los cambia solo administración.

**Para qué:** de la visita revisada a una cotización con PDF y envío, sin volver a digitar las cantidades (P27, QA-12).

### Alcance

- **Lista de precios con historia (ADR-0029, parte 1):** en "Catálogo", la columna "Precio sin IVA" y el filtro "Solo los que no tienen precio"; "Cambiar precio" (solo administración con segundo factor) abre la hoja lateral con la historia. Importar el CSV con una columna de precio también es de administración; para el resto de oficina, el archivo entra sin precios y lo dice. Los precios nunca bajan al teléfono (regla 7).
- **Módulo `cotizaciones` (ADR-0029, parte 2):** "Cotizaciones" en la navegación. "Nueva cotización" elige una visita con levantamientos revisados; las líneas salen de sus cantidades, sumadas por ítem y unidad, con el precio vigente. Oficina cambia cantidad y precio por línea (se ve el del catálogo si lo cambió), agrega líneas (mano de obra), quita con "Deshacer", elige IVA sobre el subtotal o AIU con IVA sobre la utilidad, y fija validez, forma de pago y notas.
- **Pesos enteros:** el cálculo vive en el dominio, con `BigInt`; la pantalla y el servidor usan el mismo. Una línea sin precio impide publicar, y el aviso está junto a la línea.
- **Numeración `COT-{año}-{consecutivo}`,** por organización y año, sin repetirse.
- **Versiones inmutables con PDF** (cola `pdf`, carta, con la marca), y envío por correo como el informe (ADR-0028): cada contacto marca si recibe informes, cotizaciones o los dos, y al publicar se marcan quienes reciben cotizaciones.
- **La impresión a PDF pasó a `plataforma/pdf.ts`:** un módulo no importa las partes internas de otro.

### Fuera de la iteración 21

| Qué | Dónde se resuelve |
|---|---|
| Lista de precios, plantilla (P29), tratamiento tributario, forma de pago y numeración de TEINS | Cuando TEINS los entregue: la lista se importa por CSV (administración); la numeración cambia en `numeroDeCotizacion` |
| Estado comercial de la cotización (aceptada, rechazada) y su retiro | Si TEINS lo pide |
| Cotizaciones en el portal del cliente | Si TEINS lo pide: hoy el portal solo muestra informes |
| WhatsApp de la cotización (plantilla `cotizacion_publicada`) | Con la cuenta de Meta, como el del informe |
| Contar los símbolos del croquis como cantidades | Si TEINS lo pide: el código de catálogo ya viaja en cada símbolo puesto |
| Precios de prueba en `sembrar` | No hacen falta: el entorno de pruebas los pone administración desde "Catálogo" |

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Kevin aprueba las maquetas | Hecho el 2026-09-27 |
| 2. El cálculo es exacto en pesos enteros: línea, porcentajes, IVA, AIU con IVA sobre la utilidad, líneas sin precio, validación y numeración | Hecho: `dominio/src/cotizacion.test.ts` |
| 3. Solo administración cambia o importa precios; la historia se conserva y reimportar el mismo precio no la ensucia | Hecho: `servidor/pruebas/cotizaciones.test.ts` |
| 4. La cotización toma las cantidades revisadas con el precio vigente, se numera, no se publica sin precios, se publica congelada (cambiar la lista después no la toca; la base no deja modificarla) con su PDF, y su envío sale como cotización | Hecho: `servidor/pruebas/cotizaciones.test.ts` y `envios.test.ts` |
| 5. Extremo a extremo: administración pone el precio, el técnico anota el material, oficina revisa, crea la cotización, agrega mano de obra, elige AIU, publica y descarga el PDF, y el contacto de compras la recibe | Hecho en Chromium y WebKit (`e2e/pruebas/cotizaciones.spec.ts`) |
| 6. Lo anterior sigue igual | Hecho el 2026-09-27: tipos, arquitectura, licencias y auditoría en verde; dominio 103, protocolo 18, oficina 6, campo 80, servidor 134; extremo a extremo 40 y 3 omitidas en Chromium y WebKit (la de cotizaciones falló una vez en WebKit porque el nombre del PDF llega en forma NFD, como en macOS; la prueba ahora lo normaliza); campo sigue en 119,9 de 120 KB |
| 7. Desplegada en el entorno de pruebas | Hecho el 2026-09-27: el worker en `SUCCESS` (con `cotizaciones.generarPdf`) antes que la app; campo (que aplicó `0026` y `0027`), oficina y portal en `SUCCESS` y salud en 200. Contra el entorno, `cotizaciones.spec` e `informe-al-cliente.spec` en verde en Chromium, con el correo de la cotización saliendo por Resend |

### Decisiones tomadas al construirlo

- **Puede haber más de una cotización por visita** (alternativas); la hoja de "Nueva cotización" dice cuáles ya tiene.
- **El borrador guarda la cantidad y el precio de cada línea;** la versión publicada guarda además sus totales calculados, así el PDF y la lista no recalculan.
- **En pantallas de menos de 1600 px, los totales y la publicación van debajo de las líneas,** en dos columnas: la tabla de líneas no cabe al lado del panel a 1366 px.
- **Las pruebas del servidor de cotizaciones no procesan envíos:** la cola es compartida y el correo de la cotización se prueba en `envios.test.ts`.
- **Quitar una línea no pide confirmación:** se deshace con la notificación (DESIGN.md).

## Iteración 20 · Contactos del cliente e informe por correo y WhatsApp

**Estado:** construida el 2026-09-27 con los envíos simulados y verificada en local (ver "Terminado cuando"). Maquetas aprobadas por Kevin en el lienzo (página "v1.0 · Informe por correo y WhatsApp", "Sí, aprobadas"). Kevin eligió construir sin las cuentas externas: el correo y el WhatsApp reales esperan la clave de Resend y el número de prueba de Meta.

**Para qué:** que el informe publicado le llegue al cliente por correo y WhatsApp con el PDF adjunto (P17), y que oficina vea qué llegó y qué no.

### Alcance

- **Contactos del cliente (ADR-0028, parte 5):** el cliente tiene su pantalla (Clientes → el cliente) con sus contactos y sus sitios. Cada contacto: nombre, cargo, correo, celular y por qué canal recibe el informe. WhatsApp exige la autorización, que queda con quién de oficina la confirmó y cuándo; cambiar el celular la borra. La lista de clientes dice cuántos reciben el informe y avisa "Nadie".
- **Publicar con destinatarios:** el diálogo de publicar marca por omisión a todos los que reciben el informe; se puede desmarcar. Sin contactos, avisa que el informe solo quedará en el portal y lleva a agregarlos.
- **Envíos (módulo `envios`, ADR-0028):** una fila por contacto y canal, "En cola" al publicar; salen cuando el PDF queda listo, en la misma transacción que lo marca. Correo por Resend (HTTPS, idempotente, con el PDF adjunto y el enlace al portal); WhatsApp por la Cloud API de Meta con la plantilla `informe_publicado` y el PDF en el encabezado.
- **Estado de cada envío:** En cola, Enviado, Entregado y No llegó, con el motivo. Los eventos firmados de Resend (Svix) y de Meta (`X-Hub-Signature-256`) llegan a `/api/envios/eventos/correo` y `/api/envios/eventos/whatsapp`. Un rebote marca el correo del contacto. Lo que no llega avisa por push a quien lo pidió y se marca en la bandeja de Informes ("Envío sin entregar").
- **Volver a enviar y enviar a otro contacto** desde el panel "Envíos de la versión N"; el intento anterior se conserva.
- **Retirar del portal** dice a quién ya le llegó una copia, porque no se recupera.
- **Proveedores simulados** (`ENVIOS_SIMULADOS=true`) en desarrollo, en el extremo a extremo y en el entorno de pruebas: aceptan todo menos las direcciones con "rebota" (y los celulares que terminan en 000). El servidor no arranca con simulados en producción.

### Fuera de la iteración 20

| Qué | Dónde se resuelve |
|---|---|
| Correo real en el entorno de pruebas: cuenta de Resend, dominio verificado, `RESEND_CLAVE_API`, `RESEND_SECRETO_EVENTOS`, `CORREO_REMITENTE`, `CORREO_RESPONDER_A` y la dirección de eventos registrada | Cuando Kevin entregue la cuenta: variables en el worker (clave) y en `oficina` (secreto de eventos), y `ENVIOS_SIMULADOS` fuera |
| WhatsApp real: número de prueba de Meta, plantilla `informe_publicado` aprobada, `WHATSAPP_TOKEN`, `WHATSAPP_NUMERO_ID`, `WHATSAPP_SECRETO_APP`, `WHATSAPP_TOKEN_VERIFICACION` | Igual que el correo; producción con la cuenta de WhatsApp Business de TEINS (R10) |
| Producción: dominio de TEINS y su cuenta de WhatsApp Business | Al transferir producción (ADR-0021) |
| Un envío que se acepta y no se reenvía si el worker cae justo después de que Meta lo aceptó (Meta no tiene llave de idempotencia) | Aceptado: el riesgo es un WhatsApp repetido, no uno perdido |
| `bajada.spec.ts` "permiso local vencido" falla contra el entorno de pruebas incluso sola (2 de 2): al recargar sin conexión, el service worker no sirve la página (`ERR_INTERNET_DISCONNECTED`). En local pasa. La iteración no toca campo; ya había fallado una vez en la iteración 19 | Investigar antes de la prueba en iPhone: si el service worker controla la primera carga en el entorno (precarga terminada antes de quedar sin señal) |
| La corrida completa contra el entorno choca con el límite de 5 inicios de sesión por minuto (QA-7) y falla en cualquier archivo | Correr contra el entorno de a un archivo con un minuto entre ellos, o subir el límite solo en pruebas con `INICIOS_DE_SESION_POR_MINUTO` |
| `informes.test.ts` ("planos verificados") falló una vez en la corrida completa del servidor y pasó al repetirla: otro archivo verificó el plano antes de publicar | Ya existía la carrera: aislar la cola de verificación por archivo si vuelve a fallar |

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Kevin aprueba las maquetas | Hecho el 2026-09-27 |
| 2. Contactos: se crean, cambian y quitan (sin borrar la fila, ADR-0009); WhatsApp exige la autorización y la registra; el técnico no los ve | Hecho: `servidor/pruebas/envios.test.ts` |
| 3. Los envíos esperan el PDF y salen con el adjunto, el asunto, las etiquetas y las variables de la plantilla; lo rechazado queda "No llegó" con su motivo, se marca en la bandeja y se vuelve a enviar | Hecho: `servidor/pruebas/envios.test.ts` |
| 4. Nadie envía a un contacto de otro cliente, por un canal que no recibe, ni una versión retirada | Hecho: `servidor/pruebas/envios.test.ts` |
| 5. Eventos: sin firma válida o viejos se rechazan; entregado, rebote (marca al contacto) y fallo de WhatsApp cambian el estado | Hecho: `servidor/pruebas/envios.test.ts` |
| 6. Extremo a extremo: contactos desde oficina, publicar con destinatarios, "No llegó" con su motivo, "Envío sin entregar" en la bandeja, corregir el correo y volver a enviar | Hecho en Chromium y WebKit (`e2e/pruebas/informe-al-cliente.spec.ts`) |
| 7. Lo anterior sigue igual | Hecho el 2026-09-27: tipos, arquitectura, licencias y auditoría en verde; dominio 95, protocolo 18, oficina 4, campo 80, servidor 127; extremo a extremo 37 y 3 omitidas en Chromium y WebKit; campo sigue en 119,9 de 120 KB (la iteración no toca campo) |
| 8. Desplegada en el entorno de pruebas, el worker antes que la app, con los envíos simulados | Hecho el 2026-09-27: `ENVIOS_SIMULADOS` aplicado con `railway config apply`; el worker en `SUCCESS` antes de subir la app; campo (que aplicó `0024` y `0025`), oficina y portal en `SUCCESS`, salud en 200 y el contrato nuevo publicado. Extremo a extremo contra el entorno en Chromium: `informe-al-cliente.spec` en verde. La corrida completa tuvo 8 fallas por el límite de 5 inicios de sesión por minuto (429 en el inicio de sesión); repetidas de a una, con un minuto entre ellas, pasaron 7. La octava, `bajada.spec` (permiso vencido), falla sola: ver "Fuera" |
| 9. Correo y WhatsApp reales en el entorno de pruebas | Correo hecho el 2026-09-27: clave de solo envío limitada a `deportur.tech` y dirección de eventos creadas con el CLI de Resend (Kevin guardó los secretos en Railway por tubería); `informe-al-cliente.spec` contra el entorno en verde, con los envíos saliendo por Resend y tres eventos firmados aceptados (204). WhatsApp en espera: el 2026-09-27 Kevin avisó un problema con su cuenta de Meta y pidió seguir con la iteración 21; mientras tanto sigue simulado |

### Decisiones tomadas al construirlo

- **Quitar un contacto no borra la fila:** la aplicación no borra en ninguna tabla de negocio (ADR-0009, prueba de plataforma). Se borran su correo, su celular y su autorización, y queda el nombre.
- **Los eventos se aceptan solo con el id del mensaje que dio el proveedor** (o antes de guardarlo): un evento firmado de otro mensaje no cambia un envío.
- **El panel muestra el último intento por contacto y canal:** uno que no llegó y se volvió a enviar ya no pide nada; el historial completo queda en la base.
- **Publicar confirma con el botón de peligro**, como dice `DESIGN.md` para lo que no se deshace (antes usaba el principal).
- **Sin la configuración de un canal, sus envíos quedan "No llegó: … no está configurado en este entorno":** oficina lo ve, nunca se pierde en silencio.
- **Mientras la plantilla de WhatsApp no esté aprobada, Meta rechaza el envío** y queda "No llegó" con su motivo (la maqueta decía "En cola"): así oficina sabe que no salió.
- **La simulación se elige por canal** (`ENVIOS_SIMULADOS`: `true`, `correo` o `whatsapp`): en el entorno de pruebas el correo sale de verdad por Resend con el dominio verificado de Kevin (`deportur.tech`, elegido por él para pruebas; producción irá con el de TEINS) mientras WhatsApp sigue simulado.
- **El extremo a extremo usa las direcciones de prueba de Resend** (`delivered@resend.dev`, `bounced@resend.dev`): con Resend real no dañan la reputación del dominio, y simulado `bounced@resend.dev` también se rechaza, así la misma prueba sirve en local y en el entorno.
- **El panel de envíos se vuelve a leer cada 10 s durante 10 minutos** después de enviar: la entrega o el rebote llegan por evento, no al enviar.
- **En las pruebas del servidor, solo el archivo que trae sus proveedores procesa `envios.enviar`:** la cola es compartida entre archivos, como con los avisos.

## Iteración 19 · Símbolos en el croquis

**Estado:** terminada el 2026-09-26, verificada en local y desplegada en el entorno de pruebas (el worker primero, después campo, oficina y portal; la biblioteca de prueba publicada; los 17 archivos del extremo a extremo en verde contra el entorno). Falta la prueba en iPhone. Maquetas aprobadas por Kevin en el lienzo (página "v0.9 · Símbolos en el croquis", "Si, aprobado").

**Para qué:** que el técnico ponga tableros, UPS, tomas, luminarias o racks con un toque, iguales en todos los croquis, en vez de dibujarlos.

### Alcance

- **Biblioteca como datos (ADR-0027):** por organización, publicada completa desde un archivo JSON (`publicar-simbolos`); lo que sale se retira, nunca se borra. Baja a la app 10 como el catálogo (cambio `simbolo`) y queda en el teléfono sin sellar (base local versión 6).
- **Símbolo:** trazado SVG en una caja de 100 × 100, relleno y sigla opcionales, nombre, categoría y código de catálogo opcional. El trazado se valida como geometría y nada más.
- **Editor:** "Símbolos" abajo a la derecha abre la biblioteca (buscar sin tildes, recientes de este teléfono y todo por categoría, sin textos de ayuda); el símbolo cae en el centro de lo que se ve, elegido con "Mover", y se mueve, gira, cambia de tamaño y duplica como las formas.
- **En el boceto se copia el dibujo** (versión 2 del documento, elemento `simbolo`): oficina y el PDF lo dibujan igual aunque la biblioteca cambie.
- **Biblioteca de prueba ficticia** de 21 símbolos (`simbolos-prueba.json`), que `sembrar` publica, hasta tener la de TEINS.

### Fuera de la iteración 19

| Qué | Dónde se resuelve |
|---|---|
| La lista real de símbolos de TEINS | Cuando TEINS la entregue: se publica con `publicar-simbolos`, sin tocar la app |
| Pantalla de oficina para crear o editar símbolos | Si TEINS cambia su biblioteca a menudo (ADR-0027, opción C) |
| Contar los símbolos como cantidades | Iteración 21 o después: el código de catálogo ya viaja en cada símbolo puesto |
| Sacar la validación del boceto del arranque de campo (2,3 KB) | Si el presupuesto no alcanza: campo quedó en 119,9 de 120 KB |
| `bajada.spec` falló una vez contra el entorno en la corrida completa y pasó sola; sin el detalle guardado. Sospecha: el límite de 5 inicios de sesión por minuto con la prueba anterior | Mirar con `repeticiones.spec`: correr la suite completa guardando los rastros de cada archivo |

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Kevin aprueba las maquetas | Hecho el 2026-09-26 |
| 2. Un símbolo y una biblioteca se validan; el trazado solo admite geometría; en el boceto se copia, se serializa y se dibuja | Hecho: `dominio/src/simbolos.test.ts` |
| 3. La biblioteca se publica, baja solo a la app 10 con su orden, un cambio la vuelve a mandar, lo que sale se retira y cada organización tiene la suya | Hecho: `servidor/pruebas/simbolos.test.ts` |
| 4. El teléfono la guarda, la busca, la agrupa y recuerda los recientes (también sin almacenamiento) | Hecho: `campo/src/simbolos.test.ts` y `repositorio.test.ts`; mover, girar y escalar un símbolo en `transformar.test.ts` |
| 5. Extremo a extremo: buscar y poner una UPS, duplicarla, verla en recientes, enviar; oficina y el PDF la dibujan | Hecho en Chromium y WebKit (`e2e/pruebas/simbolos.spec.ts`) |
| 6. Lo anterior sigue igual y el presupuesto de campo se respeta | Hecho: tipos, arquitectura, licencias y auditoría en verde; dominio 95, protocolo 18, oficina 4, campo 80, servidor 118; extremo a extremo 35 y 3 omitidas en Chromium y WebKit; campo 119,9 de 120 KB |
| 7. Desplegada en el entorno de pruebas, el worker antes que la app, con la biblioteca de prueba publicada | Hecho el 2026-09-26: el worker en `SUCCESS` antes de subir la app; campo (que aplicó `0022` y `0023` antes de arrancar), oficina y portal en `SUCCESS`, salud en 200 y el mismo JavaScript que en local; `publicar-simbolos` publicó los 21 de prueba; los 17 archivos del extremo a extremo contra el entorno en Chromium, 19 pruebas en verde (`bajada.spec` falló una vez en la corrida y pasó al repetirla sola; ver "Fuera") |
| 8. Probada en el iPhone | Pendiente: fase 19 de [`verificacion-manual.md`](verificacion-manual.md) |

### Decisiones tomadas al construirlo

- **La clave del símbolo es la organización y su id:** el archivo trae los ids, así que dos organizaciones pueden publicar la misma biblioteca.
- **Quitar un símbolo del medio vuelve a mandar los que siguen:** su orden cambió, y el orden es el de la pantalla. Son pocos bytes.
- **El símbolo cae del mismo tamaño en pantalla a cualquier acercamiento** (96 px), dentro de los límites de tamaño.
- **La biblioteca no abre el teclado:** el foco queda en el diálogo (`focoEnElDialogo`); lo normal es tocar un símbolo, no buscarlo.
- **Los símbolos los lee la captura y se los pasa al editor:** leerlos desde el editor partía el JavaScript inicial de campo en seis archivos y lo subía a 120,5 KB.

## Iteración 18 · Croquis a pantalla completa, con hojas

**Estado:** terminada el 2026-09-26, verificada en local y desplegada en el entorno de pruebas (el worker primero, después campo, oficina y portal; los 16 archivos del extremo a extremo en verde contra el entorno). Falta la prueba en iPhone. Maquetas aprobadas por Kevin en el lienzo (página "v0.8 · Croquis a pantalla completa", "Esoo, muchísimo mejor") después de dos rondas: la primera propuesta (página "v0.7", editor con la hoja apaisada y las herramientas en cuadrícula) le pareció pequeña, y la segunda (herramientas en un desplegable con su explicación) todavía gastaba espacio. Pidió el estilo de Notas de iOS y GoodNotes, con capturas de GoodNotes.

**Para qué:** croquis limpios y grandes: la hoja llena el teléfono, los trazos se enderezan, las paredes se miden y cada piso va en su hoja con nombre.

### Alcance

- **Editor a pantalla completa (ADR-0026, parte 4):** una sola barra de iconos arriba (volver, deshacer y rehacer; Trazo, Cota, Texto, Mover y Borrador) y la hoja en todo lo demás; abajo, la pastilla con la hoja en que se está. Sin textos de ayuda: se enseñan al operario.
- **Enderezar:** medio segundo con el dedo quieto al terminar; un anillo lo anuncia. Línea, pared en L o en U, triángulo, rectángulo, círculo o elipse; se ajusta a 0°, 45° y 90° y pega los extremos a los de otras paredes.
- **Cota** con su medida escrita; **Mover** con giro de a 15°, tamaño, "Duplicar" y "Quitar"; **Texto** y **Borrador** como antes. La herramienta "Línea" salió: la recta es un trazo enderezado.
- **Hojas:** verticales y del alto de la pantalla donde se crean; hasta 12 por boceto, cada una con nombre (se pide al crearla). Dos dedos a lo ancho pasan de hoja y, después de la última, agregan una; el menú de la pastilla va a una hoja, agrega, cambia el nombre y quita.
- **Documento versión 2** (`{ hojas: [{ nombre, ancho, alto, elementos }] }`) con `polilinea`, `elipse` y `cota`; la versión 1 sigue igual (las firmas la usan) y un boceto viejo se abre como hoja apaisada. App 9.
- **Captura, oficina y PDF:** las hojas de a dos, con su nombre si hay varias; en la captura, tocar una abre esa hoja.

### Fuera de la iteración 18

| Qué | Dónde se resuelve |
|---|---|
| Símbolos (tablero, UPS, tomas) | Iteración 19, sobre esta misma barra y documento |
| Flecha, colores y grosores | Si TEINS los pide: el croquis es en blanco y negro para el PDF |
| Ver la hoja de otro piso atenuada debajo | Si los técnicos la piden; ningún plano de TEINS lo requiere hoy |
| Deshacer con toques de varios dedos | No: se disparan por accidente e iOS ya los usa |
| `repeticiones.spec` falla a veces en WebKit en la corrida completa (esperando "Piso 3" tras corregir en oficina); pasa sola y repetida | Investigar antes de la iteración 19: ya falló en las iteraciones 17 y 18 |

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Kevin aprueba las maquetas | Hecho el 2026-09-26, en la tercera ronda |
| 2. Documento versión 2 con hojas y formas; la versión 1 y las firmas siguen igual | Hecho: `dominio/src/boceto.test.ts` (versión 2: hojas, tamaños, límites, canónica, SVG) y `firma.test.ts` |
| 3. El worker verifica la versión 2 y oficina la recibe igual; el PDF pone cada hoja con su nombre | Hecho: `servidor/pruebas/bocetos.test.ts` |
| 4. Enderezar, transformar y encajar la hoja, sin interfaz | Hecho: `campo/src/dibujo/enderezar.test.ts`, `transformar.test.ts` y `vista.test.ts` |
| 5. Extremo a extremo: enderezar, cota, mover y duplicar, dos hojas con nombre (en Chromium, pasando de hoja con dos dedos), la captura abre una hoja, oficina y el PDF | Hecho en Chromium y WebKit (`e2e/pruebas/croquis.spec.ts` y `bocetos.spec.ts`) |
| 6. Lo anterior sigue igual y el presupuesto de campo se respeta | Hecho: tipos, arquitectura, licencias y auditoría en verde; dominio 90, protocolo 18, oficina 4, campo 74, servidor 115; extremo a extremo 32 y 3 omitidas en Chromium y WebKit, con una falla intermitente de `repeticiones.spec` en WebKit que pasa sola (ver "Fuera"); campo 119,0 de 120 KB |
| 7. Desplegada en el entorno de pruebas, el servidor antes que la app | Hecho el 2026-09-26: el worker en `SUCCESS` antes de subir la app; campo, oficina y portal en `SUCCESS`, salud en 200 y el mismo JavaScript que en local; los 16 archivos del extremo a extremo contra el entorno en Chromium, 18 pruebas en verde |
| 8. Probada en el iPhone | Pendiente: fase 18 de [`verificacion-manual.md`](verificacion-manual.md) |

### Decisiones tomadas al construirlo

- **Las hojas van dentro del documento, no un archivo por hoja:** el valor del campo, su validación y la revisión no cambiaron, y ningún teléfono tenía todavía bocetos de la versión 2 (ADR-0026, parte 3).
- **La hoja toma la forma de la pantalla donde se crea** (`altoDeHoja`): una forma fija dejaba bandas vacías arriba y abajo. En otra pantalla se encaja con un margen.
- **Las maquetas ahora dibujan la barra de estado y la raya de inicio del iPhone:** sin ellas, el espacio vacío parecía mayor de lo real.
- **Deshacer guarda la hoja en que se estaba:** deshacer un cambio de otra hoja vuelve a ella.
- **El gesto de volver del iPhone se bloquea sobre la hoja** (a 24 px del borde): la hoja llega al borde y un trazo desde ahí no debe sacar al técnico de la captura.
- **La validación de las hojas viaja con el arranque de campo:** la base local lee los bocetos al abrir la captura. 117,4 → 119,0 de 120 KB; la iteración 19 debe cargar sus símbolos con el editor, aparte.
- **El guardado ya no se anuncia en pantalla:** "Guardado en este teléfono" queda para el lector de pantalla; un error sí se muestra, arriba de la hoja.

## Iteración 17 · Catálogo en el teléfono

**Estado:** terminada el 2026-09-26, verificada en local y desplegada en el entorno de pruebas (los cuatro servicios, la migración del catálogo aplicada y los 15 archivos del extremo a extremo en verde contra el entorno). Falta la prueba en iPhone. Maquetas aprobadas por Kevin en el lienzo (página "v0.6 · Catálogo en el teléfono", "yeah, i aprove").

**Para qué:** que el técnico elija los materiales del catálogo al anotar cantidades, sin conexión, y que esas líneas lleguen a oficina ya vinculadas: menos escritura en campo, descripciones iguales entre técnicos y la base de la cotización (iteración 21).

### Alcance

- **Bajada (ADR-0025):** cambio `item_catalogo` para toda la organización (código, descripción, unidad y si está activo; sin precio), solo a la app 8 o posterior. El catálogo registra cada ítem creado, editado o importado; una migración registra los que ya existían.
- **Línea de cantidad:** puede llevar `item` (el id del ítem) además de su texto. Al recibirla, el servidor la proyecta vinculada a nombre del técnico si el ítem existe; si no, sin vínculo y sin rechazar el envío. La regla 6 del modelo de dominio cambió: el técnico elige, oficina confirma, cambia o completa.
- **Campo (app 8, base local versión 5):** "Del catálogo" abre la búsqueda (sin tildes ni mayúsculas, por comienzo de palabra o por código) con "Los que más usas"; elegir agrega la línea con descripción y unidad fijas y "Del catálogo · código". Lo que no está se agrega como línea libre con lo escrito. Sin ítems que sirvan para el campo, solo "Agregar línea".
- **Oficina:** "Elegido en campo" bajo el vínculo que eligió el técnico; corregir la tabla conserva el ítem de cada línea.

### Fuera de la iteración 17

| Qué | Dónde se resuelve |
|---|---|
| Catálogo real de TEINS y sus columnas de Excel | Cuando TEINS responda P28 y P29; se prueba con ítems ficticios |
| Precios en el teléfono | Nunca en la línea (regla 7); la cotización es de oficina (iteración 21) |
| Contar los símbolos de un boceto como cantidades | Iteración 19, si los símbolos llevan código de catálogo |

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Kevin aprueba las maquetas | Hecho el 2026-09-26 |
| 2. El catálogo baja solo a la app 8, sin precio; uno desactivado baja inactivo; otra organización no lo ve | Hecho: `servidor/pruebas/catalogo-en-campo.test.ts` |
| 3. La línea elegida llega vinculada a nombre del técnico; un ítem desconocido no rechaza el envío; oficina lo cambia | Hecho: `catalogo-en-campo.test.ts` y `cantidades.test.ts` |
| 4. Búsqueda y "los que más usas" sin conexión, solo con ítems activos y unidades del campo | Hecho: `campo/src/catalogo.test.ts` y `repositorio.test.ts` (catálogo en la bajada) |
| 5. Extremo a extremo: oficina crea el ítem, el técnico lo busca y lo elige, agrega una línea libre desde la búsqueda y oficina ve "Elegido en campo" | Hecho en Chromium y WebKit (`e2e/pruebas/catalogo-campo.spec.ts`) |
| 6. Lo anterior sigue igual y el presupuesto de campo se respeta | Hecho: tipos, arquitectura, licencias y auditoría en verde; dominio 82, protocolo 18, oficina 4, campo 58, servidor 114; extremo a extremo 31 y 3 omitidas (Chromium y WebKit); campo 117,4 de 120 KB |
| 7. Desplegada en el entorno de pruebas | Hecho el 2026-09-26: los cuatro servicios en `SUCCESS`, salud en 200, `campo` aplicó la migración `0021` antes de arrancar y los 15 archivos del extremo a extremo contra el entorno en Chromium, 17 pruebas en verde |
| 8. Probada en el iPhone | Pendiente: fase 17 de [`verificacion-manual.md`](verificacion-manual.md) |

### Decisiones tomadas al construirlo

- **La línea conserva su texto aunque venga del catálogo:** se lee igual en el PDF, en oficina y en una app sin catálogo, aunque el ítem cambie después.
- **El vínculo se decide al recibir, contra el catálogo del servidor:** un teléfono con el catálogo de ayer puede elegir un ítem que ya no existe; la línea entra sin vínculo y oficina la vincula como siempre.
- **"Elegido en campo" es `vinculada_por` = el técnico:** cuando oficina lo cambia, deja de decirlo. No hizo falta otra columna.
- **"Los que más usas" se cuenta en el teléfono,** de las líneas de ese técnico, al abrir la búsqueda. No se sube nada nuevo.
- **La hoja de búsqueda va dentro de la captura, no como carga aparte:** cargada aparte desde la captura, el empaquetador partió el JavaScript inicial en cinco archivos y subió de 117,4 a 119,2 KB; la captura ya se carga aparte, así que la hoja no pesa en el arranque (117,4 KB).
- **El catálogo no se sella en el teléfono:** es la lista de materiales de la organización, como los formatos (ADR-0022 sella lo del cliente).
- **La prueba de extremo a extremo de cantidades acepta "Agregar línea" o "Línea libre":** el catálogo es de la organización y las corridas lo comparten, así que el botón depende de si ya hay ítems.

## Iteración 16 · Firma del cliente

**Estado:** terminada el 2026-09-26, verificada en local y desplegada en el entorno de pruebas (los cuatro servicios, el formato de prueba v7 sembrado y los 14 archivos del extremo a extremo en verde contra el entorno). Falta la prueba en iPhone. Maquetas aprobadas por Kevin en el lienzo (página "v0.5 · Firma del cliente", "Yeah i liked it").

**Para qué:** que quien recibe la visita firme en el teléfono del técnico una constancia de que estuvo en el sitio, que llegue a oficina y al PDF del cliente, sin papel. Certifica la visita, no el contenido técnico (Kevin, 2026-09-26; ADR-0024).

### Alcance

- **Dominio y contrato:** tipo de campo `firma` con `declaracion` opcional (`{tecnico}`, `{sitio}`, `{fecha}`); valor `{ firma: huella, nombre, cargo?, firmadoEn, declaracion }`; validación (`firma_invalida`), no corregible por oficina, exige `appMinima` 7. Formato de prueba v7 con "Cierre de la visita".
- **Campo (app 7):** "Pedir la firma" abre la constancia a pantalla completa (nombre, cargo opcional, recuadro para firmar con dedo o lápiz, "Borrar" y "Firmar"); firmada, se ve con quién y cuándo, y "Volver a firmar" pide confirmar. Los trazos se guardan como un boceto y suben al enviar.
- **Oficina:** la firma en la revisión, con quién, cuándo, en el teléfono de qué técnico y la constancia; se comenta, no se corrige.
- **PDF:** "Constancia de visita" con lo que se leyó, la firma recortada, el nombre, el cargo y la hora.

### Fuera de la iteración 16

| Qué | Dónde se resuelve |
|---|---|
| Firma de quien responde por el informe en TEINS (el marcador `[FIRMA]` del PDF) | Cuando TEINS responda P23 |
| Documento de identidad de quien firma | Solo si TEINS lo pide (regla 18, datos mínimos) |
| Firma digital con certificado | ADR-0024, "Cuándo revisarla" |

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Kevin aprueba las maquetas | Hecho el 2026-09-26 |
| 2. Una firma válida se envía y una incompleta o con datos de más se rechaza; oficina no la corrige | Hecho: `dominio/src/firma.test.ts` (8 pruebas) y `servidor/pruebas/firmas.test.ts` |
| 3. Los trazos se guardan en el teléfono, volver a firmar los reemplaza y suben al enviar | Hecho: `campo/src/datos/repositorio.test.ts` |
| 4. El PDF muestra la constancia; sin firma, el dato como cualquier otro | Hecho: `firmas.test.ts` |
| 5. Extremo a extremo: firmar en el teléfono, enviar y verla en oficina sin poder corregirla | Hecho en Chromium y WebKit (`e2e/pruebas/firma.spec.ts`) |
| 6. Lo anterior sigue igual y el presupuesto de campo se respeta | Hecho: tipos, arquitectura, licencias y auditoría en verde; dominio 81, protocolo 18, oficina 4, campo 52, servidor 112; extremo a extremo 28 y 3 omitidas en Chromium y WebKit (ver la nota de `repeticiones.spec.ts` abajo); campo 117,4 de 120 KB |
| 7. Desplegada en el entorno de pruebas | Hecho el 2026-09-26: los cuatro servicios en `SUCCESS`, salud en 200, `sembrar` publicó el formato v7 y los 14 archivos del extremo a extremo contra el entorno en Chromium, 16 pruebas en verde |
| 8. Probada en el iPhone | Pendiente: fase 16 de [`verificacion-manual.md`](verificacion-manual.md) |

### Decisiones tomadas al construirlo

- **La firma es un documento de boceto:** el mismo archivo, la misma subida al enviar, la misma verificación en el worker y el mismo dibujo. Por eso el recuadro es 4:3 (el lienzo de la versión 1); se muestra recortado a los trazos, sin cuadrícula (`Firma` de `ui` y `firmaASvg` para el PDF).
- **La constancia se llena en el teléfono y se guarda ya llena:** el PDF muestra lo que se leyó, aunque después cambie el nombre del sitio o el formato. El texto por defecto no nombra a la organización (R7); el del formato de prueba sí dice "de TEINS", porque es un dato del formato.
- **La pantalla de la firma trata de usted:** la lee el cliente, no el técnico (el resto de campo tutea).
- **Los errores se dicen al tocar "Firmar"** ("Escriba su nombre.", "Firme en el recuadro."), como en los formularios de oficina; "Firmar" no se deshabilita, porque un botón gris no explica qué falta.
- **La firma en el formato de prueba v7 es opcional:** así los demás recorridos de extremo a extremo no tienen que firmar; `firmas.test.ts` prueba la obligatoria.
- **El contorno de los trazos pasó a `campo/src/dibujo/trazo.ts`,** que usan el editor de bocetos y la firma: los dos se cargan aparte y comparten ese fragmento.
- **En el extremo a extremo en WebKit (iPhone 13) el recuadro queda bajo el pliegue:** la prueba se desplaza hasta él, como la persona.
- **Observado el 2026-09-26:** en la corrida completa, justo después de las pruebas de integración, `repeticiones.spec.ts` en Chromium agotó su tiempo una vez (1,5 minutos). No se reprodujo: 3 de 3 sola y 16 de 16 en la corrida completa de Chromium siguiente. Se vigila como el caso de `envio.spec.ts` del 2026-09-25; la integración continua reintenta una vez.

## Iteración 15 · Avisos push e instalación guiada

**Estado:** terminada el 2026-09-26, verificada en local y desplegada en el entorno de pruebas (los cuatro servicios; extremo a extremo contra el entorno en Chromium, 13 archivos y 15 pruebas en verde). Falta la prueba en iPhone. Maquetas aprobadas en el lienzo (página "v0.4 · Avisos e instalación").

**Para qué:** que el técnico sepa de una visita nueva, cambiada o cancelada, de un comentario o de una revisión sin abrir la app, y que oficina sepa de un levantamiento nuevo con la pestaña cerrada. En iPhone los avisos exigen la app instalada, así que la instalación guiada (pendiente desde la iteración 14) entra aquí.

### Alcance

- **Módulo `avisos` en el servidor (ADR-0023):** suscripciones por persona y dispositivo; un trabajo por suscripción, encolado en la misma transacción del hecho que avisa; envío con VAPID; la suscripción que el servicio de avisos da por muerta (404 o 410) se borra; desactivar o restablecer a una persona borra las suyas (QA-5).
- **Qué se avisa:** al técnico, visita asignada, reprogramada, cancelada o pasada a otra persona, comentario de oficina y levantamiento revisado; a oficina (quien lo active), levantamiento nuevo. El texto nunca lleva datos del cliente: se ve con el teléfono bloqueado (R5).
- **Campo:** el service worker generado importa un manejador de avisos; tarjeta "Avisos en este teléfono" bajo la siguiente visita; estado de los avisos en el diagnóstico; al cerrar sesión o borrar por revocación se quita la suscripción.
- **Instalación guiada:** en un teléfono sin la app instalada, antes de iniciar sesión, los pasos de iPhone o el botón de Android; "Seguir en Safari" o "Seguir en el navegador" deja continuar.
- **Oficina:** service worker solo de avisos (sin caché, sigue siendo una app en línea) y la sección "Avisos en este navegador" en Mi cuenta.

### Fuera de la iteración 15

| Qué | Dónde se resuelve |
|---|---|
| Avisos de envíos al cliente que fallan | Iteración 20 |
| Abrir el levantamiento o la visita exacta al tocar el aviso | Se abre el inicio de cada superficie, que ya muestra lo nuevo primero; se revisa si la prueba con técnicos lo pide |
| Preferencias por tipo de aviso | Cuando alguien pida apagar uno solo; hoy son pocos y todos piden una acción |
| Quitar la suscripción del navegador al ejecutar la orden de borrado | No hace falta: desactivar ya borró las suscripciones en el servidor, así que no llega ningún aviso |

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Kevin aprueba las maquetas en el lienzo antes de programar | Hecho el 2026-09-26 ("i like the hierarchy"), con un cambio: la app se llama "TEINS" en los avisos y bajo el ícono |
| 2. Cada hecho avisa a quien corresponde, en la transacción del hecho, y un hecho revertido no avisa | Hecho: `servidor/pruebas/avisos.test.ts` (visita asignada, reprogramada, cancelada y reasignada; comentario, revisado y levantamiento nuevo; una reasignación rechazada no avisa; otra organización no recibe nada) |
| 3. Ningún aviso lleva datos del cliente | Hecho: la misma prueba busca el nombre del cliente y del sitio en todo lo enviado |
| 4. Solo se aceptan servicios de avisos conocidos, por https y desde una superficie propia | Hecho: `avisos.test.ts` (dirección interna, host desconocido, http y origen ajeno rechazados) |
| 5. Suscripciones muertas se borran; desactivar o restablecer a una persona apaga sus avisos; 5xx reintenta | Hecho: `avisos.test.ts` (410, 400, 503, desactivar, restablecer, teléfono compartido) |
| 6. Cada envío va cifrado y firmado con VAPID | Hecho: `avisos.test.ts` con las opciones reales del enviador |
| 7. Campo guía la instalación antes de iniciar sesión; el técnico activa los avisos y oficina en su navegador | Hecho: `e2e/pruebas/avisos.spec.ts` (guía en Chromium y WebKit; activar en Chromium con el servicio de avisos simulado en el navegador) |
| 8. Lo anterior sigue igual y el presupuesto de campo se respeta | Hecho: tipos, arquitectura, licencias y auditoría en verde; dominio 73, protocolo 18, oficina 4, campo 51, servidor 108; extremo a extremo 27 y 3 omitidas (Chromium y WebKit); campo 117,0 de 120 KB |
| 9. Desplegada en el entorno de pruebas | Hecho el 2026-09-26: claves VAPID generadas sin mostrarlas y guardadas en el `worker`; `railway config apply` (la pública por referencia en `campo` y `oficina`, el contacto en el `worker`) y el plan sin diferencias después; los cuatro servicios en `SUCCESS`, salud en 200 y los 13 archivos del extremo a extremo contra el entorno en verde |
| 10. Probada en el iPhone: instalar, activar y recibir una visita nueva con el teléfono bloqueado | Pendiente: fase 15 de [`verificacion-manual.md`](verificacion-manual.md) |

### Decisiones tomadas al construirlo

- **Avisos a personas y envíos al cliente en módulos distintos:** el plan hablaba de un solo módulo de mensajería, pero las suscripciones son de personas con sesión (se revocan con ellas) y los contactos del cliente tendrán otro ciclo (autorización de WhatsApp, rebotes de correo). Lo que comparten, el trabajo encolado en la transacción del hecho, ya lo da la cola (ADR-0012). `envios` llega en la iteración 20.
- **Un trabajo por suscripción, con el texto armado al encolar:** si un teléfono falla, su reintento no repite el aviso en los demás; el trabajo no necesita leer otros módulos.
- **`tag` y `Topic`:** un segundo aviso de la misma visita reemplaza al primero en el teléfono y en el servicio de avisos si todavía no se entregó.
- **El aviso abre el inicio de la superficie, tomado del origen desde el que se suscribió** (la operación recibe ahora la cabecera `Origin`, que el servidor ya valida): sin variables nuevas por superficie.
- **El nombre del técnico se lee antes de la transacción del envío:** leído adentro pedía una segunda conexión mientras la primera esperaba, y la prueba de diez envíos simultáneos agotó el pool.
- **Campo conserva el service worker generado** y le suma el manejador con `importScripts`; pasar a `injectManifest` habría obligado a escribir a mano la caché que hoy da `vite-plugin-pwa`.
- **Sin instalar, el recordatorio del inicio habla de los avisos y abre la misma guía;** la tarjeta de avisos no aparece (en la maqueta era otro estado de la tarjeta: decía lo mismo dos veces).
- **"Seguir en Safari" y "Ahora no" se recuerdan en `localStorage`,** por teléfono, como la propuesta de la llave de acceso: son comodidades, no datos del negocio.
- **En el extremo a extremo el servicio de avisos se simula en el navegador** (permiso y `PushManager`): no hay servicio de avisos en las pruebas ni worker corriendo. La entrega real se prueba en el servidor y en el iPhone.
- **La clave pública del extremo a extremo vive en `playwright.config.ts`:** no es un secreto; la privada no existe ahí.

## Iteración 14 · Interfaz con la dirección Consola

**Estado:** terminada el 2026-09-26, verificada en local (verificación completa en el orden de la integración continua, en verde) y desplegada en el entorno de pruebas (`campo`, `oficina`, `portal` y `worker`; extremo a extremo en Chromium contra el entorno, 13 de 13). Falta la prueba en iPhone.

**Para qué:** Kevin encontró la interfaz "básica y fea": botones de tamaños distintos, confirmaciones metidas en filas, resultados que aparecían lejos de la acción (el QR de un acceso salía arriba de la tabla), lo creado se perdía en el orden alfabético y no había diálogos, menús ni notificaciones. Se auditó el código pantalla por pantalla, se investigó cómo resuelven lo mismo Google, Microsoft, Apple, AWS, GitHub, Shopify e IBM (segundo factor, credenciales que se muestran una vez, QR, confirmaciones, creación, tablas, formularios de campo), se compararon tres direcciones en el lienzo (página "v0.3 · Direcciones") y Kevin eligió la A, Consola, con dos reglas: la jerarquía (el título es la sección del menú; las subsecciones, pestañas) y que todo lo que se muestra esté justificado.

### Alcance

- **`DESIGN.md` reescrito:** la regla de justificación, la jerarquía, los tokens de Consola, cuándo usar cada componente, qué se confirma y qué se deshace, crear en hoja lateral y lo nuevo primero y resaltado, lo que se entrega una sola vez y el flujo del segundo factor.
- **`paquetes/ui`:** juego de componentes nuevo (botones con variantes, tamaños, icono y estado de carga; diálogo sobre `<dialog>` centrado, lateral e inferior; confirmación; notificaciones; tabla; menú de acciones sobre el popover del navegador; encabezado de pantalla; insignias; estado vacío; esqueletos; búsqueda; copiar; visor de fotos) e iconos de Lucide. `Marquilla` se retiró.
- **Oficina:** menú lateral con iconos y la cuenta de lo que espera revisión; cada pantalla con su encabezado; tablas con "Más acciones"; crear y editar en hoja lateral con errores por campo; confirmaciones en diálogo; credenciales en un diálogo que no se cierra por accidente; segundo factor en pasos numerados con los códigos de respaldo después de verificar; revisión e informe en dos columnas con el panel de acción fijo; aviso al salir del informe con cambios sin guardar.
- **Campo:** barra superior con el estado de sincronización; la siguiente visita como tarjeta focal; barra de envío fija con lo que falta y resumen con enlaces; confirmaciones en hoja inferior; fotos a pantalla completa que se quitan con deshacer (`quitarFoto`); sin la línea "Datos de prueba" que se habría visto en producción; diagnóstico plegado.
- **Portal:** ingreso y lista de informes en la dirección nueva, sin el marcador `[LOGO]` a la vista del cliente.
- **Servidor:** el PDF se descarga como archivo con un nombre legible (`Content-Disposition: attachment`), en oficina y en el portal; "Revisados" va del más reciente al más antiguo; en Administración, los usuarios activos primero.
- **Columna "Visita" en la bandeja:** cada levantamiento dice de qué cliente y sitio es sin abrirlo. El resumen del levantamiento en `protocolo` trae la visita (nula para los de antes de las visitas); el servidor la lee por la interfaz del módulo de visitas (`resumenes`), en una consulta por página.

### Fuera de la iteración 14

| Qué | Dónde se resuelve |
|---|---|
| Nombre del formato en la bandeja (hoy muestra la clave) | `docs/diseno/pendientes.md` |
| Las demás pantallas de Consola en el lienzo, para revisarlas con TEINS | `docs/diseno/pendientes.md` |
| Borrar del almacenamiento una foto que ya había subido y el técnico quitó antes de enviar | Tarea de limpieza del worker, cuando el volumen lo justifique: hoy queda huérfana y no se entrega |
| Instalación guiada de la PWA en iPhone | Siguiente en código mientras TEINS responde |

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Kevin aprueba una dirección en el lienzo antes de programar | Hecho: dirección A, página "v0.3 · Direcciones" |
| 2. Ninguna pantalla define estilos propios; todas usan el juego de `ui` | Hecho: `Marquilla` retirada, tipos verificados en los siete paquetes |
| 3. Lo que tiene consecuencias se confirma; lo que se deshace ofrece "Deshacer" | Hecho: pruebas de extremo a extremo actualizadas a los diálogos (envío, revisión, publicación, retiro, cancelación, llaves, repeticiones) |
| 4. Lo creado aparece primero y resaltado, con notificación | Hecho: `programacion.spec.ts` y `administracion.spec.ts` lo comprueban |
| 5. El PDF se descarga sin salir de la pantalla | Hecho: `informe.spec.ts` y `portal.spec.ts` esperan la descarga; pruebas del servidor del encabezado |
| 6. Quitar una foto no rompe la sincronización ni pierde otra | Hecho: 4 pruebas nuevas de `quitarFoto` en `campo` |
| 6b. La bandeja dice de qué cliente y sitio es cada levantamiento | Hecho: `informes.test.ts` ("bandeja", en cualquier pestaña), `api.test.ts` (nulo sin visita) y `envio.spec.ts` |
| 7. Lo anterior sigue igual y el presupuesto de campo se respeta | Hecho: tipos, reglas de arquitectura, licencias y auditoría en verde; dominio 73, protocolo 18, oficina 4, campo 51, servidor 96; extremo a extremo 24 y 2 omitidas (Chromium y WebKit); campo 116,0 de 120 KB |
| 8. Desplegada en el entorno de pruebas | Hecho: los cuatro servicios en `SUCCESS`, salud en 200 y los 12 archivos del extremo a extremo contra el entorno en Chromium, 13 pruebas en verde |
| 9. Probada en el iPhone | Pendiente, con las fases 9 a 13 |

### Decisiones tomadas al construirlo

- **Componentes propios sobre el navegador, sin shadcn ni Radix:** `<dialog>` da el foco atrapado, el velo, Esc y el fondo inerte; el popover da los menús encima de todo, sin que una tabla con desplazamiento los recorte. Cero dependencias nuevas salvo Lucide, y el movimiento sigue en CSS (regla 10).
- **El amarillo dejó de pintar botones:** la acción principal va en el azul de la marca; el amarillo marca el foco y lo recién creado. Con un solo acento, el amarillo sigue llamando la atención donde importa.
- **El borde de los campos de texto es más oscuro que el de los botones** (`borde-control`, 3:1): el campo no tiene otra forma de verse, el botón tiene su texto.
- **Los avisos llevan el texto en negro y el tono en el icono:** el texto de color sobre fondo teñido no llegaba a 7:1.
- **Una acción principal por fila, el resto en "Más acciones":** los botones con el nombre del cliente o del usuario en cada fila (que variaban de ancho) pasaron a un texto corto con el nombre accesible completo, así las pruebas y el lector de pantalla siguen encontrando cada uno.
- **La captura de campo se carga aparte:** el juego de componentes nuevo llevaba el JavaScript inicial a 124 KB; con la captura fuera del arranque quedó en 116 KB (el service worker la guarda igual y abre sin conexión). `ui` declara `sideEffects` para que cada superficie empaquete solo lo que usa.
- **Quitar una foto borra el archivo solo si nada más lo usa:** las fotos se direccionan por contenido, así que otro campo u otro levantamiento pueden compartirla. Una subida en curso de la foto quitada termina sin efecto.
- **Las visitas siguen en orden de fecha al programar una nueva:** la agenda es cronológica, así que la nueva se resalta y se lleva a la vista en su lugar en vez de subir al principio; clientes, usuarios e ítems nuevos sí van primero.
