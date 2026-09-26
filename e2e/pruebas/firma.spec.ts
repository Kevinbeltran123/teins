import { expect, test, type Page } from "@playwright/test";
import { nuevaVisitaConCliente, nuevoUsuario } from "../consola";
import { CAMPO, OFICINA } from "../destino";
import { filaDeLaBandeja, fotoDePrueba, iniciarSesion } from "./ayudas";

/** Firma sobre el recuadro, en proporciones de su tamaño (0 a 1). */
async function firmar(page: Page, puntos: [number, number][]) {
  // En un teléfono chico el recuadro queda más abajo: se desplaza hasta él, como lo haría la persona.
  const recuadro = page.getByLabel("Espacio para firmar con el dedo");
  await recuadro.scrollIntoViewIfNeeded();
  const caja = (await recuadro.boundingBox())!;
  const en = ([x, y]: [number, number]) => [caja.x + x * caja.width, caja.y + y * caja.height] as const;
  await page.mouse.move(...en(puntos[0]!));
  await page.mouse.down();
  for (const p of puntos.slice(1)) await page.mouse.move(...en(p), { steps: 5 });
  await page.mouse.up();
}

test("firma del cliente: quien recibe la visita firma la constancia en el teléfono; oficina la ve y no la corrige (iteración 16)", async ({ page, browser }) => {
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

  // La constancia se llena con el técnico, el cliente, el sitio y el día.
  await page.getByRole("button", { name: "Pedir la firma" }).click();
  const hoja = page.getByRole("dialog", { name: "Constancia de visita" });
  await expect(hoja.getByText(`Confirmo que ${tecnico.nombre}, de TEINS, visitó ${cliente} · Sede E2E el`)).toBeVisible();
  // Sin nombre ni firma, dice qué falta.
  await hoja.getByRole("button", { name: "Firmar" }).click();
  await expect(hoja.getByText("Escriba su nombre.")).toBeVisible();
  await expect(hoja.getByText("Firme en el recuadro.")).toBeVisible();
  await hoja.getByRole("textbox", { name: "Nombre de quien firma" }).fill("Martha Gómez");
  await hoja.getByRole("textbox", { name: "Cargo (opcional)" }).fill("Jefe de mantenimiento");
  await firmar(page, [[0.1, 0.7], [0.25, 0.5], [0.45, 0.75], [0.65, 0.55], [0.9, 0.7]]);
  await hoja.getByRole("button", { name: "Firmar" }).click();
  await expect(hoja).toHaveCount(0);
  await expect(page.getByRole("img", { name: "Firma de Martha Gómez" })).toBeVisible();
  await expect(page.getByText("Martha Gómez · Jefe de mantenimiento")).toBeVisible();

  // Volver a firmar pide confirmar; cancelar deja la firma.
  await page.getByRole("button", { name: "Volver a firmar" }).click();
  await page.getByRole("dialog", { name: "¿Volver a firmar?" }).getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByRole("img", { name: "Firma de Martha Gómez" })).toBeVisible();

  // Los trazos suben al enviar, como un boceto.
  await page.getByRole("button", { name: "Enviar a oficina" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Enviar levantamiento" }).click();
  await expect(page.getByText("Recibido en oficina")).toBeVisible({ timeout: 60_000 });

  // Oficina ve la firma, quién y cuándo, y puede comentarla pero no corregirla.
  const escritorio = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "es-CO" });
  const o = await escritorio.newPage();
  await o.goto(`${OFICINA}/`);
  await iniciarSesion(o, revisora);
  await (await filaDeLaBandeja(o, tecnico.nombre)).getByRole("link").click();
  await expect(o.getByRole("img", { name: "Firma de Martha Gómez" })).toBeVisible();
  await expect(o.getByText("Martha Gómez · Jefe de mantenimiento")).toBeVisible();
  await expect(o.getByText(`en el teléfono de ${tecnico.nombre}`)).toBeVisible();
  await o.getByRole("button", { name: "Tomar para revisar" }).click();
  await expect(o.getByRole("button", { name: "Comentar firma de quien recibe la visita" })).toBeVisible();
  await expect(o.getByRole("button", { name: "Corregir firma de quien recibe la visita" })).toHaveCount(0);
  await escritorio.close();
});
