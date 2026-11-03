import { describe, expect, it } from "vitest";
import { textoSinSolicitante } from "./DatosDelPedido";

describe("el solicitante de la visita (ADR-0051)", () => {
  it("dice por qué no hay a quién elegir, sin confundir un error con un cliente sin contactos", () => {
    expect(textoSinSolicitante({ hayCliente: false, cargando: false, error: false, contactos: 0 })).toBe("Primero el cliente");
    expect(textoSinSolicitante({ hayCliente: true, cargando: false, error: true, contactos: 0 })).toBe("No se pudieron cargar los contactos");
    expect(textoSinSolicitante({ hayCliente: true, cargando: false, error: false, contactos: 0 })).toBe("El cliente no tiene contactos");
    expect(textoSinSolicitante({ hayCliente: true, cargando: true, error: false, contactos: 0 })).toBe("Sin solicitante");
    expect(textoSinSolicitante({ hayCliente: true, cargando: false, error: false, contactos: 2 })).toBe("Sin solicitante");
  });
});
