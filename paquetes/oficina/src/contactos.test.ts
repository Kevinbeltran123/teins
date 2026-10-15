import { describe, expect, it } from "vitest";
import { autorizacionDelCelular } from "./pantallas/CamposDeContacto";

const NUMERO = "+573005550117";
const OTRO = "+573105550142";
const vigente = { por: { id: "u1", nombre: "Oficina de prueba" }, en: "2026-10-01T15:00:00.000Z" };
const autorizada = { celular: NUMERO, whatsappAutorizado: vigente };

describe("la autorización de WhatsApp es del número (ADR-0028, parte 5)", () => {
  it("con el número autorizado, vale la que ya está registrada", () => {
    expect(autorizacionDelCelular(autorizada, NUMERO, null)).toEqual({ vigente, autorizado: true });
  });

  it("con otro número, la casilla queda sin marcar: hay que confirmarla de nuevo", () => {
    expect(autorizacionDelCelular(autorizada, OTRO, null)).toEqual({ vigente: null, autorizado: false });
  });

  it("lo que se marca vale para el número escrito al marcarlo", () => {
    const marca = { celular: OTRO, autorizado: true };
    expect(autorizacionDelCelular(autorizada, OTRO, marca).autorizado).toBe(true);
    expect(autorizacionDelCelular(autorizada, "+573205550000", marca).autorizado).toBe(false);
  });

  it("si vuelve al número autorizado, vuelve la autorización registrada", () => {
    expect(autorizacionDelCelular(autorizada, NUMERO, { celular: OTRO, autorizado: true })).toEqual({ vigente, autorizado: true });
  });

  it("desmarcarla con el número autorizado la quita", () => {
    expect(autorizacionDelCelular(autorizada, NUMERO, { celular: NUMERO, autorizado: false }).autorizado).toBe(false);
  });

  it("un contacto nuevo empieza sin autorizar", () => {
    expect(autorizacionDelCelular(null, NUMERO, null)).toEqual({ vigente: null, autorizado: false });
    expect(autorizacionDelCelular(null, NUMERO, { celular: NUMERO, autorizado: true }).autorizado).toBe(true);
  });
});
