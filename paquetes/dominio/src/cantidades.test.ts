import { describe, expect, it } from "vitest";
import { aDecimalColombiano, resumirCantidades, sumarDecimales, type LineaCantidad } from "./cantidades";
import type { DefinicionCampo, VersionFormato } from "./formato";
import { describirValor } from "./describir";
import { validarDefinicionFormato } from "./meta-esquema";
import { corregir } from "./revision";
import { fotosReferenciadas, validarCampo } from "./validacion";

const campo: DefinicionCampo = { clave: "materiales", etiqueta: "Materiales", tipo: "cantidades", unidades: ["m", "und"], obligatorio: true };
const linea = (id: string, extra: Partial<LineaCantidad> = {}): LineaCantidad => ({ id, descripcion: "Cable 12 AWG", cantidad: "25", unidad: "m", ...extra });

describe("cantidades (iteración 11, F9)", () => {
  it("valida cada línea: descripción, cantidad mayor que cero, unidad permitida, ids únicos", () => {
    expect(validarCampo(campo, [linea("a0000001"), linea("a0000002", { cantidad: "2.5", unidad: "und", observacion: "Repuesto" })])).toBeNull();
    expect(validarCampo(campo, undefined)).toBe("campo_obligatorio");
    expect(validarCampo(campo, [])).toBe("campo_obligatorio");
    expect(validarCampo({ ...campo, obligatorio: false }, [])).toBeNull();
    for (const mala of [
      linea("a0000001", { descripcion: "  " }),
      linea("a0000001", { cantidad: "0" }),
      linea("a0000001", { cantidad: "0.00" }),
      linea("a0000001", { cantidad: "-3" }),
      linea("a0000001", { cantidad: "2,5" }),
      linea("a0000001", { unidad: "kg" }),
      linea("MAL", {}),
    ]) {
      expect(validarCampo(campo, [mala]), JSON.stringify(mala)).toBe("cantidades_invalidas");
    }
    expect(validarCampo(campo, [linea("a0000001"), linea("a0000001")])).toBe("cantidades_invalidas");
    // El protocolo no recibe una cantidad más larga: el teléfono no la deja salir (iteración 42).
    expect(validarCampo(campo, [linea("a0000001", { cantidad: "1".repeat(41) })])).toBe("cantidades_invalidas");
    expect(validarCampo(campo, [linea("a0000001", { cantidad: "1".repeat(40) })])).toBeNull();
    expect(validarCampo(campo, "texto")).toBe("tipo_invalido");
  });

  it("una línea puede llevar el ítem del catálogo que eligió el técnico, como id (iteración 17, ADR-0025)", () => {
    const item = "0192f0e0-0000-7000-8000-000000000017";
    expect(validarCampo(campo, [linea("a0000001", { item })])).toBeNull();
    expect(validarCampo(campo, [linea("a0000001", { item: "CAB-6A" })])).toBe("cantidades_invalidas");
    expect(validarCampo(campo, [{ ...linea("a0000001"), precio: "1000" }])).toBe("cantidades_invalidas");
  });

  it("se describe por número de líneas, no son fotos, y oficina las corrige", () => {
    expect(describirValor(campo, [linea("a0000001"), linea("a0000002")])).toBe("2 líneas");
    expect(describirValor(campo, [linea("a0000001")])).toBe("1 línea");
    expect(fotosReferenciadas({ s: { materiales: [linea("a0000001")] } })).toEqual([]);
    const formato: VersionFormato = { formato: "f", version: 1, appMinima: 6, secciones: [{ clave: "s", titulo: "S", campos: [campo] }] };
    const r = corregir(formato, { s: { materiales: [linea("a0000001")] } }, [{ seccion: "s", campo: "materiales", valor: [linea("a0000001", { cantidad: "30" })] }]);
    expect(r).toMatchObject({ ok: true, cambios: [{ campo: "materiales" }] });
    expect(validarDefinicionFormato(formato)).toEqual([]);
    expect(validarDefinicionFormato({ ...formato, appMinima: 5 })).toContain("Las cantidades exigen appMinima 6 o mayor");
  });

  it("suma decimales exactos, sin coma flotante", () => {
    expect(sumarDecimales("0.1", "0.2")).toBe("0.3");
    expect(sumarDecimales("12.5", "7.25")).toBe("19.75");
    expect(sumarDecimales("10", "0.50")).toBe("10.5");
    expect(sumarDecimales("99.99", "0.01")).toBe("100");
    expect(aDecimalColombiano("1234.5")).toBe("1234,5");
  });

  it("resume por ítem de catálogo y unidad; lo no vinculado, por descripción y unidad", () => {
    const resumen = resumirCantidades([
      { descripcion: "Cable 12 AWG", cantidad: "25", unidad: "m", item: { codigo: "C-12", descripcion: "Cable THHN 12 AWG" } },
      { descripcion: "cable #12", cantidad: "10.5", unidad: "m", item: { codigo: "C-12", descripcion: "Cable THHN 12 AWG" } },
      { descripcion: "Breaker 20 A", cantidad: "2", unidad: "und" },
      { descripcion: "breaker 20 a ", cantidad: "1", unidad: "und" },
      { descripcion: "Breaker 20 A", cantidad: "3", unidad: "m" },
    ]);
    expect(resumen).toEqual([
      { codigo: "C-12", descripcion: "Cable THHN 12 AWG", unidad: "m", cantidad: "35.5", lineas: 2 },
      { codigo: null, descripcion: "Breaker 20 A", unidad: "m", cantidad: "3", lineas: 1 },
      { codigo: null, descripcion: "Breaker 20 A", unidad: "und", cantidad: "3", lineas: 2 },
    ]);
  });
});
