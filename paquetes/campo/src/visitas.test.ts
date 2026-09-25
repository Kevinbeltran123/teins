import { describe, expect, it } from "vitest";
import type { VisitaLocal } from "./datos/modelo";
import { fechaDeVisita, ordenarVisitas } from "./visitas";

const hoy = "2026-09-24";
const visita = (id: string, programadaPara: string, cliente = `Cliente ${id}`): VisitaLocal => ({
  id,
  tecnicoId: "t1",
  cliente: { nombre: cliente },
  sitio: { nombre: "Sede", direccion: "Calle [N]" },
  motivo: "Mantenimiento",
  programadaPara,
});
const ids = (v: VisitaLocal[]) => v.map((x) => x.id);

describe("ordenarVisitas", () => {
  const futura = visita("futura", "2026-09-26");
  const manana = visita("manana", "2026-09-25");
  const hoyB = visita("hoy-b", hoy, "Beta");
  const hoyA = visita("hoy-a", hoy, "Alfa");
  const atrasadaVieja = visita("atrasada-vieja", "2026-09-20");
  const atrasada = visita("atrasada", "2026-09-23");
  const todas = [futura, manana, hoyB, hoyA, atrasada, atrasadaVieja];

  it("sin nada empezado: hoy, atrasadas y futuras, cada grupo por fecha y cliente", () => {
    expect(ids(ordenarVisitas(todas, hoy, new Set(), new Set()))).toEqual(["hoy-a", "hoy-b", "atrasada-vieja", "atrasada", "manana", "futura"]);
  });

  it("una visita con un borrador a medias va primero aunque sea de otro día", () => {
    expect(ids(ordenarVisitas(todas, hoy, new Set(["atrasada"]), new Set()))[0]).toBe("atrasada");
    expect(ids(ordenarVisitas(todas, hoy, new Set(["futura"]), new Set()))[0]).toBe("futura");
  });

  it("una visita atendida va al final y el foco pasa a la siguiente; con un borrador nuevo vuelve arriba", () => {
    const orden = ids(ordenarVisitas(todas, hoy, new Set(), new Set(["hoy-a", "atrasada-vieja"])));
    expect(orden[0]).toBe("hoy-b");
    expect(orden.slice(-2)).toEqual(["hoy-a", "atrasada-vieja"]);
    expect(ids(ordenarVisitas(todas, hoy, new Set(["hoy-a"]), new Set(["hoy-a"])))[0]).toBe("hoy-a");
  });
});

describe("fechaDeVisita", () => {
  it("nombra los días cercanos y escribe los demás", () => {
    expect(fechaDeVisita(hoy, hoy)).toBe("Hoy");
    expect(fechaDeVisita("2026-09-25", hoy)).toBe("Mañana");
    expect(fechaDeVisita("2026-09-23", hoy)).toBe("Ayer");
    expect(fechaDeVisita("2026-09-30", hoy)).toMatch(/30/);
  });
});
