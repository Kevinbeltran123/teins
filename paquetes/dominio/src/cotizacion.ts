/*
  Cotización (iteración 21): las líneas salen de las cantidades revisadas y el precio, de la lista de
  precios de oficina; nunca de la línea de cantidad (regla 7). Todo en pesos enteros: las cantidades son
  decimales exactos y nada pasa por coma flotante (regla de las cantidades).
*/
import { resumirCantidades } from "./cantidades";

/** Tarifa general de IVA en Colombia. */
export const TARIFA_IVA = "19";

/** IVA sobre el subtotal, o AIU con el IVA sobre la utilidad; el contador de TEINS decide en cada caso. */
export type Impuestos = { tipo: "iva" } | { tipo: "aiu"; administracion: string; imprevistos: string; utilidad: string };

export interface LineaDeCotizacion {
  id: string;
  itemId: string | null;
  codigo: string | null;
  descripcion: string;
  /** Decimal canónico, como en las cantidades. */
  cantidad: string;
  unidad: string;
  /** Pesos por unidad, sin IVA; null mientras nadie lo escribe. */
  precio: number | null;
  /** El de la lista al crear la línea: si oficina lo cambia, se ve cuál era. */
  precioCatalogo: number | null;
  /** De las cantidades de la visita o agregada en oficina (mano de obra, transporte). */
  origen: "cantidades" | "oficina";
}

export interface CondicionesCotizacion {
  validezDias: number;
  formaPago: string;
  notas: string;
}

export interface BorradorCotizacion {
  lineas: readonly LineaDeCotizacion[];
  impuestos: Impuestos;
  condiciones: CondicionesCotizacion;
}

export interface Totales {
  /** Total de cada línea, en el mismo orden; null si no tiene precio. */
  lineas: (number | null)[];
  subtotal: number;
  iva: number;
  aiu: { administracion: number; imprevistos: number; utilidad: number; ivaUtilidad: number } | null;
  total: number;
  sinPrecio: number;
}

const DECIMAL = /^(0|[1-9]\d*)(\.\d+)?$/;
/** Porcentaje con hasta dos decimales. */
export const PORCENTAJE = /^(0|[1-9]\d{0,2})(\.\d{1,2})?$/;

/** a / b redondeado al entero, la mitad hacia arriba (todo positivo). */
function dividirRedondeando(a: bigint, b: bigint): bigint {
  const cociente = a / b;
  return (a % b) * 2n >= b ? cociente + 1n : cociente;
}

/** "12.5" → 125n y escala 10n. */
function comoFraccion(decimal: string): { numerador: bigint; escala: bigint } {
  if (!DECIMAL.test(decimal)) throw new Error(`Decimal inválido: ${decimal}`);
  const [entero = "0", fraccion = ""] = decimal.split(".");
  return { numerador: BigInt(entero + fraccion), escala: 10n ** BigInt(fraccion.length) };
}

function aNumero(valor: bigint): number {
  if (valor > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("El monto excede lo que se puede representar");
  return Number(valor);
}

/** Cantidad × precio, redondeado al peso. */
export function totalDeLinea(cantidad: string, precio: number): number {
  const { numerador, escala } = comoFraccion(cantidad);
  return aNumero(dividirRedondeando(numerador * BigInt(precio), escala));
}

/** El porcentaje de una base en pesos, redondeado al peso. */
export function porcentaje(base: number, pct: string): number {
  const { numerador, escala } = comoFraccion(pct);
  return aNumero(dividirRedondeando(BigInt(base) * numerador, escala * 100n));
}

export function calcularTotales(lineas: readonly { cantidad: string; precio: number | null }[], impuestos: Impuestos): Totales {
  const totales = lineas.map((l) => (l.precio === null ? null : totalDeLinea(l.cantidad, l.precio)));
  const subtotal = totales.reduce<number>((s, t) => s + (t ?? 0), 0);
  const sinPrecio = totales.filter((t) => t === null).length;
  if (impuestos.tipo === "iva") {
    const iva = porcentaje(subtotal, TARIFA_IVA);
    return { lineas: totales, subtotal, iva, aiu: null, total: subtotal + iva, sinPrecio };
  }
  const administracion = porcentaje(subtotal, impuestos.administracion);
  const imprevistos = porcentaje(subtotal, impuestos.imprevistos);
  const utilidad = porcentaje(subtotal, impuestos.utilidad);
  const ivaUtilidad = porcentaje(utilidad, TARIFA_IVA);
  return { lineas: totales, subtotal, iva: 0, aiu: { administracion, imprevistos, utilidad, ivaUtilidad }, total: subtotal + administracion + imprevistos + utilidad + ivaUtilidad, sinPrecio };
}

export type ErrorCotizacion = { codigo: "sin_lineas" } | { codigo: "sin_precio"; lineas: string[] } | { codigo: "porcentaje_invalido"; campo: "administracion" | "imprevistos" | "utilidad" };

const porcentajeValido = (p: string) => PORCENTAJE.test(p) && Number(p) <= 100;

/** Lo que falta para publicar: una versión publicada tiene todo con precio y se puede calcular. */
export function validarCotizacion(b: BorradorCotizacion): ErrorCotizacion[] {
  const errores: ErrorCotizacion[] = [];
  if (b.lineas.length === 0) errores.push({ codigo: "sin_lineas" });
  const sinPrecio = b.lineas.filter((l) => l.precio === null).map((l) => l.id);
  if (sinPrecio.length > 0) errores.push({ codigo: "sin_precio", lineas: sinPrecio });
  if (b.impuestos.tipo === "aiu") {
    for (const campo of ["administracion", "imprevistos", "utilidad"] as const) if (!porcentajeValido(b.impuestos[campo])) errores.push({ codigo: "porcentaje_invalido", campo });
  }
  return errores;
}

export interface LineaRevisada {
  descripcion: string;
  cantidad: string;
  unidad: string;
  item: { id: string; codigo: string; descripcion: string } | null;
}

/**
 * Líneas de la cotización desde las cantidades revisadas: sumadas por ítem y unidad (lo no vinculado, por
 * descripción y unidad), con el precio vigente del ítem. Lo que no tiene precio queda para que oficina lo escriba.
 */
export function lineasDesdeCantidades(lineas: readonly LineaRevisada[], precios: ReadonlyMap<string, number>, nuevoId: (indice: number) => string): LineaDeCotizacion[] {
  const idPorCodigo = new Map(lineas.flatMap((l) => (l.item ? [[l.item.codigo, l.item.id] as const] : [])));
  return resumirCantidades(lineas).map((fila, i) => {
    const itemId = fila.codigo ? (idPorCodigo.get(fila.codigo) ?? null) : null;
    const precio = itemId ? (precios.get(itemId) ?? null) : null;
    return { id: nuevoId(i), itemId, codigo: fila.codigo, descripcion: fila.descripcion, cantidad: fila.cantidad, unidad: fila.unidad, precio, precioCatalogo: precio, origen: "cantidades" };
  });
}

/** "COT-2026-0007": consecutivo por organización y año, nunca reutilizado. */
export const numeroDeCotizacion = (anio: number, consecutivo: number) => `COT-${anio}-${String(consecutivo).padStart(4, "0")}`;
