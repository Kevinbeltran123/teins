import { describe, expect, it } from "vitest";
import { altoDeHoja, aVersion2, bocetoNuevo, bocetoVacio, geometriaDeCota, hojaASvg, hojaNueva, hojasDe, leerBoceto, serializarBoceto, validarBoceto, type BocetoV2, type DocumentoBoceto } from "./boceto";
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
    const svg = hojaASvg(conTodo);
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 1000 750"/);
    expect(svg).toContain("<path");
    expect(svg).toContain("<line");
    expect(svg).toContain("Tablero &lt;principal&gt; &amp; UPS");
    expect(svg).not.toContain("<principal>");
    expect(hojaASvg(conTodo, { cuadricula: false })).not.toContain('class="cuadricula"');
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

describe("bocetos versión 2: hojas y formas (iteración 18, ADR-0026)", () => {
  const formas = [
    { tipo: "polilinea", grosor: 6, puntos: [[100, 200], [650, 200], [650, 900], [100, 900]], cerrada: true },
    { tipo: "polilinea", grosor: 6, puntos: [[100, 100], [100, 300], [400, 300]], cerrada: false },
    { tipo: "elipse", grosor: 5, centro: [240, 390], radios: [60, 40], giro: 30 },
    { tipo: "cota", grosor: 3, desde: [100, 140], hasta: [650, 140], texto: "5,50 m" },
  ] as const;
  const conHojas: BocetoV2 = {
    ...bocetoNuevo(1352),
    hojas: [
      { ...hojaNueva("Primer piso", 1352), elementos: formas },
      { ...hojaNueva("Segundo piso", 1352), elementos: [{ tipo: "linea", grosor: 5, desde: [100, 200], hasta: [100, 1300] }] },
    ],
  };

  it("un boceto nuevo es de la versión 2, con una hoja vertical; admite polilíneas, elipses y cotas en varias hojas", () => {
    expect(bocetoNuevo(1352)).toMatchObject({ version: 2, hojas: [{ nombre: "Hoja 1", ancho: 750, alto: 1352, elementos: [] }] });
    expect(validarBoceto(bocetoNuevo(1352))).toEqual([]);
    expect(validarBoceto(conHojas)).toEqual([]);
  });

  it("la hoja llena el espacio de la pantalla, dentro de sus límites", () => {
    expect(altoDeHoja(390, 703)).toBe(1352);
    expect(altoDeHoja(390, 300)).toBe(1000);
    expect(altoDeHoja(360, 2000)).toBe(1700);
    expect(altoDeHoja(0, 700)).toBe(1000);
  });

  it("la versión 1 sigue igual: una hoja apaisada, sin los elementos nuevos; las firmas siguen en ella", () => {
    expect(bocetoVacio()).toMatchObject({ version: 1, ancho: 1000, alto: 750 });
    expect(validarBoceto({ ...bocetoVacio(), elementos: formas })).toHaveLength(4);
    expect(validarBoceto({ ...conHojas, version: 3 })).toEqual(["Formato o versión de boceto desconocidos"]);
  });

  it("un boceto de la versión 1 que se vuelve a editar conserva su hoja apaisada como «Hoja 1»", () => {
    const viejo = { ...bocetoVacio(), elementos: [{ tipo: "linea" as const, grosor: 4, desde: [0, 0] as const, hasta: [900, 700] as const }] };
    expect(hojasDe(viejo)).toEqual([{ nombre: "", ancho: 1000, alto: 750, elementos: viejo.elementos }]);
    const nuevo = aVersion2(viejo);
    expect(nuevo.hojas).toEqual([{ nombre: "Hoja 1", ancho: 1000, alto: 750, elementos: viejo.elementos }]);
    expect(validarBoceto(nuevo)).toEqual([]);
    expect(aVersion2(conHojas)).toBe(conHojas);
  });

  it("rechaza hojas y formas mal hechas", () => {
    const conHoja = (h: object) => validarBoceto({ ...conHojas, hojas: [{ ...hojaNueva("Hoja 1", 1352), ...h }] });
    expect(conHoja({ alto: 999 })).toEqual(["Hoja 1: Tamaño inválido"]);
    expect(conHoja({ alto: 1701 })).not.toEqual([]);
    expect(conHoja({ alto: 1200.5 })).not.toEqual([]);
    expect(conHoja({ ancho: 1000, alto: 750 })).toEqual([]);
    expect(conHoja({ nombre: " " })).toEqual(["Hoja 1: Nombre inválido"]);
    expect(conHoja({ nombre: "x".repeat(61) })).not.toEqual([]);
    expect(validarBoceto({ ...conHojas, hojas: [] })).toEqual(["Faltan las hojas"]);
    expect(validarBoceto({ ...conHojas, hojas: Array.from({ length: 13 }, (_, i) => hojaNueva(`Hoja ${i + 1}`, 1352)) })).toEqual(["Demasiadas hojas"]);
    const con = (e: unknown) => conHoja({ elementos: [e] });
    expect(con({ tipo: "polilinea", grosor: 6, puntos: [[1, 1]], cerrada: false })).toEqual(["Hoja 1: Elemento 1 inválido"]);
    expect(con({ tipo: "polilinea", grosor: 6, puntos: [[1, 1], [2, 2]] })).not.toEqual([]);
    expect(con({ tipo: "elipse", grosor: 5, centro: [1, 1], radios: [0, 10], giro: 0 })).not.toEqual([]);
    expect(con({ tipo: "cota", grosor: 3, desde: [1, 1], hasta: [2, 2], texto: " " })).not.toEqual([]);
    // Las coordenadas se miden contra la hoja: en una vertical alta cabe lo que no cabría en la apaisada.
    expect(con({ tipo: "linea", grosor: 3, desde: [0, 0], hasta: [700, 2600] })).toEqual([]);
    expect(con({ tipo: "linea", grosor: 3, desde: [0, 0], hasta: [700, 2800] })).not.toEqual([]);
  });

  it("serializa siempre igual, con las hojas en orden", () => {
    const texto = serializarBoceto(conHojas);
    expect(serializarBoceto(JSON.parse(texto) as DocumentoBoceto)).toBe(texto);
    expect(texto.startsWith('{"formato":"teins-boceto","version":2,"cuadricula":25,"hojas":[{"nombre":"Primer piso","ancho":750,"alto":1352,')).toBe(true);
    expect(leerBoceto(texto)).toEqual(conHojas);
  });

  it("cada hoja es un SVG con su tamaño: polígonos, líneas quebradas, elipses giradas y la cota con su medida", () => {
    const svg = hojaASvg(conHojas.hojas[0]!);
    expect(svg).toContain('viewBox="0 0 750 1352"');
    expect(svg).toContain('<polygon points="100,200 650,200 650,900 100,900"');
    expect(svg).toContain('<polyline points="100,100 100,300 400,300"');
    expect(svg).toContain('<ellipse cx="240" cy="390" rx="60" ry="40" transform="rotate(30 240 390)"');
    expect(svg).toContain(">5,50 m</text>");
  });

  it("el texto de la cota va sobre la línea y nunca de cabeza", () => {
    expect(geometriaDeCota([0, 100], [200, 100])).toMatchObject({ angulo: 0, textoEn: [100, 84] });
    // Dibujada de derecha a izquierda, el texto se lee igual.
    expect(geometriaDeCota([200, 100], [0, 100]).angulo).toBe(0);
    expect(Math.abs(geometriaDeCota([100, 0], [100, 200]).angulo)).toBe(90);
  });
});
