import { describe, expect, it } from "vitest";
import { validarBorrador, validarParaPublicar, type BorradorInforme, type LevantamientoParaInforme } from "./informe";
import { SELECCION_VACIA } from "./seleccion";

const visita = "v1";
const h = (c: string) => c.repeat(64);
const levantamientos = new Map<string, LevantamientoParaInforme>([
  ["a", { id: "a", visitaId: "v1", estado: "revisado" }],
  ["b", { id: "b", visitaId: "v1", estado: "en_revision" }],
  ["c", { id: "c", visitaId: "v2", estado: "revisado" }],
]);
const borrador = (extra: Partial<BorradorInforme> = {}): BorradorInforme => ({ introduccion: "", conclusiones: "", levantamientos: ["a"], planos: [], seleccion: SELECCION_VACIA, ...extra });

describe("borrador del informe (regla 9)", () => {
  it("acepta levantamientos revisados de su visita y planos PDF con nombre", () => {
    expect(validarBorrador(visita, borrador({ planos: [{ huella: h("a"), nombre: "Planta" }] }), levantamientos)).toEqual([]);
  });

  it("rechaza lo que no es de la visita, lo que no está revisado, lo repetido y lo desconocido", () => {
    expect(validarBorrador(visita, borrador({ levantamientos: ["a", "b", "c", "a", "z"] }), levantamientos)).toEqual([
      { codigo: "no_revisado", levantamientoId: "b" },
      { codigo: "otra_visita", levantamientoId: "c" },
      { codigo: "levantamiento_repetido", levantamientoId: "a" },
      { codigo: "levantamiento_desconocido", levantamientoId: "z" },
    ]);
  });

  it("rechaza planos sin nombre, con huella inválida o repetidos", () => {
    const planos = [
      { huella: h("a"), nombre: "Planta" },
      { huella: h("a"), nombre: "Otra vez" },
      { huella: "x", nombre: "Mala" },
      { huella: h("b"), nombre: " " },
    ];
    expect(validarBorrador(visita, borrador({ planos }), levantamientos)).toEqual([
      { codigo: "plano_repetido", huella: h("a") },
      { codigo: "plano_invalido", huella: "x" },
      { codigo: "plano_invalido", huella: h("b") },
    ]);
  });

  it("un borrador vacío se guarda, pero no se publica", () => {
    expect(validarBorrador(visita, borrador({ levantamientos: [] }), levantamientos)).toEqual([]);
    expect(validarParaPublicar(visita, borrador({ levantamientos: [] }), levantamientos)).toEqual([{ codigo: "sin_levantamientos" }]);
  });
});
