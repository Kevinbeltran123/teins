import { expect, test, type Page } from "@playwright/test";
import { nuevaVisitaConCliente, nuevoUsuario } from "../consola";
import { CAMPO } from "../destino";
import { fotoDePrueba, iniciarSesion, irAlPaso, irAlRecorrido, irARevisar } from "./ayudas";

/**
 * Iteración 42: lo que se ve en campo sale de lo guardado. Un tablero quitado deja de pedirse, lo que llega tarde no lo
 * revive, volver a un paso muestra lo capturado y un envío rechazado se puede corregir.
 */

async function iniciarConCuartoTecnico(page: Page) {
  const tecnico = nuevoUsuario("tecnico", "tecnico.e2e");
  const { cliente } = nuevaVisitaConCliente(tecnico);
  await page.goto(`${CAMPO}/`);
  await iniciarSesion(page, tecnico);
  const visita = page.getByRole("region", { name: "Siguiente visita" });
  await expect(visita.getByText(cliente)).toBeVisible();
  await visita.getByRole("button", { name: "Iniciar levantamiento" }).click();
  await irAlPaso(page, "Cuarto técnico");
  await page.getByRole("textbox", { name: "Potencia nominal" }).fill("15");
  await page.locator("input[type=file]").first().setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: fotoDePrueba() });
  await expect(page.getByRole("img", { name: "Foto 1 de Fotos del equipo" })).toBeVisible();
  await page.getByRole("button", { name: "Siguiente: tableros" }).click();
  return { cliente, tableros: page.getByRole("region", { name: "Tableros" }) };
}

async function quitarTablero(page: Page, nombre: string) {
  await page.getByRole("button", { name: `Opciones de ${nombre}` }).click();
  await page.getByRole("menuitem", { name: "Quitar tablero" }).click();
  // De vuelta en la lista del paso.
  await expect(page.getByRole("button", { name: "Siguiente: materiales" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^(Volver a la lista|Listo, ver )/ })).toHaveCount(0);
}

