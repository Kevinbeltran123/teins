/*
  Los documentos que recibe el cliente (ADR-0031): el informe, la cotización y los mensajes de envío. El servidor
  los imprime y los envía; oficina los dibuja en vivo con el mismo código. TypeScript puro: solo depende de dominio.
*/
export { nombreDelPdfDeCotizacion, plantillaCotizacion, piePaginaCotizacion, ESTILOS_COTIZACION, type ContenidoCotizacion } from "./cotizacion";
export { nombreDelPdfDeInforme, plantillaInforme, piePagina, ESTILOS_INFORME, type HojaDelInforme, type RecursosPlantilla } from "./informe";
export {
  asunto,
  diaCorto,
  enlaceAlPortal,
  htmlDeCorreo,
  plantillaDeWhatsapp,
  asuntoBase,
  primerNombre,
  textoBase,
  textoDeCorreo,
  variablesDeWhatsapp,
  type MensajeDeCotizacion,
  type MensajeDeEnvio,
  type MensajeDeInforme,
  type OpcionesDeCorreo,
  type TextoPropio,
} from "./mensajes";
export { escapar } from "./escapar";
export { LOGO_TEINS } from "./logo";
export { ARCHIVO_FUENTE, hojaDeLaVista, RUTA_DOCUMENTOS, type Documento, type Salida } from "./salida";
export { correoDeCodigo, correoDeInvitacion, type CorreoDelPortal } from "./portal";
