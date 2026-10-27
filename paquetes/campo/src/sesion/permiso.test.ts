import { describe, expect, it } from "vitest";
import { permisoLocal } from "./permiso";

const ahora = Date.parse("2026-09-24T10:00:00.000Z");

describe("permisoLocal", () => {
  it("sin bajada no hay permiso que vencer", () => {
    expect(permisoLocal(null, ahora)).toBe("vigente");
    expect(permisoLocal(undefined, ahora)).toBe("vigente");
  });

  it("vigente hasta el instante en que vence, incluido", () => {
    expect(permisoLocal({ permisoLocalHasta: "2026-09-25T10:00:00.000Z" }, ahora)).toBe("vigente");
    expect(permisoLocal({ permisoLocalHasta: "2026-09-24T10:00:00.000Z" }, ahora)).toBe("vigente");
  });

  it("vencido: basta conectarse, salvo que el servidor haya rechazado la sesión", () => {
    expect(permisoLocal({ permisoLocalHasta: "2026-09-24T09:59:59.999Z" }, ahora)).toBe("vencido");
    expect(permisoLocal({ permisoLocalHasta: "2026-09-20T10:00:00.000Z", sesionVencida: false }, ahora)).toBe("vencido");
    expect(permisoLocal({ permisoLocalHasta: "2026-09-20T10:00:00.000Z", sesionVencida: true }, ahora)).toBe("vencido_sin_sesion");
  });

  it("con la sesión vencida pero el permiso vigente, sigue vigente", () => {
    expect(permisoLocal({ permisoLocalHasta: "2026-09-25T10:00:00.000Z", sesionVencida: true }, ahora)).toBe("vigente");
  });
});
