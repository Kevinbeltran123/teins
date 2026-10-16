import { describe, expect, it } from "vitest";
import { validarDefinicionFormato } from "./meta-esquema";
import type { VersionFormato } from "./formato";

const base: VersionFormato = {
  formato: "prueba",
  version: 1,
  secciones: [{ clave: "s", titulo: "S", campos: [{ clave: "m", etiqueta: "M", tipo: "medida", unidades: ["m", "cm"] }] }],
};

describe("validarDefinicionFormato", () => {
  it("acepta una definición coherente", () => {
    expect(validarDefinicionFormato(base)).toEqual([]);
  });

  it("un mínimo de fotos exige que el campo sea obligatorio: si no, nunca se podría marcar «No se pudo obtener» (iteración 42)", () => {
    const conMinimo = (obligatorio: boolean): VersionFormato => ({
      ...base,
      secciones: [{ clave: "s", titulo: "S", campos: [{ clave: "f", etiqueta: "F", tipo: "foto", min: 2, ...(obligatorio ? { obligatorio } : {}) }] }],
    });
    expect(validarDefinicionFormato(conMinimo(true))).toEqual([]);
    expect(validarDefinicionFormato(conMinimo(false))).toEqual(["Un mínimo de fotos exige que s.f sea obligatorio"]);
  });

  it("rechaza claves repetidas, unidades repetidas y secciones vacías", () => {
    const mala: VersionFormato = {
      ...base,
      secciones: [
        { clave: "s", titulo: "S", campos: [{ clave: "m", etiqueta: "M", tipo: "medida", unidades: ["m", "m"] }, { clave: "m", etiqueta: "M", tipo: "texto" }] },
        { clave: "s", titulo: "Otra", campos: [] },
      ],
    };
    expect(validarDefinicionFormato(mala)).toEqual([
      "Unidades repetidas en s.m",
      "Campo repetido: s.m",
      "Sección repetida: s",
      "La sección s no tiene campos",
    ]);
  });
});
