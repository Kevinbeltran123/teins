import { expect, test, type Page } from "@playwright/test";
import { nuevaVisitaConCliente, nuevoUsuario } from "../consola";
import { CAMPO } from "../destino";
import { fotoDePrueba, iniciarSesion, irAlPaso, irARevisar } from "./ayudas";

/** Iteración 24 (grupo A): en campo nada se duplica ni se pierde por un toque de más o un aviso tapado. */

/** Cuántos levantamientos hay guardados en el teléfono (cifrados: solo se cuentan). */
function levantamientosEnElTelefono(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolver, fallar) => {
      const pedido = indexedDB.open("teins-campo");
      pedido.onsuccess = () => resolver(pedido.result);
      pedido.onerror = () => fallar(pedido.error);
    });
    const total = await new Promise<number>((resolver) => {
      const pedido = db.transaction("levantamientos").objectStore("levantamientos").count();
      pedido.onsuccess = () => resolver(pedido.result);
    });
    db.close();
    return total;
  });
}

async function iniciarLevantamiento(page: Page, { dobleToque = false } = {}) {
  const tecnico = nuevoUsuario("tecnico", "tecnico.e2e");
  const { cliente } = nuevaVisitaConCliente(tecnico);
  await page.goto(`${CAMPO}/`);
  await iniciarSesion(page, tecnico);
  const visita = page.getByRole("region", { name: "Siguiente visita" });
  await expect(visita.getByText(cliente)).toBeVisible();
  const iniciar = visita.getByRole("button", { name: "Iniciar levantamiento" });
  if (dobleToque) await iniciar.dblclick();
  else await iniciar.click();
}

test("un doble toque en «Iniciar levantamiento» y en «Agregar tablero» crea uno solo", async ({ page }) => {
  await iniciarLevantamiento(page, { dobleToque: true });
  await irAlPaso(page, "Tableros");
  await page.waitForTimeout(500);
  expect(await levantamientosEnElTelefono(page)).toBe(1);

  const tableros = page.getByRole("region", { name: "Tableros" });
  await tableros.getByRole("button", { name: "Agregar tablero" }).dblclick();
  await expect(page.getByRole("article", { name: "Tablero 1" })).toBeVisible();
  await page.getByRole("button", { name: "Listo este tablero" }).click();
  await expect(tableros.getByRole("button", { name: /^Tablero/ })).toHaveCount(1);
});

test("«No se pudo obtener» sobre un dato capturado se deshace, y desmarcarlo deja el campo vacío a la vista", async ({ page }) => {
  await iniciarLevantamiento(page);
  await irAlPaso(page, "Cuarto técnico");
  const potencia = page.getByRole("textbox", { name: "Potencia nominal" });
  const marca = page.getByRole("checkbox", { name: "Potencia nominal: no se pudo obtener" });
  // La casilla va oculta a la vista: se toca su texto, como el técnico.
  const tocarMarca = () => marca.locator("xpath=ancestor::label").click();
  await potencia.fill("20");

  // Marcar reemplaza lo capturado: se avisa y se deshace.
  await tocarMarca();
  await expect(marca).toBeChecked();
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(marca).not.toBeChecked();
  await expect(potencia).toHaveValue("20");
  await expect(potencia).toBeEnabled();

  // Desmarcar deja el dato vacío para capturarlo (regla 3), y así se ve.
  await tocarMarca();
  await expect(marca).toBeChecked();
  await tocarMarca();
  await expect(marca).not.toBeChecked();
  await expect(potencia).toHaveValue("");
});

test("si el teléfono no puede guardar lo escrito, la captura lo dice hasta que vuelva a guardar", async ({ page }) => {
  await iniciarLevantamiento(page);
  await irAlPaso(page, "Cuarto técnico");
  const descripcion = page.getByRole("textbox", { name: "Descripción del sitio" });
  await descripcion.fill("Se guarda");

  // El almacenamiento del teléfono deja de escribir (lleno, por ejemplo).
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    Object.assign(window, { restaurarEscritura: () => (IDBObjectStore.prototype.put = original) });
    IDBObjectStore.prototype.put = () => {
      throw new DOMException("Sin espacio", "QuotaExceededError");
    };
  });
  await descripcion.fill("No alcanza a guardarse");
  const aviso = page.getByRole("alert").filter({ hasText: "No se pudo guardar en este teléfono" });
  await expect(aviso).toBeVisible();

  await page.evaluate(() => (window as unknown as { restaurarEscritura: () => void }).restaurarEscritura());
  await descripcion.fill("Ahora sí se guarda");
  await expect(aviso).toHaveCount(0);
});

test("un envío rechazado para siempre dice qué hacer, conserva lo capturado y sale al reintentar cuando oficina lo resuelve", async ({ page }) => {
  await iniciarLevantamiento(page);
  await irAlPaso(page, "Cuarto técnico");
  await page.getByRole("textbox", { name: "Potencia nominal" }).fill("20");
  await page.getByRole("textbox", { name: "Descripción del sitio" }).fill("Cuarto del rechazo E2E");
  await page.locator("input[type=file]").first().setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: fotoDePrueba() });
  await expect(page.getByRole("img", { name: "Foto 1 de Fotos del equipo" })).toBeVisible();

  // El servidor lo rechaza con un error que reintentar solo no arregla (ADR-0003).
  await page.route("**/api/sync/comandos", (ruta) => ruta.fulfill({ status: 409, body: "" }));
  await irARevisar(page);
  await page.getByRole("button", { name: "Enviar a oficina" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Enviar levantamiento" }).click();
  await expect(page.getByText("No se pudo enviar", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Lo capturado sigue guardado en este teléfono", { exact: false })).toBeVisible();
  await expect(page.getByText("Avísale a oficina", { exact: false })).toBeVisible();

  await page.unroute("**/api/sync/comandos");
  await page.getByRole("button", { name: "Reintentar envío" }).click();
  await expect(page.getByText("Recibido en oficina")).toBeVisible({ timeout: 30_000 });
});

test("«Deshacer» de «Foto eliminada» se alcanza a tocar con el visor de fotos abierto", async ({ page }) => {
  await iniciarLevantamiento(page);
  await irAlPaso(page, "Cuarto técnico");
  const entrada = page.locator("input[type=file]").first();
  await entrada.setInputFiles({ name: "uno.png", mimeType: "image/png", buffer: fotoDePrueba() });
  await expect(page.getByRole("img", { name: "Foto 1 de Fotos del equipo" })).toBeVisible();
  await entrada.setInputFiles({ name: "dos.png", mimeType: "image/png", buffer: fotoDePrueba() });
  await expect(page.getByRole("img", { name: "Foto 2 de Fotos del equipo" })).toBeVisible();

  await page.getByRole("button", { name: "Foto 1 de Fotos del equipo" }).click();
  const visor = page.getByRole("dialog", { name: /^Fotos del equipo: foto 1 de 2/ });
  await expect(visor).toBeVisible();
  await visor.getByRole("button", { name: "Eliminar foto" }).click();
  await expect(page.getByRole("dialog", { name: /^Fotos del equipo: foto 1 de 1/ })).toBeVisible();
  await page.getByRole("button", { name: "Deshacer" }).click({ timeout: 5_000 });
  await expect(page.getByRole("dialog", { name: /^Fotos del equipo: foto \d de 2/ })).toBeVisible();
});
