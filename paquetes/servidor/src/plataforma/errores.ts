import { ESTADO_POR_CODIGO, tipoDeProblema, type CodigoProblema, type Problema } from "@teins/protocolo";

type Extensiones = Omit<Partial<Problema>, "type" | "title" | "status" | "codigo" | "detail">;

const TITULOS: Record<CodigoProblema, string> = {
  entrada_invalida: "La solicitud no tiene la forma esperada",
  no_autenticado: "Se requiere iniciar sesión",
  sin_permiso: "No tiene permiso para esta acción",
  no_encontrado: "No existe",
  conflicto: "Conflicto con el estado actual",
  archivos_faltantes: "Faltan archivos por subir",
  archivos_en_verificacion: "Hay archivos en verificación",
  archivo_demasiado_grande: "El archivo supera el tamaño permitido",
  tipo_de_archivo_no_permitido: "Tipo de archivo no permitido",
  respuestas_invalidas: "Las respuestas no cumplen el formato",
  formato_desconocido: "Versión de formato desconocida",
  version_protocolo_no_soportada: "La app debe actualizarse para enviar",
  demasiadas_solicitudes: "Demasiadas solicitudes",
  error_interno: "Error interno",
};

/** Error de dominio que viaja al cliente como Problem Details (RFC 9457). */
export class ErrorProblema extends Error {
  readonly estado: number;

  constructor(
    readonly codigo: CodigoProblema,
    readonly detalle?: string,
    readonly extensiones: Extensiones = {},
  ) {
    super(detalle ?? TITULOS[codigo]);
    this.name = "ErrorProblema";
    this.estado = ESTADO_POR_CODIGO[codigo];
  }

  aProblema(correlacion: string): Problema {
    return {
      type: tipoDeProblema(this.codigo),
      title: TITULOS[this.codigo],
      status: this.estado,
      codigo: this.codigo,
      correlacion,
      ...(this.detalle ? { detail: this.detalle } : {}),
      ...this.extensiones,
    };
  }
}

export const problema = (codigo: CodigoProblema, detalle?: string, extensiones?: Extensiones) =>
  new ErrorProblema(codigo, detalle, extensiones);
