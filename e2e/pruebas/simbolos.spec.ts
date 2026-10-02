import { expect, test } from "@playwright/test";
import { nuevaVisitaConCliente, nuevoUsuario } from "../consola";
import { CAMPO, OFICINA } from "../destino";
import { abrirCroquis, filaDeLaBandeja, fotoDePrueba, iniciarSesion, irAlPaso, irARevisar, verLoEnviado } from "./ayudas";

/**
 * Símbolos (iteración 19, ADR-0027). La biblioteca de prueba la publica `sembrar` en la organización de
 * desarrollo (en el entorno de pruebas, `publicar-simbolos` con `simbolos-prueba.json`).
 */
test("símbolos: el técnico busca y pone una UPS, la duplica, la ve en recientes; oficina y el PDF la dibujan (iteración 19)", async ({ page, browser }) => {
  const tecnico = nuevoUsuario("tecnico", "tecnico.e2e");
  const revisora = nuevoUsuario("oficina", "oficina");
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

  await abrirCroquis(page);
  const editor = page.getByRole("dialog", { name: "Boceto: Croquis del cuarto" });
  const hoja = editor.getByRole("img", { name: "Croquis del cuarto" });

  // La biblioteca: por categoría y con buscador.
  await editor.getByRole("button", { name: "Símbolos" }).click();
  let biblioteca = page.getByRole("dialog", { name: "Símbolos" });
  await expect(biblioteca.getByRole("region", { name: "Energía" }).getByRole("button", { name: "Tablero" })).toBeVisible();
  await biblioteca.getByRole("searchbox", { name: "Buscar símbolo" }).fill("ups");
  await biblioteca.getByRole("button", { name: "UPS" }).click();
  await expect(biblioteca).toHaveCount(0);

  // Cae elegido, con "Mover": se duplica ahí mismo.
  await expect(hoja.getByText("UPS")).toHaveCount(1);
  await expect(editor.getByRole("button", { name: "Mover" })).toHaveAttribute("aria-pressed", "true");
  await editor.getByRole("toolbar", { name: "Elemento elegido" }).getByRole("button", { name: "Duplicar" }).click();
  await expect(hoja.getByText("UPS")).toHaveCount(2);

  // La próxima vez, en los recientes.
  await editor.getByRole("button", { name: "Símbolos" }).click();
  biblioteca = page.getByRole("dialog", { name: "Símbolos" });
  await expect(biblioteca.getByRole("region", { name: "Recientes" }).getByRole("button", { name: "UPS" })).toBeVisible();
  await biblioteca.getByRole("button", { name: "Cerrar" }).click();
  await editor.getByRole("button", { name: "Volver a la captura" }).click();

  // El worker lo verifica al enviar; oficina lo dibuja y el PDF se genera con él.
  await irARevisar(page);
  await page.getByRole("button", { name: "Enviar a oficina" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Enviar levantamiento" }).click();
  await expect(page.getByText("Recibido en oficina")).toBeVisible({ timeout: 60_000 });
  await verLoEnviado(page);
  await expect(page.getByRole("img", { name: "Boceto de croquis del cuarto" }).getByText("UPS")).toHaveCount(2);

  const escritorio = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "es-CO" });
  const o = await escritorio.newPage();
  await o.goto(`${OFICINA}/`);
  await iniciarSesion(o, revisora);
  await (await filaDeLaBandeja(o, tecnico.nombre)).getByRole("link").click();
  await expect(o.getByRole("img", { name: "Boceto de croquis del cuarto" }).getByText("UPS")).toHaveCount(2);
  await o.getByRole("button", { name: "Tomar para revisar" }).click();
  await o.getByRole("button", { name: "Marcar revisado" }).click();
  await o.getByRole("dialog").getByRole("button", { name: "Marcar revisado" }).click();
  await o.getByRole("button", { name: "Abrir el informe de la visita" }).click();
  await o.getByRole("checkbox", { name: new RegExp(`de ${tecnico.nombre}`) }).check();
  await o.getByRole("button", { name: "Publicar versión 1" }).click();
  await o.getByRole("dialog").getByRole("button", { name: "Publicar versión 1" }).click();
  await expect(o.getByRole("button", { name: "Descargar PDF de la versión 1" })).toBeVisible({ timeout: 60_000 });
  await escritorio.close();
});
