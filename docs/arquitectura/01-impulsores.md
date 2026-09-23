# Impulsores de arquitectura

Fuentes: resumen de la reunión con el dueño de TEINS, respuestas a las preguntas de aclaración (P-n) y la investigación de huecos (I-n). Método: escenarios de atributos de calidad del SEI, priorizados como en el árbol de utilidad de ATAM.

**Prioridad:** I = importancia para el negocio · D = dificultad o impacto en la arquitectura (A alta, M media, B baja).

---

## 1. Restricciones

| ID | Restricción | Origen | Consecuencia principal |
|---|---|---|---|
| R1 | Un solo desarrollador | Kevin | Pocas piezas móviles; nada que exija un equipo para operarlo |
| R2 | Proyecto completo en dos meses, incluida la validación | Kevin / cliente | Construir lo que el piloto necesita; preparar las costuras para crecer |
| R3 | Sin presupuesto del desarrollador; el cliente quiere el menor costo posible | Kevin / P38 | Costo por uso o capas gratuitas; evitar costos fijos |
| R4 | Android e iPhone, celulares y tabletas, de la empresa y personales | P11 | Una sola base de código; no se controla el dispositivo |
| R5 | Información de TEINS bajo acuerdo de confidencialidad | P49 | Datos ficticios fuera de producción; nada real en el repositorio |
| R6 | TEINS mantendrá el sistema al terminar el curso | P50 | Tecnologías comunes, documentadas y fáciles de contratar |
| R7 | El software es de Kevin y podría venderse a otras empresas | P49 | No codificar a TEINS dentro del sistema |
| R8 | El portal de informes puede estar fuera de la web actual | P45 | Sin dependencia de la web corporativa |
| R9 | Distribución como PWA; sin cuentas de desarrollador de Apple ni Google por ahora | Kevin | Instalación desde el navegador; limitaciones de Safari que deben mitigarse |
| R10 | TEINS aloja el sistema en producción | Kevin | Cuentas de infraestructura a nombre de TEINS; despliegue reproducible por terceros |

### Decisiones del cliente que acotan el alcance

- No se registra ubicación GPS.
- No se requiere verificación de autenticidad de informes.
- La política de tratamiento de datos personales se aplaza. La Ley 1581 de 2012 sigue aplicando.
- Quién mantendrá el sistema no condiciona las decisiones técnicas.
- Vocabulario de servicios de TEINS (tomado de su sitio web): **Transporte de Datos** (cableado estructurado en cobre y fibra óptica), **Transporte de Energía** (UPS, inversores, reguladores, media y baja tensión) y **Energía Solar**.

---

## 2. Funcionalidades con impacto arquitectónico

| ID | Funcionalidad | Por qué afecta la arquitectura |
|---|---|---|
| F1 | Formatos distintos por tipo de servicio | Obliga a decidir si los formularios son código o datos |
| F2 | Secciones repetibles (pisos, áreas) | Modelo jerárquico, no una hoja plana |
| F3 | Fotos, bocetos a mano (dedo y lápiz) y planos adjuntos | Archivos pesados con mala señal; almacenamiento que crece |
| F4 | Captura sin conexión y envío posterior | Es el problema técnico más difícil del proyecto |
| F5 | Estados: borrador → enviado → revisión → revisado → publicado | Define quién edita en cada momento |
| F6 | Trazabilidad de cambios | Historial diseñado desde el inicio |
| F7 | Informe PDF con fotos y planos | Generación pesada; debe ser reproducible |
| F8 | Portal del cliente con QR y clave, por cliente, disponible indefinidamente | Superficie expuesta a internet; aislamiento entre clientes |
| F9 | Cantidades con texto libre y catálogo, exportables a Excel; precios a futuro | Normalización posterior y crecimiento hacia presupuestos |
| F10 | Cinco funciones: técnico, oficina, supervisor, administrador, cliente | Autorización por rol y por cliente |

---

## 3. Escenarios de atributos de calidad

### Sin conexión y sincronización

| ID | Escenario | Medida de éxito | I | D |
|---|---|---|---|---|
| QA-1 | El técnico trabaja horas sin señal; la app se cierra, el teléfono se reinicia o se queda sin batería | Cero pérdida de lo ingresado; guardado automático en cada cambio | A | A |
| QA-2 | Se recupera señal débil e intermitente durante un envío con muchas fotos | Llega completo, sin duplicados ni partes faltantes; un archivo interrumpido se reintenta sin reenviar lo ya confirmado; el técnico ve qué está solo en su dispositivo | A | A |
| QA-3 | Técnico y oficina podrían editar el mismo levantamiento | Sin conflictos de edición en la operación normal | A | M |
| QA-21 | Un técnico usa una versión vieja de la app con levantamientos sin enviar mientras el servidor ya se actualizó | Cero pérdida; el servidor acepta al menos la versión anterior del protocolo; un cliente demasiado viejo guarda localmente y pide actualizar antes de enviar | A | A |
| QA-22 | Se actualiza la app y cambia la estructura del almacenamiento local con borradores pendientes | Cero pérdida; migración probada con datos pendientes | A | M |

