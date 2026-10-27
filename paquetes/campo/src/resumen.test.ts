import { describe, expect, it } from "vitest";
import { claveDeRepeticion, type Respuestas, type VersionFormato } from "@teins/dominio";
import type { LevantamientoLocal } from "./datos/modelo";
import { pasosDe } from "./recorrido";
import { agrupar, cifrasDelBorrador, claveDeError, datosDeResumen, progreso, resumenDePaso } from "./resumen";

// Formato ficticio (R5).
const formato: VersionFormato = {
  formato: "prueba",
  version: 1,
  secciones: [
    {
      clave: "datos",
      titulo: "Datos",
      campos: [
        { clave: "nombre", etiqueta: "Nombre", tipo: "texto", obligatorio: true },
        { clave: "voltaje", etiqueta: "Voltaje", tipo: "medida", unidades: ["V"], obligatorio: true },
        { clave: "fotos", etiqueta: "Fotos", tipo: "foto" },
        { clave: "notas", etiqueta: "Notas", tipo: "texto" },
        { clave: "materiales", etiqueta: "Materiales", tipo: "cantidades", unidades: ["und", "m"] },
        { clave: "croquis", etiqueta: "Croquis", tipo: "boceto" },
        { clave: "firma", etiqueta: "Firma", tipo: "firma" },
      ],
    },
    {
      clave: "tableros",
      titulo: "Tableros",
      repetible: { etiqueta: "Tablero" },
      campos: [
        { clave: "corriente", etiqueta: "Corriente nominal", tipo: "medida", unidades: ["A", "und"], obligatorio: true },
        { clave: "marca", etiqueta: "Marca", tipo: "texto" },
        { clave: "modelo", etiqueta: "Modelo", tipo: "texto" },
        { clave: "serie", etiqueta: "Serie", tipo: "texto" },
        { clave: "fotos", etiqueta: "Fotos", tipo: "foto" },
      ],
    },
  ],
};
const [datos, tableros] = formato.secciones as [VersionFormato["secciones"][number], VersionFormato["secciones"][number]];
const pasos = pasosDe(formato);
const paso = (id: string) => pasos.find((p) => p.id === id)!;

function levantamiento(respuestas: Respuestas, repeticiones: LevantamientoLocal["repeticiones"] = { tableros: [] }): LevantamientoLocal {
  return { id: "l1", formato: "prueba", versionFormato: 1, estado: "borrador", respuestas, repeticiones, creadoEn: "2026-09-24T10:00:00.000Z", actualizadoEn: "2026-09-24T10:00:00.000Z" };
}

const materiales = [
  { id: "a", descripcion: "Cable UTP", cantidad: "120", unidad: "m" },
  { id: "b", descripcion: "Breaker", cantidad: "4", unidad: "und" },
  { id: "c", descripcion: "Canaleta", cantidad: "2.5", unidad: "m" },
  { id: "d", descripcion: "Tornillo", cantidad: "10", unidad: "und" },
];

describe("agrupar", () => {
  it("junta los datos simples seguidos; fotos, cantidades, bocetos y firmas van cada uno aparte", () => {
    expect(agrupar(datos.campos).map((g) => g.map((c) => c.clave))).toEqual([["nombre", "voltaje"], ["fotos"], ["notas"], ["materiales"], ["croquis"], ["firma"]]);
  });
});

describe("progreso", () => {
  it("cuenta los obligatorios de cada bloque, también los de cada repetición", () => {
    const l = levantamiento({ datos: { nombre: "Ana" } }, { tableros: [{ id: "r1000000", nombre: "Tablero 1" }] });
    const { errores, obligatorios, completos } = progreso(formato, l);
    expect(obligatorios).toBe(3);
    expect(completos).toBe(1);
    expect(errores.map((e) => claveDeError(e.seccion, e.campo ?? ""))).toEqual(expect.arrayContaining(["datos.voltaje", `${claveDeRepeticion("tableros", "r1000000")}.corriente`]));
  });

  it("lo de una repetición quitada no cuenta como error", () => {
    const l = levantamiento({ datos: { nombre: "Ana", voltaje: { valor: "220", unidad: "V" } }, [claveDeRepeticion("tableros", "quitada")]: { corriente: "no es medida" } });
    expect(progreso(formato, l)).toEqual({ errores: [], obligatorios: 2, completos: 2 });
  });
});

