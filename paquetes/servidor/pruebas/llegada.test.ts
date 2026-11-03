import { createServer, type IncomingMessage } from "node:http";
import { afterAll, describe, expect, it } from "vitest";
import { jpegDePrueba, ORIGEN, servidorDePrueba } from "./ayudas";

/*
  La foto de llegada (iteración 47, ADR-0052): la hora de red y el mapa. Geoapify se simula con un servidor local: la
  prueba comprueba lo que el servidor le pide (coordenadas redondeadas, la llave) y lo que le devuelve a campo.
*/

const pedidas: URL[] = [];
let estado = 200;
const geoapify = createServer((pedido: IncomingMessage, respuesta) => {
  pedidas.push(new URL(pedido.url ?? "/", "http://geoapify.prueba"));
  if (estado === 0) {
    // Responde la cabecera y se queda callado a mitad de la imagen: el tiempo vence leyendo el cuerpo.
    respuesta.writeHead(200, { "content-type": "image/jpeg" });
    respuesta.write(jpegDePrueba("mapa").datos.subarray(0, 10));
    setTimeout(() => respuesta.end(), 4_000);
    return;
  }
  if (estado !== 200) {
    respuesta.writeHead(estado).end("falla");
    return;
  }
  respuesta.writeHead(200, { "content-type": "image/jpeg" }).end(jpegDePrueba("mapa").datos);
});
await new Promise<void>((listo) => geoapify.listen(0, "127.0.0.1", listo));
afterAll(() => new Promise<void>((listo) => geoapify.close(() => listo())));
const urlDeGeoapify = `http://127.0.0.1:${(geoapify.address() as { port: number }).port}`;

const s = await servidorDePrueba({ config: { GEOAPIFY_LLAVE: "llave-de-prueba", GEOAPIFY_URL: urlDeGeoapify } });
const org = await s.nuevaOrganizacionConUsuarios();
const pedir = (cookie: string, url: string) => s.app.inject({ method: "GET", url, headers: { cookie, origin: ORIGEN } });

describe("la hora de red", () => {
  it("el técnico recibe la hora del servidor; oficina no la pide", async () => {
    const antes = Date.now();
    const r = await pedir(org.tecnico.cookie, "/api/hora");
    expect(r.statusCode, r.body).toBe(200);
    const ahora = Date.parse(r.json().ahora);
    expect(ahora).toBeGreaterThanOrEqual(antes - 1000);
    expect(ahora).toBeLessThanOrEqual(Date.now() + 1000);
    expect((await pedir(org.oficina.cookie, "/api/hora")).statusCode).toBe(403);
    expect((await s.app.inject({ method: "GET", url: "/api/hora" })).statusCode).toBe(401);
  });
});

describe("el mapa de la llegada", () => {
  it("pide el mapa con las coordenadas redondeadas y la llave que nunca sale del servidor, y lo devuelve como imagen incrustada", async () => {
    pedidas.length = 0;
    estado = 200;
    const r = await pedir(org.tecnico.cookie, "/api/mapa?lat=4.2012345&lon=-74.6361111");
    expect(r.statusCode, r.body).toBe(200);
    const cuerpo = r.json();
    expect(cuerpo.imagen).toMatch(/^data:image\/jpeg;base64,/);
    expect(cuerpo.centro).toEqual({ lat: 4.201, lon: -74.636 });
    expect(cuerpo.zoom).toBe(16);
    expect(cuerpo.atribucion).toMatch(/Geoapify/);
    expect(cuerpo.atribucion).toMatch(/OpenStreetMap/);
    // Geoapify nunca conoce el punto exacto: solo el redondeado a 3 decimales (unos 110 m).
    expect(pedidas).toHaveLength(1);
    const p = pedidas[0]!;
    expect(p.pathname).toBe("/v1/staticmap");
    expect(p.searchParams.get("center")).toBe("lonlat:-74.636,4.201");
    expect(p.searchParams.get("zoom")).toBe("16");
    expect(p.searchParams.get("style")).toBe("osm-bright");
    expect(p.searchParams.get("scaleFactor")).toBe("2");
    expect(p.searchParams.get("apiKey")).toBe("llave-de-prueba");
    // La llave y las coordenadas exactas no vuelven al teléfono.
    expect(r.body).not.toContain("llave-de-prueba");
    expect(r.body).not.toContain("4.2012345");
  });

  it("solo la pide el técnico, con coordenadas que existen", async () => {
    expect((await pedir(org.oficina.cookie, "/api/mapa?lat=4.2&lon=-74.6")).statusCode).toBe(403);
    expect((await s.app.inject({ method: "GET", url: "/api/mapa?lat=4.2&lon=-74.6" })).statusCode).toBe(401);
    for (const mal of ["lat=91&lon=0", "lat=0&lon=181", "lat=abc&lon=0", "lat=4.2", ""]) {
      expect((await pedir(org.tecnico.cookie, `/api/mapa?${mal}`)).statusCode, mal).toBe(400);
    }
  });

  it("si Geoapify falla, responde «no disponible»: la foto sale sin mapa", async () => {
    estado = 500;
    const r = await pedir(org.tecnico.cookie, "/api/mapa?lat=4.2&lon=-74.6");
    expect(r.statusCode).toBe(503);
    expect(r.json()).toMatchObject({ codigo: "no_disponible" });
    expect(r.body).not.toContain("llave-de-prueba");
    estado = 200;
  });

  it("si Geoapify se queda callado a mitad de la imagen, también «no disponible», no un error interno", async () => {
    estado = 0;
    const r = await pedir(org.tecnico.cookie, "/api/mapa?lat=4.2&lon=-74.6");
    expect(r.statusCode).toBe(503);
    expect(r.json()).toMatchObject({ codigo: "no_disponible" });
    estado = 200;
  });

  it("sin la llave configurada, el entorno no tiene mapa", async () => {
    const sinLlave = await servidorDePrueba({ config: { GEOAPIFY_URL: urlDeGeoapify } });
    const otra = await sinLlave.nuevaOrganizacionConUsuarios();
    pedidas.length = 0;
    const r = await sinLlave.app.inject({ method: "GET", url: "/api/mapa?lat=4.2&lon=-74.6", headers: { cookie: otra.tecnico.cookie, origin: ORIGEN } });
    expect(r.statusCode).toBe(503);
    expect(r.json()).toMatchObject({ codigo: "no_disponible" });
    expect(pedidas).toHaveLength(0);
  });

  it("30 por minuto y por técnico; otro técnico no se ve afectado", async () => {
    const otra = await s.nuevaOrganizacionConUsuarios();
    estado = 200;
    for (let i = 0; i < 30; i++) expect((await pedir(otra.tecnico.cookie, "/api/mapa?lat=4.2&lon=-74.6")).statusCode, `solicitud ${i + 1}`).toBe(200);
    const exceso = await pedir(otra.tecnico.cookie, "/api/mapa?lat=4.2&lon=-74.6");
    expect(exceso.statusCode).toBe(429);
    expect(exceso.json()).toMatchObject({ codigo: "demasiadas_solicitudes" });
    expect((await pedir(org.tecnico.cookie, "/api/mapa?lat=4.2&lon=-74.6")).statusCode).toBe(200);
  });
});