/** Envía desde «Revisa y envía»: sin nada pendiente, la lista de lo que falta no aparece y oficina lo recibe. */
async function enviarSinPendientes(page: Page) {
  await irARevisar(page);
  await expect(page.getByRole("region", { name: /por completar$/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Enviar a oficina" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Enviar levantamiento" }).click();
  await expect(page.getByText("Recibido en oficina")).toBeVisible({ timeout: 30_000 });
}

test("un tablero nuevo que se quita deja de pedirse aunque «Siguiente» ya lo hubiera marcado", async ({ page }) => {
  const { tableros } = await iniciarConCuartoTecnico(page);
  await tableros.getByRole("button", { name: "Agregar tablero" }).click();
  await expect(page.getByRole("article", { name: "Tablero 1" })).toBeVisible();
  await page.getByRole("button", { name: /^Listo, ver / }).click();
  await page.getByRole("button", { name: "Siguiente: materiales" }).click();
  await expect(page.getByRole("dialog", { name: /datos? en tableros/ })).toBeVisible();
  await page.getByRole("button", { name: "Seguir y completar después" }).click();

  await irAlPaso(page, "Tableros");
  await tableros.getByRole("button", { name: /^Tablero 1/ }).click();
  await quitarTablero(page, "Tablero 1");
  await expect(tableros.getByRole("button", { name: /^Tablero/ })).toHaveCount(0);
  await enviarSinPendientes(page);
});

test("«Deshacer» de una foto o de «No se pudo obtener» después de quitar su tablero no lo revive", async ({ page }) => {
  const { tableros } = await iniciarConCuartoTecnico(page);
  await tableros.getByRole("button", { name: "Agregar tablero" }).click();
  const tablero = page.getByRole("article", { name: "Tablero 1" });
  await tablero.getByRole("textbox", { name: "Ubicación del tablero" }).fill("Sótano");
  await tablero.locator("input[type=file]").first().setInputFiles({ name: "t.png", mimeType: "image/png", buffer: fotoDePrueba() });
  await expect(page.getByRole("img", { name: "Foto 1 de Foto del tablero" })).toBeVisible();
  await page.getByRole("button", { name: "Foto 1 de Foto del tablero" }).click();
  await page.getByRole("dialog", { name: /^Foto del tablero: foto 1 de 1/ }).getByRole("button", { name: "Eliminar foto" }).click();
  await page.keyboard.press("Escape");
  await tablero.getByRole("checkbox", { name: "Ubicación del tablero: no se pudo obtener" }).locator("xpath=ancestor::label").click();
  await expect(page.getByText("Marcado como no obtenido: Ubicación del tablero")).toBeVisible();

  await quitarTablero(page, "Tablero 1");
  // Tres notificaciones con «Deshacer»: las de la foto y la marca siguen a la vista y se tocan después de quitar.
  const avisos = page.getByRole("status");
  await avisos.locator("div", { hasText: "Foto eliminada" }).getByRole("button", { name: "Deshacer" }).click();
  await avisos.locator("div", { hasText: "Marcado como no obtenido" }).getByRole("button", { name: "Deshacer" }).click();
  await expect(tableros.getByRole("button", { name: /^Tablero/ })).toHaveCount(0);
  await enviarSinPendientes(page);
});

test("quitar un tablero mientras su foto todavía se procesa no deja el envío bloqueado", async ({ page }) => {
  // Un teléfono lento: decodificar la foto tarda 3 s.
  await page.addInitScript(() => {
    const original = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = function () {
      return new Promise((r) => setTimeout(r, 3000)).then(() => original.call(this));
    };
  });
  const { tableros } = await iniciarConCuartoTecnico(page);
  await tableros.getByRole("button", { name: "Agregar tablero" }).click();
  const tablero = page.getByRole("article", { name: "Tablero 1" });
  await tablero.getByRole("textbox", { name: "Ubicación del tablero" }).fill("Sótano");
  await tablero.locator("input[type=file]").first().setInputFiles({ name: "t.png", mimeType: "image/png", buffer: fotoDePrueba() });
  await quitarTablero(page, "Tablero 1");
  // La foto termina de procesarse con el tablero ya quitado.
  await page.waitForTimeout(4000);
  await expect(tableros.getByRole("button", { name: /^Tablero/ })).toHaveCount(0);
  await enviarSinPendientes(page);
});

test("«Deshacer» de una foto obligatoria quita su aviso de lo que falta", async ({ page }) => {
  await iniciarConCuartoTecnico(page);
  await irAlPaso(page, "Cuarto técnico");
  await page.getByRole("button", { name: "Foto 1 de Fotos del equipo" }).click();
  await page.getByRole("dialog", { name: /^Fotos del equipo: foto 1 de 1/ }).getByRole("button", { name: "Eliminar foto" }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Siguiente: tableros" }).click();
  await expect(page.getByRole("dialog", { name: /Falta 1 dato en cuarto técnico/ })).toBeVisible();
  await page.getByRole("button", { name: "Deshacer" }).click();
  await page.getByRole("button", { name: "Seguir y completar después" }).click();
  await enviarSinPendientes(page);
});

test("volver a un paso muestra lo guardado, y agregar un material conserva los anteriores", async ({ page }) => {
  await iniciarConCuartoTecnico(page);
  await irAlPaso(page, "Cuarto técnico");
  await page.getByRole("textbox", { name: "Descripción del sitio" }).fill("Cuarto norte");
  await irAlPaso(page, "Materiales");
  const lineaLibre = page.getByRole("button", { name: /agregar línea libre$/i });
  await lineaLibre.click();
  await page.getByRole("textbox", { name: "Descripción de la línea 1" }).fill("Cable 12 AWG");
  await lineaLibre.click();
  await page.getByRole("textbox", { name: "Descripción de la línea 2" }).fill("Breaker 20 A");

  // Ida y vuelta por el recorrido, sin cerrar el borrador.
  await irAlPaso(page, "Cuarto técnico");
  await expect(page.getByRole("textbox", { name: "Potencia nominal" })).toHaveValue("15");
  await expect(page.getByRole("textbox", { name: "Descripción del sitio" })).toHaveValue("Cuarto norte");
  await irAlPaso(page, "Materiales");
  await expect(page.getByRole("textbox", { name: "Descripción de la línea 2" })).toHaveValue("Breaker 20 A");
  await lineaLibre.click();
  await page.getByRole("textbox", { name: "Descripción de la línea 3" }).fill("Tubo EMT");
  await irARevisar(page);
  await expect(page.getByRole("button", { name: "Editar Materiales" })).toContainText("Cable 12 AWG × 1 · Breaker 20 A × 1 · 1 más");
});

test("«Deshacer» de un material quitado lo devuelve a su lugar sin borrar lo agregado después", async ({ page }) => {
  await iniciarConCuartoTecnico(page);
  await irAlPaso(page, "Materiales");
  const lineaLibre = page.getByRole("button", { name: /agregar línea libre$/i });
  await lineaLibre.click();
  await page.getByRole("textbox", { name: "Descripción de la línea 1" }).fill("Cable 12 AWG");
  await lineaLibre.click();
  await page.getByRole("textbox", { name: "Descripción de la línea 2" }).fill("Breaker 20 A");
  // Bajar a cero quita el primero; antes de deshacer, se agrega otro.
  await page.getByRole("button", { name: "Menos de la línea 1" }).click();
  await expect(page.getByRole("group", { name: /^Línea \d+$/ })).toHaveCount(1);
  await lineaLibre.click();
  await page.getByRole("textbox", { name: "Descripción de la línea 2" }).fill("Tubo EMT");
  await page.getByRole("button", { name: "Deshacer" }).dblclick();
  await expect(page.getByRole("group", { name: /^Línea \d+$/ })).toHaveCount(3);
  await expect(page.getByRole("textbox", { name: "Descripción de la línea 1" })).toHaveValue("Cable 12 AWG");
  await expect(page.getByRole("textbox", { name: "Descripción de la línea 3" })).toHaveValue("Tubo EMT");
});

test("un envío que oficina rechazó para siempre vuelve a borrador, se corrige y se envía (ADR-0045)", async ({ page }) => {
  await iniciarConCuartoTecnico(page);
  await irAlPaso(page, "Cuarto técnico");
  await page.getByRole("textbox", { name: "Descripción del sitio" }).fill("Antes de corregir");
  // El servidor lo rechaza con un error que reintentar solo no arregla (ADR-0003).
  await page.route("**/api/sync/comandos", (ruta) => ruta.fulfill({ status: 409, body: "" }));
  await irARevisar(page);
  await page.getByRole("button", { name: "Enviar a oficina" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Enviar levantamiento" }).click();
  await expect(page.getByText("No se pudo enviar", { exact: true })).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "Volver a borrador para corregir" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Volver a borrador" }).click();
  await page.unroute("**/api/sync/comandos");
  await irAlPaso(page, "Cuarto técnico");
  await page.getByRole("textbox", { name: "Descripción del sitio" }).fill("Corregido");
  await enviarSinPendientes(page);
});

test("«Ver en Descartados» abre la papelera una sola vez, no cada vez que se vuelve al inicio", async ({ page }) => {
  const { cliente } = await iniciarConCuartoTecnico(page);
  await irAlRecorrido(page);
  await page.getByRole("button", { name: "Descartar levantamiento" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Descartar", exact: true }).click();
  const siguiente = page.getByRole("region", { name: "Siguiente visita" });
  await expect(siguiente.getByText(cliente)).toBeVisible();
  await page.getByRole("button", { name: "Ver en Descartados" }).click();
  const papelera = page.getByRole("dialog", { name: "Descartados" });
  await expect(papelera).toBeVisible();
  await papelera.getByRole("button", { name: "Cerrar" }).click();
  await expect(papelera).toHaveCount(0);

  // Abrir otro levantamiento y volver: el inicio no abre la papelera solo.
  await siguiente.getByRole("button", { name: "Iniciar levantamiento" }).click();
  await irAlRecorrido(page);
  await page.getByRole("button", { name: "Volver a mis visitas" }).first().click();
  await expect(siguiente.getByRole("button", { name: "Continuar levantamiento" })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(papelera).toHaveCount(0);
});
