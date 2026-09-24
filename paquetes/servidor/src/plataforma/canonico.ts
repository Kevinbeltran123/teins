import { createHash } from "node:crypto";

/** JSON con llaves ordenadas en todos los niveles: el mismo contenido siempre produce el mismo texto. */
export function canonico(valor: unknown): string {
  if (valor === null || valor === undefined) return "null";
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(",")}]`;
  if (valor instanceof Date) return JSON.stringify(valor.toISOString());
  if (typeof valor === "object") {
    const entradas = Object.entries(valor as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entradas.map(([k, v]) => `${JSON.stringify(k)}:${canonico(v)}`).join(",")}}`;
  }
  return JSON.stringify(valor);
}

export const huellaCanonica = (valor: unknown) => createHash("sha256").update(canonico(valor), "utf8").digest("hex");
