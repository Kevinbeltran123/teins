# Modelo de dominio

Método: patrones estratégicos y tácticos de Domain-Driven Design, adaptados a un proyecto de una persona.

---

## 1. Lenguaje común

| Término | Definición | Qué **no** es |
|---|---|---|
| **Organización** | Empresa que usa el sistema. Hoy solo TEINS | No es el cliente de TEINS |
| **Cliente** | Empresa o persona a la que TEINS presta servicio | No es un usuario interno |
| **Sitio** | Lugar físico de un cliente donde se interviene | No es la dirección de facturación |
| **Visita** | Desplazamiento a un sitio con un motivo (cotización, mantenimiento, modificación) | No es el documento que se llena |
| **Levantamiento** | Información capturada por **un** técnico con **un** formato durante una visita | No es el informe |
| **Formato** | Plantilla de un tipo de servicio | No es un levantamiento lleno |
| **Versión de formato** | Definición congelada de un formato | Nunca cambia después de publicarse |
| **Sección** | Parte de un levantamiento; puede repetirse (Piso 1, Piso 2…) | No es una hoja de papel |
| **Respuesta** | Valor de un campo dentro de una sección | — |
| **Medida** | Número acompañado siempre de una unidad del catálogo de unidades | Nunca un número suelto |
| **Evidencia** | Foto o boceto asociado a una sección o campo | No es un plano de oficina |
| **Boceto** | Dibujo a mano alzada hecho en campo sobre cuadrícula | No es un plano de ingeniería |
| **Línea de cantidad** | Material o trabajo con descripción, cantidad, unidad y observación | No incluye precio |
| **Ítem de catálogo** | Material estandarizado de la lista de TEINS | — |
| **Comentario** | Nota de oficina dirigida al técnico; abre una conversación que el técnico responde desde el teléfono (ADR-0040) | No modifica datos; se cierra al marcar revisado |
| **Informe** | Composición de oficina a partir de levantamientos revisados, con planos y textos propios | No es el PDF |
| **Versión publicada** | Copia congelada de un informe, con su PDF, entregada al cliente | Nunca se edita |
| **Acceso de cliente** | Credencial (QR y clave) con la que un cliente consulta sus informes | No es un usuario interno |
| **Plano** | Documento técnico elaborado en oficina con sus propias herramientas | No se dibuja en el sistema |

**Distinción fundamental:** levantamiento ≠ informe. El levantamiento guarda hechos de campo; el informe es una composición editorial de oficina.

---

## 2. Módulos

| Módulo | Contenido | Tipo | Rigor |
|---|---|---|---|
| Levantamientos | Captura, secciones, respuestas, evidencias, cantidades, revisión | **Núcleo** | Hexagonal |
| Formatos y catálogos | Formatos versionados, tipos de servicio, ítems, unidades | **Núcleo** | Hexagonal |
| Visitas | Visitas y programación | Soporte | Capas simples |
| Clientes | Clientes y sitios | Soporte | Capas simples |
| Informes | Composición, publicación, versiones, PDF | Soporte | Capas simples |
| Portal del cliente | Acceso de cliente, consulta, registro de descargas | Soporte | Capas simples, seguridad reforzada |
| Identidad y acceso | Usuarios, roles, dispositivos, revocación | Genérico | Adaptador sobre solución existente |
| Trazabilidad | Registro de cambios | Genérico transversal | Desde el día uno |
| Archivos | Fotos, bocetos, planos | Genérico | Adaptador sobre almacenamiento de objetos |
| *Presupuestos, Estadísticas, Integraciones* | *Futuro* | — | Solo la costura |

---

## 3. Entidades y relaciones

Todas las entidades llevan identificador de organización (omitido en el diagrama).

```mermaid
erDiagram
  CLIENTE ||--o{ SITIO : "tiene"
  CLIENTE ||--o| ACCESO_CLIENTE : "consulta con"
  CLIENTE ||--o{ VISITA : "solicita"
  SITIO |o--o{ VISITA : "recibe"
  VISITA ||--o{ LEVANTAMIENTO : "contiene"
  USUARIO ||--o{ LEVANTAMIENTO : "responde por"
  USUARIO ||--o{ DISPOSITIVO : "usa"
  FORMATO ||--|{ VERSION_FORMATO : "se versiona en"
  VERSION_FORMATO ||--o{ LEVANTAMIENTO : "estructura"
  LEVANTAMIENTO ||--|{ SECCION : "se divide en"
  SECCION ||--o{ RESPUESTA : "contiene"
  SECCION ||--o{ LINEA_CANTIDAD : "registra"
  SECCION ||--o{ EVIDENCIA : "documenta"
  ITEM_CATALOGO |o--o{ LINEA_CANTIDAD : "normaliza"
  EVIDENCIA }o--|| ARCHIVO : "apunta a"
  LEVANTAMIENTO ||--o{ COMENTARIO : "recibe"
  VISITA ||--o{ INFORME : "se documenta en"
  INFORME }o--|{ LEVANTAMIENTO : "incluye"
  INFORME ||--o{ VERSION_PUBLICADA : "publica"
```

