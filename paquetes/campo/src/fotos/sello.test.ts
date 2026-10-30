import { describe, expect, it } from "vitest";
import { aGradosMinutosSegundos, desplazamientoEnPixeles, formatoDeMomento, lineasDelSello, mejorPosicion, textoDeUbicacion, type PosicionDeLlegada } from "./sello";

const BOGOTA = "America/Bogota";

describe("la franja de la foto de llegada (ADR-0052)", () => {
  it("las coordenadas se escriben en grados, minutos y segundos, con el hemisferio", () => {
    expect(aGradosMinutosSegundos(4.20127, -74.6361275)).toBe(`4°12'4.572"N 74°38'10.059"W`);
    expect(aGradosMinutosSegundos(-33.5, 151.25)).toBe(`33°30'0.000"S 151°15'0.000"E`);
    expect(aGradosMinutosSegundos(0, 0)).toBe(`0°0'0.000"N 0°0'0.000"E`);
  });

  it("la hora se escribe con día, hora de 12 y su diferencia con GMT, en la zona pedida", () => {
    expect(formatoDeMomento(new Date("2026-10-27T17:31:07Z"), BOGOTA)).toBe("27 oct 2026 12:31:07 p. m. GMT-05:00");
    expect(formatoDeMomento(new Date("2026-10-27T06:05:09Z"), BOGOTA)).toBe("27 oct 2026 1:05:09 a. m. GMT-05:00");
  });

  it("las líneas van en orden: red, teléfono, coordenadas con su precisión, dirección registrada y lugar", () => {
    const lineas = lineasDelSello({
      ahora: new Date("2026-10-27T17:31:07Z"),
      horaDeRed: new Date("2026-10-27T17:31:06Z"),
      ubicacion: { lat: 4.20127, lon: -74.6361275, precision: 12.4 },
      direccion: "Calle 12 # 3-45",
      ciudad: "Ibagué",
      lugar: { organizacion: "TEINS", cliente: "Cliente de prueba", sitio: "Sede Norte" },
      zona: BOGOTA,
    });
    expect(lineas).toEqual([
      "Red: 27 oct 2026 12:31:06 p. m. GMT-05:00",
      "Teléfono: 27 oct 2026 12:31:07 p. m. GMT-05:00",
      `4°12'4.572"N 74°38'10.059"W · ±12 m`,
      "Calle 12 # 3-45, Ibagué",
      "TEINS · Cliente de prueba · Sede Norte",
    ]);
  });

  it("sin señal dice «Red: sin señal»; sin permiso, la foto sale sin coordenadas; lo que falta no se inventa", () => {
    const lineas = lineasDelSello({ ahora: new Date("2026-10-27T17:31:07Z"), horaDeRed: null, direccion: undefined, lugar: { cliente: "Cliente", sitio: "Sede" }, zona: BOGOTA });
    expect(lineas).toEqual(["Red: sin señal", "Teléfono: 27 oct 2026 12:31:07 p. m. GMT-05:00", "Cliente · Sede"]);
  });

  it("la mejor posición es la de menor imprecisión de los últimos 2 minutos", () => {
    const en = 1_000_000;
    const p = (precision: number, hace = 0): PosicionDeLlegada => ({ lat: 4.2, lon: -74.6, precision, en: en - hace });
    expect(mejorPosicion(null, p(30), en)).toEqual(p(30));
    expect(mejorPosicion(p(30), p(12), en)).toEqual(p(12));
    // Una lectura peor no reemplaza a una mejor reciente.
    expect(mejorPosicion(p(12, 30_000), p(40), en)).toEqual(p(12, 30_000));
    // La mejor de hace más de 2 minutos ya no vale: manda la nueva aunque sea peor.
    expect(mejorPosicion(p(5, 3 * 60_000), p(40), en)).toEqual(p(40));
  });

  it("el estado de la ubicación se dice en una línea", () => {
    expect(textoDeUbicacion("buscando", null)).toBe("Buscando ubicación…");
    expect(textoDeUbicacion("lista", { lat: 0, lon: 0, precision: 11.6, en: 0 })).toBe("Ubicación lista (±12 m)");
    expect(textoDeUbicacion("sin_permiso", null)).toBe("Sin permiso de ubicación: la foto sale sin coordenadas");
    expect(textoDeUbicacion("no_disponible", null)).toBe("Este teléfono no da la ubicación: la foto sale sin coordenadas");
  });

  it("el pin se dibuja en el punto exacto, a partir del centro que se redondeó", () => {
    const centro = { lat: 4.201, lon: -74.636 };
    expect(desplazamientoEnPixeles(centro, centro, 16, 2)).toEqual({ dx: 0, dy: 0 });
    // Al este y al norte: a la derecha (+x) y hacia arriba (-y).
    const { dx, dy } = desplazamientoEnPixeles(centro, { lat: 4.2012, lon: -74.6355 }, 16, 2);
    expect(dx).toBeGreaterThan(90);
    expect(dx).toBeLessThan(100);
    expect(dy).toBeLessThan(-35);
    expect(dy).toBeGreaterThan(-45);
    // El doble de escala, el doble de píxeles; un nivel más de zoom, también.
    expect(desplazamientoEnPixeles(centro, { lat: 4.2012, lon: -74.6355 }, 16, 1).dx).toBeCloseTo(dx / 2, 6);
    expect(desplazamientoEnPixeles(centro, { lat: 4.2012, lon: -74.6355 }, 17, 2).dx).toBeCloseTo(dx * 2, 6);
  });
});
