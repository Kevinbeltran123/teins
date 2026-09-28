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

  it("si la conexión se corta leyendo la respuesta, es ErrorDeRed", async () => {
    const cortada = crearClienteApi({
      fetch: async () => {
        const cuerpo = new ReadableStream({ start: (c) => c.error(new TypeError("network error")) });
        return new Response(cuerpo, { status: 200, headers: { "content-type": "application/json" } });
      },
    });
    await expect(cortada.llamar("obtenerSesion")).rejects.toBeInstanceOf(ErrorDeRed);
    const truncada = crearClienteApi({ fetch: async () => new Response('{"usuario":', { status: 200 }) });
    await expect(truncada.llamar("obtenerSesion")).rejects.toBeInstanceOf(ErrorDeRed);
  });

  it("un 4xx que no viene de la aplicación no se reintenta", async () => {
    for (const estado of [404, 409, 413, 415, 422]) {
      const cliente = crearClienteApi({ fetch: async () => respuestaJson(estado, { message: "x" }) });
      const error = (await cliente.llamar("obtenerSesion").catch((e: unknown) => e)) as ErrorApi;
      expect(error).toBeInstanceOf(ErrorApi);
      expect(error.reintentable, `estado ${estado}`).toBe(false);
    }
    const caido = crearClienteApi({ fetch: async () => new Response("", { status: 502 }) });
    expect(((await caido.llamar("obtenerSesion").catch((e: unknown) => e)) as ErrorApi).reintentable).toBe(true);
  });

  it("un código que esta versión no conoce conserva el detalle y no se reintenta si es 4xx", async () => {
    const cliente = crearClienteApi({
      fetch: async () => respuestaJson(409, { type: "t", title: "Conflicto nuevo", status: 409, detail: "Explicación", codigo: "nuevo_conflicto", versionActual: 3 }, "application/problem+json"),
    });
    const error = (await cliente.llamar("obtenerSesion").catch((e: unknown) => e)) as ErrorApi;
    expect(error).toBeInstanceOf(ErrorApi);
    expect(error.reintentable).toBe(false);
    expect(error.message).toBe("Explicación");
    expect(error.problema.versionActual).toBe(3);
  });

  it("falta un parámetro de ruta: falla sin llamar al servidor", async () => {
    let llamado = false;
    const cliente = crearClienteApi({ fetch: async () => ((llamado = true), respuestaJson(202, { archivo: "subido" })) });
    await expect(cliente.llamar("confirmarSubida", { parametros: {} as { huella: string } })).rejects.toThrow(/huella/);
    expect(llamado).toBe(false);
  });

  it("la consulta es obligatoria cuando la operación tiene campos obligatorios", () => {
    const cliente = crearClienteApi({ fetch: async () => respuestaJson(200, {}) });
    // @ts-expect-error listarVisitas exige vista y hoy
    void cliente.llamar("listarVisitas").catch(() => undefined);
    // @ts-expect-error obtenerCambios exige app
    void cliente.llamar("obtenerCambios", {}).catch(() => undefined);
    void cliente.llamar("obtenerSesion").catch(() => undefined);
  });
});
