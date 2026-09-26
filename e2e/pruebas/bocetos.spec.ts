import { expect, test, type Page } from "@playwright/test";
import { nuevaVisitaConCliente, nuevoUsuario } from "../consola";
import { CAMPO, OFICINA } from "../destino";
import { filaDeLaBandeja, fotoDePrueba, iniciarSesion } from "./ayudas";

/** Arrastra sobre el lienzo, en proporciones de su tamaño (0 a 1). */
async function arrastrar(page: Page, puntos: [number, number][]) {
  const caja = (await page.getByLabel("Lienzo del boceto").boundingBox())!;
  const en = ([x, y]: [number, number]) => [caja.x + x * caja.width, caja.y + y * caja.height] as const;
  await page.mouse.move(...en(puntos[0]!));
  await page.mouse.down();
  for (const p of puntos.slice(1)) await page.mouse.move(...en(p), { steps: 5 });
  await page.mouse.up();
}

test("bocetos: el técnico dibuja trazo, línea y texto, deshace y rehace, envía; oficina ve el croquis (iteración 10)", async ({ page, browser }) => {
  const tecnico = nuevoUsuario("tecnico", "tecnico.e2e");
  const revisora = nuevoUsuario("oficina", "oficina");
  const { cliente } = nuevaVisitaConCliente(tecnico);

  await page.goto(`${CAMPO}/`);
  await iniciarSesion(page, tecnico);
  const visita = page.getByRole("region", { name: "Siguiente visita" });
  await expect(visita.getByText(cliente)).toBeVisible();
  await visita.getByRole("button", { name: "Iniciar levantamiento" }).click();
  await page.getByRole("textbox", { name: "Potencia nominal" }).fill("15");
  await page.locator("input[type=file]").first().setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: fotoDePrueba() });
  await expect(page.getByRole("img", { name: "Foto 1 de Fotos del equipo" })).toBeVisible();

  // El editor, a pantalla completa.
  await page.getByRole("button", { name: "Dibujar boceto" }).click();
  const editor = page.getByRole("dialog", { name: "Boceto: Croquis del cuarto" });
  const hoja = editor.getByRole("img", { name: "Croquis del cuarto" });
  await arrastrar(page, [[0.1, 0.2], [0.2, 0.35], [0.3, 0.3], [0.4, 0.5]]);
  await editor.getByRole("radio", { name: "Línea" }).check();
  await arrastrar(page, [[0.1, 0.8], [0.9, 0.8]]);
  await expect(hoja.locator("line")).toHaveCount(1);
  await editor.getByRole("radio", { name: "Texto" }).check();
  await arrastrar(page, [[0.5, 0.6], [0.5, 0.6]]);
  await editor.getByRole("textbox", { name: "Texto del boceto" }).fill("Tablero");
  await editor.getByRole("button", { name: "Poner texto" }).click();
  await expect(hoja.getByText("Tablero")).toBeVisible();

  await editor.getByRole("button", { name: "Deshacer" }).click();
  await expect(hoja.getByText("Tablero")).toHaveCount(0);
  await editor.getByRole("button", { name: "Rehacer" }).click();
  await expect(hoja.getByText("Tablero")).toBeVisible();
  await expect(editor.getByText("Guardado en este teléfono")).toBeVisible();
  await editor.getByRole("button", { name: "Listo" }).click();

  // La miniatura en el formulario, y el boceto sube al enviar.
  const miniatura = page.getByRole("img", { name: "Boceto de croquis del cuarto" });
  await expect(miniatura.getByText("Tablero")).toBeVisible();
  await expect(page.getByRole("button", { name: "Editar boceto" })).toBeVisible();
  await page.getByRole("button", { name: "Enviar a oficina" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Enviar levantamiento" }).click();
  await expect(page.getByText("Recibido en oficina")).toBeVisible({ timeout: 60_000 });

  // Oficina lo ve, sin poder corregirlo.
  const escritorio = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "es-CO" });
  const o = await escritorio.newPage();
  await o.goto(`${OFICINA}/`);
  await iniciarSesion(o, revisora);
  await (await filaDeLaBandeja(o, tecnico.nombre)).getByRole("link").click();
  const croquis = o.getByRole("img", { name: "Boceto de croquis del cuarto" });
  await expect(croquis.getByText("Tablero")).toBeVisible();
  await expect(croquis.locator("line")).toHaveCount(1);
  await o.getByRole("button", { name: "Tomar para revisar" }).click();
  await expect(o.getByRole("button", { name: "Corregir croquis del cuarto" })).toHaveCount(0);

  // El PDF se genera con el boceto leído del almacenamiento (worker).
  await o.getByRole("button", { name: "Marcar revisado" }).click();
  await o.getByRole("dialog").getByRole("button", { name: "Marcar revisado" }).click();
  await o.getByRole("button", { name: "Abrir el informe de esta visita" }).click();
  await o.getByRole("checkbox", { name: new RegExp(`de ${tecnico.nombre}`) }).check();
  await o.getByRole("button", { name: "Publicar versión 1" }).click();
  await o.getByRole("dialog").getByRole("button", { name: "Publicar versión 1" }).click();
  await expect(o.getByRole("button", { name: "Descargar PDF de la versión 1" })).toBeVisible({ timeout: 60_000 });
  await escritorio.close();
});
