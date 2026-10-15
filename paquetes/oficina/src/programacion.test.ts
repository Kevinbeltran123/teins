import { describe, expect, it } from "vitest";
import { ErrorApi, tipoDeProblema } from "@teins/protocolo";
import { mensajeDeProgramacion } from "./programacion";

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
