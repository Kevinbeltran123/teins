import type { DefinicionCampo, VersionFormato } from "./formato";
import { esBoceto, esFirma, esHorario, esNoObtenido, esOpciones, type Respuestas } from "./levantamiento";
import { LIMITES_FIRMA } from "./firma";
import { LIMITES } from "./limites";
import { bloques, ID_REPETICION, leerClave, type Repeticiones } from "./repeticiones";
import { lineasValidas } from "./cantidades";
import { DECIMAL_CANONICO, DOCUMENTO_DE_IDENTIDAD, HORA_HHMM } from "./patrones";

export { DECIMAL_CANONICO, LIMITES };

export const HUELLA_SHA256 = /^[0-9a-f]{64}$/;

export type CodigoErrorValidacion =
  | "seccion_desconocida"
  | "campo_desconocido"
  | "tipo_invalido"
  | "campo_obligatorio"
  | "texto_muy_largo"
  | "medida_invalida"
  | "unidad_no_permitida"
  | "fotos_insuficientes"
  | "foto_invalida"
  | "motivo_requerido"
  | "no_obtenido_no_permitido"
  /** Secciones repetibles: menos repeticiones que el mínimo, más que el máximo, o un nombre vacío. */
  | "repeticiones_insuficientes"
  | "repeticiones_excedidas"
  | "nombre_de_repeticion_invalido"
  /** El valor de un boceto no es la huella de su archivo. */
  | "boceto_invalido"
  /** Una línea de cantidad sin descripción, con cantidad no positiva o con una unidad no permitida (regla 6). */
  | "cantidades_invalidas"
  /** Una firma sin sus trazos, sin el nombre de quien firmó, sin fecha o sin la constancia (ADR-0024). */
  | "firma_invalida"
  /** Una opción que no es del campo, repetida, o un «Otro» que el campo no admite o que no es texto (ADR-0050). */
  | "opcion_invalida"
  /** Una hora que no es HH:MM, de 00:00 a 23:59 (ADR-0050). */
  | "horario_invalido"
  /** Oficina no corrige este tipo de campo (hoy, fotos). */
  | "no_corregible"
  /** El archivo de un boceto o una firma pesa más de lo que recibe el servidor: lo mide el teléfono antes de enviar (iteración 42). */
  | "archivo_muy_grande";

export interface ErrorValidacion {
  seccion: string;
  campo?: string;
  codigo: CodigoErrorValidacion;
}

/**
 * Valida las respuestas contra su versión de formato (reglas 3 y 5) y, en las secciones repetibles,
 * sus repeticiones (F2). Es total: con cualquier entrada devuelve errores, nunca lanza, porque en el
 * servidor valida datos que llegan de un dispositivo.
 */
export function validarRespuestas(formato: VersionFormato, respuestas: Respuestas, repeticiones: Repeticiones = {}): ErrorValidacion[] {
  const errores: ErrorValidacion[] = [];
  const porClave = new Map(formato.secciones.map((s) => [s.clave, s]));

  // La lista de repeticiones: solo de secciones repetibles, con ids válidos y sin repetir, y nombres.
  const listas = new Map<string, readonly { id: string; nombre: string }[]>();
  // Secciones cuya lista ya se rechazó: sus conteos y respuestas no se reportan otra vez (un error, no una cascada).
  const rechazadas = new Set<string>();
  const deRepeticiones = typeof repeticiones === "object" && repeticiones !== null && !Array.isArray(repeticiones) ? repeticiones : {};
  for (const [clave, lista] of Object.entries(deRepeticiones)) {
    const seccion = porClave.get(clave);
    if (!seccion?.repetible) {
      errores.push({ seccion: clave, codigo: "seccion_desconocida" });
      continue;
    }
    const ids = Array.isArray(lista) ? lista.map((r) => (typeof r === "object" && r !== null ? (r as { id?: unknown }).id : undefined)) : [];
    if (!Array.isArray(lista) || ids.some((id) => typeof id !== "string" || !ID_REPETICION.test(id)) || new Set(ids).size !== ids.length) {
      errores.push({ seccion: clave, codigo: "tipo_invalido" });
      rechazadas.add(clave);
      continue;
    }
    if (lista.some((r) => typeof r.nombre !== "string" || r.nombre.trim() === "" || r.nombre.length > LIMITES.nombreDeRepeticion)) {
      errores.push({ seccion: clave, codigo: "nombre_de_repeticion_invalido" });
    }
    listas.set(clave, lista);
  }
  for (const seccion of formato.secciones) {
    if (!seccion.repetible || rechazadas.has(seccion.clave)) continue;
    const cantidad = listas.get(seccion.clave)?.length ?? 0;
    if (cantidad < (seccion.repetible.min ?? 0)) errores.push({ seccion: seccion.clave, codigo: "repeticiones_insuficientes" });
    if (cantidad > (seccion.repetible.max ?? LIMITES.repeticiones)) errores.push({ seccion: seccion.clave, codigo: "repeticiones_excedidas" });
  }

  const validos = bloques(formato, Object.fromEntries(listas));
  const clavesValidas = new Set(validos.map((b) => b.clave));
  for (const [clave, valores] of Object.entries(respuestas)) {
    if (rechazadas.has(leerClave(clave).seccion)) continue;
    if (!clavesValidas.has(clave)) {
      errores.push({ seccion: clave, codigo: "seccion_desconocida" });
    } else if (typeof valores !== "object" || valores === null || Array.isArray(valores)) {
      errores.push({ seccion: clave, codigo: "tipo_invalido" });
    }
  }

  for (const bloque of validos) {
    const valores = respuestas[bloque.clave];
    const deBloque = typeof valores === "object" && valores !== null && !Array.isArray(valores) ? valores : {};
    const camposConocidos = new Set(bloque.seccion.campos.map((c) => c.clave));
    for (const clave of Object.keys(deBloque)) {
      if (!camposConocidos.has(clave)) errores.push({ seccion: bloque.clave, campo: clave, codigo: "campo_desconocido" });
    }
    for (const campo of bloque.seccion.campos) {
      const codigo = validarCampo(campo, deBloque[campo.clave]);
      if (codigo) errores.push({ seccion: bloque.clave, campo: campo.clave, codigo });
    }
  }
  return errores;
}

