import { describe, expect, it } from "vitest";
import { ErrorApi, tipoDeProblema } from "@teins/protocolo";
import { errorDelCampo, mensajeDeError, sinError, textoDelServidor } from "./mensajes";

const entradaInvalida = (campos?: { ruta: string; mensaje: string }[], detail = "Revise cuerpo") =>
  new ErrorApi({ type: tipoDeProblema("entrada_invalida"), title: "Entrada inválida", status: 400, codigo: "entrada_invalida", detail, ...(campos ? { campos } : {}) });
const estadoInvalido = (detail?: string) =>
  new ErrorApi({ type: tipoDeProblema("estado_invalido"), title: "La acción no aplica en el estado actual", status: 409, codigo: "estado_invalido", ...(detail ? { detail } : {}) });

describe("un estado que cambió dice qué pasó, si el servidor lo sabe", () => {
  it("abrir el informe de una visita cancelada lo dice, en vez de pedir recargar", () => {
    expect(mensajeDeError(estadoInvalido("La visita está cancelada: no se abre un informe nuevo"))).toBe("La visita está cancelada: no se abre un informe nuevo");
  });

  it("sin detalle del servidor, se recarga para ver cómo quedó", () => {
    expect(mensajeDeError(estadoInvalido())).toBe("El levantamiento cambió de estado. Recargue para ver cómo quedó.");
  });
});

describe("al cambiar un campo, su error se va", () => {
  it("quita los errores de ese campo y deja los demás", () => {
    const errores: { nombre?: string; direccion?: string } = { nombre: "Escriba el nombre del sitio.", direccion: "Escriba la dirección." };
    expect(sinError(errores, "nombre")).toEqual({ direccion: "Escriba la dirección." });
    expect(errores.nombre).toBe("Escriba el nombre del sitio.");
  });

  it("si ese campo no tenía error, devuelve el mismo objeto: la pantalla no se vuelve a pintar", () => {
    const errores: { nombre?: string; direccion?: string } = { direccion: "Escriba la dirección." };
    expect(sinError(errores, "nombre")).toBe(errores);
  });
});

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

describe("errores por campo desde problema.campos (iteración 24b)", () => {
  const error = entradaInvalida([
    { ruta: "cuerpo.correo", mensaje: "Invalid email address" },
    { ruta: "cuerpo.contactos.0.celular", mensaje: "Invalid string" },
  ]);

  it("marca el campo que el servidor rechazó, por su clave, con un texto en español", () => {
    expect(errorDelCampo(error, "correo")).toBe("Revise este dato: no tiene la forma esperada.");
    expect(errorDelCampo(error, "celular")).toBe("Revise este dato: no tiene la forma esperada.");
    expect(errorDelCampo(error, "nombre")).toBeUndefined();
  });

  it("otro error, o ninguno, no marca nada", () => {
    expect(errorDelCampo(entradaInvalida(undefined, "El contacto no tiene correo"), "correo")).toBeUndefined();
    expect(errorDelCampo(new Error("red"), "correo")).toBeUndefined();
    expect(errorDelCampo(null, "correo")).toBeUndefined();
  });
});
