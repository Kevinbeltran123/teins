import type { DefinicionCampo } from "./formato";
import { esBoceto, esFirma, esNoObtenido, type Valor } from "./levantamiento";

/**
 * Un valor como lo lee una persona, en español de Colombia: "12,5 kVA", "No se pudo obtener: …".
 * Lo usan campo, oficina y el informe, para que el mismo dato se lea igual en todas partes.
 * Cubre todos los tipos: un tipo nuevo no compila hasta decir aquí cómo se lee.
 */
export function describirValor(campo: DefinicionCampo, valor: Valor | undefined): string {
  if (valor === undefined) return "Sin dato";
  if (esNoObtenido(valor)) return `No se pudo obtener: ${valor.motivo}`;
  if (typeof valor === "string") return valor;
  switch (campo.tipo) {
    case "cantidades":
      return Array.isArray(valor) ? (valor.length === 1 ? "1 línea" : `${valor.length} líneas`) : "Sin dato";
    case "foto":
      return Array.isArray(valor) ? (valor.length === 1 ? "1 foto" : `${valor.length} fotos`) : "Sin dato";
    case "boceto":
      return esBoceto(valor) ? "Boceto" : "Sin dato";
    case "firma":
      return esFirma(valor) ? `Firmada por ${valor.nombre}${valor.cargo ? ` (${valor.cargo})` : ""}` : "Sin dato";
    case "medida":
      return "valor" in valor ? `${valor.valor.replace(".", ",")} ${valor.unidad}` : "Sin dato";
    case "texto":
      return "Sin dato";
    default:
      return campo satisfies never;
  }
}
