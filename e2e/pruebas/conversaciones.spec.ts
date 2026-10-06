import { expect, test, type Browser, type Page } from "@playwright/test";
import { nuevaVisita, nuevoUsuario, type Usuario } from "../consola";
import { CAMPO, OFICINA } from "../destino";
import { filaDeLaBandeja, fotoDePrueba, iniciarSesion, irAlPaso, irARevisar } from "./ayudas";

/*
  Conversaciones entre oficina y campo (iteración 39, ADR-0040): el técnico responde desde el teléfono, con o sin
  señal; oficina ve el punto de «sin leer», responde en el hilo y, al marcar revisado, la conversación se cierra.
*/

async function oficina(browser: Browser, usuario: Usuario): Promise<Page> {
  const contexto = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "es-CO" });
  const pagina = await contexto.newPage();
  await pagina.goto(`${OFICINA}/`);
  await iniciarSesion(pagina, usuario);
  await expect(pagina.getByRole("tab", { name: /Esperando revisión/ })).toBeVisible();
  return pagina;
}

/** El teléfono vuelve a preguntar al servidor (la bajada), como al recuperar la señal. */
const sincronizar = (page: Page) => page.evaluate(() => window.dispatchEvent(new Event("online")));

test("el técnico responde desde el teléfono, oficina ve el punto y contesta; sin señal sale al volver; revisado la cierra (ADR-0040)", async ({ page, browser, context }) => {
  test.setTimeout(180_000);
  const tecnico = nuevoUsuario("tecnico", "tecnico.e2e");
  const ana = nuevoUsuario("oficina", "oficina");
  const cliente = nuevaVisita(tecnico);

  // Campo: captura y envía.
  await page.goto(`${CAMPO}/`);
  await iniciarSesion(page, tecnico);
  const visita = page.getByRole("region", { name: "Siguiente visita" });
  await expect(visita.getByText(cliente)).toBeVisible();
  await visita.getByRole("button", { name: "Iniciar levantamiento" }).click();
  await irAlPaso(page, "Cuarto técnico");
  await page.getByRole("textbox", { name: "Potencia nominal" }).fill("12");
  await page.getByRole("textbox", { name: "Descripción del sitio" }).fill("Cuarto para conversar (E2E)");
  await page.locator("input[type=file]").first().setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: fotoDePrueba() });
  await expect(page.getByRole("img", { name: "Foto 1 de Fotos del equipo" })).toBeVisible();
  await irARevisar(page);
  await page.getByRole("button", { name: "Enviar a oficina" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Enviar levantamiento" }).click();
  await expect(page.getByText("Recibido en oficina")).toBeVisible({ timeout: 30_000 });

  // Oficina comenta sobre la potencia: abre una conversación.
  const o = await oficina(browser, ana);
  await (await filaDeLaBandeja(o, tecnico.nombre)).getByRole("link").click();
  await o.getByRole("button", { name: "Comentar potencia nominal" }).click();
  await o.getByRole("textbox", { name: "Nuevo comentario" }).fill("¿Seguro que la placa dice 12 kVA?");
  await o.getByRole("button", { name: "Enviar comentario" }).first().click();
  await expect(o.getByRole("textbox", { name: "Nuevo comentario" })).toHaveCount(0);

  // Campo: «Oficina te escribió»; el chat muestra el dato del que habla y se responde.
  await page.getByRole("button", { name: "Volver a mis visitas" }).click();
  await sincronizar(page);
  const enviados = page.getByRole("region", { name: "Enviados" });
  await expect(enviados.getByText("Oficina te escribió")).toBeVisible({ timeout: 30_000 });
  await enviados.getByRole("button").first().click();
  await page.getByRole("button", { name: /^Oficina/ }).click();
  const chat = page.getByRole("dialog", { name: "Chat con oficina" });
  await expect(chat.getByText("1 mensaje sin leer")).toBeVisible();
  await expect(chat.getByRole("button", { name: /Tu respuesta · Cuarto técnico Potencia nominal 12 kVA/ })).toBeVisible();
  await chat.getByRole("textbox", { name: "Respuesta para oficina" }).fill("Sí, 12 kVA. Es el equipo nuevo.");
  await chat.getByRole("button", { name: "Enviar" }).click();
  await expect(chat.getByText("Enviado", { exact: true })).toBeVisible({ timeout: 30_000 });

  // Oficina: el punto en la bandeja con quién respondió; al abrir la conversación se apaga y el técnico ve «Leído».
  await o.getByRole("link", { name: "Levantamientos" }).first().click();
  const fila = await filaDeLaBandeja(o, tecnico.nombre);
  await expect(fila.getByLabel("Respuesta sin leer")).toBeVisible({ timeout: 30_000 });
  await expect(fila.getByText(`${tecnico.nombre} respondió`, { exact: false })).toBeVisible();
  await fila.getByRole("link").click();
  await o.getByRole("tab", { name: /^Comentarios/ }).click();
  const hilo = o.getByRole("region", { name: "Conversación sobre Potencia nominal" });
  await expect(hilo.getByText("Sí, 12 kVA. Es el equipo nuevo.")).toBeVisible();
  await expect(hilo.getByText("Nuevo", { exact: true })).toBeVisible();
  await expect(hilo.getByText("1 respuesta")).toBeVisible();
  await expect(o.getByRole("tab", { name: /^Comentarios/ }).getByLabel("Respuesta sin leer")).toHaveCount(0, { timeout: 15_000 });
  await expect(chat.getByText("Leído", { exact: true })).toBeVisible({ timeout: 30_000 });

  // Oficina contesta en el hilo con ↵ y le llega al teléfono, que lo consulta cada 15 s con el chat abierto.
  await hilo.getByRole("textbox", { name: `Responder a ${tecnico.nombre} sobre Potencia nominal` }).fill("Gracias, así queda.");
  await hilo.getByRole("textbox", { name: `Responder a ${tecnico.nombre} sobre Potencia nominal` }).press("Enter");
  await expect(hilo.getByText("Gracias, así queda.")).toBeVisible();
  await expect(chat.getByRole("button", { name: "Responder: Gracias, así queda." })).toBeVisible({ timeout: 40_000 });

  // Sin señal: queda en el teléfono y se envía solo al volver.
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await chat.getByRole("textbox", { name: "Respuesta para oficina" }).fill("Mañana paso a confirmarlo (sin señal).");
  await chat.getByRole("button", { name: "Enviar" }).click();
  await expect(chat.getByText("Se envía cuando haya señal")).toBeVisible();
  await context.setOffline(false);
  await sincronizar(page);
  await expect(chat.getByText("Se envía cuando haya señal")).toHaveCount(0, { timeout: 40_000 });
  await expect(hilo.getByText("Mañana paso a confirmarlo (sin señal).")).toBeVisible({ timeout: 40_000 });

  // Marcar revisado cierra la conversación en los dos lados.
  await o.getByRole("button", { name: "Tomar para revisar" }).click();
  await o.getByRole("button", { name: "Marcar revisado" }).click();
  await expect(o.getByRole("dialog").getByText("Las conversaciones se cierran")).toBeVisible();
  await o.getByRole("dialog").getByRole("button", { name: "Marcar revisado" }).click();
  await expect(hilo.getByText(`Cerrada al marcar revisado. ${tecnico.nombre} la sigue viendo.`)).toBeVisible();
  await expect(chat.getByText("La conversación quedó cerrada")).toBeVisible({ timeout: 40_000 });
  await expect(chat.getByRole("textbox", { name: "Respuesta para oficina" })).toHaveCount(0);
});
