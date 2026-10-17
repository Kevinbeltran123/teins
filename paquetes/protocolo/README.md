# protocolo

Esquemas Zod de comandos y respuestas de sincronización y de la API, con su versión. Genera la especificación OpenAPI. Es el contrato: se define antes que el endpoint y la pantalla (`docs/proceso/forma-de-trabajo.md`).

- **Dependencias:** solo `dominio` (más Zod, `zod-openapi` y `@simplewebauthn/browser`).
- **ADR:** 0003, 0014, 0015.
- **Pruebas:** `pnpm --filter @teins/protocolo test` (`protocolo.test.ts`, `cliente.test.ts`).

## Qué contiene

| Archivo | Qué tiene |
|---|---|
| `src/operaciones.ts` | Catálogo tipado de operaciones HTTP. El servidor registra un manejador por operación y los clientes llaman por operación |
| `src/problemas.ts` | Códigos de error (Problem Details) y si cada uno se puede reintentar |
| `src/cliente.ts` | Cliente para las superficies; valida también las respuestas |
| `src/llaves.ts` | Entrada liviana `@teins/protocolo/llaves`, sin Zod, para campo: entrar con llave de acceso y crear, listar y quitar llaves (`iniciarSesionConLlave`, `crearLlave`, `llaves`, `quitarLlave`, `admiteLlaves`, `esLlaveCancelada`). `@simplewebauthn/browser` se importa solo al usarlas |
| `src/openapi.ts` | Entrada `@teins/protocolo/openapi`, solo para el servidor |
| `src/version.ts` | `VERSION_PROTOCOLO`, la mínima aceptada (regla N-1) y la cabecera `x-teins-protocolo` |
| `src/dominio.ts` | Forma de los datos del dominio en la frontera: solo estructura; las reglas contra el formato las aplica `validarRespuestas` |

## Operaciones por área

- **Sincronización:** `enviarComando` (subida), `obtenerCambios` (bajada con punto de control y `epoca`), `informarDispositivo` (registro y salud) y `consultarOrdenes` (órdenes de borrado, autenticada con el secreto del dispositivo). `fuera_de_alcance` acepta el motivo `atendida`, que el servidor solo manda a la app 15 o posterior (ADR-0041).
- **Levantamiento:** `Respuestas` acepta claves de repetición (`seccion~id`), `Repeticiones` describe su lista, `VersionFormato` admite `repetible` en una sección, y `EnviarLevantamiento` y `DetalleLevantamiento` llevan `repeticiones` (opcional al enviar: expansión, ADR-0015).
- **Revisión:** `tomarLevantamiento`, `corregirLevantamiento`, `marcarRevisado`, `comentarLevantamiento` e `historialLevantamiento`, con los errores `conflicto_de_version`, `tomado_por_otro`, `no_tomado` y `estado_invalido`.
- **Comentarios y conversaciones (ADR-0035, ADR-0040):** `editarComentario`, `retirarComentario` y `restaurarComentario`; un comentario trae `editadoEn` y `retirado`. `responderComentario` (técnico, `{ llave, texto }`) y `marcarConversacionLeida`; `comentarLevantamiento` acepta `enRespuestaA`; mensajes de hasta 1000 caracteres. `Comentario` trae `enRespuestaA` y `de`; `ComentarioParaTecnico` trae `editadoEn` y `respuestas` (opcional, `MensajeParaTecnico` con `de`, `llave` y `leido`; la app 13 lo descarta). `ResumenLevantamiento.conversacion` (sin leer y la última respuesta) y `DetalleLevantamiento.leidoHasta`.
- **Informes:** `listarInformes`, `abrirInformeDeVisita`, `obtenerInforme`, `guardarInforme`, `publicarInforme` y `pdfDeVersion`. `estadoDePlano` dice si un plano ya se verificó, cuántas páginas anexa al informe o que no se puede anexar.
- **Envíos y cotizaciones (ADR-0028, 0029, 0034, 0036):** `enviarVersion` y `enviarCotizacion` aceptan una `llave` opcional (regla 4). `EstadoDeEnvio` incluye `cancelado` y cada envío trae `cancelado` (quién y cuándo) y `personalizado`. `cancelarEnvio`, `reanudarEnvio`, `cancelarEnvioDeCotizacion`, `reanudarEnvioDeCotizacion` y `retirarVersionDeCotizacion` (con `motivo`); las versiones de cotización traen `retirada` y la lista `todasRetiradas`. `TextoDeCorreoPropio` (`mensaje`) en publicar y enviar.
- **Clientes (ADR-0035):** `crearCliente` acepta `contacto`; `editarCliente`, `editarSitio`, `archivarCliente`, `recuperarCliente`, `archivarSitio` y `recuperarSitio` devuelven el detalle; `listarClientes` toma `vista`; el detalle trae `editado`, `archivado` y `visitasPorHacer`.
- **Visitas (ADR-0037):** `Hora` y el horario de la visita (`horaInicio`, `horaFin`, `terminada`) en `VisitaAsignada` (opcional) y `VisitaProgramada`; `ocupacionDeTecnicos`, `terminarVisita` y el código `tecnico_ocupado` con `ocupados`.
- **Cuenta propia (ADR-0033):** `cambiarContrasena`, `quitarSegundoFactor` y `reactivarUsuarioAdministrado`, con los errores `cambio_de_contrasena_requerido` (403) y `credencial_incorrecta` (422). La sesión dice `debeCambiarContrasena` y trae `organizacion` (nombre y dirección del portal), con los que oficina dibuja en vivo los documentos y el correo (ADR-0031).
