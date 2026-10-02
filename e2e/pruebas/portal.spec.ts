import { expect, test } from "@playwright/test";
import { nuevaVisitaConCliente, nuevoAcceso, nuevoAdministrador, nuevoUsuario } from "../consola";
import { CAMPO, OFICINA } from "../destino";
import { activarSegundoFactor, filaDeLaBandeja, fotoDePrueba, iniciarSesion, irAlPaso, irARevisar } from "./ayudas";

test("el recorrido completo: campo envía, oficina revisa y publica, y el cliente descarga su informe con el QR y la clave (QA-4)", async ({ page, browser }) => {
  const tecnico = nuevoUsuario("tecnico", "tecnico.e2e");
  const revisora = nuevoUsuario("oficina", "oficina");
  const { cliente, clienteId } = nuevaVisitaConCliente(tecnico);

  // Campo.
  await page.goto(`${CAMPO}/`);
  await iniciarSesion(page, tecnico);
  const visita = page.getByRole("region", { name: "Siguiente visita" });
  await expect(visita.getByText(cliente)).toBeVisible();
  await visita.getByRole("button", { name: "Iniciar levantamiento" }).click();
  await irAlPaso(page, "Cuarto técnico");
  await page.getByRole("textbox", { name: "Potencia nominal" }).fill("15");
  await page.locator("input[type=file]").first().setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: fotoDePrueba() });
  await expect(page.getByRole("img", { name: "Foto 1 de Fotos del equipo" })).toBeVisible();
  await irARevisar(page);
  await page.getByRole("button", { name: "Enviar a oficina" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Enviar levantamiento" }).click();
  await expect(page.getByText("Recibido en oficina")).toBeVisible({ timeout: 30_000 });

  // Oficina: revisa y publica.
  const escritorio = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "es-CO" });
  const o = await escritorio.newPage();
  await o.goto(`${OFICINA}/`);
  await iniciarSesion(o, revisora);
  await (await filaDeLaBandeja(o, tecnico.nombre)).getByRole("link").click();
  await o.getByRole("button", { name: "Tomar para revisar" }).click();
  await o.getByRole("button", { name: "Marcar revisado" }).click();
  await o.getByRole("dialog").getByRole("button", { name: "Marcar revisado" }).click();
  await o.getByRole("button", { name: "Abrir el informe de la visita" }).click();
  await o.getByRole("checkbox", { name: new RegExp(`de ${tecnico.nombre}`) }).check();
  await o.getByRole("button", { name: "Publicar versión 1" }).click();
  await o.getByRole("dialog").getByRole("button", { name: "Publicar versión 1" }).click();
  await expect(o.getByRole("button", { name: "Descargar PDF de la versión 1" })).toBeVisible({ timeout: 60_000 });
  await escritorio.close();

  // Cliente: abre la URL del QR en su celular y escribe la clave.
  const acceso = nuevoAcceso(clienteId);
  expect(acceso.url).toContain(`?acceso=${acceso.identificador}`);
  expect(acceso.url).not.toContain(acceso.clave);
  const celular = await browser.newContext({ locale: "es-CO", viewport: { width: 390, height: 844 } });
  const c = await celular.newPage();
  await c.goto(acceso.url);
  await expect(c.getByText("Código de acceso tomado del QR.")).toBeVisible();
  await c.getByLabel("Clave").fill("equivocada");
  await c.getByRole("button", { name: "Ver mis informes" }).click();
  await expect(c.getByText("El código de acceso o la clave no son correctos.")).toBeVisible();
  await c.getByLabel("Clave").fill(acceso.clave);
  await c.getByRole("button", { name: "Ver mis informes" }).click();
  await expect(c.getByRole("heading", { name: `Informes de ${cliente}` })).toBeVisible();
  // El PDF baja como archivo: el cliente sigue en su lista de informes.
  const pdf = c.waitForEvent("download");
  await c.getByRole("button", { name: /Descargar el informe de/ }).click();
  expect((await pdf).suggestedFilename()).toMatch(/\.pdf$/);
  await expect(c.getByRole("heading", { name: `Informes de ${cliente}` })).toBeVisible();

  // Una persona administradora retira la versión del portal: el cliente deja de verla (iteración 6).
  const admin = nuevoAdministrador();
  const administracion = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "es-CO" });
  const ad = await administracion.newPage();
  await activarSegundoFactor(ad, OFICINA, admin);
  await ad.goto(`${OFICINA}/informes`);
  await ad.getByRole("link", { name: cliente }).click();
  await ad.getByRole("button", { name: "Retirar la versión 1 del portal" }).click();
  await ad.getByLabel("Motivo del retiro de la versión 1").fill("Prueba de retiro E2E");
  await ad.getByRole("dialog").getByRole("button", { name: "Retirar la versión 1" }).click();
  await expect(ad.getByText("Versión 1 retirada del portal")).toBeVisible();
  await administracion.close();
  await c.reload();
  await expect(c.getByText("Todavía no hay informes publicados.", { exact: false })).toBeVisible();
  await celular.close();

  // Otro cliente, con su propio acceso, no ve ese informe (QA-4).
  const otro = nuevaVisitaConCliente(tecnico);
  const accesoOtro = nuevoAcceso(otro.clienteId);
  const ajeno = await browser.newContext({ locale: "es-CO" });
  const a = await ajeno.newPage();
  await a.goto(accesoOtro.url);
  await a.getByLabel("Clave").fill(accesoOtro.clave);
  await a.getByRole("button", { name: "Ver mis informes" }).click();
  await expect(a.getByRole("heading", { name: `Informes de ${otro.cliente}` })).toBeVisible();
  await expect(a.getByText("Todavía no hay informes publicados.", { exact: false })).toBeVisible();
  await ajeno.close();
});
