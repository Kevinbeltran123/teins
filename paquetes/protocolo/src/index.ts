export { CABECERA_VERSION, VERSION_MINIMA_ACEPTADA, VERSION_PROTOCOLO } from "./version";
export { DefinicionCampo, Fecha, Huella, Respuestas, Uuid, Valor, VersionFormato } from "./dominio";
export {
  CodigoProblema,
  ESTADO_POR_CODIGO,
  Problema,
  REINTENTABLE,
  TIPO_PROBLEMA,
  tipoDeProblema,
} from "./problemas";
export {
  Bajada,
  BYTES_MAXIMOS_ARCHIVO,
  Cambio,
  Comando,
  Comentario,
  DetalleInforme,
  DetalleLevantamiento,
  EnviarLevantamiento,
  Historial,
  IDENTIFICADOR_ACCESO,
  InformesDelCliente,
  llaveDeEnvio,
  operaciones,
  OrdenesDelDispositivo,
  PaginaInformes,
  PaginaLevantamientos,
  ResultadoComando,
  SaludDispositivo,
  SesionPortal,
  Sesion,
  TIPOS_DE_ARCHIVO,
  UrlDeArchivo,
  VersionPublicada,
  VisitaAsignada,
} from "./operaciones";
export type {
  Consulta,
  ConsultaEntrada,
  Cuerpo,
  CuerpoEntrada,
  NombreOperacion,
  Operacion,
  Operaciones,
  Parametros,
  ParametrosEntrada,
  Respuesta,
  RespuestaServidor,
} from "./operaciones";
export { crearClienteApi, ErrorApi, ErrorDeRed } from "./cliente";
export type { ClienteApi, EntradaCliente } from "./cliente";
