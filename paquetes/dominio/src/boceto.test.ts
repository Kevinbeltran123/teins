import { describe, expect, it } from "vitest";
import { bocetoASvg, bocetoVacio, leerBoceto, serializarBoceto, validarBoceto, type DocumentoBoceto } from "./boceto";
import type { VersionFormato } from "./formato";
import { validarDefinicionFormato } from "./meta-esquema";
import { corregir } from "./revision";
import { archivosReferenciados, validarCampo } from "./validacion";
import { describirValor } from "./describir";

const conTodo: DocumentoBoceto = {
  ...bocetoVacio(),
  elementos: [
    { tipo: "trazo", grosor: 4, puntos: [[10, 10, 0.5], [20.123, 20.987, 0.7]], contorno: [[9, 9], [21, 21], [19, 22]] },
    { tipo: "linea", grosor: 3, desde: [0, 0], hasta: [100, 0] },
    { tipo: "texto", en: [50, 60], texto: "Tablero <principal> & UPS", tamano: 24 },
  ],
};

describe("bocetos (iteración 10, ADR-0019)", () => {
  it("un boceto válido pasa; el vacío también", () => {
    expect(validarBoceto(conTodo)).toEqual([]);
    expect(validarBoceto(bocetoVacio())).toEqual([]);
  });

  it("rechaza lo que no tiene la forma, sin lanzar", () => {
    expect(validarBoceto(null)).not.toEqual([]);
    expect(validarBoceto({ ...conTodo, formato: "otro" })).not.toEqual([]);
    expect(validarBoceto({ ...conTodo, elementos: [{ tipo: "circulo" }] })).not.toEqual([]);
    expect(validarBoceto({ ...conTodo, elementos: [{ tipo: "linea", grosor: 3, desde: [0, "x"], hasta: [1, 1] }] })).not.toEqual([]);
    expect(validarBoceto({ ...conTodo, elementos: [{ tipo: "texto", en: [1, 1], texto: "", tamano: 20 }] })).not.toEqual([]);
    expect(validarBoceto({ ...conTodo, elementos: [{ tipo: "trazo", grosor: 4, puntos: [], contorno: [] }] })).not.toEqual([]);
  });

  it("serializa siempre igual el mismo dibujo (misma huella) y redondea a un decimal", () => {
    const texto = serializarBoceto(conTodo);
    expect(serializarBoceto(JSON.parse(texto) as DocumentoBoceto)).toBe(texto);
    expect(texto).toContain("[20.1,21,0.7]");
    expect(leerBoceto(texto)).toEqual(JSON.parse(texto));
    expect(leerBoceto("{no es json")).toBeNull();
  });

  it("el SVG es vectorial, con cuadrícula, y escapa el texto", () => {
    const svg = bocetoASvg(conTodo);
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 1000 750"/);
    expect(svg).toContain("<path");
    expect(svg).toContain("<line");
    expect(svg).toContain("Tablero &lt;principal&gt; &amp; UPS");
    expect(svg).not.toContain("<principal>");
    expect(bocetoASvg(conTodo, { cuadricula: false })).not.toContain('class="cuadricula"');
  });

  it("el campo boceto guarda la huella; no se corrige en oficina; su archivo cuenta como referencia", () => {
    const campo = { clave: "croquis", etiqueta: "Croquis", tipo: "boceto" as const, obligatorio: true };
    const huella = "a".repeat(64);
    expect(validarCampo(campo, undefined)).toBe("campo_obligatorio");
    expect(validarCampo(campo, { boceto: huella })).toBeNull();
    expect(validarCampo(campo, { boceto: "no-es-huella" })).toBe("boceto_invalido");
    expect(validarCampo(campo, "texto")).toBe("tipo_invalido");
    expect(describirValor(campo, { boceto: huella })).toBe("Boceto");
    expect(archivosReferenciados({ s: { croquis: { boceto: huella }, fotos: ["b".repeat(64)] } })).toEqual([huella, "b".repeat(64)]);

    const formato: VersionFormato = { formato: "f", version: 1, appMinima: 5, secciones: [{ clave: "s", titulo: "S", campos: [campo] }] };
    expect(corregir(formato, { s: { croquis: { boceto: huella } } }, [{ seccion: "s", campo: "croquis", valor: undefined }])).toMatchObject({
      ok: false,
      errores: [{ codigo: "no_corregible" }],
    });
    expect(validarDefinicionFormato(formato)).toEqual([]);
    expect(validarDefinicionFormato({ ...formato, appMinima: 4 })).toContain("Los bocetos exigen appMinima 5 o mayor");
  });
});
