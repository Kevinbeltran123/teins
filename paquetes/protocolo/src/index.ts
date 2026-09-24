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
  BYTES_MAXIMOS_ARCHIVO,
  Comando,
  DetalleLevantamiento,
  EnviarLevantamiento,
  llaveDeEnvio,
  operaciones,
  PaginaLevantamientos,
  ResultadoComando,
  Sesion,
  TIPOS_DE_ARCHIVO,
  UrlDeArchivo,
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
export { documentoOpenApi } from "./openapi";
export { crearClienteApi, ErrorApi, ErrorDeRed } from "./cliente";
export type { ClienteApi, EntradaCliente } from "./cliente";