/** La definición del campo de una ruta de respuestas (`seccion` o `seccion~id`), si la repetición existe. */
export function campoDeRuta(formato: VersionFormato, repeticiones: Repeticiones, seccion: string, campo: string): DefinicionCampo | undefined {
  const { seccion: clave, repeticion } = leerClave(seccion);
  const definicion = formato.secciones.find((s) => s.clave === clave);
  if (!definicion || Boolean(definicion.repetible) !== (repeticion !== undefined)) return undefined;
  if (repeticion !== undefined && !(repeticiones[clave] ?? []).some((r) => r.id === repeticion)) return undefined;
  return definicion.campos.find((c) => c.clave === campo);
}

/** Valida un solo valor contra su campo, con las mismas reglas del envío. */
export function validarCampo(campo: DefinicionCampo, valor: unknown): CodigoErrorValidacion | null {
  if (esNoObtenido(valor)) {
    if (!campo.obligatorio) return "no_obtenido_no_permitido";
    if (typeof valor.motivo !== "string" || valor.motivo.trim() === "") return "motivo_requerido";
    if (valor.motivo.length > LIMITES.motivo) return "texto_muy_largo";
    return null;
  }

  switch (campo.tipo) {
    case "texto": {
      if (valor === undefined) return campo.obligatorio ? "campo_obligatorio" : null;
      if (typeof valor !== "string") return "tipo_invalido";
      if (valor.trim() === "") return campo.obligatorio ? "campo_obligatorio" : null;
      return valor.length > LIMITES.texto ? "texto_muy_largo" : null;
    }
    case "medida": {
      if (valor === undefined) return campo.obligatorio ? "campo_obligatorio" : null;
      if (typeof valor !== "object" || valor === null || !("valor" in valor) || !("unidad" in valor)) return "tipo_invalido";
      if (typeof valor.valor !== "string" || valor.valor.length > LIMITES.decimal || !DECIMAL_CANONICO.test(valor.valor)) return "medida_invalida";
      if (typeof valor.unidad !== "string" || !campo.unidades.includes(valor.unidad)) return "unidad_no_permitida";
      return null;
    }
    case "opcion": {
      if (valor === undefined) return campo.obligatorio ? "campo_obligatorio" : null;
      if (typeof valor !== "string") return "tipo_invalido";
      if (valor.trim() === "") return campo.obligatorio ? "campo_obligatorio" : null;
      if (campo.opciones.includes(valor)) return null;
      return campo.otro && valor.length <= LIMITES.otro ? null : "opcion_invalida";
    }
    case "opciones": {
      if (valor === undefined) return campo.obligatorio ? "campo_obligatorio" : null;
      if (!esOpciones(valor) || Object.keys(valor).some((k) => k !== "elegidas" && k !== "otro")) return "tipo_invalido";
      const { elegidas, otro } = valor;
      if (!Array.isArray(elegidas)) return "tipo_invalido";
      if (elegidas.some((o) => typeof o !== "string" || !campo.opciones.includes(o)) || new Set(elegidas).size !== elegidas.length) return "opcion_invalida";
      if (otro !== undefined && (!campo.otro || typeof otro !== "string" || otro.trim() === "" || otro.length > LIMITES.otro)) return "opcion_invalida";
      return elegidas.length === 0 && otro === undefined && campo.obligatorio ? "campo_obligatorio" : null;
    }
    case "horario": {
      if (valor === undefined) return campo.obligatorio ? "campo_obligatorio" : null;
      if (!esHorario(valor) || Object.keys(valor).some((k) => k !== "desde" && k !== "hasta")) return "tipo_invalido";
      const { desde, hasta } = valor;
      if (typeof desde !== "string" || !HORA_HHMM.test(desde) || (hasta !== undefined && (typeof hasta !== "string" || !HORA_HHMM.test(hasta)))) return "horario_invalido";
      return hasta === undefined && campo.obligatorio ? "campo_obligatorio" : null;
    }
    case "foto": {
      const minimo = Math.max(campo.min ?? 0, campo.obligatorio ? 1 : 0);
      if (valor === undefined) return minimo > 0 ? (campo.obligatorio ? "campo_obligatorio" : "fotos_insuficientes") : null;
      if (!Array.isArray(valor)) return "tipo_invalido";
      if (valor.length > LIMITES.fotosPorCampo) return "tipo_invalido";
      if (valor.some((id) => typeof id !== "string" || !HUELLA_SHA256.test(id)) || new Set(valor).size !== valor.length) {
        return "foto_invalida";
      }
      if (valor.length < minimo) return valor.length === 0 && campo.obligatorio ? "campo_obligatorio" : "fotos_insuficientes";
      return null;
    }
    case "cantidades": {
      if (valor === undefined) return campo.obligatorio ? "campo_obligatorio" : null;
      if (!Array.isArray(valor)) return "tipo_invalido";
      if (valor.length === 0) return campo.obligatorio ? "campo_obligatorio" : null;
      return lineasValidas(valor, campo.unidades) ? null : "cantidades_invalidas";
    }
    case "boceto": {
      if (valor === undefined) return campo.obligatorio ? "campo_obligatorio" : null;
      if (!esBoceto(valor) || Object.keys(valor).length !== 1) return "tipo_invalido";
      return typeof valor.boceto === "string" && HUELLA_SHA256.test(valor.boceto) ? null : "boceto_invalido";
    }
    case "firma": {
      if (valor === undefined) return campo.obligatorio ? "campo_obligatorio" : null;
      if (!esFirma(valor) || Object.keys(valor).some((k) => !CLAVES_FIRMA.has(k))) return "tipo_invalido";
      const { firma, nombre, cargo, firmadoEn, declaracion, documento } = valor;
      // La cédula solo la recibe un formato que la pide (ADR-0050); si llega, tiene que ser válida.
      const documentoValido = documento === undefined ? campo.documento !== "obligatorio" : campo.documento !== undefined && typeof documento === "string" && DOCUMENTO_DE_IDENTIDAD.test(documento);
      const texto = (t: unknown, maximo: number) => typeof t === "string" && t.trim() !== "" && t.length <= maximo;
      const valida =
        typeof firma === "string" && HUELLA_SHA256.test(firma) &&
        texto(nombre, LIMITES_FIRMA.nombre) &&
        (cargo === undefined || texto(cargo, LIMITES_FIRMA.cargo)) &&
        typeof firmadoEn === "string" && !Number.isNaN(Date.parse(firmadoEn)) &&
        texto(declaracion, LIMITES_FIRMA.declaracion) &&
        documentoValido;
      return valida ? null : "firma_invalida";
    }
  }
}

