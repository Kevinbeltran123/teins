# protocolo

Esquemas Zod de comandos y respuestas de sincronización, con su versión. Genera la especificación OpenAPI.

**Dependencias:** Solo depende de `dominio`.

**ADR relevantes:** 0003, 0014, 0015

- `operaciones.ts`: catálogo tipado de operaciones HTTP. El servidor registra un manejador por operación y los clientes llaman por operación. Informes (corte 4): `listarInformes`, `abrirInformeDeVisita`, `obtenerInforme`, `guardarInforme`, `publicarInforme` y `pdfDeVersion`. Revisión (corte 3): `tomarLevantamiento`, `corregirLevantamiento`, `marcarRevisado`, `comentarLevantamiento` e `historialLevantamiento`, con los errores `conflicto_de_version`, `tomado_por_otro`, `no_tomado` y `estado_invalido`. Sincronización: `enviarComando` (subida), `obtenerCambios` (bajada con punto de control), `informarDispositivo` (registro y salud) y `consultarOrdenes` (órdenes de borrado, autenticada con el secreto del dispositivo).
- `problemas.ts`: códigos de error (Problem Details) y si cada uno se puede reintentar.
- `cliente.ts`: cliente para las superficies; valida también las respuestas.
- Entradas livianas: `@teins/protocolo/llaves` (sin Zod, para campo) y `@teins/protocolo/openapi` (solo el servidor).
- Iteración 13: el cliente entra y crea, lista y quita llaves de acceso (`iniciarSesionConLlave`, `crearLlave`, `llaves`, `quitarLlave`), con `admiteLlaves` y `esLlaveCancelada`. La biblioteca del navegador (`@simplewebauthn/browser`) se importa solo al usarlas.
- Iteración 9: `Respuestas` acepta claves de repetición (`seccion~id`), `Repeticiones` describe su lista, `VersionFormato` admite `repetible` en una sección, y `EnviarLevantamiento` y `DetalleLevantamiento` llevan `repeticiones` (opcional al enviar: expansión).
