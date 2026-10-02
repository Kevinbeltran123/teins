import { describe, expect, it } from "vitest";
import type { VisitaLocal } from "./datos/modelo";
import { enCurso, fechaDeVisita, horaCorta, horarioDeVisita, ordenarVisitas, terminadaEn } from "./visitas";

const hoy = "2026-09-24";
const visita = (id: string, programadaPara: string, cliente = `Cliente ${id}`, horario: Partial<VisitaLocal> = {}): VisitaLocal => ({
  id,
  tecnicoId: "t1",
  cliente: { nombre: cliente },
  sitio: { nombre: "Sede", direccion: "Calle [N]" },
  motivo: "Mantenimiento",
  programadaPara,
  ...horario,
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

  it("el mismo día va por hora de inicio y las de todo el día al final, aunque el cliente vaya antes (ADR-0037)", () => {
    const tarde = visita("tarde", hoy, "Alfa", { horaInicio: "14:00", horaFin: null });
    const manana9 = visita("nueve", hoy, "Zeta", { horaInicio: "09:00", horaFin: "11:00" });
    const todoElDia = visita("todo-el-dia", hoy, "Aaa");
    const ayer = visita("ayer", "2026-09-23", "Beta", { horaInicio: "08:00", horaFin: null });
    expect(ids(ordenarVisitas([tarde, todoElDia, manana9, ayer], hoy, new Set(), new Set()))).toEqual(["nueve", "tarde", "todo-el-dia", "ayer"]);
  });
});

describe("horario", () => {
  it("dice la hora como en Colombia, con mediodía y medianoche", () => {
    expect(horaCorta("09:00")).toBe("9:00 a. m.");
    expect(horaCorta("12:30")).toBe("12:30 p. m.");
    expect(horaCorta("00:05")).toBe("12:05 a. m.");
    expect(horaCorta("14:00")).toBe("2:00 p. m.");
  });

  it("de-a, desde (sin fin) o nada si es de todo el día", () => {
    expect(horarioDeVisita({ horaInicio: "09:00", horaFin: "11:00" })).toBe("9:00 a. m. a 11:00 a. m.");
    expect(horarioDeVisita({ horaInicio: "14:00", horaFin: null })).toBe("Desde 2:00 p. m.");
    expect(horarioDeVisita({ horaInicio: null, horaFin: null })).toBeNull();
    // Una visita bajada por una app anterior al horario no trae los campos.
    expect(horarioDeVisita({})).toBeNull();
  });
});

describe("enCurso", () => {
  const abierta = visita("abierta", hoy, "Alfa", { horaInicio: "14:00", horaFin: null });
  const a = (hhmm: string) => new Date(`${hoy}T${hhmm}:00`);

  it("sin hora de fin, de hoy y ya empezada", () => {
    expect(enCurso(abierta, a("13:59"))).toBe(false);
    expect(enCurso(abierta, a("14:00"))).toBe(true);
    expect(enCurso(abierta, a("23:00"))).toBe(true);
  });

  it("no con hora de fin, de todo el día, de otro día, ni ya terminada (en el servidor o solo en el teléfono)", () => {
    expect(enCurso({ ...abierta, horaFin: "16:00" }, a("15:00"))).toBe(false);
    expect(enCurso({ ...abierta, horaInicio: null }, a("15:00"))).toBe(false);
    expect(enCurso({ ...abierta, programadaPara: "2026-09-23" }, a("15:00"))).toBe(false);
    expect(enCurso({ ...abierta, terminada: { en: "2026-09-24T20:00:00.000Z" } }, a("15:00"))).toBe(false);
    const pendiente = { llave: "0192f0e0-0000-7000-8000-000000000001", en: "2026-09-24T20:30:00.000Z", intentos: 0, proximoIntentoEn: 0 };
    expect(enCurso({ ...abierta, terminacionPendiente: pendiente }, a("15:00"))).toBe(false);
  });

  it("la terminada del servidor manda sobre la del teléfono", () => {
    const pendiente = { llave: "0192f0e0-0000-7000-8000-000000000001", en: "2026-09-24T20:30:00.000Z", intentos: 0, proximoIntentoEn: 0 };
    expect(terminadaEn({ ...abierta, terminacionPendiente: pendiente })).toBe(pendiente.en);
    expect(terminadaEn({ ...abierta, terminada: { en: "2026-09-24T20:00:00.000Z" }, terminacionPendiente: pendiente })).toBe("2026-09-24T20:00:00.000Z");
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
