import { expect, test, type Browser, type Page } from "@playwright/test";
import { nuevaVisita, nuevoUsuario, type Usuario } from "../consola";
import { CAMPO, OFICINA } from "../destino";
import { filaDeLaBandeja, fotoDePrueba, iniciarSesion } from "./ayudas";

/** Una persona de oficina en su propio navegador de escritorio. */
async function oficina(browser: Browser, usuario: Usuario): Promise<Page> {
  const contexto = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "es-CO" });
  const pagina = await contexto.newPage();
  await pagina.goto(`${OFICINA}/`);
  await iniciarSesion(pagina, usuario);
  await expect(pagina.getByRole("heading", { name: "Esperando revisión" })).toBeVisible();
  return pagina;
}

async function abrirLevantamientoDe(pagina: Page, tecnico: Usuario, pestana: string) {
  await pagina.getByRole("tab", { name: pestana }).click();
  await (await filaDeLaBandeja(pagina, tecnico.nombre)).getByRole("link").click();
  await expect(pagina.getByRole("heading", { name: `Levantamiento de ${tecnico.nombre}` })).toBeVisible();
}

test("oficina revisa sin pisarse y el técnico ve el resultado y los comentarios (QA-8, QA-25)", async ({ page, browser }) => {
  const tecnico = nuevoUsuario("tecnico", "tecnico.e2e");
  const [ana, luis] = [nuevoUsuario("oficina", "oficina"), nuevoUsuario("oficina", "oficina")];
  const cliente = nuevaVisita(tecnico);

  // Campo: captura y envía un levantamiento con la versión vigente del formato.
  await page.goto(`${CAMPO}/`);
  await iniciarSesion(page, tecnico);
  const visita = page.getByRole("region", { name: "Siguiente visita" });
  await expect(visita.getByText(cliente)).toBeVisible();
  await visita.getByRole("button", { name: "Iniciar levantamiento" }).click();
  await page.getByRole("textbox", { name: "Potencia nominal" }).fill("10");
  await page.getByRole("textbox", { name: "Descripción del sitio" }).fill("Cuarto para revisión E2E");
  await page.locator("input[type=file]").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: fotoDePrueba() });
  await expect(page.getByRole("img", { name: "Foto 1 de Fotos del equipo" })).toBeVisible();
  await page.getByRole("button", { name: "Enviar a oficina" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Enviar levantamiento" }).click();
  await expect(page.getByText("Recibido en oficina")).toBeVisible({ timeout: 30_000 });

  // Ana toma la revisión, corrige la potencia con motivo y comenta ese dato.
  const a = await oficina(browser, ana);
  await abrirLevantamientoDe(a, tecnico, "Esperando revisión");
  await a.getByRole("button", { name: "Tomar para revisar" }).click();
  await expect(a.getByText("Usted tiene la revisión.", { exact: false })).toBeVisible();
  await a.getByRole("button", { name: "Corregir potencia nominal" }).click();
  await a.getByRole("textbox", { name: "Nuevo valor de potencia nominal" }).fill("12,5");
  await a.getByRole("textbox", { name: "Motivo de la corrección" }).fill("La placa dice 12,5 kVA");
  await a.getByRole("button", { name: "Guardar corrección" }).click();
  await expect(a.getByText("12,5 kVA", { exact: true })).toBeVisible();
  const historial = a.getByRole("region", { name: "Historial de cambios" });
  await expect(historial.getByText("potencia nominal: 10 kVA → 12,5 kVA")).toBeVisible();
  await expect(historial.getByText("Motivo: La placa dice 12,5 kVA", { exact: false })).toBeVisible();
  await expect(historial.getByText("Historial íntegro")).toBeVisible();

  await a.getByRole("button", { name: "Comentar potencia nominal" }).click();
  await a.getByRole("textbox", { name: "Nuevo comentario" }).fill("Revisa la placa: la potencia estaba mal");
  await a.getByRole("button", { name: "Enviar comentario" }).click();
  await expect(a.getByRole("region", { name: "Comentarios al técnico" }).getByText("Revisa la placa: la potencia estaba mal")).toBeVisible();

  // Luis se lleva la revisión pidiéndolo; el guardado que Ana tenía en curso se rechaza y se avisa (QA-25).
  await a.getByRole("button", { name: "Corregir descripción del sitio" }).click();
  const b = await oficina(browser, luis);
  await abrirLevantamientoDe(b, tecnico, "En revisión");
  await b.getByRole("button", { name: `Tomar la revisión de ${ana.nombre}` }).click();
  await b.getByRole("dialog").getByRole("button", { name: "Tomar la revisión" }).click();
  await expect(b.getByText("Usted tiene la revisión.", { exact: false })).toBeVisible();

  await a.getByRole("textbox", { name: "Nuevo valor de descripción del sitio" }).fill("Cambio que no debe quedar");
  await a.getByRole("button", { name: "Guardar corrección" }).click();
  await expect(a.getByText("recargue para ver la versión actual", { exact: false }).or(a.getByText("Ya no tiene la revisión", { exact: false }))).toBeVisible();
  await a.getByRole("button", { name: "Recargar" }).click();
  await expect(a.getByText(`La revisión la tiene ${luis.nombre}.`)).toBeVisible();
  await expect(a.getByText("Cambio que no debe quedar")).toHaveCount(0);

  // Luis la marca revisada.
  await b.getByRole("button", { name: "Marcar revisado" }).click();
  await b.getByRole("dialog").getByRole("button", { name: "Marcar revisado" }).click();
  await expect(b.getByText(`Revisado por ${luis.nombre}.`, { exact: false })).toBeVisible();
  await expect(b.getByRole("region", { name: "Historial de cambios" }).getByText(`que tenía ${ana.nombre}`, { exact: false })).toBeVisible();

  // Campo: la siguiente bajada trae el estado y el comentario.
  await page.getByRole("button", { name: "Volver a mis visitas" }).click();
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  const esta = page.getByRole("region", { name: `En ${cliente}` });
  await expect(esta.getByText("Revisado por oficina")).toBeVisible({ timeout: 30_000 });
  await expect(esta.getByText("1 comentario de oficina")).toBeVisible();
  await esta.getByRole("button").first().click();
  await expect(page.getByText("Revisa la placa: la potencia estaba mal")).toBeVisible();
  await expect(page.getByText("Sobre potencia nominal", { exact: false })).toBeVisible();

  await a.context().close();
  await b.context().close();
});
