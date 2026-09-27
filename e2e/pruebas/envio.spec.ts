import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { CAMPO, OFICINA } from "../destino";
import { filaDeLaBandeja, fotoDePrueba, iniciarSesion, irARevisar } from "./ayudas";

const usuarios = () =>
  JSON.parse(readFileSync("test-results/usuarios.json", "utf8")) as Record<"tecnico" | "oficina", { usuario: string; nombre: string; contrasena: string }> & {
    cliente: string;
  };

test("un levantamiento capturado sin conexión llega completo a la bandeja de oficina", async ({ page, context, browser, browserName }) => {
  const { tecnico, oficina, cliente } = usuarios();
  page.on("console", (m) => {
    if (m.type() === "error") console.log(`[${browserName}] consola:`, m.text());
  });

  // Campo: primera instalación con conexión; baja la visita asignada y los formatos.
  await page.goto(`${CAMPO}/`);
  await iniciarSesion(page, tecnico);
  await expect(page.getByRole("heading", { name: /^Hola, / })).toBeVisible();
  const visita = page.getByRole("region", { name: "Siguiente visita" });
  await expect(visita.getByText(cliente)).toBeVisible();
  await expect(visita.getByText("Hoy")).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);

  // Sin señal. En Chromium se corta desde el inicio y se recarga, para probar que el service worker
  // sirve la app y que se captura todo sin red. La emulación sin red de WebKit en Playwright también
  // bloquea las URL blob: locales (no así Safari real, validado en iPhone en modo avión, corte 0), así
  // que en WebKit la red se corta después de la foto y antes de enviar (ADR-0002, ADR-0018).
  const capturaCompletaSinRed = browserName === "chromium";
  if (capturaCompletaSinRed) {
    await context.setOffline(true);
    await page.reload();
    await expect(visita.getByText(cliente)).toBeVisible();
  }
  await visita.getByRole("button", { name: "Iniciar levantamiento" }).click();
  // Con datos faltantes, "Enviar a oficina" muestra el resumen directamente: no hay nada que confirmar.
  await irARevisar(page);
  await page.getByRole("button", { name: "Enviar a oficina" }).click();
  await expect(page.getByRole("region", { name: "Faltan 2 datos por completar" })).toBeVisible();
  // El resumen lleva al dato: abre su paso.
  await page.getByRole("region", { name: "Faltan 2 datos por completar" }).getByRole("button", { name: /Potencia nominal/ }).click();

  await page.getByRole("textbox", { name: "Potencia nominal" }).fill("12,5");
  await page.getByRole("textbox", { name: "Descripción del sitio" }).fill("Cuarto de prueba E2E");
  await page.locator("input[type=file]").first().setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: fotoDePrueba() });
  await expect(page.getByRole("img", { name: "Foto 1 de Fotos del equipo" })).toBeVisible();
  if (!capturaCompletaSinRed) await context.setOffline(true);
  await irARevisar(page);
  await page.getByRole("button", { name: "Enviar a oficina" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Enviar levantamiento" }).click();
  await expect(page.getByText("Sin conexión: se enviará al recuperar señal")).toBeVisible();

  // Vuelve la señal: el envío sale solo.
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByText("Recibido en oficina")).toBeVisible({ timeout: 30_000 });
  // En la lista, el estado que dio el servidor en la bajada.
  await page.getByRole("button", { name: "Volver a mis visitas" }).click();
  await expect(page.getByRole("region", { name: "Enviados" }).getByText("Recibido en oficina")).toBeVisible();

  // Oficina, en su propio navegador de escritorio.
  const escritorio = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "es-CO" });
  const bandeja = await escritorio.newPage();
  await bandeja.goto(`${OFICINA}/`);
  await iniciarSesion(bandeja, oficina);
  await expect(bandeja.getByRole("heading", { name: "Esperando revisión" })).toBeVisible();
  const fila = (await filaDeLaBandeja(bandeja, tecnico.nombre)).last();
  // La bandeja dice de qué cliente y sitio es, sin abrirlo (iteración 14).
  await expect(fila).toContainText(cliente);
  await expect(fila).toContainText("Sede E2E");
  await fila.getByRole("link").click();

  await expect(bandeja.getByRole("heading", { name: `Levantamiento de ${tecnico.nombre}` })).toBeVisible();
  await expect(bandeja.getByText("12,5 kVA")).toBeVisible();
  // La visita viaja con el envío desde campo.
  await expect(bandeja.getByText(`${cliente} · Sede E2E`)).toBeVisible();
  await expect(bandeja.getByText("Cuarto de prueba E2E")).toBeVisible();
  const foto = bandeja.getByRole("img", { name: "Foto 1 de Fotos del equipo" });
  await expect(foto).toBeVisible();
  // La foto llegó recodificada: JPEG real, con su tamaño, servido por URL firmada.
  await expect.poll(() => foto.evaluate((img: HTMLImageElement) => (img.complete ? img.naturalWidth : 0))).toBe(640);
  await escritorio.close();
});
