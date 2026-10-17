import { describe, expect, it } from "vitest";
import { detalleDelCancelado, receptores } from "./pantallas/Envios";

const contacto = (id: string, cambios: object = {}) =>
  ({ id, nombre: id, cargo: "", correo: `${id}@cliente.example`, celular: null, recibeCorreo: true, recibeWhatsapp: false, recibeInformes: true, recibeCotizaciones: true, whatsappAutorizado: null, correoRebotado: null, ...cambios }) as never;

describe("a quién se envía por omisión al publicar (ADR-0028, ADR-0029)", () => {
  it("a quienes reciben ese documento por algún canal", () => {
    const contactos = [contacto("ana"), contacto("jorge", { recibeInformes: false }), contacto("marta", { recibeCorreo: false })];
    expect(receptores({ archivado: null, contactos }, "informes")).toEqual(["ana"]);
    expect(receptores({ archivado: null, contactos }, "cotizaciones")).toEqual(["ana", "jorge"]);
  });

  it("un cliente archivado no recibe envíos (ADR-0035): nadie va marcado y el servidor no aborta la publicación", () => {
    const archivado = { en: "2026-10-02T15:00:00.000Z", por: { id: "u1", nombre: "Oficina" } };
    expect(receptores({ archivado, contactos: [contacto("ana")] }, "informes")).toEqual([]);
  });
});

describe("un envío cancelado dice por qué no sale (ADR-0034, ADR-0047)", () => {
  const por = { id: "u1", nombre: "Ana Torres" };
  it("lo canceló una persona", () => {
    expect(detalleDelCancelado({ canal: "correo", error: null, cancelado: { en: "2026-10-16T15:00:00.000Z", por } })).toMatch(/^Correo · cancelado por Ana Torres .+: no sale$/);
  });

  it("se retiró su versión: el motivo, no «No llegó»", () => {
    expect(detalleDelCancelado({ canal: "whatsapp", error: "Versión retirada", cancelado: { en: "2026-10-16T15:00:00.000Z", por } })).toMatch(/^WhatsApp · Versión retirada por Ana Torres .+: no sale$/);
  });
});
