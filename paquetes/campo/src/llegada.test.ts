import { describe, expect, it } from "vitest";
import type { VersionFormato } from "@teins/dominio";
import { horaLocalDe, huellasConSello, sugerenciaDeLlegada } from "./llegada";

const formato: VersionFormato = {
  formato: "visita",
  version: 1,
  secciones: [
    {
      clave: "llegada",
      titulo: "Llegada",
      campos: [{ clave: "fotos", etiqueta: "Fotos de llegada", tipo: "foto", sello: { ubicacion: true, mapa: true } }],
    },
    {
      clave: "servicio",
      titulo: "Servicio",
      campos: [
        { clave: "horario", etiqueta: "Horario", tipo: "horario" },
        { clave: "fotos_equipo", etiqueta: "Fotos del equipo", tipo: "foto" },
      ],
    },
  ],
};
const a = "a".repeat(64);
const b = "b".repeat(64);
const c = "c".repeat(64);

describe("la llegada que se sugiere en el horario", () => {
  it("solo cuentan las fotos de campos con sello", () => {
    expect(huellasConSello(formato, { llegada: { fotos: [a, b] }, servicio: { fotos_equipo: [c] } })).toEqual([a, b]);
    expect(huellasConSello(formato, {})).toEqual([]);
    expect(huellasConSello(formato, { llegada: { fotos: { noObtenido: true, motivo: "x" } } })).toEqual([]);
  });

  it("la hora local sale de un momento ISO en el teléfono, como HH:MM", () => {
    const momento = new Date(2026, 9, 29, 8, 14, 30);
    expect(horaLocalDe(momento.toISOString())).toBe("08:14");
  });

  it("con fotos de llegada, la más temprana; sin ellas, el inicio del levantamiento", () => {
    const antes = new Date(2026, 9, 29, 8, 14).toISOString();
    const despues = new Date(2026, 9, 29, 8, 40).toISOString();
    const inicio = new Date(2026, 9, 29, 8, 5).toISOString();
    const creadas = new Map([[a, despues], [b, antes]]);
    expect(sugerenciaDeLlegada(formato, { llegada: { fotos: [a, b] } }, inicio, creadas)).toEqual({ hora: "08:14", texto: "Usar 8:14 a. m. (foto de llegada)" });
    expect(sugerenciaDeLlegada(formato, {}, inicio, new Map())).toEqual({ hora: "08:05", texto: "Usar 8:05 a. m. (inicio del levantamiento)" });
  });

  it("una foto cuyo archivo todavía no se leyó no se inventa: cae al inicio del levantamiento", () => {
    const inicio = new Date(2026, 9, 29, 16, 20).toISOString();
    expect(sugerenciaDeLlegada(formato, { llegada: { fotos: [a] } }, inicio, new Map())).toEqual({ hora: "16:20", texto: "Usar 4:20 p. m. (inicio del levantamiento)" });
  });
});
