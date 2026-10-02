import { describe, expect, it } from "vitest";
import { cruceDe, duracionTexto, enCurso, hora12, horarioTexto, libreTexto, ordenDelDia, type Ocupacion } from "./horario";

const FECHA = "2026-10-02";
const ocupacion = (o: Partial<Ocupacion> & { tecnicoId: string }): Ocupacion => ({ visitaId: crypto.randomUUID(), cliente: "Hotel Plaza Real", sitio: "Torre A", motivo: "Mantenimiento", horaInicio: null, horaFin: null, terminadaEn: null, ...o });

describe("el horario de una visita (ADR-0037)", () => {
  it("se lee como en la oficina", () => {
    expect(hora12("09:00")).toBe("9:00 a. m.");
    expect(hora12("12:00")).toBe("12:00 p. m.");
    expect(hora12("14:30")).toBe("2:30 p. m.");
    expect(duracionTexto(90)).toBe("1 h 30 min");
    expect(horarioTexto({ horaInicio: null, horaFin: null, terminada: null }).hora).toBe("Todo el día");
    expect(horarioTexto({ horaInicio: "14:00", horaFin: null, terminada: null })).toEqual({ hora: "Desde 2:00 p. m.", detalle: "Hasta que la terminen" });
    expect(horarioTexto({ horaInicio: "14:00", horaFin: null, terminada: { en: "2026-10-02T21:05:00.000Z" } }).detalle).toBe("Terminó 4:05 p. m.");
  });

  it("los cruces siguen la regla del servidor: tocar el borde no cruza, todo el día y sin fin sí", () => {
    const ana = [ocupacion({ tecnicoId: "ana", horaInicio: "09:00", horaFin: "12:00" })];
    expect(cruceDe("ana", FECHA, { horaInicio: "11:00", horaFin: "13:00" }, ana)).not.toBeNull();
    expect(cruceDe("ana", FECHA, { horaInicio: "12:00", horaFin: "13:00" }, ana)).toBeNull();
    expect(cruceDe("ana", FECHA, { horaInicio: null, horaFin: null }, ana)).not.toBeNull();
    const ciro = [ocupacion({ tecnicoId: "ciro", horaInicio: "14:00" })];
    expect(cruceDe("ciro", FECHA, { horaInicio: "16:00", horaFin: "17:00" }, ciro)).not.toBeNull();
    // Terminada a las 3:00 p. m.: libre desde ahí.
    const terminada = [ocupacion({ tecnicoId: "ciro", horaInicio: "14:00", terminadaEn: "2026-10-02T20:00:00.000Z" })];
    expect(cruceDe("ciro", FECHA, { horaInicio: "16:00", horaFin: "17:00" }, terminada)).toBeNull();
    // La que se está cambiando no cuenta.
    expect(cruceDe("ana", FECHA, { horaInicio: "10:00", horaFin: "11:00" }, ana, ana[0]!.visitaId)).toBeNull();
  });

  it("dice cuándo tiene la siguiente o desde cuándo está libre", () => {
    const juan = [ocupacion({ tecnicoId: "juan", horaInicio: "14:00" })];
    expect(libreTexto("juan", FECHA, { horaInicio: "09:00", horaFin: "11:00" }, juan)).toBe("Libre · tiene otra a las 2:00 p. m.");
    const diego = [ocupacion({ tecnicoId: "diego", horaInicio: "07:00", horaFin: "08:30" })];
    expect(libreTexto("diego", FECHA, { horaInicio: "09:00", horaFin: "11:00" }, diego)).toBe("Libre desde 8:30 a. m.");
    expect(libreTexto("laura", FECHA, { horaInicio: "09:00", horaFin: "11:00" }, diego)).toBe("Libre todo el día");
  });

  it("en curso: sin fin, de hoy, ya empezó y nadie la terminó; el día se ordena por hora", () => {
    const v = { horaInicio: "14:00", horaFin: null, programadaPara: FECHA, terminada: null };
    expect(enCurso(v, FECHA, new Date("2026-10-02T20:00:00.000Z"))).toBe(true);
    expect(enCurso(v, FECHA, new Date("2026-10-02T15:00:00.000Z"))).toBe(false);
    expect(enCurso({ ...v, terminada: { en: "x" } }, FECHA, new Date("2026-10-02T20:00:00.000Z"))).toBe(false);
    const dia = [{ horaInicio: null, horaFin: null }, { horaInicio: "14:00", horaFin: null }, { horaInicio: "09:00", horaFin: "12:00" }].sort(ordenDelDia);
    expect(dia.map((x) => x.horaInicio)).toEqual(["09:00", "14:00", null]);
  });
});
