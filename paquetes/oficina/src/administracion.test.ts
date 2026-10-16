import { describe, expect, it } from "vitest";
import { credencialConQr, mensajeDeAdministracion } from "./administracion";

const respuesta = { identificador: "hotel-plaza", clave: "K7QX-29MZ", url: "https://portal.example/entrar?c=hotel-plaza" };
// Lo que lanza el navegador cuando una pestaña vieja pide un archivo que el despliegue ya cambió de nombre.
const archivoViejo = new TypeError("Failed to fetch dynamically imported module: https://oficina.example/assets/browser-Bx2.js");

describe("entregar una credencial cuando el QR no se puede dibujar (iteración 29)", () => {
  it("la clave que el servidor ya cambió se entrega aunque el QR falle", async () => {
    const c = await credencialConQr(respuesta, () => Promise.reject(archivoViejo));
    expect(c.clave).toBe("K7QX-29MZ");
    expect(c.url).toBe(respuesta.url);
    expect(c.qr).toBeNull();
  });

  it("con el QR dibujado, lo lleva junto a la clave", async () => {
    const c = await credencialConQr(respuesta, async (t) => `data:qr,${t}`);
    expect(c.qr).toBe(`data:qr,${respuesta.url}`);
  });
});

describe("una pestaña con la versión anterior (iteración 29)", () => {
  it("dice que hay una versión nueva en vez de un error genérico", () => {
    expect(mensajeDeAdministracion(archivoViejo)).toBe("Hay una versión nueva de TEINS: recargue la página e intente de nuevo.");
    expect(mensajeDeAdministracion(new TypeError("Importing a module script failed."))).toContain("versión nueva");
  });
});
