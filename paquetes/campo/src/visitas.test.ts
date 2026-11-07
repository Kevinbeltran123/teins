import { describe, expect, it } from "vitest";
import type { VisitaLocal } from "./datos/modelo";
import { accionDeVisita, agendaDeVisitas, formatosParaIniciar, cuandoSePodraIniciar, enCurso, fechaDeVisita, horaCorta, horarioDeVisita, sePuedeIniciar, terminadaEn } from "./visitas";

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

describe("agendaDeVisitas", () => {
  const futura = visita("futura", "2026-09-26");
  const manana = visita("manana", "2026-09-25");
  const hoyB = visita("hoy-b", hoy, "Beta");
  const hoyA = visita("hoy-a", hoy, "Alfa");
  const atrasadaVieja = visita("atrasada-vieja", "2026-09-20");
  const atrasada = visita("atrasada", "2026-09-23");
  const todas = [futura, manana, hoyB, hoyA, atrasada, atrasadaVieja];
  const ahora = new Date("2026-09-24T15:00:00");
  const agenda = (vs: VisitaLocal[], conBorrador: string[] = [], conEnviados: string[] = []) => agendaDeVisitas(vs, hoy, new Set(conBorrador), new Set(conEnviados), ahora);

  it("sin nada empezado: hoy, atrasadas y futuras, cada grupo por fecha y cliente", () => {
    expect(ids(agenda(todas).pendientes)).toEqual(["hoy-a", "hoy-b", "atrasada-vieja", "atrasada", "manana", "futura"]);
  });

  it("una visita con un borrador a medias va primero aunque sea de otro día, y aunque ya tenga algo enviado", () => {
    expect(ids(agenda(todas, ["atrasada"]).pendientes)[0]).toBe("atrasada");
    expect(ids(agenda(todas, ["futura"]).pendientes)[0]).toBe("futura");
    expect(ids(agenda(todas, ["hoy-a"], ["hoy-a"]).pendientes)[0]).toBe("hoy-a");
  });

  it("una visita atendida sale de las pendientes: la siguiente es la que falta, y la de hoy queda en «Atendidas hoy»", () => {
    const { pendientes, atendidasHoy } = agenda(todas, [], ["hoy-a"]);
    expect(ids(pendientes)[0]).toBe("hoy-b");
    expect(ids(pendientes)).not.toContain("hoy-a");
    expect(ids(atendidasHoy)).toEqual(["hoy-a"]);
  });

  it("sin nada pendiente no hay siguiente visita: la atendida no vuelve a ocupar ese lugar", () => {
    const { pendientes, atendidasHoy } = agenda([hoyA], [], ["hoy-a"]);
    expect(pendientes).toEqual([]);
    expect(ids(atendidasHoy)).toEqual(["hoy-a"]);
  });

  it("lo atendido de otros días no se muestra: su levantamiento sigue en «Enviados»", () => {
    const { pendientes, atendidasHoy } = agenda(todas, [], ["atrasada-vieja", "atrasada"]);
    expect(ids(pendientes)).toEqual(["hoy-a", "hoy-b", "manana", "futura"]);
    expect(atendidasHoy).toEqual([]);
  });

  it("una visita terminada sin nada enviado está atendida: no queda de siguiente ni pasa a atrasada (ADR-0037)", () => {
    const terminadaHoy = visita("terminada-hoy", hoy, "Gamma", { horaInicio: "08:00", horaFin: null, terminada: { en: "2026-09-24T13:00:00.000Z" } });
    const terminadaAyer = visita("terminada-ayer", "2026-09-23", "Delta", { horaInicio: "08:00", horaFin: null, terminacionPendiente: { llave: "k", en: "2026-09-23T18:00:00.000Z", intentos: 0, proximoIntentoEn: 0 } });
    const { pendientes, atendidasHoy } = agenda([terminadaHoy, terminadaAyer, manana]);
    expect(ids(pendientes)).toEqual(["manana"]);
    expect(ids(atendidasHoy)).toEqual(["terminada-hoy"]);
  });

  it("una visita cancelada o reasignada con un borrador a medias no tapa la de hoy: va después, para terminarla y enviarla", () => {
    const cancelada = visita("cancelada", "2026-09-20", "Zeta", { fueraDeAlcance: true, motivoSalida: "cancelada" });
    expect(ids(agenda([hoyA, cancelada, manana], ["cancelada"]).pendientes)).toEqual(["hoy-a", "cancelada", "manana"]);
  });

  it("el mismo día va por hora de inicio y las de todo el día al final, aunque el cliente vaya antes (ADR-0037)", () => {
    const tarde = visita("tarde", hoy, "Alfa", { horaInicio: "14:00", horaFin: null });
    const manana9 = visita("nueve", hoy, "Zeta", { horaInicio: "09:00", horaFin: "11:00" });
    const todoElDia = visita("todo-el-dia", hoy, "Aaa");
    const ayer = visita("ayer", "2026-09-23", "Beta", { horaInicio: "08:00", horaFin: null });
    expect(ids(agenda([tarde, todoElDia, manana9, ayer]).pendientes)).toEqual(["nueve", "tarde", "todo-el-dia", "ayer"]);
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

describe("cuándo se puede iniciar una visita (iteración 46)", () => {
  it("la de un día futuro no se puede iniciar; la de hoy, a cualquier hora, y las atrasadas, sí", () => {
    expect(sePuedeIniciar({ programadaPara: "2026-10-30" }, "2026-10-29")).toBe(false);
    expect(sePuedeIniciar({ programadaPara: "2026-11-03" }, "2026-10-29")).toBe(false);
    expect(sePuedeIniciar({ programadaPara: "2026-10-29" }, "2026-10-29")).toBe(true);
    expect(sePuedeIniciar({ programadaPara: "2026-10-28" }, "2026-10-29")).toBe(true);
  });

  it("el día no cambia por la hora de la visita: el horario no la bloquea dentro del día", () => {
    expect(sePuedeIniciar(visita("noche", "2026-10-29", "Cliente", { horaInicio: "21:00" }), "2026-10-29")).toBe(true);
  });

  it("dice cuándo: mañana, o el día con su nombre", () => {
    expect(cuandoSePodraIniciar("2026-10-30", "2026-10-29")).toBe("Podrás iniciarla mañana");
    expect(cuandoSePodraIniciar("2026-11-03", "2026-10-29")).toBe("Podrás iniciarla el martes, 3 de noviembre");
  });

  it("cruza el fin de mes y de año", () => {
    expect(cuandoSePodraIniciar("2026-11-01", "2026-10-31")).toBe("Podrás iniciarla mañana");
    expect(cuandoSePodraIniciar("2027-01-01", "2026-12-31")).toBe("Podrás iniciarla mañana");
  });
});

describe("accionDeVisita (ADR-0054)", () => {
  const l = (id: string, estado: "borrador" | "enviado") => ({ id, estado });
  it("sin nada, se inicia; con un borrador, se continúa", () => {
    expect(accionDeVisita([])).toEqual({ tipo: "iniciar" });
    expect(accionDeVisita([l("b", "borrador")])).toEqual({ tipo: "continuar", id: "b" });
  });
  it("con uno enviado, ya no se inicia otro: se ve lo enviado", () => {
    expect(accionDeVisita([l("e", "enviado")])).toEqual({ tipo: "ver", id: "e" });
  });
  it("un borrador de antes de la regla se sigue pudiendo continuar y enviar", () => {
    expect(accionDeVisita([l("e", "enviado"), l("b", "borrador")])).toEqual({ tipo: "continuar", id: "b" });
  });
});

describe("formatosParaIniciar (ADR-0057)", () => {
  const ups = { formato: "servicio-ups" };
  const tecnica = { formato: "visita-tecnica" };
  it("una visita con servicio ofrece solo ese formato; si falta en el teléfono, ninguno", () => {
    expect(formatosParaIniciar({ formato: "visita-tecnica" }, [ups, tecnica])).toEqual([tecnica]);
    expect(formatosParaIniciar({ formato: "visita-tecnica" }, [ups])).toEqual([]);
  });
  it("una visita sin servicio (anterior o de una app anterior) ofrece todos, como antes", () => {
    expect(formatosParaIniciar({ formato: null }, [ups, tecnica])).toEqual([ups, tecnica]);
    expect(formatosParaIniciar({}, [ups, tecnica])).toEqual([ups, tecnica]);
  });
});
