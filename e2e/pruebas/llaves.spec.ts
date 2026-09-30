import { expect, test, type Page } from "@playwright/test";
import { nuevaVisitaConCliente, nuevoUsuario } from "../consola";
import { CAMPO, OFICINA } from "../destino";
import { iniciarSesion } from "./ayudas";

/** Autenticador virtual de Chromium: hace de Face ID o huella, con la persona verificada. */
async function conAutenticador(pagina: Page) {
  const cdp = await pagina.context().newCDPSession(pagina);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
}

test("llaves de acceso: el técnico y oficina crean una y entran sin contraseña (iteración 13)", async ({ page, browser, browserName }) => {
  test.skip(browserName === "webkit", "WebKit no tiene autenticador virtual: se prueba en Chromium y en el iPhone");
  const tecnico = nuevoUsuario("tecnico", "tecnico.e2e");
  const revisora = nuevoUsuario("oficina", "oficina");
  const { cliente } = nuevaVisitaConCliente(tecnico);

  // Campo: después de entrar con la contraseña, la app propone la llave.
  await conAutenticador(page);
  await page.goto(`${CAMPO}/`);
  await iniciarSesion(page, tecnico);
  const propuesta = page.getByRole("region", { name: "Entra sin escribir la contraseña" });
  await propuesta.getByRole("button", { name: "Crear llave de acceso" }).click();
  await expect(page.getByText("Listo. La próxima vez entra con")).toBeVisible();

  // "Cerrar sesión" está en la cuenta (rediseño Recorrido).
  await page.getByRole("button", { name: "Tu cuenta" }).click();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await page.getByRole("button", { name: "Ingresar con llave de acceso" }).click();
  await expect(page.getByRole("region", { name: "Siguiente visita" }).getByText(cliente)).toBeVisible();
  // Con la llave creada, ya no se propone.
  await expect(page.getByRole("region", { name: "Entra sin escribir la contraseña" })).toHaveCount(0);

  // Oficina: la crea en "Mi cuenta", entra con ella y la quita.
  const escritorio = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "es-CO" });
  const o = await escritorio.newPage();
  await conAutenticador(o);
  await o.goto(`${OFICINA}/`);
  await iniciarSesion(o, revisora);
  await o.getByRole("link", { name: /^Mi cuenta/ }).click();
  await expect(o.getByText("Todavía no tiene llaves de acceso.")).toBeVisible();
  await o.getByRole("button", { name: "Crear llave de acceso" }).click();
  await expect(o.getByRole("list", { name: "Sus llaves de acceso" }).getByRole("listitem")).toHaveCount(1);

  await o.getByRole("region", { name: "Sesión" }).getByRole("button", { name: "Cerrar sesión" }).click();
  await o.getByRole("button", { name: "Ingresar con llave de acceso" }).click();
  await expect(o.getByRole("link", { name: "Levantamientos" })).toBeVisible();

  await o.getByRole("link", { name: /^Mi cuenta/ }).click();
  await o.getByRole("button", { name: "Quitar la llave 1" }).click();
  await o.getByRole("dialog").getByRole("button", { name: "Quitar llave" }).click();
  await expect(o.getByText("Todavía no tiene llaves de acceso.")).toBeVisible();
  await escritorio.close();
});
