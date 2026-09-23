# Análisis inicial de la reunión con TEINS

> Confidencial. Resume el análisis hecho a partir de la transcripción de la reunión y del sitio de TEINS. La transcripción no identificaba a los hablantes y contenía errores; las sugerencias de los entrevistadores se tomaron como pedidos del cliente solo cuando su aceptación fue clara. No se recibieron el formato físico ni informes de ejemplo.

## Dificultades que describió el cliente

- **Trabajo duplicado:** se captura en campo y se transcribe en oficina.
- **Demora:** oficina depende de que el técnico regrese o digitalice.
- **Calidad irregular:** unidades equivocadas, materiales mal descritos, datos faltantes.
- **Entregables manuales:** completar planos y organizar la información para el cliente.

La atención de un terremoto (sin conectividad, transcripción hasta la madrugada) es evidencia de un escenario exigente, no una medida del tiempo promedio perdido.

## Resultados esperados

Menos transcripción y armado repetitivo de informes; información disponible antes cuando hay conexión; menos omisiones y responsables identificados; informes PDF organizados; cantidades reutilizables para presupuestos; una solución que, probada en TEINS, pueda ofrecerse a otros.

## Métricas del piloto

No hay evidencia para cuantificar ahorros hoy. Se miden en el piloto (ver ADR-0017):

- Tiempo entre la visita y el informe entregado (línea base: P41).
- Tiempo dedicado a transcripción y armado.
- Frecuencia de devoluciones o correcciones por información incompleta.

## Mapa de capacidades

| Capacidad | Problema que resuelve | Origen | Límite de la primera versión |
|---|---|---|---|
| Expediente de visita | Separar información por cliente, lugar e intervención | Inferido; explícito para varias hojas y planos por visita | Cliente, ubicación, motivo, responsable, secciones por área o piso; sin gestión de proyectos |
| Captura técnica guiada | Transcripción, omisiones, ambigüedad | Explícito: campos por servicio, fotos, texto | Formato base y pocas variantes; sin constructor universal |
| Bocetos y evidencia visual | Contexto espacial para medidas y planos | Explícito: dibujar sobre cuadrícula; planos desde oficina | Bocetos sencillos; los planos se hacen fuera del sistema |
| Continuidad sin internet | Volver al papel cuando falla la conexión | Explícito y prioritario | Captura y conservación de visitas preparadas |
| Revisión y trazabilidad | Saber quién registró o corrigió | Explícito: usuarios y registro de cambios | Autor, fecha y cambio; revisión de una etapa; versiones entregadas |
| Cantidades reutilizables | Volver a digitar materiales para presupuestos | Explícito: tabla, texto libre, salida a Excel | Descripción, cantidad, unidad, observación; sin precios |
| Informe y acceso del cliente | Entregar un documento legible | Explícito: PDF, web, QR y clave | Una composición acordada; acceso solo a lo autorizado |
| Usuarios y permisos | Colaborar sin perder responsabilidad | Explícito | Funciones asignadas expresamente |

## Contradicciones y riesgos de alcance

| Tensión | Consecuencia |
|---|---|
| "Disponible automáticamente" y "sin internet" | Distinguir guardar en campo de compartir con oficina; sin conexión no hay disponibilidad inmediata |
| Un formato para todo y campos especializados | Base común con variantes limitadas |
| Boceto y plano de ingeniería | El dibujo técnico avanzado queda fuera |
| Captura estructurada y materiales libres | Texto libre en campo, normalización en oficina |
| "Arrojar valores" y presupuestos | Son cantidades (P27); no es presupuesto automático |
| Información compartida y entrega al cliente | Una captura incompleta no se publica sola; oficina aprueba (P24) |
| Correcciones desde varios lugares | Un editor por estado (modelo de dominio) |
| Usuarios individuales y correos compartidos | Identificación individual sin exigir correo empresarial (P35) |
| Herramienta interna y producto comercial | Interés expresado, no demanda validada; solo se prepara la costura (QA-13) |
| "Para lo que sea" y dos meses | Casos piloto concretos para tener una frontera verificable |

Dos precauciones adicionales: digitalizar no garantiza exactitud técnica (una medida equivocada sigue requiriendo revisión), y la renovación de la web corporativa es una iniciativa aparte.

## Evoluciones posteriores

Nuevos formularios y editor visual; estadísticas e indicadores; catálogo amplio, precios y presupuestos; integraciones con facturación; planos avanzados o medición automática; aprobaciones adicionales; comercialización a otras empresas; acceso al portal desde la web corporativa.