### Seguridad y privacidad

| ID | Escenario | Medida de éxito | I | D |
|---|---|---|---|---|
| QA-4 | Un cliente autenticado intenta ver informes de otro cliente | Cero accesos cruzados, comprobado con pruebas automáticas; el QR nunca reemplaza la clave | A | M |
| QA-5 | Se revoca a un empleado que se retira | Pierde acceso al servidor de inmediato; su dispositivo borra los datos de TEINS al reconectar | A | M |
| QA-6 | Un dispositivo personal con datos queda en manos equivocadas | Datos locales no legibles fuera de la app; reautenticación tras un periodo sin conexión | M | M |
| QA-7 | Intentos de adivinar claves del portal | Bloqueo o retraso tras intentos fallidos; claves con hash adecuado | A | B |
| QA-23 | Se captura una foto con el celular | Ninguna foto almacenada ni publicada conserva metadatos de ubicación o dispositivo | A | B |

### Trazabilidad y durabilidad

| ID | Escenario | Medida de éxito | I | D |
|---|---|---|---|---|
| QA-8 | Oficina corrige un dato de un levantamiento enviado | Queda quién, cuándo, qué campo, valor anterior y nuevo; 100 % de los cambios posteriores al envío atribuibles | A | M |
| QA-9 | Se publica una nueva versión de un informe | La anterior se conserva intacta; el cliente ve la vigente | A | B |
| QA-10 | Falla del servidor o borrado accidental | Copias automáticas; pérdida máxima de 24 h; restauración en menos de un día; los informes publicados nunca se pierden | A | M |
| QA-25 | Dos personas de oficina trabajan sobre el mismo levantamiento | Ningún cambio se pierde en silencio; el segundo guardado se rechaza y se avisa | A | M |

### Modificabilidad y crecimiento

| ID | Escenario | Medida de éxito | I | D |
|---|---|---|---|---|
| QA-11 | Se necesita un nuevo tipo de servicio o un campo nuevo | Sin publicar versión nueva de la app ni cambiar la base de datos; menos de un día; los levantamientos viejos se muestran con su formato original | A | A |
| QA-12 | Se agregan precios, presupuestos o estadísticas | Módulo nuevo que no modifica la captura ni la sincronización | M | M |
| QA-13 | Se vende el sistema a otra empresa | Cada dato pertenece a una organización desde el día uno | M | B* |
| QA-14 | Temporada alta con muchas más visitas y fotos | Mismo tiempo de respuesta; almacenamiento que crece sin intervención; costo proporcional al uso | M | B |

\* Baja si se hace desde el inicio; muy alta si se agrega después.

### Uso, rendimiento, operación y costo

| ID | Escenario | Medida de éxito | I | D |
|---|---|---|---|---|
| QA-15 | Un técnico nuevo usa la app en campo | Completa una visita tras unos 15 minutos de explicación; las unidades se eligen, no se escriben | A | M |
| QA-16 | Foto o cambio de sección en un celular de gama media | Respuesta en menos de un segundo; foto comprimida en el dispositivo | M | M |
| QA-17 | Oficina genera un PDF con muchas fotos | En segundo plano, con aviso al terminar; el mismo informe publicado produce siempre el mismo PDF | M | M |
| QA-18 | Un desarrollador que no es el autor recibe el proyecto | Monta el entorno y despliega un cambio en menos de un día con la documentación | A | M |
| QA-19 | Un mes de operación normal | Costo mensual bajo y predecible, con alertas de gasto | M | B |
| QA-20 | Se modifica la sincronización o los permisos | Pruebas automáticas cubren esos caminos y detectan regresiones | A | M |
| QA-24 | Un error ocurre en un dispositivo en campo | Errores y estado del dispositivo visibles para soporte tras la siguiente sincronización; métricas del piloto calculables desde el primer día | A | M |

### Priorización

