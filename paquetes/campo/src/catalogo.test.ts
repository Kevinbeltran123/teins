import { describe, expect, it } from "vitest";
import { buscarEnCatalogo, frecuentes, usosPorItem } from "./catalogo";
import type { ItemCatalogoLocal, LevantamientoLocal } from "./datos/modelo";

const item = (id: string, codigo: string, descripcion: string, unidad = "m", activo = true): ItemCatalogoLocal => ({ id, codigo, descripcion, unidad, activo });
const catalogo = [
  item("1", "CAB-6A", "Cable UTP categoría 6A"),
  item("2", "CAB-6", "Cable UTP categoría 6"),
  item("3", "CAB-6EXT", "Cable UTP exterior categoría 6"),
  item("4", "JCK-6A", "Jack RJ45 categoría 6A", "und"),
  item("5", "CAN-2012", "Canaleta plástica 20x12"),
  item("6", "CAB-5E", "Cable UTP categoría 5e", "m", false),
  item("7", "PNL-400", "Panel solar 400 W", "kg"),
];

const levantamiento = (lineas: { item?: string }[]) =>
  ({ respuestas: { obra: { materiales: lineas.map((l, i) => ({ id: `l000000${i}`, descripcion: "x", cantidad: "1", unidad: "m", ...l })) } } }) as unknown as LevantamientoLocal;

describe("catálogo en el teléfono (iteración 17)", () => {
  const usos = usosPorItem([levantamiento([{ item: "3" }, { item: "3" }, { item: "5" }, {}]), levantamiento([{ item: "3" }, { item: "1" }])]);

  it("cuenta cuántas líneas usan cada ítem", () => {
    expect(usos).toEqual(new Map([["3", 3], ["5", 1], ["1", 1]]));
  });

  it("busca por comienzo de palabra, sin tildes ni mayúsculas, y por código", () => {
    const ids = (consulta: string) => buscarEnCatalogo(catalogo, consulta, ["m", "und"], new Map()).map((i) => i.id);
    expect(ids("cab utp")).toEqual(["2", "1", "3"]);
    expect(ids("CATEGORIA 6a")).toEqual(["1", "4"]);
    expect(ids("cab-6")).toEqual(["2", "1", "3"]);
    expect(ids("canaleta 20")).toEqual(["5"]);
    expect(ids("canaleta 12")).toEqual(["5"]);
    expect(ids("exterior")).toEqual(["3"]);
    expect(ids("")).toEqual([]);
    expect(ids("tornillo")).toEqual([]);
  });

  it("el código exacto va primero; después, los que más usa el técnico", () => {
    expect(buscarEnCatalogo(catalogo, "cab-6a", ["m"], usos).map((i) => i.id)[0]).toBe("1");
    expect(buscarEnCatalogo(catalogo, "cable", ["m"], usos).map((i) => i.id)).toEqual(["3", "1", "2"]);
  });

  it("no propone inactivos ni ítems con una unidad que el campo no admite", () => {
    const ids = buscarEnCatalogo(catalogo, "c", ["m"], new Map()).map((i) => i.id);
    expect(ids).not.toContain("6");
    expect(ids).not.toContain("4");
    expect(buscarEnCatalogo(catalogo, "panel", ["m", "und"], new Map())).toEqual([]);
  });

  it("los que más usa: con al menos una línea, del más usado al menos, solo los que admite el campo", () => {
    expect(frecuentes(catalogo, usos, ["m"]).map((i) => i.id)).toEqual(["3", "1", "5"]);
    expect(frecuentes(catalogo, usos, ["und"])).toEqual([]);
  });
});
