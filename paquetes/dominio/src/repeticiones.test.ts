import { describe, expect, it } from "vitest";
import type { VersionFormato } from "./formato";
import { agregarRepeticion, crearLevantamiento, quitarRepeticion, renombrarRepeticion, responder } from "./levantamiento";
import { validarDefinicionFormato } from "./meta-esquema";
import { bloques, claveDeRepeticion, leerClave, nombreDeDato, rutaLegible, VERSION_APP_REPETIBLES } from "./repeticiones";
import { corregir } from "./revision";
import { validarRespuestas } from "./validacion";
import { enviarLevantamiento } from "./estados";

const formato: VersionFormato = {
  formato: "edificio",
  version: 1,
  appMinima: VERSION_APP_REPETIBLES,
  secciones: [
    { clave: "general", titulo: "Datos generales", campos: [{ clave: "direccion", etiqueta: "Dirección", tipo: "texto" }] },
    {
      clave: "tableros",
      titulo: "Tableros",
      repetible: { etiqueta: "Tablero", min: 1, max: 3 },
      campos: [
        { clave: "ubicacion", etiqueta: "Ubicación", tipo: "texto", obligatorio: true },
        { clave: "corriente", etiqueta: "Corriente nominal", tipo: "medida", unidades: ["A"], obligatorio: true },
      ],
    },
  ],
};

const ahora = new Date("2026-09-25T12:00:00Z");
let n = 0;
const nuevoId = () => `id${String(++n).padStart(6, "0")}`;