| Nivel | Escenarios | Lectura |
|---|---|---|
| **(A, A): definen la arquitectura** | QA-1, QA-2, QA-11, QA-21 | Trabajar sin conexión sin perder datos, cambiar formatos sin reprogramar y convivir con clientes desactualizados |
| **(A, M)** | QA-3, QA-4, QA-5, QA-8, QA-10, QA-15, QA-18, QA-20, QA-22, QA-24, QA-25 | Seguridad, trazabilidad, durabilidad, usabilidad, mantenibilidad, observabilidad |
| **(A, B)** | QA-7, QA-9, QA-23 | Obligatorios pero directos |
| **(M, ·): preparar sin construir** | QA-6, QA-12, QA-13, QA-14, QA-16, QA-17, QA-19 | Dejar las costuras; construir solo lo que el piloto necesita |

---

## 4. Tensiones entre atributos

| Tensión | Resolución |
|---|---|
| Sin conexión vs. revocación | Riesgo residual acotado: la sesión local expira tras un periodo sin conexión, datos locales cifrados, borrado al reconectar |
| Formatos configurables vs. dos meses | Formatos como configuración editada por un desarrollador; editor visual para después (P10) |
| Trazabilidad completa vs. sincronización simple | Detalle por campo desde el envío; en borrador, solo autor y fechas |
| Preparar la venta vs. no sobrediseñar | Solo el identificador de organización en todos los datos; sin interfaz multiempresa |
| Costo mínimo vs. durabilidad y seguridad | No se negocian QA-10 ni QA-4; se ahorra en cómputo |
| Acceso compartido por cliente vs. trazabilidad | Aceptable: el cliente solo consulta; se registra el acceso por cliente |

---

## 5. Hallazgos de la investigación incorporados

| ID | Hallazgo | Dónde se resuelve |
|---|---|---|
| I-1 | Concurrencia dentro de oficina (3 a 5 personas) | Modelo de dominio (toma de revisión) + ADR-0005 (concurrencia optimista) |
| I-2 | Relojes de dispositivos poco confiables | Modelo (doble hora) + ADR-0003 + ADR-0008 |
| I-3 | Borrados que deben sincronizarse | ADR-0003 (marcas de borrado) |
| I-4 | Reasignación con el técnico desconectado | Modelo de dominio (regla de reasignación) |
| I-5 | Desfase de versiones entre app y servidor | ADR-0003 + ADR-0015 |
| I-6 | Migraciones del almacenamiento local | ADR-0004 |
| I-7 | Contrato de API documentado y versionado | ADR-0014 |
| I-8 | Idempotencia completa en el servidor | ADR-0003 + ADR-0005 |
| I-9 | Reintentos con espera creciente; envíos atascados visibles | ADR-0003 |
| I-10 | Eventos confiables (outbox) | ADR-0012 |
| I-11 | Trabajos en segundo plano | ADR-0001 (rol worker) + ADR-0012 |
| I-12 | Metadatos GPS en fotos | ADR-0007 |
| I-13 | Validación de archivos subidos | ADR-0007 |
| I-14 | Modelado de amenazas (STRIDE, OWASP ASVS) | ADR-0009 |
| I-15 | Alcance real del cifrado local | ADR-0004 + ADR-0009 |
| I-16 | Entornos y secretos separados | ADR-0016 |
| I-17 | Aislamiento de datos en la base de datos | ADR-0009 |
| I-18 a I-22 | Ley 1581: seguridad, acceso controlado en internet, supresión vs. inmutabilidad, responsabilidad demostrada | ADR-0008, ADR-0009; minimización en el modelo de dominio |
| I-23 | Registro de auditoría a prueba de alteraciones | ADR-0008 |
| I-25 a I-30 | Observabilidad, métricas del piloto, pruebas con fallas, reglas de arquitectura, copias probadas, proveedor y licencias | ADR-0016 a ADR-0018 |

---

## 6. Supuestos por validar

1. Los técnicos son menos de diez.
2. Un levantamiento tiene decenas de fotos, no cientos.
3. Oficina corrige sin devolver el levantamiento al técnico (se deriva de P18).
4. Los tipos de servicio iniciales difieren sobre todo en campos, no en estructura.
5. El catálogo de materiales (P28) se carga como lista de referencia sin integración.
6. Los técnicos aceptan instalar la app y conceder el permiso de notificaciones.

## 7. Preguntas pendientes con impacto arquitectónico

| Pregunta | Impacto |
|---|---|
| P4 · ¿Uno o varios técnicos por visita? | El modelo lo resuelve con un levantamiento por técnico; solo un levantamiento compartido lo rompería |
| P10 · ¿Quién edita los formatos? | Decide si hace falta un editor visual |
| P5 · ¿Vincular visitas al mismo sitio? | Sitio incluido como entidad; se vuelve opcional si no se necesita |
| P26 · ¿Informe por visita o agrupado? | Solo cambia una regla de negocio |
| ¿Qué hace el supervisor? | Solo cambia la tabla de permisos |
