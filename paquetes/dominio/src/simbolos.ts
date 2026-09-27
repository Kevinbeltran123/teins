/**
 * Símbolos de los bocetos (iteración 19, ADR-0027): tableros, UPS, tomas, luminarias… que el técnico pone con
 * un toque en vez de dibujarlos. Son datos de la organización, no código (R7): oficina publica su biblioteca, baja
 * a los teléfonos como el catálogo y cada símbolo que se usa se copia dentro del boceto.
 *
 * Un símbolo se dibuja en una caja de 100 × 100: un trazado SVG (líneas, sin relleno), un relleno opcional y una
 * sigla opcional en el centro ("UPS").
 */
import { LIMITES_SIMBOLO } from "./limites";

export interface DefinicionSimbolo {
  id: string;
  nombre: string;
  /** Agrupa la biblioteca en el teléfono: "Energía", "Datos", "Obra". */
  categoria: string;
  trazado: string;
  relleno?: string | undefined;
  texto?: string | undefined;
  /** Código del ítem del catálogo que representa, para contarlo algún día como cantidad. */
  codigo?: string | undefined;
}

/** Primera versión de `campo` que recibe la biblioteca y pone símbolos (ADR-0015, punto 4). */
export const VERSION_APP_SIMBOLOS = 10;

/** Ancho de las líneas de un símbolo en la hoja, sea cual sea su tamaño (el mismo de las formas). */
export const GROSOR_SIMBOLO = 5;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TOKEN = /\s*(?:([MmLlHhVvCcSsQqTtAaZz])|([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)|(,))/y;

/**
 * Un trazado SVG que empieza con M y solo tiene comandos y números razonables. Va dentro del SVG del PDF: nada
 * que no sea geometría pasa.
 */
export function esTrazadoValido(d: unknown): d is string {
  if (typeof d !== "string" || d.trim() === "" || d.length > LIMITES_SIMBOLO.trazado) return false;
  let posicion = 0;
  let primero = true;
  for (;;) {
    TOKEN.lastIndex = posicion;
    const m = TOKEN.exec(d);
    if (!m) break;
    posicion = TOKEN.lastIndex;
    if (primero && m[1] !== "M" && m[1] !== "m") return false;
    primero = false;
    if (m[2] !== undefined && Math.abs(Number(m[2])) > 1000) return false;
  }
  return !primero && d.slice(posicion).trim() === "";
}

const textoValido = (t: unknown, max: number) => typeof t === "string" && t.trim() !== "" && t.length <= max;

/** Un símbolo de la biblioteca que llega de afuera (el comando que la publica). Total: nunca lanza. */
export function validarSimbolo(valor: unknown): string[] {
  if (typeof valor !== "object" || valor === null) return ["No es un símbolo"];
  const s = valor as Record<string, unknown>;
  const errores: string[] = [];
  if (typeof s.id !== "string" || !UUID.test(s.id)) errores.push("id inválido");
  if (!textoValido(s.nombre, LIMITES_SIMBOLO.nombre)) errores.push("nombre inválido");
  if (!textoValido(s.categoria, LIMITES_SIMBOLO.categoria)) errores.push("categoría inválida");
  if (!esTrazadoValido(s.trazado)) errores.push("trazado inválido");
  if (s.relleno !== undefined && !esTrazadoValido(s.relleno)) errores.push("relleno inválido");
  if (s.texto !== undefined && !textoValido(s.texto, LIMITES_SIMBOLO.texto)) errores.push("texto inválido");
  if (s.codigo !== undefined && !textoValido(s.codigo, LIMITES_SIMBOLO.codigo)) errores.push("código inválido");
  return errores;
}

/** La biblioteca completa: cada símbolo válido, sin ids ni nombres repetidos. */
export function validarBiblioteca(valor: unknown): string[] {
  if (!Array.isArray(valor)) return ["La biblioteca debe ser una lista de símbolos"];
  if (valor.length > LIMITES_SIMBOLO.porBiblioteca) return [`Más de ${LIMITES_SIMBOLO.porBiblioteca} símbolos`];
  const errores = valor.flatMap((s, i) => validarSimbolo(s).map((e) => `Símbolo ${i + 1}: ${e}`));
  const repetidos = (clave: "id" | "nombre") => {
    const vistos = new Set<string>();
    for (const s of valor as Record<string, unknown>[]) {
      const v = typeof s?.[clave] === "string" ? (s[clave] as string).trim().toLowerCase() : "";
      if (v && vistos.has(v)) errores.push(`${clave === "id" ? "id" : "Nombre"} repetido: ${s[clave] as string}`);
      vistos.add(v);
    }
  };
  repetidos("id");
  repetidos("nombre");
  return errores;
}
