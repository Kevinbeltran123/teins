import { describe, expect, it } from "vitest";
import { aCsv, csvDetalle, csvResumen, leerCatalogo } from "./csv";

const datos = {
  visita: { cliente: "Cliente; de prueba", sitio: "Sede", programadaPara: "2026-09-30" },
  lineas: [
    { levantamientoId: "11111111-2222-4333-8444-555555555555", tecnico: "T", estado: "revisado" as const, ubicacion: "Obra · Materiales", descripcion: "Cable 12", cantidad: "12.5", unidad: "m", observacion: null, item: { codigo: "C-12", descripcion: "Cable THHN 12" } },
    { levantamientoId: "11111111-2222-4333-8444-555555555555", tecnico: "T", estado: "revisado" as const, ubicacion: "Obra · Materiales", descripcion: "=HYPERLINK(\"x\")", cantidad: "2", unidad: "und", observacion: "Dice \"urgente\"", item: null },
    { levantamientoId: "99999999-2222-4333-8444-555555555555", tecnico: "U", estado: "enviado" as const, ubicacion: "Obra · Materiales", descripcion: "Cable #12", cantidad: "0.5", unidad: "m", observacion: null, item: { codigo: "C-12", descripcion: "Cable THHN 12" } },
  ],
};

describe("CSV para Excel en español (iteración 11)", () => {
  it("usa BOM, punto y coma, CRLF y comillas solo donde hacen falta", () => {
    expect(aCsv([["a", "b;c"], ['di "x"', "e"]])).toBe('﻿a;"b;c"\r\n"di ""x""";e\r\n');
  });

  it("el detalle trae coma decimal y neutraliza lo que Excel tomaría por fórmula", () => {
    const filas = csvDetalle(datos).split("\r\n");
    expect(filas[0]).toBe("﻿Fecha de la visita;Cliente;Sitio;Levantamiento;Estado;Técnico;Ubicación;Descripción;Cantidad;Unidad;Observación;Código del catálogo;Descripción del catálogo");
    expect(filas[1]).toBe('2026-09-30;"Cliente; de prueba";Sede;11111111;Revisado;T;Obra · Materiales;Cable 12;12,5;m;;C-12;Cable THHN 12');
    expect(filas[2]).toContain(`;"'=HYPERLINK(""x"")";2;und;"Dice ""urgente""";;`);
  });

  it("el resumen suma exacto por ítem y deja lo no vinculado aparte", () => {
    expect(csvResumen(datos).split("\r\n").slice(0, 3)).toEqual([
      "﻿Código del catálogo;Descripción;Cantidad;Unidad;Líneas",
      "C-12;Cable THHN 12;13;m;2",
      `Sin vincular;"'=HYPERLINK(""x"")";2;und;1`,
    ]);
  });

  it("lee el catálogo con encabezado en cualquier orden, con coma o punto y coma", () => {
    expect(leerCatalogo("﻿Unidad;Código;Descripción\r\nm;C-12;Cable THHN 12\r\n\r\nund;B-20;\"Breaker; 20 A\"\r\n")).toEqual({
      items: [
        { codigo: "C-12", descripcion: "Cable THHN 12", unidad: "m" },
        { codigo: "B-20", descripcion: "Breaker; 20 A", unidad: "und" },
      ],
      errores: [],
    });
    expect(leerCatalogo("C-12,Cable,m\nB-20,,und\n").errores).toEqual(["Fila 2: le falta el código, la descripción o la unidad."]);
    expect(leerCatalogo("codigo;nombre\nC-1;X\n").errores).toEqual(["El encabezado necesita las columnas Código, Descripción y Unidad."]);
  });
});
