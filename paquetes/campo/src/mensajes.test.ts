import { describe, expect, it } from "vitest";
import type { EstadoDeEnvio, EstadoServidor } from "./datos/modelo";
import { estadoCorto } from "./mensajes";

const envio = (estado: EstadoDeEnvio["estado"], codigo?: string): EstadoDeEnvio => ({
  levantamientoId: "l1",
  tecnicoId: "t1",
  estado,
  intentos: 1,
  proximoIntentoEn: 0,
  ultimoError: codigo ? { codigo, mensaje: "" } : undefined,
  creadoEn: "2026-10-03T15:00:00.000Z",
});
const servidor = (estado: EstadoServidor["estado"]) => ({ estado }) as EstadoServidor;

describe("estadoCorto (iteración 32): la lista del inicio no se desborda", () => {
  it("un rechazo es corto: la explicación queda en el detalle", () => {
    const corto = estadoCorto(envio("error", "respuestas_invalidas"), undefined, true);
    expect(corto).toEqual({ texto: "No se pudo enviar", tono: "error" });
  });

  it("lo que dice el servidor manda sobre lo que sabe el teléfono", () => {
    expect(estadoCorto(envio("recibido"), servidor("en_revision"), true)).toEqual({ texto: "En revisión", tono: "revision" });
    expect(estadoCorto(undefined, servidor("revisado"), false)?.texto).toBe("Revisado");
  });

  it("sin señal dice cuándo sale", () => {
    expect(estadoCorto(envio("pendiente"), undefined, false)?.texto).toBe("Se envía al tener señal");
    expect(estadoCorto(envio("pendiente", "archivos_en_verificacion"), undefined, true)?.texto).toBe("Verificando fotos");
  });

  it("ningún estado pasa de tres o cuatro palabras", () => {
    for (const estado of ["recibido", "enviando", "requiere_sesion", "requiere_actualizar", "error", "pendiente"] as const) {
      expect(estadoCorto(envio(estado), undefined, true)!.texto.split(" ").length).toBeLessThanOrEqual(4);
    }
  });
});
