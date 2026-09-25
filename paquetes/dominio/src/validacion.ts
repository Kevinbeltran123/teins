import type { DefinicionCampo, VersionFormato } from "./formato";
import { esNoObtenido, type Respuestas } from "./levantamiento";

/** Límites compartidos por el dispositivo y el servidor. */
export const LIMITES = {
  texto: 10_000,
  motivo: 500,
  fotosPorCampo: 100,
} as const;

/** Forma canónica que produce `normalizarDecimal`: sin ceros a la izquierda, punto decimal. */
export const DECIMAL_CANONICO = /^(0|[1-9]\d*)(\.\d+)?$/;

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
  /** Oficina no corrige este tipo de campo (hoy, fotos). */
  | "no_corregible";

export interface ErrorValidacion {
  seccion: string;
  campo?: string;
  codigo: CodigoErrorValidacion;
}

/**
 * Valida las respuestas contra su versión de formato (reglas 3 y 5).
 * Es total: con cualquier entrada devuelve errores, nunca lanza, porque en el servidor
 * valida datos que llegan de un dispositivo.
 */
export function validarRespuestas(formato: VersionFormato, respuestas: Respuestas): ErrorValidacion[] {
  const errores: ErrorValidacion[] = [];
  const seccionesConocidas = new Set(formato.secciones.map((s) => s.clave));

  for (const [clave, valores] of Object.entries(respuestas)) {
    if (!seccionesConocidas.has(clave)) {
      errores.push({ seccion: clave, codigo: "seccion_desconocida" });
    } else if (typeof valores !== "object" || valores === null || Array.isArray(valores)) {
      errores.push({ seccion: clave, codigo: "tipo_invalido" });
    }
  }

  for (const seccion of formato.secciones) {
    const valores = respuestas[seccion.clave];
    const deSeccion = typeof valores === "object" && valores !== null && !Array.isArray(valores) ? valores : {};
    const camposConocidos = new Set(seccion.campos.map((c) => c.clave));
    for (const clave of Object.keys(deSeccion)) {
      if (!camposConocidos.has(clave)) errores.push({ seccion: seccion.clave, campo: clave, codigo: "campo_desconocido" });
    }
    for (const campo of seccion.campos) {
      const codigo = validarCampo(campo, deSeccion[campo.clave]);
      if (codigo) errores.push({ seccion: seccion.clave, campo: campo.clave, codigo });
    }
  }
  return errores;
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
      if (typeof valor.valor !== "string" || !DECIMAL_CANONICO.test(valor.valor)) return "medida_invalida";
      if (typeof valor.unidad !== "string" || !campo.unidades.includes(valor.unidad)) return "unidad_no_permitida";
      return null;
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
  }
}

/** Huellas de todas las fotos referenciadas, sin repetir. */
export function fotosReferenciadas(respuestas: Respuestas): string[] {
  const huellas = new Set<string>();
  for (const valores of Object.values(respuestas)) {
    if (typeof valores !== "object" || valores === null) continue;
    for (const valor of Object.values(valores)) {
      if (Array.isArray(valor)) for (const id of valor) if (typeof id === "string") huellas.add(id);
    }
  }
  return [...huellas];
}