const CLAVES_FIRMA = new Set(["firma", "nombre", "cargo", "firmadoEn", "declaracion", "documento"]);

/**
 * Recorre las respuestas una sola vez y junta las huellas de archivos, sin repetir. Un tipo de valor nuevo con
 * archivo se agrega aquí y lo ven todas las funciones de abajo.
 */
function huellasReferenciadas(respuestas: Respuestas, incluir: { fotos: boolean; trazos: boolean }): string[] {
  const huellas = new Set<string>();
  for (const valores of Object.values(respuestas)) {
    if (typeof valores !== "object" || valores === null) continue;
    for (const valor of Object.values(valores)) {
      if (incluir.fotos && Array.isArray(valor)) for (const id of valor) if (typeof id === "string") huellas.add(id);
      if (incluir.trazos && esBoceto(valor) && typeof valor.boceto === "string") huellas.add(valor.boceto);
      if (incluir.trazos && esFirma(valor) && typeof valor.firma === "string") huellas.add(valor.firma);
    }
  }
  return [...huellas];
}

/** Huellas de todas las fotos referenciadas, sin repetir. */
export const fotosReferenciadas = (respuestas: Respuestas) => huellasReferenciadas(respuestas, { fotos: true, trazos: false });

/**
 * Huellas de todos los archivos que referencian las respuestas: fotos y bocetos. Son los que deben estar
 * subidos y verificados antes de registrar un envío (QA-2).
 */
export const archivosReferenciados = (respuestas: Respuestas) => huellasReferenciadas(respuestas, { fotos: true, trazos: true });

/**
 * Huellas de los documentos de trazos (bocetos y firmas): suben al enviar, no antes, porque mientras es
 * borrador se pueden reemplazar (ADR-0019, parte 3; ADR-0024).
 */
export const bocetosReferenciados = (respuestas: Respuestas) => huellasReferenciadas(respuestas, { fotos: false, trazos: true });
