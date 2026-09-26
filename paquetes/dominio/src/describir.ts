import type { DefinicionCampo } from "./formato";
import { esBoceto, esFirma, esNoObtenido, type Valor } from "./levantamiento";

/**
 * Un valor como lo lee una persona, en español de Colombia: "12,5 kVA", "No se pudo obtener: …".
 * Lo usan campo, oficina y el informe, para que el mismo dato se lea igual en todas partes.
 */
export function describirValor(campo: DefinicionCampo, valor: Valor | undefined): string {
  if (valor === undefined) return "Sin dato";
  if (esNoObtenido(valor)) return `No se pudo obtener: ${valor.motivo}`;
  if (typeof valor === "string") return valor;
  if (campo.tipo === "cantidades" && Array.isArray(valor)) return valor.length === 1 ? "1 línea" : `${valor.length} líneas`;
  if (Array.isArray(valor)) return valor.length === 1 ? "1 foto" : `${valor.length} fotos`;
  if (esBoceto(valor)) return "Boceto";
  if (esFirma(valor)) return `Firmada por ${valor.nombre}${valor.cargo ? ` (${valor.cargo})` : ""}`;
  if (campo.tipo === "medida" && "valor" in valor) return `${valor.valor.replace(".", ",")} ${valor.unidad}`;
  return "Sin dato";
}
