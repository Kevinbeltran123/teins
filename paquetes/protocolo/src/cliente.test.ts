import { describe, expect, it } from "vitest";
import { crearClienteApi, ErrorApi, ErrorDeRed } from "./cliente";

const respuestaJson = (estado: number, cuerpo: unknown, tipo = "application/json") =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { "content-type": tipo } });

describe("cliente del contrato", () => {
  it("arma ruta, cabecera de versión y cuerpo, y valida la respuesta", async () => {
    let pedido: Request | undefined;
    const cliente = crearClienteApi({
      fetch: async (url, init) => {
        pedido = new Request(`http://x${url}`, init);
        return respuestaJson(202, { archivo: "subido" });
      },
    });
    const huella = "a".repeat(64);
    expect(await cliente.llamar("confirmarSubida", { parametros: { huella } })).toEqual({ archivo: "subido" });
    expect(pedido?.url).toBe(`http://x/api/archivos/${huella}/subido`);
    expect(pedido?.headers.get("x-teins-protocolo")).toBe("1");
  });

  it("convierte Problem Details en ErrorApi con su política de reintento", async () => {
    const cliente = crearClienteApi({
      fetch: async () =>
        respuestaJson(409, { type: "t", title: "t", status: 409, codigo: "archivos_en_verificacion", pendientes: [] }, "application/problem+json"),
    });
    const error = await cliente.llamar("obtenerSesion").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorApi);
    expect((error as ErrorApi).codigo).toBe("archivos_en_verificacion");
    expect((error as ErrorApi).reintentable).toBe(true);
  });

  it("un fallo de red es ErrorDeRed y una respuesta que rompe el contrato se detecta", async () => {
    const sinRed = crearClienteApi({ fetch: async () => Promise.reject(new TypeError("Failed to fetch")) });
    await expect(sinRed.llamar("obtenerSesion")).rejects.toBeInstanceOf(ErrorDeRed);
    const roto = crearClienteApi({ fetch: async () => respuestaJson(200, { usuario: { id: 1 } }) });
    await expect(roto.llamar("obtenerSesion")).rejects.toThrow();
  });
});
