import type { CodigoErrorValidacion } from "@teins/dominio";
import { ErrorApi, ErrorDeRed } from "@teins/protocolo";

/** Textos de oficina en español de Colombia, tratando de usted (el técnico se tutea en campo). */
export const mensajeDeValidacion: Record<CodigoErrorValidacion, string> = {
  campo_obligatorio: "Este dato es obligatorio. Si no se pudo obtener, márquelo y escriba el motivo.",
  medida_invalida: "Escriba solo el número, por ejemplo 12,5",
  unidad_no_permitida: "Elija una de las unidades del formato",
  fotos_insuficientes: "Faltan fotos",
  foto_invalida: "Hay una foto dañada",
  motivo_requerido: "Escriba por qué no se pudo obtener",
  texto_muy_largo: "El texto es demasiado largo",
  tipo_invalido: "Este dato no tiene la forma esperada",
  campo_desconocido: "Este dato no pertenece al formato",
  seccion_desconocida: "Esta sección no pertenece al formato",
  no_obtenido_no_permitido: "Este dato no es obligatorio: bórrelo en lugar de marcarlo",
  no_corregible: "Este dato no se corrige desde oficina",
  repeticiones_insuficientes: "Faltan repeticiones de esta sección",
  repeticiones_excedidas: "Hay más repeticiones de las que permite el formato",
  nombre_de_repeticion_invalido: "Una repetición no tiene nombre",
  boceto_invalido: "El boceto no tiene la forma esperada",
};

/** Lo que una persona de oficina necesita saber de un error al guardar. */
export function mensajeDeError(error: unknown): string {
  if (error instanceof ErrorDeRed) return "Sin conexión con el servidor. No se guardó nada; intente de nuevo al recuperar la conexión.";
  if (!(error instanceof ErrorApi)) return "No se pudo guardar. Intente de nuevo.";
  switch (error.codigo) {
    case "conflicto_de_version":
      return "Otra persona guardó cambios en este levantamiento mientras usted lo tenía abierto. Lo suyo no se guardó: recargue para ver la versión actual.";
    case "tomado_por_otro":
      return `${error.problema.revisor?.nombre ?? "Otra persona"} tomó la revisión antes que usted.`;
    case "no_tomado":
      return "Ya no tiene la revisión de este levantamiento: otra persona la tomó.";
    case "estado_invalido":
      return "El levantamiento cambió de estado. Recargue para ver cómo quedó.";
    case "respuestas_invalidas":
      return "Hay datos que no cumplen el formato. Revise los campos marcados.";
    case "no_autenticado":
      return "Su sesión venció. Inicie sesión de nuevo.";
    default:
      return error.message || "No se pudo guardar. Intente de nuevo.";
  }
}

/** El error se arregla recargando: la versión que se tenía abierta ya no es la vigente. */
export const pideRecargar = (error: unknown) =>
  error instanceof ErrorApi && ["conflicto_de_version", "tomado_por_otro", "no_tomado", "estado_invalido"].includes(error.codigo);
