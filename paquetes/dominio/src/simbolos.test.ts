import { describe, expect, it } from "vitest";
import { bocetoNuevo, elementoDeSimbolo, hojaASvg, hojaNueva, leerBoceto, puntosDeElemento, serializarBoceto, validarBoceto, type BocetoV2 } from "./boceto";
import { esTrazadoValido, validarBiblioteca, validarSimbolo, type DefinicionSimbolo } from "./simbolos";

const ups: DefinicionSimbolo = { id: "0b8f7c3e-2d4a-4f1b-9c6e-5a7d8e9f0a1b", nombre: "UPS", categoria: "Energía", trazado: "M10 25H90V75H10Z", texto: "UPS" };
const tablero: DefinicionSimbolo = { id: "1c9e8d4f-3e5b-4a2c-8d7f-6b8e9f0a1b2c", nombre: "Tablero", categoria: "Energía", trazado: "M10 25H90V75H10Z", relleno: "M10 75L90 25V75Z", codigo: "TAB-01" };

describe("símbolos de los bocetos (iteración 19, ADR-0027)", () => {
  it("un trazado es geometría SVG y nada más: empieza con M, solo comandos y números razonables", () => {
    expect(esTrazadoValido("M10 25H90V75H10Z")).toBe(true);
    expect(esTrazadoValido("m 30,58 a20 20 0 1 0 40 0 z ")).toBe(true);
    expect(esTrazadoValido("M1e2 5L-3.5 .5")).toBe(true);
    expect(esTrazadoValido("L10 10")).toBe(false);
    expect(esTrazadoValido("M10 10\"/><script>")).toBe(false);
    expect(esTrazadoValido("M10 10 url(#x)")).toBe(false);
    expect(esTrazadoValido("M5000 1")).toBe(false);
    expect(esTrazadoValido("   ")).toBe(false);
    expect(esTrazadoValido("M1 1" + "L2 2".repeat(600))).toBe(false);
  });

  it("valida cada símbolo y la biblioteca sin repetidos", () => {
    expect(validarSimbolo(ups)).toEqual([]);
    expect(validarSimbolo(tablero)).toEqual([]);
    expect(validarSimbolo({ ...ups, id: "no" })).toEqual(["id inválido"]);
    expect(validarSimbolo({ ...ups, texto: "MUY LARGO" })).toEqual(["texto inválido"]);
    expect(validarSimbolo({ ...ups, relleno: "Z" })).toEqual(["relleno inválido"]);
    expect(validarBiblioteca([ups, tablero])).toEqual([]);
    expect(validarBiblioteca([ups, { ...tablero, nombre: "ups" }])).toEqual(["Nombre repetido: ups"]);
    expect(validarBiblioteca([ups, { ...tablero, id: ups.id }])).toEqual([`id repetido: ${ups.id}`]);
    expect(validarBiblioteca({})).not.toEqual([]);
  });

  it("puesto en la hoja, el símbolo copia su dibujo y viaja en el boceto; se valida y se serializa igual", () => {
    const e = elementoDeSimbolo(tablero, [375, 500], 150);
    expect(e).toMatchObject({ tipo: "simbolo", simbolo: tablero.id, nombre: "Tablero", relleno: tablero.relleno, codigo: "TAB-01", centro: [375, 500], tamano: 150, giro: 0 });
    const d: BocetoV2 = { ...bocetoNuevo(1352), hojas: [{ ...hojaNueva("Hoja 1", 1352), elementos: [e, elementoDeSimbolo(ups, [200, 300], 100)] }] };
    expect(validarBoceto(d)).toEqual([]);
    const texto = serializarBoceto(d);
    expect(serializarBoceto(JSON.parse(texto) as BocetoV2)).toBe(texto);
    expect(leerBoceto(texto)).toEqual(d);
    expect(texto).not.toContain('"relleno":undefined');
  });

  it("rechaza un símbolo mal hecho dentro del boceto, y en la versión 1 no existe", () => {
    const con = (cambio: object) => validarBoceto({ ...bocetoNuevo(1352), hojas: [{ ...hojaNueva("Hoja 1", 1352), elementos: [{ ...elementoDeSimbolo(ups, [100, 100], 100), ...cambio }] }] });
    expect(con({})).toEqual([]);
    expect(con({ trazado: "<g/>" })).toEqual(["Hoja 1: Elemento 1 inválido"]);
    expect(con({ tamano: 5 })).not.toEqual([]);
    expect(con({ texto: "" })).not.toEqual([]);
    expect(validarBoceto({ formato: "teins-boceto", version: 1, ancho: 1000, alto: 750, cuadricula: 25, elementos: [elementoDeSimbolo(ups, [100, 100], 100)] })).not.toEqual([]);
  });

  it("el SVG lo dibuja a su tamaño con el trazo parejo, su relleno y su sigla; la caja cuenta el giro", () => {
    const svg = hojaASvg({ ancho: 750, alto: 1352, elementos: [elementoDeSimbolo(tablero, [375, 500], 150), { ...elementoDeSimbolo(ups, [200, 300], 100), giro: 90 }] });
    expect(svg).toContain('<g transform="translate(375 500) rotate(0) scale(1.5) translate(-50 -50)"><path d="M10 25H90V75H10Z" fill="none" stroke="#15171A" stroke-width="3.3"');
    expect(svg).toContain('<path d="M10 75L90 25V75Z" fill="#15171A"/>');
    expect(svg).toContain(">UPS</text>");
    expect(puntosDeElemento({ ...elementoDeSimbolo(ups, [200, 300], 100), giro: 45 })[0]![0]).toBeCloseTo(200 - 50 * Math.SQRT2, 5);
  });
});
