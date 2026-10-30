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

describe("tipos nuevos en el meta-esquema (ADR-0050)", () => {
  const con = (campos: VersionFormato["secciones"][number]["campos"], extra: Partial<VersionFormato["secciones"][number]> = {}, appMinima = 16): VersionFormato => ({
    formato: "prueba",
    version: 1,
    appMinima,
    secciones: [{ clave: "s", titulo: "S", campos, ...extra }],
  });

  it("acepta una selección, un horario, una firma con cédula y una foto con sello", () => {
    expect(
      validarDefinicionFormato(
        con([
          { clave: "o", etiqueta: "O", tipo: "opcion", opciones: ["Sí", "No"] },
          { clave: "p", etiqueta: "P", tipo: "opciones", opciones: ["CCTV", "UPS"], otro: true },
          { clave: "h", etiqueta: "H", tipo: "horario" },
          { clave: "f", etiqueta: "F", tipo: "firma", documento: "opcional" },
          { clave: "l", etiqueta: "L", tipo: "foto", sello: { ubicacion: true, mapa: true } },
        ]),
      ),
    ).toEqual([]);
  });

  it("las opciones: de 2 a 20, sin repetir, de 1 a 60 caracteres", () => {
    const op = (opciones: string[]) => validarDefinicionFormato(con([{ clave: "o", etiqueta: "O", tipo: "opcion", opciones }]));
    expect(op(["Sí"])).toEqual(["Una selección necesita de 2 a 20 opciones en s.o"]);
    expect(op(Array.from({ length: 21 }, (_, i) => `Opción ${i}`))).toEqual(["Una selección necesita de 2 a 20 opciones en s.o"]);
    expect(op(["Sí", "Sí"])).toEqual(["Opciones repetidas en s.o"]);
    expect(op(["Sí", ""])).toEqual(["Cada opción de s.o necesita de 1 a 60 caracteres"]);
    expect(op(["Sí", "x".repeat(61)])).toEqual(["Cada opción de s.o necesita de 1 a 60 caracteres"]);
  });

  it("una app anterior no recibe lo que no sabe dibujar (appMinima 16)", () => {
    expect(validarDefinicionFormato(con([{ clave: "o", etiqueta: "O", tipo: "opcion", opciones: ["Sí", "No"] }], {}, 15))).toEqual(["Las selecciones exigen appMinima 16 o mayor"]);
    expect(validarDefinicionFormato(con([{ clave: "h", etiqueta: "H", tipo: "horario" }], {}, 15))).toEqual(["Los horarios exigen appMinima 16 o mayor"]);
    expect(validarDefinicionFormato(con([{ clave: "f", etiqueta: "F", tipo: "firma", documento: "opcional" }], {}, 15))).toEqual(["La cédula de la firma exige appMinima 16 o mayor"]);
    expect(validarDefinicionFormato(con([{ clave: "l", etiqueta: "L", tipo: "foto", sello: { mapa: true } }], {}, 15))).toEqual(["El sello de las fotos exige appMinima 16 o mayor"]);
    const medidas = [{ clave: "a", etiqueta: "A", tipo: "medida", unidades: ["V"] }] as const;
    expect(validarDefinicionFormato(con(medidas, { tablas: [{ columnas: ["F1"], filas: [{ etiqueta: "Voltaje", campos: ["a"] }] }] }, 15))).toEqual(["Las tablas de medidas exigen appMinima 16 o mayor"]);
  });

  describe("tablas de medidas", () => {
    const medidas = [
      { clave: "v1", etiqueta: "V F1", tipo: "medida", unidades: ["V"] },
      { clave: "v2", etiqueta: "V F2", tipo: "medida", unidades: ["V"] },
      { clave: "v3", etiqueta: "V F3", tipo: "medida", unidades: ["V"] },
      { clave: "a1", etiqueta: "A F1", tipo: "medida", unidades: ["A"] },
      { clave: "a2", etiqueta: "A F2", tipo: "medida", unidades: ["A"] },
      { clave: "a3", etiqueta: "A F3", tipo: "medida", unidades: ["A"] },
      { clave: "hz", etiqueta: "Hz", tipo: "medida", unidades: ["Hz"] },
    ] as const;
    const tabla = (filas: { etiqueta: string; campos: string[] }[], columnas = ["F1", "F2", "F3"], campos: VersionFormato["secciones"][number]["campos"] = medidas) =>
      validarDefinicionFormato(con(campos, { tablas: [{ columnas, filas }] }));

    it("acepta filas con tantos campos como columnas y filas de un solo campo", () => {
      expect(tabla([{ etiqueta: "Voltaje", campos: ["v1", "v2", "v3"] }, { etiqueta: "Corriente", campos: ["a1", "a2", "a3"] }, { etiqueta: "Frecuencia", campos: ["hz"] }])).toEqual([]);
    });

    it("rechaza columnas fuera de 1 a 4, y una fila con otra cantidad de campos", () => {
      expect(tabla([{ etiqueta: "V", campos: ["v1"] }], [])).toEqual(["Una tabla de s necesita de 1 a 4 columnas"]);
      expect(tabla([{ etiqueta: "V", campos: ["v1"] }], ["1", "2", "3", "4", "5"])).toEqual(["Una tabla de s necesita de 1 a 4 columnas"]);
      expect(tabla([{ etiqueta: "V", campos: ["v1", "v2"] }])).toEqual(["La fila V de la tabla de s necesita 1 campo o 3"]);
      expect(tabla([{ etiqueta: "V", campos: [] }])).toEqual(["La fila V de la tabla de s necesita 1 campo o 3"]);
    });

    it("cada campo existe, es una medida de una sola unidad y está en una sola tabla", () => {
      expect(tabla([{ etiqueta: "V", campos: ["nope"] }])).toEqual(["La tabla de s usa un campo que no existe: nope"]);
      const texto = [{ clave: "t", etiqueta: "T", tipo: "texto" }] as const;
      expect(tabla([{ etiqueta: "T", campos: ["t"] }], ["F1"], texto)).toEqual(["El campo s.t de la tabla debe ser una medida"]);
      const dos = [{ clave: "m", etiqueta: "M", tipo: "medida", unidades: ["V", "A"] }] as const;
      expect(tabla([{ etiqueta: "M", campos: ["m"] }], ["F1"], dos)).toEqual(["El campo s.m de la tabla debe tener una sola unidad"]);
      expect(tabla([{ etiqueta: "V", campos: ["v1"] }, { etiqueta: "Otra", campos: ["v1"] }], ["F1"])).toEqual(["El campo s.v1 aparece más de una vez en las tablas"]);
    });

    it("un campo de una tabla no es obligatorio, y los de una fila comparten unidad", () => {
      const obligatorio = [{ clave: "v1", etiqueta: "V", tipo: "medida", unidades: ["V"], obligatorio: true }] as const;
      expect(tabla([{ etiqueta: "V", campos: ["v1"] }], ["F1"], obligatorio)).toEqual(["El campo s.v1 de la tabla no puede ser obligatorio"]);
      expect(tabla([{ etiqueta: "Mezcla", campos: ["v1", "a1", "v3"] }])).toEqual(["La fila Mezcla de la tabla de s mezcla unidades"]);
    });
  });

  it("sello solo en fotos y documento solo en firmas, aunque la definición llegue sin pasar por el compilador", () => {
    const mal = (campo: object) => validarDefinicionFormato(con([campo as never]));
    expect(mal({ clave: "t", etiqueta: "T", tipo: "texto", sello: { mapa: true } })).toEqual(["El sello solo va en fotos: s.t"]);
    expect(mal({ clave: "f", etiqueta: "F", tipo: "foto", documento: "opcional" })).toEqual(["La cédula solo va en firmas: s.f"]);
  });
});
