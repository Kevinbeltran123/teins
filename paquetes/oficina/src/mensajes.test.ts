import { describe, expect, it } from "vitest";
import { ErrorApi, ErrorDeRed, tipoDeProblema } from "@teins/protocolo";
import { mensajeDeAdministracion } from "./administracion";
import { errorDelTelefono } from "./mensajes";
import { mensajeDeCotizacion } from "./cotizaciones";
import { errorDeCuenta } from "./cuenta";
import { mensajeDeInforme } from "./informes";
import { errorDelCampo, MENSAJE_VERSION_NUEVA, mensajeDeError, sinError, textoDelServidor } from "./mensajes";
import { mensajeDeProgramacion } from "./programacion";

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

describe("todos los traductores dicen igual los errores comunes", () => {
  const traductores: [string, (error: unknown) => string][] = [
    ["mensajeDeError", mensajeDeError],
    ["mensajeDeCotizacion", mensajeDeCotizacion],
    ["mensajeDeAdministracion", mensajeDeAdministracion],
    ["mensajeDeProgramacion", mensajeDeProgramacion],
    ["mensajeDeInforme", (e) => mensajeDeInforme(e, () => "").join(" ")],
    ["errorDeCuenta", (e) => errorDeCuenta(e).general ?? ""],
  ];
  const noAutenticado = new ErrorApi({ type: tipoDeProblema("no_autenticado"), title: "Se requiere iniciar sesión", status: 401, codigo: "no_autenticado" });
  const versionVieja = new TypeError("Failed to fetch dynamically imported module: /assets/qr-abc123.js");

  it.each(traductores)("%s", (_, traducir) => {
    expect(traducir(versionVieja)).toBe(MENSAJE_VERSION_NUEVA);
    expect(traducir(new ErrorDeRed(new Error("offline")))).toMatch(/^Sin conexión con el servidor\. No se .+; intente de nuevo al recuperar la conexión\.$/);
    expect(traducir(new Error("inesperado"))).toMatch(/^No se pudo .+\. Intente de nuevo\.$/);
    expect(traducir(noAutenticado)).toBe("Su sesión venció. Inicie sesión de nuevo.");
  });
});

describe("errorDelTelefono", () => {
  it("dice en palabras el rechazo de un segundo levantamiento en la visita (ADR-0054); otro código sale tal cual", () => {
    expect(errorDelTelefono("estado_invalido")).toBe("ya envió un levantamiento de esta visita");
    expect(errorDelTelefono("formato_desconocido")).toBe("formato_desconocido");
  });
});
