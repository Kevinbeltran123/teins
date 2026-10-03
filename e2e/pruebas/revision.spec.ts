import { expect, test, type Browser, type Page } from "@playwright/test";
import { nuevaVisita, nuevoUsuario, type Usuario } from "../consola";
import { CAMPO, OFICINA } from "../destino";
import { filaDeLaBandeja, fotoDePrueba, iniciarSesion, irAlPaso, irARevisar } from "./ayudas";

/** Una persona de oficina en su propio navegador de escritorio. */
async function oficina(browser: Browser, usuario: Usuario): Promise<Page> {
  const contexto = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "es-CO" });
  const pagina = await contexto.newPage();
  await pagina.goto(`${OFICINA}/`);
  await iniciarSesion(pagina, usuario);
  await expect(pagina.getByRole("tab", { name: /Esperando revisión/ })).toBeVisible();
  return pagina;
}

async function abrirLevantamientoDe(pagina: Page, tecnico: Usuario, pestana: string) {
  await pagina.getByRole("tab", { name: pestana }).click();
  await (await filaDeLaBandeja(pagina, tecnico.nombre)).getByRole("link").click();
  // El título es el cliente y el sitio; el técnico va debajo (rediseño de oficina, iteración 23).
  await expect(pagina.getByRole("region", { name: "Revisión" })).toBeVisible();
  await expect(pagina.getByText(`de ${tecnico.nombre}`, { exact: false }).first()).toBeVisible();
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
  await irAlPaso(page, "Cuarto técnico");
  await page.getByRole("textbox", { name: "Potencia nominal" }).fill("10");
  await page.getByRole("textbox", { name: "Descripción del sitio" }).fill("Cuarto para revisión E2E");
  await page.locator("input[type=file]").first().setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: fotoDePrueba() });
  await expect(page.getByRole("img", { name: "Foto 1 de Fotos del equipo" })).toBeVisible();
  await irARevisar(page);
  await page.getByRole("button", { name: "Enviar a oficina" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Enviar levantamiento" }).click();
  await expect(page.getByText("Recibido en oficina")).toBeVisible({ timeout: 30_000 });

  // Ana toma la revisión, corrige la potencia con motivo y comenta ese dato.
  const a = await oficina(browser, ana);
  await abrirLevantamientoDe(a, tecnico, "Esperando revisión");
  await a.getByRole("button", { name: "Tomar para revisar" }).click();
  await expect(a.getByRole("region", { name: "Revisión" }).getByText("La tomó usted")).toBeVisible();
  await a.getByRole("button", { name: "Corregir potencia nominal" }).click();
  await a.getByRole("textbox", { name: "Nuevo valor de potencia nominal" }).fill("12,5");
  // Antes de guardar, el capítulo del informe ya muestra el valor nuevo y el anterior (ADR-0031).
  await a.getByRole("button", { name: "Ver cómo queda en el informe" }).click();
  const capitulo = a.frameLocator('iframe[title="Capítulo del informe"]');
  await expect(capitulo.getByText("12,5 kVA")).toBeVisible();
  await expect(capitulo.locator('td[data-antes="Antes: 10 kVA · sin guardar"]')).toHaveCount(1);
  // Sin motivo no se guarda: queda en el historial junto al valor anterior (iteración 24c).
  await a.getByRole("button", { name: "Guardar corrección" }).click();
  await expect(a.getByText("Escriba el motivo: queda en el historial junto al valor anterior.")).toBeVisible();
  await expect(a.getByRole("textbox", { name: "Motivo de la corrección" })).toBeFocused();
  await a.getByRole("textbox", { name: "Motivo de la corrección" }).fill("La placa dice 12,5 kVA");
  await a.getByRole("button", { name: "Guardar corrección" }).click();
  await expect(a.getByText("12,5 kVA", { exact: true })).toBeVisible();
  await expect(capitulo.locator('tr.vista-corregido td[data-antes="Antes: 10 kVA"]')).toHaveCount(1);
  // El historial va en su pestaña del carril.
  await a.getByRole("tab", { name: "Historial" }).click();
  const historial = a.getByRole("region", { name: "Historial de cambios" });
  await expect(historial.getByText("potencia nominal: 10 kVA → 12,5 kVA")).toBeVisible();
  await expect(historial.getByText("Motivo: La placa dice 12,5 kVA", { exact: false })).toBeVisible();
  await expect(historial.getByText("Historial íntegro")).toBeVisible();

  await a.getByRole("button", { name: "Comentar potencia nominal" }).click();
  await a.getByRole("textbox", { name: "Nuevo comentario" }).fill("Revisa la placa: la potencia esta mal");
  // Se escribe debajo de la fila: el primer "Enviar comentario" es el de esa fila.
  await a.getByRole("button", { name: "Enviar comentario" }).first().click();
  await a.getByRole("tab", { name: /^Comentarios/ }).click();
  const comentarios = a.getByRole("region", { name: "Comentarios al técnico" });
  await expect(comentarios.getByText("Revisa la placa: la potencia esta mal")).toBeVisible();

  // Su autora lo corrige (ADR-0035): editar deja la hora; borrar no pregunta, queda "Comentario retirado" con "Deshacer".
  await comentarios.getByRole("button", { name: "Más acciones para el comentario" }).click();
  await a.getByRole("menuitem", { name: "Editar" }).click();
  await comentarios.getByRole("textbox", { name: "Comentario", exact: true }).fill("Revisa la placa: la potencia estaba mal");
  await comentarios.getByRole("button", { name: "Guardar" }).click();
  await expect(comentarios.getByText("Revisa la placa: la potencia estaba mal")).toBeVisible();
  await expect(comentarios.getByText(/^Editado /)).toBeVisible();
  await a.getByRole("textbox", { name: "Comentario general" }).fill("Comentario equivocado (E2E)");
  await comentarios.getByRole("button", { name: "Enviar comentario" }).click();
  await comentarios.locator(".nota-c").filter({ hasText: "Comentario equivocado (E2E)" }).getByRole("button", { name: "Más acciones para el comentario" }).click();
  await a.getByRole("menuitem", { name: "Borrar" }).click();
  await expect(comentarios.getByText(`Comentario retirado por ${ana.nombre}`, { exact: false })).toBeVisible();
  await expect(a.getByRole("tab", { name: "Comentarios · 1" })).toBeVisible();

  // Luis se lleva la revisión pidiéndolo; el guardado que Ana tenía en curso se rechaza y se avisa (QA-25).
  await a.getByRole("button", { name: "Corregir descripción del sitio" }).click();
  const b = await oficina(browser, luis);
  await abrirLevantamientoDe(b, tecnico, "En revisión");
  await b.getByRole("button", { name: `Tomar la revisión de ${ana.nombre}` }).click();
  await b.getByRole("dialog").getByRole("button", { name: "Tomar la revisión" }).click();
  await expect(b.getByRole("region", { name: "Revisión" }).getByText("La tomó usted")).toBeVisible();

  await a.getByRole("textbox", { name: "Nuevo valor de descripción del sitio" }).fill("Cambio que no debe quedar");
  await a.getByRole("textbox", { name: "Motivo de la corrección" }).fill("Prueba de conflicto E2E");
  await a.getByRole("button", { name: "Guardar corrección" }).click();
  await expect(a.getByText("recargue para ver la versión actual", { exact: false }).or(a.getByText("Ya no tiene la revisión", { exact: false }))).toBeVisible();
  await a.getByRole("button", { name: "Recargar" }).click();
  await expect(a.getByRole("region", { name: "Revisión" }).getByText(`La tiene ${luis.nombre}`)).toBeVisible();
  await expect(a.getByText("Cambio que no debe quedar")).toHaveCount(0);

  // Luis la marca revisada.
  await b.getByRole("button", { name: "Marcar revisado" }).click();
  await b.getByRole("dialog").getByRole("button", { name: "Marcar revisado" }).click();
  // El estado cambia en su lugar: una línea con el chulo y quién lo revisó, y una notificación (iteraciones 27 y 29).
  const revision = b.getByRole("region", { name: "Revisión" });
  await expect(revision.getByText(`por ${luis.nombre}`, { exact: false })).toBeVisible();
  await expect(b.getByRole("status").getByText("Marcado revisado")).toBeVisible();
  await b.getByRole("tab", { name: "Historial" }).click();
  await expect(b.getByRole("region", { name: "Historial de cambios" }).getByText(`que tenía ${ana.nombre}`, { exact: false })).toBeVisible();

  // Campo: la siguiente bajada trae el estado y el comentario.
  await page.getByRole("button", { name: "Volver a mis visitas" }).click();
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  const esta = page.getByRole("region", { name: "Enviados" });
  await expect(esta.getByText("Revisado", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(esta.getByText("1 comentario de oficina")).toBeVisible();
  await esta.getByRole("button").first().click();
  await expect(page.getByText("Revisa la placa: la potencia estaba mal")).toBeVisible();
  await expect(page.getByText("Sobre potencia nominal", { exact: false })).toBeVisible();

  await a.context().close();
  await b.context().close();
});
