import { describe, expect, it } from "vitest";
import type { ComentarioDeOficina, RespuestaPendiente } from "./datos/modelo";
import { armarChat, filasDelChat, sinLeer } from "./conversacion";

const c1: ComentarioDeOficina = {
  id: "c1",
  texto: "¿Quién te recibe?",
  seccion: "llegada",
  campo: "recibe",
  autor: "Oficina",
  creadoEn: "2026-10-05T20:26:00.000Z",
  respuestas: [
    { id: "r1", texto: "Nadie", de: "tecnico", autor: "María", creadoEn: "2026-10-05T20:30:00.000Z", llave: "k1", leido: true },
    { id: "r2", texto: "Gracias", de: "oficina", autor: "Oficina", creadoEn: "2026-10-05T20:31:00.000Z" },
  ],
};
const c2: ComentarioDeOficina = { id: "c2", texto: "¿Seguro de los 12 kVA?", seccion: "cuarto", campo: "potencia", autor: "Oficina", creadoEn: "2026-10-05T20:27:00.000Z" };
const pendiente = (llave: string, comentarioId: string, creadaEn: string, extra: Partial<RespuestaPendiente> = {}): RespuestaPendiente => ({
  llave,
  tecnicoId: "t1",
  levantamientoId: "l1",
  comentarioId,
  texto: `Pendiente ${llave}`,
  creadaEn,
  intentos: 0,
  proximoIntentoEn: 0,
  ...extra,
});

describe("el chat con oficina (ADR-0040)", () => {
  it("junta lo de oficina, lo del técnico y lo que espera señal en el orden en que se escribió", () => {
    const chat = armarChat([c1, c2], [pendiente("k2", "c2", "2026-10-05T20:40:00.000Z"), pendiente("k1", "c1", "2026-10-05T20:29:00.000Z", { enviada: { id: "r1", creadoEn: "2026-10-05T20:30:00.000Z" } })]);
    expect(chat.map((m) => [m.texto, m.de, m.estado])).toEqual([
      ["¿Quién te recibe?", "oficina", undefined],
      ["¿Seguro de los 12 kVA?", "oficina", undefined],
      // Lo que el servidor ya devolvió no se repite aunque siga en la cola.
      ["Nadie", "tecnico", "leido"],
      ["Gracias", "oficina", undefined],
      ["Pendiente k2", "tecnico", "cola"],
    ]);
    expect(chat.map((m) => m.comentarioId)).toEqual(["c1", "c2", "c1", "c1", "c2"]);
  });

  it("lo rechazado por estar revisado queda con su estado; lo recibido sin bajar, como enviado", () => {
    const chat = armarChat([c2], [pendiente("k3", "c2", "2026-10-05T20:41:00.000Z", { rechazo: "revisado" }), pendiente("k4", "c2", "2026-10-05T20:42:00.000Z", { enviada: { id: "x", creadoEn: "2026-10-05T20:42:30.000Z" } })]);
    expect(chat.slice(1).map((m) => m.estado)).toEqual(["rechazada", "enviado"]);
  });

  it("sin leer es lo de oficina después de lo último que leyó el técnico", () => {
    const chat = armarChat([c1, c2], []);
    expect(sinLeer(chat, null)).toBe(3);
    expect(sinLeer(chat, "2026-10-05T20:28:00.000Z")).toBe(1);
    expect(sinLeer(chat, "2026-10-05T21:00:00.000Z")).toBe(0);
  });

  it("la hora va centrada al principio y cuando pasan 10 minutos; la franja antes de lo nuevo; los seguidos van pegados", () => {
    const chat = armarChat([c1, c2], [pendiente("k2", "c2", "2026-10-05T20:45:00.000Z")]);
    const filas = filasDelChat(chat, "2026-10-05T20:30:30.000Z");
    expect(filas.map((f) => (f.tipo === "mensaje" ? `${f.mensaje.texto}${f.sigue ? " (sigue)" : ""}${f.cita ? ` [cita: ${f.cita}]` : ""}${f.referencia ? " [dato]" : ""}` : f.tipo === "hora" ? `hora ${f.en}` : `sin leer ${f.cuantos}`))).toEqual([
      "hora 2026-10-05T20:26:00.000Z",
      "¿Quién te recibe? [dato]",
      // Otro dato: no va pegado al anterior aunque sea de oficina.
      "¿Seguro de los 12 kVA? [dato]",
      // El técnico cambia de tema: cita la pregunta de oficina que responde.
      "Nadie [cita: ¿Quién te recibe?]",
      "sin leer 1",
      "Gracias",
      "hora 2026-10-05T20:45:00.000Z",
      "Pendiente k2 [cita: ¿Seguro de los 12 kVA?]",
    ]);
  });
});
