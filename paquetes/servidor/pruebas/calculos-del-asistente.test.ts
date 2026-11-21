import { describe, expect, it } from "vitest";
import {
  cantidadConUnidad,
  decimalColombiano,
  esFechaReal,
  estadisticas,
  mediana,
  mesCorto,
  mesesEntre,
  normalizarTexto,
  numeroColombiano,
  percentil,
  preguntaPorPersona,
  redactar,
  redondearArriba,
} from "../src/modulos/asistente/herramientas/calculos";

/** Cálculos puros de las herramientas del asistente (iteración 53). */
describe("estadísticas", () => {
  const porPunto = [28.3333, 25.4167, 28.9583, 31.1111, 30.1667];

  it("mediana y percentil 80 con interpolación lineal, como numpy", () => {
    expect(mediana(porPunto)).toBeCloseTo(28.9583, 4);
    expect(percentil(porPunto, 80)).toBeCloseTo(30.3556, 4);
    expect(estadisticas(porPunto)).toMatchObject({ n: 5, minimo: 25.4167, maximo: 31.1111 });
    expect(mediana([1, 2, 3, 4])).toBe(2.5);
    expect(percentil([7], 80)).toBe(7);
  });

  it("con las cantidades exactas, 40 puntos dan 1.215 m con el percentil 80 y 1.159 m con la mediana", () => {
    const exactos = [1020 / 36, 610 / 24, 1390 / 48, 560 / 18, 905 / 30];
    expect(redondearArriba(percentil(exactos, 80) * 40)).toBe(1215);
    expect(redondearArriba(mediana(exactos) * 40)).toBe(1159);
  });
});

describe("redondeo hacia arriba", () => {
  it("sube al entero siguiente y no suma uno por el ruido de la coma flotante", () => {
    expect(redondearArriba(1214.22)).toBe(1215);
    expect(redondearArriba(1158.0001)).toBe(1159);
    expect(redondearArriba(1200)).toBe(1200);
    expect(redondearArriba(0.1 * 3 * 10)).toBe(3);
  });
});

describe("redacción de correos y celulares", () => {
  it("cambia correos y teléfonos de Colombia", () => {
    expect(redactar("Escribir a ana.perez@ejemplo.com.co antes")).toBe("Escribir a [correo] antes");
    expect(redactar("Llamar al 3001234567")).toBe("Llamar al [celular]");
    expect(redactar("Llamar al +57 300 123 4567.")).toBe("Llamar al [celular].");
    expect(redactar("Fijo (608) 123 4567 o 300-123-4567")).toBe("Fijo [celular] o [celular]");
  });

  it("no toca cantidades, fechas ni otros números", () => {
    const texto = "Se usaron 1020 m y 4.485 m el 2026-11-20; orden 0041, 36 puntos, NIT 900123456-7, serial 30012345678901";
    expect(redactar(texto)).toBe(texto);
  });

  it("los bordes del correo: con tildes, pegados, sin dominio completo y textos largos sin @", () => {
    expect(redactar("Correo: José.Peña_2+obra@clínica-ñandú.com.co.")).toBe("Correo: [correo].");
    expect(redactar("a@b.co_x@d.com y c@d.e")).toBe("[correo][correo] y [correo]");
    expect(redactar("a@b.co.x@d.com")).toBe("[correo]@d.com");
    expect(redactar("ana@ejemplo, @x.co, a@@b.co, a@.co, a@b.")).toBe("ana@ejemplo, @x.co, a@@b.co, a@.co, a@b.");
    expect(redactar("(ana@x.co)<b@y.org>")).toBe("([correo])<[correo]>");
    const largo = "a".repeat(50_000);
    expect(redactar(largo)).toBe(largo);
    expect(redactar(`${largo}@x`)).toBe(`${largo}@x`);
  });
});

describe("ciudades", () => {
  it("se comparan sin mayúsculas, tildes ni espacios de más", () => {
    expect(normalizarTexto(" IBAGUÉ ")).toBe("ibague");
    expect(normalizarTexto("Ibague")).toBe(normalizarTexto("ibagué"));
    expect(normalizarTexto("San  José   del Guaviare")).toBe("san jose del guaviare");
  });
});

describe("formato de los números", () => {
  it("miles con punto y decimales con coma", () => {
    expect(decimalColombiano("4485")).toBe("4.485");
    expect(decimalColombiano("1234567.25")).toBe("1.234.567,25");
    expect(decimalColombiano("45")).toBe("45");
    expect(decimalColombiano("100")).toBe("100");
    expect(decimalColombiano("1000")).toBe("1.000");
    expect(decimalColombiano("123456")).toBe("123.456");
    expect(decimalColombiano("-1234.5")).toBe("-1.234,5");
    expect(decimalColombiano("0.25")).toBe("0,25");
    expect(numeroColombiano(1e21)).toBe("1e+21");
    expect(numeroColombiano(Number.NaN)).toBe("NaN");
    expect(numeroColombiano(-Infinity)).toBe("-Infinity");
    expect(numeroColombiano(28.9583, 1)).toBe("29,0");
    expect(numeroColombiano(30.3556, 1)).toBe("30,4");
    expect(cantidadConUnidad("4485", "m")).toBe("4.485 m");
  });

  it("meses cortos en español y fechas que existen", () => {
    expect(mesCorto("2026-01")).toBe("ene");
    expect(mesCorto("2026-09")).toBe("sep");
    expect(mesesEntre("2025-11", "2026-02")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(esFechaReal("2026-02-28")).toBe(true);
    expect(esFechaReal("2028-02-29")).toBe(true);
    expect(esFechaReal("2026-02-30")).toBe(false);
    expect(esFechaReal("2026-2-3")).toBe(false);
  });
});

describe("campos que preguntan por una persona", () => {
  it("reconoce las etiquetas sin mayúsculas ni tildes", () => {
    for (const e of ["¿Quién te recibe?", "Nombre del contacto", "Persona que atiende", "RESPONSABLE DEL SITIO", "Encargada", "Cédula", "Documento de identidad", "Teléfono", "Celular", "Correo", "E-mail", "WhatsApp", "Nombre de quien firma", "Nombre de la persona", "¿Quiénes estaban?"]) {
      expect(preguntaPorPersona(e), e).toBe(true);
    }
  });

  it("no confunde otros campos", () => {
    for (const e of ["Nombre del tablero", "Observaciones", "Correcciones hechas", "Recibido en bodega", "Ubicación del tablero", "Descripción del sitio"]) {
      expect(preguntaPorPersona(e), e).toBe(false);
    }
  });
});