describe("secciones repetibles (iteración 9)", () => {
  it("el levantamiento nace con las repeticiones mínimas, con nombre por defecto", () => {
    const l = crearLevantamiento(formato, "l1", ahora, undefined, nuevoId);
    expect(l.repeticiones?.tableros).toHaveLength(1);
    expect(l.repeticiones?.tableros?.[0]?.nombre).toBe("Tablero 1");
    expect(bloques(formato, l.repeticiones).map((b) => b.clave)).toEqual(["general", claveDeRepeticion("tableros", l.repeticiones!.tableros![0]!.id)]);
  });

  it("agrega hasta el máximo, renombra y quita con sus respuestas", () => {
    let l = crearLevantamiento(formato, "l2", ahora, undefined, nuevoId);
    l = agregarRepeticion(l, formato, "tableros", "otro0001", ahora);
    l = agregarRepeticion(l, formato, "tableros", "otro0002", ahora);
    expect(l.repeticiones?.tableros?.map((r) => r.nombre)).toEqual(["Tablero 1", "Tablero 2", "Tablero 3"]);
    expect(() => agregarRepeticion(l, formato, "tableros", "otro0003", ahora)).toThrow(/máximo/);
    expect(() => agregarRepeticion(l, formato, "general", "otro0004", ahora)).toThrow(/no es repetible/);

    l = renombrarRepeticion(l, "tableros", "otro0001", "Tablero del sótano", ahora);
    l = responder(l, claveDeRepeticion("tableros", "otro0001"), "ubicacion", "Sótano", ahora);
    l = quitarRepeticion(l, "tableros", "otro0001", ahora);
    expect(l.repeticiones?.tableros?.map((r) => r.nombre)).toEqual(["Tablero 1", "Tablero 3"]);
    expect(l.respuestas[claveDeRepeticion("tableros", "otro0001")]).toBeUndefined();
    // Un nombre nuevo no repite uno que ya existe.
    l = agregarRepeticion(l, formato, "tableros", "otro0005", ahora);
    expect(l.repeticiones?.tableros?.at(-1)?.nombre).toBe("Tablero 4");
  });

  it("valida cada repetición con sus obligatorios, y el número de repeticiones", () => {
    let l = crearLevantamiento(formato, "l3", ahora, undefined, nuevoId);
    const primera = claveDeRepeticion("tableros", l.repeticiones!.tableros![0]!.id);
    expect(validarRespuestas(formato, l.respuestas, l.repeticiones)).toEqual([
      { seccion: primera, campo: "ubicacion", codigo: "campo_obligatorio" },
      { seccion: primera, campo: "corriente", codigo: "campo_obligatorio" },
    ]);
    l = responder(l, primera, "ubicacion", "Piso 1", ahora);
    l = responder(l, primera, "corriente", { valor: "63", unidad: "A" }, ahora);
    expect(validarRespuestas(formato, l.respuestas, l.repeticiones)).toEqual([]);
    expect(enviarLevantamiento(l, formato, ahora).ok).toBe(true);

    // Menos del mínimo.
    expect(validarRespuestas(formato, {}, { tableros: [] })).toEqual([{ seccion: "tableros", codigo: "repeticiones_insuficientes" }]);
    // Más del máximo.
    const cuatro = ["a0000001", "a0000002", "a0000003", "a0000004"].map((id, i) => ({ id, nombre: `T${i}` }));
    const respuestasCuatro = Object.fromEntries(cuatro.map((r) => [claveDeRepeticion("tableros", r.id), { ubicacion: "x", corriente: { valor: "1", unidad: "A" } }]));
    expect(validarRespuestas(formato, respuestasCuatro, { tableros: cuatro })).toEqual([{ seccion: "tableros", codigo: "repeticiones_excedidas" }]);
  });

  it("rechaza lo que llega mal desde un dispositivo, sin lanzar", () => {
    const valido = { ubicacion: "x", corriente: { valor: "1", unidad: "A" } };
    // Respuestas de una repetición que no está en la lista, o de la sección repetible sin repetición.
    expect(validarRespuestas(formato, { "tableros~zzzzzzzz": valido, tableros: valido }, { tableros: [{ id: "a0000001", nombre: "T" }] })).toEqual(
      expect.arrayContaining([
        { seccion: "tableros~zzzzzzzz", codigo: "seccion_desconocida" },
        { seccion: "tableros", codigo: "seccion_desconocida" },
      ]),
    );
    // Repeticiones de una sección que no es repetible, ids inválidos o repetidos, nombres vacíos.
    expect(validarRespuestas(formato, {}, { general: [{ id: "a0000001", nombre: "X" }] })).toContainEqual({ seccion: "general", codigo: "seccion_desconocida" });
    expect(validarRespuestas(formato, {}, { tableros: [{ id: "MAL", nombre: "X" }] })).toContainEqual({ seccion: "tableros", codigo: "tipo_invalido" });
    expect(validarRespuestas(formato, {}, { tableros: [{ id: "a0000001", nombre: " " }] })).toContainEqual({ seccion: "tableros", codigo: "nombre_de_repeticion_invalido" });
    expect(validarRespuestas(formato, {}, { tableros: "no es una lista" } as never)).toContainEqual({ seccion: "tableros", codigo: "tipo_invalido" });
  });

  it("oficina corrige una repetición existente; no una que no existe", () => {
    const repeticiones = { tableros: [{ id: "a0000001", nombre: "Tablero 1" }] };
    const respuestas = { "tableros~a0000001": { ubicacion: "Piso 1", corriente: { valor: "63", unidad: "A" } } };
    const r = corregir(formato, respuestas, [{ seccion: "tableros~a0000001", campo: "ubicacion", valor: "Piso 2" }], repeticiones);
    expect(r).toMatchObject({ ok: true, cambios: [{ seccion: "tableros~a0000001", campo: "ubicacion", anterior: "Piso 1", nuevo: "Piso 2" }] });
    expect(corregir(formato, respuestas, [{ seccion: "tableros~b0000001", campo: "ubicacion", valor: "x" }], repeticiones)).toMatchObject({ ok: false });
  });

  it("describe la ruta de un dato para personas", () => {
    const repeticiones = { tableros: [{ id: "a0000001", nombre: "Tablero del sótano" }] };
    expect(rutaLegible(formato, repeticiones, "tableros~a0000001", "corriente")).toBe("Tableros · Tablero del sótano · Corriente nominal");
    expect(rutaLegible(formato, repeticiones, "general", "direccion")).toBe("Datos generales · Dirección");
    expect(leerClave("tableros~a0000001")).toEqual({ seccion: "tableros", repeticion: "a0000001" });
    // En una sección normal, el dato se sigue nombrando como antes.
    expect(nombreDeDato(formato, repeticiones, "general", "direccion", true)).toBe("dirección");
    expect(nombreDeDato(formato, repeticiones, "tableros~a0000001", "corriente", true)).toBe("Tableros · Tablero del sótano · Corriente nominal");
  });

  it("el meta-esquema exige appMinima 4 y límites coherentes", () => {
    expect(validarDefinicionFormato(formato)).toEqual([]);
    expect(validarDefinicionFormato({ ...formato, appMinima: undefined })).toContain("Las secciones repetibles exigen appMinima 4 o mayor");
    const malos = { ...formato, secciones: [{ ...formato.secciones[1]!, repetible: { etiqueta: " ", min: 3, max: 2 } }] };
    expect(validarDefinicionFormato(malos)).toEqual(expect.arrayContaining(["La sección tableros necesita la etiqueta de sus repeticiones", "Límites imposibles en la sección repetible tableros"]));
  });
});
