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