**Decisión clave:** una visita contiene varios levantamientos, y cada levantamiento tiene exactamente un técnico responsable y un formato. Resuelve varios técnicos por visita (P4) sin edición simultánea, visitas con varios servicios e informes consolidados.

---

## 4. Agregados

| Agregado | Contiene | Quién lo modifica | ¿Viaja al dispositivo? |
|---|---|---|---|
| **Levantamiento** | Secciones, respuestas, líneas de cantidad, referencias a evidencias | Técnico en borrador; oficina después | Sube al enviar; su estado baja |
| **Archivo** | Binario inmutable con huella digital | Quien lo crea | Sube |
| **Comentario** | Texto, autor, fecha, referencia al campo y, si es respuesta, a qué comentario responde y de qué lado (ADR-0040) | Lo abre oficina; el técnico responde | Baja con sus respuestas; las del técnico suben |
| **Visita** | Cliente, sitio, motivo, canal de origen, técnicos asignados, fecha y horario (ADR-0037); se cierra al día siguiente de atendida (ADR-0041) | Oficina, supervisor | Baja; atendida, sale del teléfono |
| **Formato** | Nombre, tipo de servicio, versión vigente | Administrador | No |
| **Versión de formato** | Definición completa (ADR-0006) | Nadie tras publicarse | Baja |
| **Ítem de catálogo** | Código, descripción, unidad por defecto, activo | Oficina, administrador | Baja |
| **Cliente** | Datos del cliente y sus sitios | Oficina | Lo necesario, baja |
| **Informe** | Levantamientos incluidos, planos, textos, orden y qué sale de cada uno (ADR-0039) | Oficina | No |
| **Versión publicada** | Copia congelada de datos, planos y PDF | Nadie; solo puede retirarse | No |
| **Acceso de cliente** | Credencial, QR, estado, registro de descargas | Administrador | No |
| **Usuario** | Nombre, identificación, roles, estado | Administrador | Solo el propio |
| **Dispositivo** | Usuario, última sincronización, orden de borrado | Sistema, administrador | Sí |

Decisiones incluidas:

1. **Evidencias separadas de sus archivos:** el levantamiento guarda la referencia; el binario viaja aparte.
2. **Identificadores generados en el dispositivo** (UUID v7): sin identificadores temporales; los reintentos no duplican.
3. **Solo el módulo de captura viaja al dispositivo.**

---

## 5. Ciclos de vida

### Levantamiento

| Estado | Quién edita | Entrada | Salida |
|---|---|---|---|
| Borrador | Solo el técnico responsable | Al crearlo | Enviar → Enviado |
| Enviado | Nadie | El técnico lo envía | Un revisor lo toma → En revisión |
| En revisión | **Solo el revisor que lo tomó** | Toma de revisión | Marcar revisado → Revisado |
| Revisado | Oficina, con toma y registro de cambios | Fin de la revisión | Se incluye en informes |
| Anulado | Nadie | Creado por error, con motivo | Final |

- **Estado de negocio ≠ estado de sincronización.** "Pendiente de subir", "subiendo", "confirmado" y "error" viven solo en el dispositivo.
- **Toma de revisión (I-1):** un revisor toma el levantamiento y queda visible como responsable. Otro puede reasignarse la toma explícitamente, lo que queda registrado. Cada guardado lleva la versión que el usuario tenía abierta; si otro guardó antes, se rechaza (QA-25).
- **Llegada completa:** el servidor solo registra un envío cuando llegaron todos sus archivos con huellas correctas.
- **Un envío que oficina nunca recibió vuelve a Borrador (ADR-0045):** si el servidor lo rechaza para siempre, en el teléfono queda «No se pudo enviar» y el técnico puede volverlo a borrador para corregirlo. Como oficina no lo tiene, sigue habiendo un solo editor. No aplica si la visita ya tiene otro borrador, ni a lo que oficina ya recibió.

### Informe

| Estado | Descripción |
|---|---|
| Borrador | Oficina compone |
| Publicado (versión n) | Oficina aprueba y publica (P24); copia congelada con PDF |
| Nueva versión | Se edita el borrador y se publica n+1; n se conserva (P25) |
| Versión retirada | El administrador la saca del portal; queda registrado |

La versión publicada es una **copia**, no una referencia.

### Visita

Su avance se **deduce** de sus levantamientos e informes. Solo *Cancelada* y, desde la iteración 31, *Terminada* son explícitos: un técnico la termina desde su teléfono (ADR-0037). Su horario puede ser todo el día, de una hora a otra, o desde una hora hasta que la terminen; mientras tanto el técnico está ocupado y no se le programa otra visita que se cruce.

