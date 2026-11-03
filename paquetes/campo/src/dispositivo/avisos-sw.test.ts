import { describe, expect, it, vi } from "vitest";
import fuente from "../../public/avisos-sw.js?raw";

/*
  El manejador de avisos corre en el service worker (ADR-0023, ADR-0040): aquí se ejecuta su texto con un `self` falso,
  sin navegador, para ver a quién le avisa y qué muestra.
*/

interface VentanaFalsa {
  id: string;
  focused: boolean;
  url: string;
  postMessage: ReturnType<typeof vi.fn>;
  focus: ReturnType<typeof vi.fn>;
}

const ventana = (id: string, focused = false): VentanaFalsa => ({ id, focused, url: "https://campo.teins.test/", postMessage: vi.fn(), focus: vi.fn() });

function montar(ventanas: VentanaFalsa[]) {
  const manejadores = new Map<string, (evento: unknown) => void>();
  const cerradas = vi.fn();
  const registration = {
    showNotification: vi.fn(async () => undefined),
    getNotifications: vi.fn(async () => [{ close: cerradas }]),
  };
  const propio = {
    addEventListener: (tipo: string, manejador: (evento: unknown) => void) => manejadores.set(tipo, manejador),
    clients: { matchAll: vi.fn(async () => ventanas), openWindow: vi.fn() },
    registration,
    location: { origin: "https://campo.teins.test" },
  };
  new Function("self", fuente)(propio);

  const mensaje = (id: string, datos: unknown) => manejadores.get("message")!({ data: datos, source: { id } });
  const push = async (carga: unknown) => {
    const pendientes: Promise<unknown>[] = [];
    const evento = {
      data: { json: () => (carga instanceof Error ? (() => { throw carga; })() : carga) },
      waitUntil: (p: Promise<unknown>) => pendientes.push(p),
    };
    manejadores.get("push")!(evento);
    await Promise.all(pendientes);
  };
  return { registration, cerradas, mensaje, push };
}

const aviso = (tag: string) => ({ notification: { title: "Oficina te escribió", body: "Hola", tag, navigate: `/?chat=${tag}` } });

describe("avisos push: la pantalla consulta en cada aviso", () => {
  it("con la app en el inicio, el aviso se muestra y la ventana consulta", async () => {
    const inicio = ventana("a");
    const { registration, push } = montar([inicio]);
    await push(aviso("lev-1"));
    expect(registration.showNotification).toHaveBeenCalledWith("Oficina te escribió", expect.objectContaining({ tag: "lev-1" }));
    expect(inicio.postMessage).toHaveBeenCalledWith({ tipo: "consultar" });
  });

  it("con varias ventanas, todas consultan", async () => {
    const una = ventana("a", true);
    const otra = ventana("b");
    const { push } = montar([una, otra]);
    await push(aviso("lev-1"));
    expect(una.postMessage).toHaveBeenCalledWith({ tipo: "consultar" });
    expect(otra.postMessage).toHaveBeenCalledWith({ tipo: "consultar" });
  });

  it("con esa conversación a la vista, el aviso es silencioso, se cierra y la pantalla consulta", async () => {
    const mirando = ventana("a", true);
    const { registration, cerradas, mensaje, push } = montar([mirando]);
    mensaje("a", { tipo: "conversacion", etiqueta: "lev-1" });
    await push(aviso("lev-1"));
    expect(registration.showNotification).toHaveBeenCalledWith("Oficina te escribió", expect.objectContaining({ silent: true }));
    expect(cerradas).toHaveBeenCalledTimes(1);
    expect(mirando.postMessage).toHaveBeenCalledWith({ tipo: "consultar" });
  });

  it("otra conversación a la vista no silencia el aviso", async () => {
    const mirando = ventana("a", true);
    const { registration, mensaje, push } = montar([mirando]);
    mensaje("a", { tipo: "conversacion", etiqueta: "lev-2" });
    await push(aviso("lev-1"));
    expect(registration.showNotification).toHaveBeenCalledWith("Oficina te escribió", expect.not.objectContaining({ silent: true }));
    expect(mirando.postMessage).toHaveBeenCalledWith({ tipo: "consultar" });
  });

  it.each([
    ["una carga ilegible", new Error("no es JSON")],
    ["una carga sin título", { notification: { body: "Hola" } }],
    ["una carga vacía", null],
  ])("%s igual muestra un aviso: Safari retira el permiso si un push no muestra nada", async (_caso, carga) => {
    const inicio = ventana("a");
    const { registration, push } = montar([inicio]);
    await push(carga);
    expect(registration.showNotification).toHaveBeenCalledWith("TEINS", expect.objectContaining({ body: "Abre la app para ver las novedades.", icon: "/icono-192.png" }));
    expect(inicio.postMessage).toHaveBeenCalledWith({ tipo: "consultar" });
  });

  it("una carga ilegible con la app enfocada se ve y no cierra los demás avisos", async () => {
    const enfocada = ventana("a", true);
    const { registration, cerradas, push } = montar([enfocada]);
    await push(null);
    expect(registration.showNotification).toHaveBeenCalledWith("TEINS", expect.not.objectContaining({ silent: true }));
    expect(cerradas).not.toHaveBeenCalled();
  });
});
