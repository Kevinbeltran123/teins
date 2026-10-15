import { describe, expect, it } from "vitest";
import { ErrorApi, tipoDeProblema } from "@teins/protocolo";
import { cambiosAlReasignar, mensajeDeProgramacion } from "./programacion";

const estadoInvalido = (detail?: string) =>
  new ErrorApi({ type: tipoDeProblema("estado_invalido"), title: "La acción no aplica en el estado actual", status: 409, codigo: "estado_invalido", ...(detail ? { detail } : {}) });

describe("lo que no se pudo hacer con una visita lo dice el servidor", () => {
  it("el cliente o el sitio se archivó con el diálogo abierto", () => {
    const archivado = "El cliente o el sitio están archivados: recupérelos para programarles una visita";
    expect(mensajeDeProgramacion(estadoInvalido(archivado))).toBe(archivado);
  });

  it("sin detalle del servidor, la visita ya está cancelada", () => {
    expect(mensajeDeProgramacion(estadoInvalido())).toBe("La visita ya está cancelada.");
  });
});

describe("reasignar una visita con un técnico desactivado", () => {
  const [ana, luis] = [{ id: "ana" }, { id: "luis" }];

  it("el desactivado sale al guardar, sin bloquear, y se dice aparte de los que salen", () => {
    expect(cambiosAlReasignar([ana, luis], ["ana", "luis", "marta"], new Set(["luis", "marta"]))).toEqual({ finales: ["luis", "marta"], inactivos: ["ana"], salen: [], entran: ["marta"] });
  });

  it("quitar a uno activo sigue diciendo que deja de verla", () => {
    expect(cambiosAlReasignar([ana, luis], ["ana"], new Set(["ana", "luis"]))).toEqual({ finales: ["ana"], inactivos: [], salen: ["luis"], entran: [] });
  });

  it("si el único técnico está desactivado, no queda nadie: hay que elegir otro", () => {
    expect(cambiosAlReasignar([ana], ["ana"], new Set(["luis"])).finales).toEqual([]);
  });

  it("mientras no llega la lista de activos, no se quita a nadie", () => {
    expect(cambiosAlReasignar([ana], ["ana"], undefined)).toEqual({ finales: ["ana"], inactivos: [], salen: [], entran: [] });
  });
});