---

## 6. Reglas del negocio

1. Un levantamiento tiene exactamente un técnico responsable y una versión de formato; ninguno cambia tras crearlo.
2. En borrador, solo el técnico responsable edita.
3. Para enviar, todo campo obligatorio tiene valor o está marcado "no se pudo obtener" con motivo.
4. Tras el envío, el técnico no edita. Cada cambio de oficina se registra con autor, fecha, campo, valor anterior y nuevo.
5. Una medida siempre lleva una unidad permitida para su campo.
6. Una línea de cantidad requiere descripción, cantidad mayor que cero y unidad. El técnico puede elegir el ítem del catálogo al capturarla; oficina confirma, cambia o completa el vínculo (ADR-0025).
7. Las líneas de cantidad nunca guardan precio.
8. Una versión de formato publicada no se modifica; los levantamientos conservan la suya.
9. Un informe solo incluye levantamientos de la misma visita en estado Revisado.
10. Publicar crea una versión inmutable con número consecutivo; el cliente ve la vigente.
11. Una versión publicada nunca se borra; puede retirarse con registro.
12. Un acceso de cliente solo muestra versiones vigentes de su cliente.
13. Un usuario desactivado no autentica; sus dispositivos se marcan para borrado local; su autoría se conserva.
14. Nada se borra físicamente en el servidor: se anula o se retira. En borrador, los borrados del técnico viajan como **marcas de borrado** (I-3).
15. Cada dato pertenece a una organización; ninguna relación cruza organizaciones.
16. **Doble hora (I-2):** todo registro guarda la hora del dispositivo (declarada) y la hora del servidor (oficial). La oficial es la del servidor.
17. **Reasignación (I-4):** reasignar una visita no invalida levantamientos ya iniciados; oficina decide cuáles incluir en el informe.
18. **Minimización (I-20):** las versiones publicadas incluyen los datos personales mínimos necesarios (por ejemplo, cargo en lugar de teléfono del contacto).
19. **Las fotos no conservan metadatos** de ubicación ni del dispositivo (QA-23).

---

## 7. Eventos de dominio

| Evento | Reacción hoy | Reacción futura posible |
|---|---|---|
| LevantamientoEnviado | Bandeja de oficina | Notificaciones |
| RevisionTomada | Visibilidad del responsable | — |
| CampoCorregido | Trazabilidad | Estadísticas de errores frecuentes (P9) |
| LevantamientoRevisado | Disponible para informes | Presupuestos toma sus cantidades |
| InformePublicado | PDF, portal, métricas del piloto | Aviso al cliente por correo |
| VersionRetirada | Portal | Auditoría |
| UsuarioDesactivado | Revocación de sesiones y dispositivos | — |
| AccesoClienteRegenerado | Invalidación del QR anterior | — |

---

## 8. Permisos preliminares

| Acción | Técnico | Oficina | Supervisor | Administrador | Cliente |
|---|---|---|---|---|---|
| Crear y programar visitas | — | Sí | Sí | — | — |
| Capturar y enviar levantamientos | Solo los propios | — | — | — | — |
| Tomar, revisar y corregir | — | Sí | ? | — | — |
| Comentar | — | Sí | ? | — | — |
| Componer y publicar informes | — | Sí (P24) | ? | — | — |
| Retirar una versión publicada | — | — | ? | Sí | — |
| Gestionar catálogo | — | Sí | — | Sí | — |
| Gestionar formatos | — | — | — | Sí | — |
| Gestionar usuarios y accesos de cliente | — | — | — | Sí | — |
| Consultar todo | — | Sí | Sí | Sí | — |
| Descargar sus informes | — | — | — | — | Sí |

"?" depende de la función del supervisor, pendiente de definir. Los roles son un conjunto asignable: definirlo no cambia el modelo.

---

## 9. Variantes según preguntas pendientes

| Pregunta | Supuesto actual | Si la respuesta es distinta |
|---|---|---|
| P4 | Un levantamiento por técnico | Solo un levantamiento compartido y editado a la vez rompería el diseño; se desaconseja |
| P5 | Sitio como entidad | Se vuelve opcional |
| P26 | Informe por visita | La regla 9 pasa a "mismo cliente"; el modelo no cambia |
| P2 | Oficina programa las visitas | Se agrega "visita no programada" creada sin conexión con cliente provisional |
| P10 | Formatos editados por administrador/desarrollador | Un editor visual se construye sobre el mismo modelo |

---

## 10. Fuera de alcance deliberado

Agenda avanzada · precios y presupuestos (solo la costura) · dibujo técnico de planos · edición simultánea de un levantamiento · devolución formal al técnico · ubicación GPS · verificación de autenticidad de informes · interfaz multiempresa.
