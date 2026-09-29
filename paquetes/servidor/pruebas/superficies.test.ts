import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { construirApp } from "../src/app";
import { almacenamientoS3 } from "../src/plataforma/almacenamiento";
import { configDePrueba, conexionesDePrueba } from "./ayudas";

// Compilaciones mínimas de las superficies, en una carpeta temporal.
const raiz = mkdtempSync(join(tmpdir(), "superficies-"));
for (const s of ["campo", "oficina"]) {
  mkdirSync(join(raiz, s, "assets"), { recursive: true });
  writeFileSync(join(raiz, s, "index.html"), `<!doctype html><title>${s}</title>`);
  writeFileSync(join(raiz, s, "sw.js"), "// sw");
  writeFileSync(join(raiz, s, "assets", "app-abc123.js"), "console.log(1)");
}
writeFileSync(join(raiz, "secreto.txt"), "no debe servirse");

const config = configDePrueba({
  SUPERFICIE_CAMPO_HOST: "campo.prueba",
  SUPERFICIE_OFICINA_HOST: "oficina.prueba",
  SUPERFICIES_DIR: raiz,
});
const { app: conexion } = conexionesDePrueba();
const { app } = await construirApp({ config, bd: conexion.bd, almacenamiento: almacenamientoS3(config) });
afterAll(() => app.close());

const pedir = (host: string, url: string) => app.inject({ method: "GET", url, headers: { host } });

describe("superficies servidas por el rol web (ADR-0016)", () => {
  it("cada host recibe su superficie; index.html y sw.js no se cachean, assets sí", async () => {
    const campo = await pedir("campo.prueba", "/");
    expect(campo.body).toContain("<title>campo</title>");
    expect(campo.headers["cache-control"]).toBe("no-cache");
    expect((await pedir("oficina.prueba", "/")).body).toContain("<title>oficina</title>");
    expect((await pedir("campo.prueba", "/sw.js")).headers["cache-control"]).toBe("no-cache");
    expect((await pedir("campo.prueba", "/assets/app-abc123.js")).headers["cache-control"]).toBe("public, max-age=31536000, immutable");
  });

  it("una ruta de la aplicación devuelve index.html; un archivo inexistente, 404", async () => {
    expect((await pedir("oficina.prueba", "/levantamientos/0192f0e0-0000-7000-8000-000000000001")).body).toContain("<title>oficina</title>");
    expect((await pedir("campo.prueba", "/assets/no-existe.js")).statusCode).toBe(404);
  });

  it("no sale de la carpeta de la superficie ni atiende hosts desconocidos", async () => {
    expect((await pedir("campo.prueba", "/../secreto.txt")).body).not.toContain("no debe servirse");
    expect((await pedir("campo.prueba", "/%2e%2e/secreto.txt")).body).not.toContain("no debe servirse");
    expect((await pedir("otro.example", "/")).statusCode).toBe(404);
    // Un "%" que ya llega decodificado no se decodifica otra vez: es una ruta más de la aplicación, nunca un error interno.
    expect((await pedir("campo.prueba", "/%25")).statusCode).toBe(200);
    expect((await pedir("campo.prueba", "/%252e%252e/secreto.txt")).body).not.toContain("no debe servirse");
  });

  it("una ruta /api desconocida es un 404 del contrato, no la aplicación", async () => {
    const r = await pedir("campo.prueba", "/api/no-existe");
    expect(r.statusCode).toBe(404);
    expect(r.headers["content-type"]).toContain("application/problem+json");
  });

  it("aplica encabezados de seguridad con el almacenamiento solo donde hace falta", async () => {
    const r = await pedir("campo.prueba", "/");
    const csp = String(r.headers["content-security-policy"]);
    const almacen = new URL(config.S3_ENDPOINT!).origin;
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain(`connect-src 'self' ${almacen}`);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(r.headers["x-content-type-options"]).toBe("nosniff");
  });
});
