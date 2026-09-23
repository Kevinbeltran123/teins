# Contexto del producto

> Documento confidencial (acuerdo con TEINS). No se publica ni se copia fuera de este repositorio.

## Necesidad

TEINS diseña, instala y mantiene sistemas de **Transporte de Datos** (cableado estructurado en cobre y fibra óptica), **Transporte de Energía** (UPS, inversores, reguladores, media y baja tensión) y **Energía Solar**, con presencia en Tolima y Cundinamarca.

Antes de cotizar o intervenir, un técnico visita la instalación y levanta la información en papel cuadriculado. Después alguien la transcribe, corrige errores (unidades, materiales, datos faltantes), elabora planos y arma el informe para el cliente. Esto duplica trabajo, retrasa la información y produce datos de calidad irregular. En la atención de un terremoto, sin conectividad, se transcribió hasta la madrugada.

**En una frase:** capturar la información una sola vez en campo, sin depender de internet, que oficina la revise y complete, y entregar al cliente un informe confiable.

## Flujo objetivo

Solicitud → registro de visita → captura en campo (con o sin conexión) → envío a oficina → revisión y corrección con trazabilidad → composición del informe con planos → publicación (versión inmutable + PDF) → consulta del cliente con QR y clave.

## Alcance de la primera versión

- Registro básico de visitas.
- Formato común y pocas variantes técnicas priorizadas.
- Celulares y tabletas Android e iPhone (PWA).
- Captura sin conexión de texto, números con unidad, fotos, bocetos y cantidades; secciones repetibles.
- Envío a oficina al recuperar conexión.
- Revisión con correcciones atribuibles y comentarios al técnico.
- Informe PDF con planos anexos; versiones conservadas.
- Portal del cliente con QR y clave, por cliente.
- Tabla de cantidades exportable.
- Usuarios y permisos: técnico, oficina, supervisor, administrador, cliente.

**Fuera de alcance:** ver `docs/arquitectura/02-modelo-dominio.md`, sección 10.

## Respuestas del cliente

Numeración de la lista original de 51 preguntas.

| # | Respuesta |
|---|---|
| P1 | Las solicitudes llegan por llamada, correo o WhatsApp |
| P3 | Volumen de visitas variable según temporada |
| P6 | Compartirán el formato físico, todavía no |
| P11 | Android e iPhone; dispositivos de la empresa y personales; celulares y tabletas |
| P12 | Sin conexión generalmente por horas |
| P13 | Fotos por visita: depende |
| P14 | Boceto con dedo y con lápiz digital |
| P15 | La pérdida de un dispositivo antes de sincronizar no ocurre en la práctica |
| P16 | Oficina de 3 a 5 personas según temporada |
| P17 | PDF es el formato más cómodo para el cliente |
| P18 | Oficina corrige directamente y le comenta al técnico |
| P19 | El técnico edita hasta que envía a oficina |
| P24 | Oficina aprueba el informe antes de entregarlo |
| P25 | El informe entregado no se modifica; se conservan versiones anteriores |
| P27 | "Arrojar valores" es sobre todo cantidades; precios serían interesantes |
| P28 | Tienen un catálogo o lista habitual de materiales |
| P30 | El cliente ve el PDF |
| P31 | Acceso con QR y clave por cliente |
| P32 | Varias personas por cliente empresa: no importa |
| P33 | Informes disponibles indefinidamente |
| P34 | Supervisor y administrador son personas distintas |
| P35 | Identificación de técnicos: lo más práctico y seguro |
| P36 | Al retirarse un empleado se revocan todos sus permisos y accesos |
| P37 | Manejan información sensible; la seguridad es primordial |
| P38 | Hay presupuesto de alojamiento, prefieren lo más económico |
| P39 | No hay que migrar levantamientos históricos por ahora |
| P45 | El acceso a informes puede estar fuera de la web actual |

Otras decisiones: TEINS aloja el sistema en producción; no se registra GPS; no se requiere verificación de autenticidad de informes; la política de tratamiento de datos se aplaza; quién mantenga el sistema no condiciona la tecnología.