describe("datosDeResumen", () => {
  it("los tres primeros datos con valor, con la etiqueta corta y sin «und»", () => {
    const resumen = datosDeResumen(tableros, {
      corriente: { valor: "12", unidad: "und" },
      marca: { noObtenido: true, motivo: "Sin placa" },
      modelo: "X1",
      serie: "S-9",
      fotos: ["h1"],
    });
    expect(resumen).toEqual([
      { etiqueta: "Corriente", valor: "12" },
      { etiqueta: "Modelo", valor: "X1" },
      { etiqueta: "Serie", valor: "S-9" },
    ]);
  });

  it("sin respuestas, nada", () => {
    expect(datosDeResumen(tableros, undefined)).toEqual([]);
  });
});

describe("resumenDePaso", () => {
  it("un paso repetible dice cuántas repeticiones hay y sus nombres", () => {
    expect(resumenDePaso(paso("tableros"), levantamiento({}))).toBe("Ningún tablero");
    const l = levantamiento({}, { tableros: [{ id: "r1000000", nombre: "Tablero 1" }, { id: "r2000000", nombre: "Tablero 2" }] });
    expect(resumenDePaso(paso("tableros"), l)).toBe("2 · Tablero 1, Tablero 2");
  });

  it("los datos del paso en una línea, hasta tres", () => {
    expect(resumenDePaso(paso("datos#0"), levantamiento({}))).toBe("Sin datos");
    const l = levantamiento({ datos: { nombre: "Ana", voltaje: { valor: "220.5", unidad: "V" }, fotos: ["h1", "h2"], notas: "Ok" } });
    expect(resumenDePaso(paso("datos#0"), l)).toBe("Ana · 220,5 V · 2 fotos");
  });

  it("materiales, firma y boceto con su propio texto", () => {
    const l = levantamiento({
      datos: {
        materiales,
        croquis: { boceto: "h" },
        firma: { firma: "h", nombre: "Ana", cargo: "Jefa", firmadoEn: "2026-09-24T10:00:00.000Z", declaracion: "Constancia" },
      },
    });
    expect(resumenDePaso(paso("datos#1"), l)).toBe("Cable UTP × 120 m · Breaker × 4 · 2 más");
    expect(resumenDePaso(paso("datos#2"), l)).toBe("Dibujado");
    expect(resumenDePaso(paso("datos#3"), l)).toBe("Ana · Jefa");
    expect(resumenDePaso(paso("datos#1"), levantamiento({ datos: { materiales: [] } }))).toBe("Sin materiales");
  });
});

describe("cifrasDelBorrador", () => {
  it("fotos, cada sección repetible y el total de materiales, hasta tres", () => {
    const l = levantamiento({ datos: { materiales } }, { tableros: [{ id: "r1000000", nombre: "Tablero 1" }] });
    expect(cifrasDelBorrador(pasos, l, 1)).toEqual([
      { valor: 1, texto: "foto" },
      { valor: 1, texto: "tableros" },
      { valor: 4, texto: "materiales" },
    ]);
  });

  it("sin materiales ni repetibles en el formato, solo las fotos", () => {
    const soloDatos = pasosDe({ ...formato, secciones: [{ clave: "s", titulo: "S", campos: [{ clave: "t", etiqueta: "T", tipo: "texto" }] }] });
    expect(cifrasDelBorrador(soloDatos, levantamiento({}), 3)).toEqual([{ valor: 3, texto: "fotos" }]);
  });

  it("un material en singular", () => {
    const l = levantamiento({ datos: { materiales: materiales.slice(0, 1) } });
    expect(cifrasDelBorrador(pasos, l, 0)[2]).toEqual({ valor: 1, texto: "material" });
  });
});
