import { expect, test, type Browser, type Page } from "@playwright/test";
import { nuevaVisita, nuevoUsuario, type Usuario } from "../consola";
import { CAMPO, OFICINA } from "../destino";
import { filaDeLaBandeja, fotoDePrueba, iniciarSesion, irAlPaso, irARevisar, pdfDePrueba } from "./ayudas";

async function enviarDesdeCampo(page: Page, tecnico: Usuario, cliente: string) {
  await page.goto(`${CAMPO}/`);
  await iniciarSesion(page, tecnico);
  const visita = page.getByRole("region", { name: "Siguiente visita" });
  await expect(visita.getByText(cliente)).toBeVisible();
  await visita.getByRole("button", { name: "Iniciar levantamiento" }).click();
  await irAlPaso(page, "Cuarto técnico");
  await page.getByRole("textbox", { name: "Potencia nominal" }).fill("20");
  await page.getByRole("textbox", { name: "Descripción del sitio" }).fill("Cuarto para el informe E2E");
  await page.locator("input[type=file]").first().setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: fotoDePrueba() });
  await expect(page.getByRole("img", { name: "Foto 1 de Fotos del equipo" })).toBeVisible();
  await irARevisar(page);
  await page.getByRole("button", { name: "Enviar a oficina" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Enviar levantamiento" }).click();
  await expect(page.getByText("Recibido en oficina")).toBeVisible({ timeout: 30_000 });
}

async function oficina(browser: Browser, usuario: Usuario): Promise<Page> {
  const contexto = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "es-CO" });
  const pagina = await contexto.newPage();
  await pagina.goto(`${OFICINA}/`);
  await iniciarSesion(pagina, usuario);
  await expect(pagina.getByRole("tab", { name: /Esperando revisión/ })).toBeVisible();
  return pagina;
}

test("oficina compone el informe de la visita, lo publica con un plano y descarga el PDF; una versión nueva conserva la anterior (QA-9, QA-17)", async ({ page, browser }) => {
  const tecnico = nuevoUsuario("tecnico", "tecnico.e2e");
  const revisora = nuevoUsuario("oficina", "oficina");
  const cliente = nuevaVisita(tecnico);
  await enviarDesdeCampo(page, tecnico, cliente);

  // Revisión mínima: tomar y marcar revisado.
  const o = await oficina(browser, revisora);
  await (await filaDeLaBandeja(o, tecnico.nombre)).getByRole("link").click();
  await o.getByRole("button", { name: "Tomar para revisar" }).click();
  await o.getByRole("button", { name: "Marcar revisado" }).click();
  await o.getByRole("dialog").getByRole("button", { name: "Marcar revisado" }).click();
  await o.getByRole("button", { name: "Abrir el informe de la visita" }).click();
  await expect(o.getByRole("heading", { name: `Informe de ${cliente}` })).toBeVisible();

  // Composición: el levantamiento revisado, una introducción y un plano.
  await o.getByRole("checkbox", { name: new RegExp(`de ${tecnico.nombre}`) }).check();
  await o.getByRole("textbox", { name: "Introducción" }).fill("Primera versión del informe E2E.");
  await o.locator("input[type=file]").setInputFiles({ name: "Planta del cuarto.pdf", mimeType: "application/pdf", buffer: pdfDePrueba() });
  await expect(o.getByRole("textbox", { name: "Nombre del plano 1" })).toHaveValue("Planta del cuarto");
  // Al lado, el informe como lo recibe el cliente, al escribir (ADR-0031): la introducción, el capítulo y el plano
  // como ficha, porque no se dibuja.
  const hoja = o.frameLocator('iframe[title^="Vista previa del informe"]');
  await expect(hoja.getByText("Primera versión del informe E2E.")).toBeVisible();
  await expect(hoja.getByText("Levantamiento 1 de 1")).toBeVisible();
  // El servidor cuenta sus páginas al verificarlo: la fila y la ficha dicen cuántas anexa.
  await expect(o.getByText("1 página", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(hoja.locator(".vista-anexo").filter({ hasText: "Planta del cuarto" })).toContainText("1 página, se anexa al final del PDF");
  await o.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(o.getByText("Todo guardado")).toBeVisible();

  // El worker verifica el plano en segundos; publicar antes lo avisa y se reintenta.
  // El error queda en el diálogo de confirmación, que sigue abierto: se reintenta desde ahí.
  await o.getByRole("button", { name: "Publicar versión 1" }).click();
  await expect(async () => {
    await o.getByRole("dialog").getByRole("button", { name: "Publicar versión 1" }).click();
    await expect(o.getByText("Versión 1 vigente")).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });

  const descargar = o.getByRole("button", { name: "Descargar PDF de la versión 1" });
  await expect(descargar).toBeVisible({ timeout: 60_000 });

  // Versión 2 con otra introducción: la 1 sigue ahí, con su PDF.
  await o.getByRole("textbox", { name: "Introducción" }).fill("Segunda versión del informe E2E.");
  await expect(hoja.getByText("Segunda versión del informe E2E.")).toBeVisible();
  await o.getByRole("button", { name: "Publicar versión 2" }).click();
  await o.getByRole("dialog").getByRole("button", { name: "Publicar versión 2" }).click();
  await expect(o.getByText("Versión 2 vigente")).toBeVisible();
  await expect(o.getByRole("button", { name: "Descargar PDF de la versión 2" })).toBeVisible({ timeout: 60_000 });
  await expect(descargar).toBeVisible();

  // La descarga entrega un PDF como archivo: la pantalla de oficina no cambia.
  const pdf = o.waitForEvent("download");
  await descargar.click();
  expect((await pdf).suggestedFilename()).toMatch(/\.pdf$/);
  await expect(o.getByRole("heading", { name: `Informe de ${cliente}` })).toBeVisible();

  await o.context().close();
});
