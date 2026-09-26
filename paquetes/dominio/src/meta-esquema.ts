import type { VersionFormato } from "./formato";
import { LIMITES } from "./limites";
import { VERSION_APP_REPETIBLES } from "./repeticiones";
import { VERSION_APP_BOCETOS } from "./boceto";
import { VERSION_APP_CANTIDADES } from "./cantidades";

/**
 * Reglas semánticas del meta-esquema (ADR-0006, regla 1): lo que la forma sola no garantiza.
 * Una definición con errores nunca se publica ni llega a un dispositivo.
 */
export function validarDefinicionFormato(definicion: VersionFormato): string[] {
  const errores: string[] = [];
  if (definicion.secciones.length === 0) errores.push("El formato no tiene secciones");
  const secciones = new Set<string>();
  for (const seccion of definicion.secciones) {
    if (secciones.has(seccion.clave)) errores.push(`Sección repetida: ${seccion.clave}`);
    secciones.add(seccion.clave);
    if (seccion.campos.length === 0) errores.push(`La sección ${seccion.clave} no tiene campos`);
    if (seccion.repetible) {
      const { etiqueta, min = 0, max = LIMITES.repeticiones } = seccion.repetible;
      if (etiqueta.trim() === "") errores.push(`La sección ${seccion.clave} necesita la etiqueta de sus repeticiones`);
      if (min < 0 || max < 1 || min > max || max > LIMITES.repeticiones) errores.push(`Límites imposibles en la sección repetible ${seccion.clave}`);
    }
    const campos = new Set<string>();
    for (const campo of seccion.campos) {
      const ruta = `${seccion.clave}.${campo.clave}`;
      if (campos.has(campo.clave)) errores.push(`Campo repetido: ${ruta}`);
      campos.add(campo.clave);
      if ((campo.tipo === "medida" || campo.tipo === "cantidades") && new Set(campo.unidades).size !== campo.unidades.length) errores.push(`Unidades repetidas en ${ruta}`);
      if (campo.tipo === "cantidades" && campo.unidades.length === 0) errores.push(`Sin unidades en ${ruta}`);
      if (campo.tipo === "foto" && (campo.min ?? 0) > LIMITES.fotosPorCampo) errores.push(`Mínimo de fotos imposible en ${ruta}`);
    }
  }
  // Una app anterior no sabe capturarlas: la bajada no le entrega este formato (ADR-0015, punto 4).
  if (definicion.secciones.some((s) => s.repetible) && (definicion.appMinima ?? 0) < VERSION_APP_REPETIBLES) {
    errores.push(`Las secciones repetibles exigen appMinima ${VERSION_APP_REPETIBLES} o mayor`);
  }
  if (definicion.secciones.some((s) => s.campos.some((c) => c.tipo === "cantidades")) && (definicion.appMinima ?? 0) < VERSION_APP_CANTIDADES) {
    errores.push(`Las cantidades exigen appMinima ${VERSION_APP_CANTIDADES} o mayor`);
  }
  if (definicion.secciones.some((s) => s.campos.some((c) => c.tipo === "boceto")) && (definicion.appMinima ?? 0) < VERSION_APP_BOCETOS) {
    errores.push(`Los bocetos exigen appMinima ${VERSION_APP_BOCETOS} o mayor`);
  }
  return errores;
}
