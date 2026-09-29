import { describe, expect, it } from "vitest";
import { ErrorApi, tipoDeProblema } from "@teins/protocolo";
import { mensajeDeError, textoDelServidor } from "./mensajes";

const entradaInvalida = (campos?: { ruta: string; mensaje: string }[], detail = "Revise cuerpo") =>
  new ErrorApi({ type: tipoDeProblema("entrada_invalida"), title: "Entrada inválida", status: 400, codigo: "entrada_invalida", detail, ...(campos ? { campos } : {}) });

describe("errores de entrada del servidor en palabras de oficina (iteración 24)", () => {
  it("nombra los datos que el servidor rechazó, en vez de «Revise cuerpo»", () => {
    const error = entradaInvalida([
      { ruta: "cuerpo.contactos.0.correo", mensaje: "Invalid email address" },
      { ruta: "cuerpo.nombre", mensaje: "Too small" },
      { ruta: "cuerpo.contactos.1.correo", mensaje: "Invalid email address" },
    ]);
    expect(mensajeDeError(error)).toBe("Revise el correo y el nombre: no tienen la forma esperada.");
    expect(textoDelServidor(error, "respaldo")).not.toContain("cuerpo");
  });

  it("un dato sin nombre conocido no deja la ruta técnica a la vista", () => {
    expect(textoDelServidor(entradaInvalida([{ ruta: "parametros.id", mensaje: "Invalid UUID" }]), "respaldo")).toBe("Revise los datos: alguno no tiene la forma esperada.");
  });

  it("un rechazo escrito para la persona se muestra tal cual", () => {
    expect(textoDelServidor(entradaInvalida(undefined, "El contacto no tiene correo"), "respaldo")).toBe("El contacto no tiene correo");
  });
});
