import { LIMITES_FIRMA, VERSION_APP_FIRMA } from "./firma";
import { VERSION_APP_DOCUMENTO_DE_FIRMA, VERSION_APP_HORARIO, VERSION_APP_OPCIONES, VERSION_APP_SELLO, VERSION_APP_TABLAS, type DefinicionSeccion, type VersionFormato } from "./formato";
import { LIMITES } from "./limites";
import { VERSION_APP_REPETIBLES } from "./repeticiones";
import { erroresDeVisibilidad, usaVisibilidad, VERSION_APP_VISIBILIDAD } from "./visibilidad";
import { VERSION_APP_BOCETOS } from "./boceto";
import { VERSION_APP_CANTIDADES } from "./cantidades";

/**
 * Reglas semánticas del meta-esquema (ADR-0006, regla 1): lo que la forma sola no garantiza.
 * Una definición con errores nunca se publica ni llega a un dispositivo.
 */
/** Las reglas de `tablas` de una sección (ADR-0050): cada celda es un campo `medida` que ya existe. */
function erroresDeTablas(seccion: DefinicionSeccion): string[] {
  const errores: string[] = [];
  const porClave = new Map(seccion.campos.map((c) => [c.clave, c]));
  const usados = new Set<string>();
  for (const tabla of seccion.tablas ?? []) {
    if (tabla.columnas.length < 1 || tabla.columnas.length > 4) errores.push(`Una tabla de ${seccion.clave} necesita de 1 a 4 columnas`);
    for (const fila of tabla.filas) {
      if (fila.campos.length !== 1 && fila.campos.length !== tabla.columnas.length) errores.push(`La fila ${fila.etiqueta} de la tabla de ${seccion.clave} necesita 1 campo o ${tabla.columnas.length}`);
      const unidades = new Set<string>();
      for (const clave of fila.campos) {
        const campo = porClave.get(clave);
        const ruta = `${seccion.clave}.${clave}`;
        if (!campo) {
          errores.push(`La tabla de ${seccion.clave} usa un campo que no existe: ${clave}`);
          continue;
        }
        if (usados.has(clave)) errores.push(`El campo ${ruta} aparece más de una vez en las tablas`);
        usados.add(clave);
        if (campo.tipo !== "medida") {
          errores.push(`El campo ${ruta} de la tabla debe ser una medida`);
          continue;
        }
        if (campo.unidades.length !== 1) errores.push(`El campo ${ruta} de la tabla debe tener una sola unidad`);
        // Dentro de una tabla no hay «No se pudo obtener»: una celda vacía es una celda vacía.
        if (campo.obligatorio) errores.push(`El campo ${ruta} de la tabla no puede ser obligatorio`);
        unidades.add(campo.unidades[0] ?? "");
      }
      if (unidades.size > 1) errores.push(`La fila ${fila.etiqueta} de la tabla de ${seccion.clave} mezcla unidades`);
    }
  }
  return errores;
}

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
    errores.push(...erroresDeTablas(seccion));
    const campos = new Set<string>();
    for (const campo of seccion.campos) {
      const ruta = `${seccion.clave}.${campo.clave}`;
      if (campos.has(campo.clave)) errores.push(`Campo repetido: ${ruta}`);
      campos.add(campo.clave);
      if ((campo.tipo === "medida" || campo.tipo === "cantidades") && new Set(campo.unidades).size !== campo.unidades.length) errores.push(`Unidades repetidas en ${ruta}`);
      if (campo.tipo === "cantidades" && campo.unidades.length === 0) errores.push(`Sin unidades en ${ruta}`);
      if (campo.tipo === "foto" && (campo.min ?? 0) > LIMITES.fotosPorCampo) errores.push(`Mínimo de fotos imposible en ${ruta}`);
      // Sin obligatorio, un mínimo de fotos bloquea el envío y no deja marcar «No se pudo obtener» (regla 3, iteración 42).
      if (campo.tipo === "foto" && (campo.min ?? 0) > 0 && !campo.obligatorio) errores.push(`Un mínimo de fotos exige que ${ruta} sea obligatorio`);
      if (campo.tipo === "opcion" || campo.tipo === "opciones") {
        if (campo.opciones.length < 2 || campo.opciones.length > 20) errores.push(`Una selección necesita de 2 a 20 opciones en ${ruta}`);
        if (new Set(campo.opciones).size !== campo.opciones.length) errores.push(`Opciones repetidas en ${ruta}`);
        if (campo.opciones.some((o) => o.trim() === "" || o.length > LIMITES.opcion)) errores.push(`Cada opción de ${ruta} necesita de 1 a ${LIMITES.opcion} caracteres`);
      }
      // El compilador ya lo impide; esto cubre una definición que llega de un archivo.
      if ("sello" in campo && campo.tipo !== "foto") errores.push(`El sello solo va en fotos: ${ruta}`);
      if ("documento" in campo && campo.tipo !== "firma") errores.push(`La cédula solo va en firmas: ${ruta}`);
      if (campo.tipo === "firma" && campo.declaracion !== undefined && (campo.declaracion.trim() === "" || campo.declaracion.length > LIMITES_FIRMA.declaracion)) {
        errores.push(`Constancia vacía o demasiado larga en ${ruta}`);
      }
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
  if (definicion.secciones.some((s) => s.campos.some((c) => c.tipo === "firma")) && (definicion.appMinima ?? 0) < VERSION_APP_FIRMA) {
    errores.push(`Las firmas exigen appMinima ${VERSION_APP_FIRMA} o mayor`);
  }
  const usa = (algun: (c: VersionFormato["secciones"][number]["campos"][number]) => boolean) => definicion.secciones.some((s) => s.campos.some(algun));
  const app = definicion.appMinima ?? 0;
  if (usa((c) => c.tipo === "opcion" || c.tipo === "opciones") && app < VERSION_APP_OPCIONES) errores.push(`Las selecciones exigen appMinima ${VERSION_APP_OPCIONES} o mayor`);
  if (usa((c) => c.tipo === "horario") && app < VERSION_APP_HORARIO) errores.push(`Los horarios exigen appMinima ${VERSION_APP_HORARIO} o mayor`);
  if (definicion.secciones.some((s) => (s.tablas?.length ?? 0) > 0) && app < VERSION_APP_TABLAS) errores.push(`Las tablas de medidas exigen appMinima ${VERSION_APP_TABLAS} o mayor`);
  if (usa((c) => c.tipo === "foto" && c.sello !== undefined) && app < VERSION_APP_SELLO) errores.push(`El sello de las fotos exige appMinima ${VERSION_APP_SELLO} o mayor`);
  if (usa((c) => c.tipo === "firma" && c.documento !== undefined) && app < VERSION_APP_DOCUMENTO_DE_FIRMA) errores.push(`La cédula de la firma exige appMinima ${VERSION_APP_DOCUMENTO_DE_FIRMA} o mayor`);
  errores.push(...erroresDeVisibilidad(definicion));
  if (usaVisibilidad(definicion) && app < VERSION_APP_VISIBILIDAD) errores.push(`Los campos condicionales exigen appMinima ${VERSION_APP_VISIBILIDAD} o mayor`);
  return errores;
}
