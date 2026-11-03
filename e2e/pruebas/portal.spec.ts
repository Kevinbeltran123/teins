import { expect, test } from "@playwright/test";
import { codigoDelPortal, nuevaVisitaConCliente, nuevoUsuario, ultimoCodigo } from "../consola";
import { CAMPO, OFICINA, PORTAL, REMOTO } from "../destino";
import { entrarAlPortal, filaDeLaBandeja, fotoDePrueba, iniciarSesion, irAlPaso, irARevisar, nuevoContacto } from "./ayudas";

/*
  El portal por contacto (ADR-0053): oficina da el acceso, el contacto entra con el código que le llega al correo, ve lo
  que recibe y descarga; desde el botón de un correo llega a ese documento; si oficina le quita el acceso, queda fuera.
  El código se lee del correo simulado: solo en local (en el entorno de pruebas el correo es real).
*/
test.skip(REMOTO, "El código llega a un correo real en el entorno de pruebas: se prueba a mano (verificación manual).");

test("el recorrido completo: campo envía, oficina publica y da acceso, y el contacto entra con su código y descarga (QA-4)", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const tecnico = nuevoUsuario("tecnico", "tecnico.e2e");
  const revisora = nuevoUsuario("oficina", "oficina");
  const { cliente, clienteId } = nuevaVisitaConCliente(tecnico);
  const sufijo = clienteId.slice(0, 8);
  const ana = { nombre: `Ana ${sufijo}`, correo: `ana.${sufijo}@cliente.example`, recibeInformes: true, recibeCotizaciones: true };

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
  await o.getByRole("button", { name: "Abrir el informe" }).click();
  await o.waitForURL(/\/informes\/[0-9a-f-]{36}/);
  const informeId = /\/informes\/([0-9a-f-]{36})/.exec(o.url())![1]!;
  await o.getByRole("checkbox", { name: new RegExp(`de ${tecnico.nombre}`) }).check();
  await o.getByRole("button", { name: "Publicar versión 1" }).click();
  await o.getByRole("dialog").getByRole("button", { name: "Publicar versión 1" }).click();
  await expect(o.getByRole("button", { name: "Descargar PDF de la versión 1" })).toBeVisible({ timeout: 60_000 });

  // Oficina da el acceso desde el contacto: se confirma, porque le envía una invitación.
  await nuevoContacto(revisora, clienteId, ana, { acceso: false });
  await o.goto(`${OFICINA}/clientes/${clienteId}`);
  const interruptor = o.getByRole("switch", { name: `Acceso al portal de ${ana.nombre}` });
  await expect(interruptor).not.toBeChecked();
  await interruptor.click();
  const confirmar = o.getByRole("dialog", { name: `¿Dar acceso al portal a ${ana.nombre}?` });
  await expect(confirmar.getByText(`Le enviaremos una invitación a ${ana.correo}`)).toBeVisible();
  await confirmar.getByRole("button", { name: "Dar acceso" }).click();
  await expect(interruptor).toBeChecked();
  await expect(o.getByText("Aún no entra")).toBeVisible();

  // El contacto, en su celular: el correo, un código equivocado y después el que le llegó.
  const celular = await browser.newContext({ locale: "es-CO", viewport: { width: 390, height: 844 } });
  const c = await celular.newPage();
  await c.goto(`${PORTAL}/`);
  const anterior = ultimoCodigo(ana.correo);
  await c.getByLabel("Correo").fill(ana.correo.toUpperCase());
  await c.getByRole("button", { name: "Enviar código" }).click();
  await expect(c.getByText(`Le enviamos un código a ${ana.correo.toUpperCase()}`, { exact: false })).toBeVisible();
  const codigo = await codigoDelPortal(ana.correo, anterior);
  await c.getByLabel("Código").fill(codigo === "000000" ? "111111" : "000000");
  await c.getByRole("button", { name: "Entrar" }).click();
  await expect(c.getByText("El código no es correcto o venció. Pida uno nuevo.")).toBeVisible();
  await c.getByLabel("Código").fill(codigo);
  await c.getByRole("button", { name: "Entrar" }).click();
  await expect(c.getByRole("heading", { level: 1, name: cliente })).toBeVisible();
  // Ve lo que recibe: informes y cotizaciones.
  await expect(c.getByRole("tab", { name: /Informes/ })).toHaveAttribute("aria-selected", "true");
  const pdf = c.waitForEvent("download");
  await c.getByRole("button", { name: /Descargar el informe de/ }).click();
  expect((await pdf).suggestedFilename()).toMatch(/\.pdf$/);
  await c.getByRole("tab", { name: /Cotizaciones/ }).click();
  await expect(c.getByText("Todavía no hay cotizaciones publicadas.")).toBeVisible();

  // Oficina ve que ya entró.
  await o.reload();
  await expect(o.getByText(/Último ingreso: /)).toBeVisible();

  // Desde el botón de un correo, sin sesión: entra y llega a ese informe, resaltado.
  const otroEquipo = await browser.newContext({ locale: "es-CO", viewport: { width: 1280, height: 800 } });
  const enlace = await otroEquipo.newPage();
  await entrarAlPortal(enlace, ana.correo, `${PORTAL}/informes/${informeId}`);
  await expect(enlace.getByRole("listitem").filter({ has: enlace.getByRole("button", { name: /Descargar el informe de/ }) })).toHaveAttribute("aria-current", "true");
  await otroEquipo.close();

  // Oficina le quita el acceso: al instante, con «Deshacer»; su sesión queda fuera.
  await interruptor.click();
  await expect(o.getByText(`Acceso al portal quitado: ${ana.nombre}`)).toBeVisible();
  await expect(interruptor).not.toBeChecked();
  await escritorio.close();
  await c.reload();
  await expect(c.getByRole("button", { name: "Enviar código" })).toBeVisible();
  await celular.close();

  // Otro contacto de otro cliente, que solo recibe informes: no ve el de este cliente ni la pestaña de cotizaciones (QA-4).
  const otro = nuevaVisitaConCliente(tecnico);
  const beto = { nombre: `Beto ${sufijo}`, correo: `beto.${sufijo}@otro.example`, recibeInformes: true, recibeCotizaciones: false };
  await nuevoContacto(revisora, otro.clienteId, beto);
  const ajeno = await browser.newContext({ locale: "es-CO" });
  const a = await ajeno.newPage();
  await entrarAlPortal(a, beto.correo);
  await expect(a.getByRole("heading", { level: 1, name: otro.cliente })).toBeVisible();
  await expect(a.getByText("Todavía no hay informes publicados.")).toBeVisible();
  await expect(a.getByRole("tablist")).toHaveCount(0);

  // El tema se elige en el encabezado y se recuerda en el equipo, como en oficina y en campo.
  await a.getByRole("radio", { name: "Oscuro" }).click();
  await expect(a.locator("html")).toHaveAttribute("data-tema", "oscuro");
  await a.reload();
  await expect(a.locator("html")).toHaveAttribute("data-tema", "oscuro");
  await ajeno.close();
});
