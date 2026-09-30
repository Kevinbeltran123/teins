import { describe, expect, it } from "vitest";
import { calcularTotales, lineasDesdeCantidades, numeroDeCotizacion, porcentaje, totalDeLinea, validarCotizacion, type BorradorCotizacion } from "./cotizacion";

describe("cálculo en pesos enteros", () => {
  it("el total de línea es cantidad por precio, redondeado al peso (mitad hacia arriba), sin coma flotante", () => {
    expect(totalDeLinea("30", 4800)).toBe(144000);
    expect(totalDeLinea("12.5", 23000)).toBe(287500);
    expect(totalDeLinea("0.333", 1000)).toBe(333);
    expect(totalDeLinea("0.5", 1)).toBe(1);
    expect(totalDeLinea("0.1", 3)).toBe(0);
    // 0.1 × 3 en coma flotante es 0.30000000000000004: aquí es exacto.
    expect(totalDeLinea("2.675", 100)).toBe(268);
  });

  it("un porcentaje del subtotal se redondea al peso", () => {
    expect(porcentaje(1505400, "19")).toBe(286026);
    expect(porcentaje(1505400, "2.5")).toBe(37635);
    expect(porcentaje(75270, "19")).toBe(14301);
    expect(porcentaje(3, "50")).toBe(2);
  });

  it("IVA sobre el subtotal", () => {
    const t = calcularTotales(
      [
        { cantidad: "30", precio: 4800 },
        { cantidad: "12", precio: 23000 },
      ],
      { tipo: "iva" },
    );
    expect(t).toEqual({ lineas: [144000, 276000], subtotal: 420000, iva: 79800, aiu: null, total: 499800, sinPrecio: 0 });
  });

  it("AIU: cada parte sobre el subtotal y el IVA solo sobre la utilidad", () => {
    const t = calcularTotales([{ cantidad: "1", precio: 1505400 }], { tipo: "aiu", administracion: "10", imprevistos: "3", utilidad: "5" });
    expect(t.aiu).toEqual({ administracion: 150540, imprevistos: 45162, utilidad: 75270, ivaUtilidad: 14301 });
    expect(t.iva).toBe(0);
    expect(t.total).toBe(1505400 + 150540 + 45162 + 75270 + 14301);
  });

  it("las líneas sin precio no suman y se cuentan", () => {
    const t = calcularTotales(
      [
        { cantidad: "2", precio: 100 },
        { cantidad: "5", precio: null },
      ],
      { tipo: "iva" },
    );
    expect(t).toMatchObject({ lineas: [200, null], subtotal: 200, sinPrecio: 1 });
  });
});

describe("montos grandes", () => {
  it("un subtotal que no se puede representar exacto falla en vez de perder pesos", () => {
    const lineas = Array.from({ length: 200 }, () => ({ cantidad: "50000", precio: 1_000_000_000 }));
    expect(() => calcularTotales(lineas, { tipo: "iva" })).toThrow(/excede/);
  });
});

describe("para publicar", () => {
  const base: BorradorCotizacion = {
    lineas: [{ id: "a", itemId: null, codigo: null, descripcion: "Cable", cantidad: "3", unidad: "m", precio: 100, precioCatalogo: null, origen: "oficina" }],
    impuestos: { tipo: "iva" },
    condiciones: { validezDias: 30, formaPago: "", notas: "" },
  };

  it("exige líneas, todas con precio, y porcentajes de AIU entre 0 y 100", () => {
    expect(validarCotizacion(base)).toEqual([]);
    expect(validarCotizacion({ ...base, lineas: [] })).toEqual([{ codigo: "sin_lineas" }]);
    expect(validarCotizacion({ ...base, lineas: [{ ...base.lineas[0]!, precio: null }] })).toEqual([{ codigo: "sin_precio", lineas: ["a"] }]);
    expect(validarCotizacion({ ...base, impuestos: { tipo: "aiu", administracion: "10", imprevistos: "101", utilidad: "5" } })).toEqual([{ codigo: "porcentaje_invalido", campo: "imprevistos" }]);
  });
});

describe("líneas desde las cantidades revisadas", () => {
  const cable = { id: "11111111-1111-4111-8111-111111111111", codigo: "CAB-6A", descripcion: "Cable UTP categoría 6A" };

  it("suma por ítem y unidad, toma el precio vigente y deja sin precio lo que no lo tiene", () => {
    const lineas = lineasDesdeCantidades(
      [
        { descripcion: "cable utp", cantidad: "10", unidad: "m", item: cable },
        { descripcion: "Cable", cantidad: "20.5", unidad: "m", item: cable },
        { descripcion: "Terminales de ponchar", cantidad: "20", unidad: "und", item: null },
        { descripcion: "terminales  de ponchar", cantidad: "4", unidad: "und", item: null },
      ],
      new Map([[cable.id, 4800]]),
      (i) => `l${i}`,
    );
    expect(lineas).toEqual([
      { id: "l0", itemId: cable.id, codigo: "CAB-6A", descripcion: "Cable UTP categoría 6A", cantidad: "30.5", unidad: "m", precio: 4800, precioCatalogo: 4800, origen: "cantidades" },
      { id: "l1", itemId: null, codigo: null, descripcion: "Terminales de ponchar", cantidad: "24", unidad: "und", precio: null, precioCatalogo: null, origen: "cantidades" },
    ]);
  });
});

it("la numeración es COT, el año y el consecutivo de cuatro cifras", () => {
  expect(numeroDeCotizacion(2026, 7)).toBe("COT-2026-0007");
  expect(numeroDeCotizacion(2026, 12345)).toBe("COT-2026-12345");
});
