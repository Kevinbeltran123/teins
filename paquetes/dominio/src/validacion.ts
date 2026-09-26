import type { DefinicionCampo, VersionFormato } from "./formato";
import { esNoObtenido, type Respuestas } from "./levantamiento";
import { LIMITES } from "./limites";
import { bloques, ID_REPETICION, leerClave, type Repeticiones } from "./repeticiones";

export { LIMITES };

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
  /** Secciones repetibles: menos repeticiones que el mínimo, más que el máximo, o un nombre vacío. */
  | "repeticiones_insuficientes"
  | "repeticiones_excedidas"
  | "nombre_de_repeticion_invalido"
  /** Oficina no corrige este tipo de campo (hoy, fotos). */
  | "no_corregible";

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
      continue;
    }
    if (lista.some((r) => typeof r.nombre !== "string" || r.nombre.trim() === "" || r.nombre.length > LIMITES.nombreDeRepeticion)) {
      errores.push({ seccion: clave, codigo: "nombre_de_repeticion_invalido" });
    }
    listas.set(clave, lista);
  }
  for (const seccion of formato.secciones) {
    if (!seccion.repetible) continue;
    const cantidad = listas.get(seccion.clave)?.length ?? 0;
    if (cantidad < (seccion.repetible.min ?? 0)) errores.push({ seccion: seccion.clave, codigo: "repeticiones_insuficientes" });
    if (cantidad > (seccion.repetible.max ?? LIMITES.repeticiones)) errores.push({ seccion: seccion.clave, codigo: "repeticiones_excedidas" });
  }

  const validos = bloques(formato, Object.fromEntries(listas));
  const clavesValidas = new Set(validos.map((b) => b.clave));
  for (const [clave, valores] of Object.entries(respuestas)) {
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
