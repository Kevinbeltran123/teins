/**
 * Cantidades (F9, reglas 6 y 7): materiales y trabajos que anota el técnico, en texto libre y sin precio.
 * Oficina las vincula al catálogo, las suma por visita y las exporta. La cantidad es un decimal en texto,
 * como la medida (ADR-0006): nada de coma flotante en lo que después se cotiza.
 */
import { LIMITES_CANTIDADES } from "./limites";

export interface LineaCantidad {
  /** Id estable de la línea (8 caracteres): el vínculo al catálogo y las correcciones la siguen por él. */
  id: string;
  descripcion: string;
  /** Decimal canónico mayor que cero ("12.5"). */
  cantidad: string;
  unidad: string;
  observacion?: string | undefined;
}

export type ValorCantidades = readonly LineaCantidad[];

/** Primera versión de `campo` que captura cantidades (ADR-0015, punto 4). */
export const VERSION_APP_CANTIDADES = 6;

export const ID_LINEA = /^[a-z0-9]{8}$/;
const DECIMAL = /^(0|[1-9]\d*)(\.\d+)?$/;

/** Una tabla de cantidades: un arreglo de líneas (objetos), a diferencia de las fotos (huellas). */
export const esCantidades = (valor: unknown): valor is ValorCantidades => Array.isArray(valor) && valor.every((l) => typeof l === "object" && l !== null && !Array.isArray(l));

/** ¿La tabla cumple la regla 6? Descripción, cantidad mayor que cero, unidad permitida e ids únicos. */
export function lineasValidas(lineas: readonly unknown[], unidades: readonly string[]): boolean {
  if (lineas.length > LIMITES_CANTIDADES.lineas) return false;
  const ids = new Set<string>();
  for (const l of lineas) {
    if (typeof l !== "object" || l === null) return false;
    const { id, descripcion, cantidad, unidad, observacion } = l as Record<string, unknown>;
    if (typeof id !== "string" || !ID_LINEA.test(id) || ids.has(id)) return false;
    ids.add(id);
    if (typeof descripcion !== "string" || descripcion.trim() === "" || descripcion.length > LIMITES_CANTIDADES.descripcion) return false;
    if (typeof cantidad !== "string" || !DECIMAL.test(cantidad) || /^0(\.0+)?$/.test(cantidad)) return false;
    if (typeof unidad !== "string" || !unidades.includes(unidad)) return false;
    if (observacion !== undefined && (typeof observacion !== "string" || observacion.length > LIMITES_CANTIDADES.observacion)) return false;
    const extra = Object.keys(l).filter((k) => !["id", "descripcion", "cantidad", "unidad", "observacion"].includes(k));
    if (extra.length > 0) return false;
  }
  return true;
}

/** Suma exacta de dos decimales canónicos: "0.1" + "0.2" = "0.3". */
export function sumarDecimales(a: string, b: string): string {
  const [ea = "0", fa = ""] = a.split(".");
  const [eb = "0", fb = ""] = b.split(".");
  const decimales = Math.max(fa.length, fb.length);
  const total = (BigInt(ea + fa.padEnd(decimales, "0")) + BigInt(eb + fb.padEnd(decimales, "0"))).toString().padStart(decimales + 1, "0");
  const entero = total.slice(0, total.length - decimales).replace(/^0+(?=\d)/, "");
  const fraccion = total.slice(total.length - decimales).replace(/0+$/, "");
  return fraccion ? `${entero}.${fraccion}` : entero;
}

/** Como se escribe en Colombia y lo lee Excel en español: coma decimal. */
export const aDecimalColombiano = (decimal: string) => decimal.replace(".", ",");

export interface LineaParaResumir {
  descripcion: string;
  cantidad: string;
  unidad: string;
  /** Ítem del catálogo al que oficina la vinculó, si lo hizo. */
  item?: { codigo: string; descripcion: string } | null | undefined;
}

export interface FilaDeResumen {
  codigo: string | null;
  descripcion: string;
  unidad: string;
  cantidad: string;
  lineas: number;
}

const normalizar = (t: string) => t.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Suma por ítem de catálogo y unidad; lo no vinculado, por descripción (sin distinguir mayúsculas ni
 * espacios) y unidad. Primero lo vinculado, por código; después lo demás, por descripción.
 */
export function resumirCantidades(lineas: readonly LineaParaResumir[]): FilaDeResumen[] {
  const filas = new Map<string, FilaDeResumen>();
  for (const l of lineas) {
    const llave = l.item ? `item\u0000${l.item.codigo}\u0000${l.unidad}` : `texto\u0000${normalizar(l.descripcion)}\u0000${l.unidad}`;
    const fila = filas.get(llave);
    if (fila) {
      fila.cantidad = sumarDecimales(fila.cantidad, l.cantidad);
      fila.lineas++;
    } else {
      filas.set(llave, { codigo: l.item?.codigo ?? null, descripcion: l.item?.descripcion ?? l.descripcion.trim(), unidad: l.unidad, cantidad: l.cantidad, lineas: 1 });
    }
  }
  return [...filas.values()].sort(
    (a, b) => Number(a.codigo === null) - Number(b.codigo === null) || (a.codigo ?? "").localeCompare(b.codigo ?? "") || a.descripcion.localeCompare(b.descripcion) || a.unidad.localeCompare(b.unidad),
  );
}
