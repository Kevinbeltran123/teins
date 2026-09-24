import type { VersionFormato } from "./formato";
import { LIMITES } from "./validacion";

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
    const campos = new Set<string>();
    for (const campo of seccion.campos) {
      const ruta = `${seccion.clave}.${campo.clave}`;
      if (campos.has(campo.clave)) errores.push(`Campo repetido: ${ruta}`);
      campos.add(campo.clave);
      if (campo.tipo === "medida" && new Set(campo.unidades).size !== campo.unidades.length) errores.push(`Unidades repetidas en ${ruta}`);
      if (campo.tipo === "foto" && (campo.min ?? 0) > LIMITES.fotosPorCampo) errores.push(`Mínimo de fotos imposible en ${ruta}`);
    }
  }
  return errores;
}
