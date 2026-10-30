import { expect, test, type Page } from "@playwright/test";
import { nuevaVisita, nuevoUsuario } from "../consola";
import { CAMPO } from "../destino";
import { fotoDePrueba, iniciarSesion, irAlPaso, irARevisar, verLoEnviado } from "./ayudas";

/*
  Lo nuevo de la iteración 47 en el teléfono: la foto de llegada con su franja (ADR-0052) y los controles de selección,
  horario y tabla de medidas (ADR-0050), sobre el formato de prueba v10.
*/

async function empezar(page: Page) {
  const tecnico = nuevoUsuario("tecnico", "tecnico.e2e");
  const cliente = nuevaVisita(tecnico);
  await page.goto(`${CAMPO}/`);
  await iniciarSesion(page, tecnico);
  const visita = page.getByRole("region", { name: "Siguiente visita" });
  await expect(visita.getByText(cliente)).toBeVisible();
  await visita.getByRole("button", { name: "Iniciar levantamiento" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Llegada" })).toBeVisible();
  return { tecnico, cliente };
}

const tomarFoto = (page: Page) => page.locator("input[type=file]").first().setInputFiles({ name: "llegada.png", mimeType: "image/png", buffer: fotoDePrueba() });

test.describe("con permiso de ubicación", () => {
  test.use({ permissions: ["geolocation"], geolocation: { latitude: 4.20127, longitude: -74.63613, accuracy: 12 } });

  test("la foto de llegada dice que la ubicación está lista, pide la hora de red y el mapa, y se guarda (ADR-0052)", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "La ubicación simulada se comprueba en Chromium; el iPhone, en la fase manual.");
    await empezar(page);
    await expect(page.getByText("Ubicación lista (±12 m)")).toBeVisible({ timeout: 15_000 });
    // Con señal, la foto pide la hora al servidor y el mapa; sin llave de mapas en este entorno, el mapa responde «no disponible»
    // y la foto sale sin él: nunca se bloquea.
    const hora = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/hora");
    const mapa = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/mapa");
    await tomarFoto(page);
    expect((await hora).status()).toBe(200);
    expect([200, 503]).toContain((await mapa).status());
    await expect(page.getByRole("img", { name: "Foto 1 de Fotos de llegada" })).toBeVisible({ timeout: 15_000 });
  });
});

test("sin permiso de ubicación, la foto de llegada se guarda y la línea lo dice", async ({ page }) => {
  await empezar(page);
  await expect(page.getByText("Sin permiso de ubicación: la foto sale sin coordenadas")).toBeVisible({ timeout: 15_000 });
  await tomarFoto(page);
  await expect(page.getByRole("img", { name: "Foto 1 de Fotos de llegada" })).toBeVisible({ timeout: 15_000 });
});

test("selección, horario y tabla de medidas se capturan, se guardan al salir y se ven en lo enviado (ADR-0050)", async ({ page }) => {
  test.setTimeout(150_000);
  await empezar(page);

  await irAlPaso(page, "Servicio");
  // Horario: llegada y salida, con el total debajo. La salida espera a la llegada.
  await expect(page.getByLabel("Salida", { exact: true })).toBeDisabled();
  await page.getByLabel("Llegada", { exact: true }).fill("08:14");
  await page.getByLabel("Salida", { exact: true }).fill("11:30");
  await expect(page.getByText("3 h 16 min")).toBeVisible();
  // Selección múltiple, con «Otro».
  const sistemas = page.getByRole("group", { name: "Sistema revisado" });
  await sistemas.getByText("CCTV", { exact: true }).click();
  await sistemas.getByText("UPS", { exact: true }).click();
  await sistemas.getByText("Otro", { exact: true }).click();
  await page.getByRole("textbox", { name: "Sistema revisado: escribe cuál" }).fill("cerca eléctrica");
  // Selección única: tocar la elegida la quita (el campo es opcional).
  const solucionado = page.getByRole("radiogroup", { name: "Solucionado" });
  await solucionado.getByText("Parcialmente", { exact: true }).click();
  await expect(solucionado.getByRole("radio", { name: "Parcialmente" })).toBeChecked();
  await solucionado.getByText("Totalmente", { exact: true }).click();
  await solucionado.getByText("Totalmente", { exact: true }).click();
  await expect(solucionado.getByRole("radio", { name: "Totalmente" })).not.toBeChecked();
  await solucionado.getByText("Parcialmente", { exact: true }).click();

  // La tabla de medidas: cada casilla es un campo; acepta coma y punto, y rechaza lo que no es un número.
  await irAlPaso(page, "Acometida");
  await page.getByLabel("Voltaje F-N, F1").fill("127,4");
  await page.getByLabel("Voltaje F-N, F2").fill("126.8");
  await page.getByLabel("Frecuencia", { exact: true }).fill("60");
  await page.getByLabel("Voltaje F-N, F3").fill("abc");
  await expect(page.getByText("Escribe solo el número, por ejemplo 12,5")).toBeVisible();
  await page.getByLabel("Voltaje F-N, F3").fill("127");
  await expect(page.getByText("Escribe solo el número, por ejemplo 12,5")).toHaveCount(0);

  // Al volver al paso, todo sigue donde estaba (se guarda al escribirlo).
  await irAlPaso(page, "Servicio");
  await expect(page.getByLabel("Llegada", { exact: true })).toHaveValue("08:14");
  await expect(page.getByLabel("Salida", { exact: true })).toHaveValue("11:30");
  await expect(page.getByRole("group", { name: "Sistema revisado" }).getByRole("checkbox", { name: "CCTV" })).toBeChecked();
  await expect(page.getByRole("textbox", { name: "Sistema revisado: escribe cuál" })).toHaveValue("cerca eléctrica");
  await irAlPaso(page, "Acometida");
  await expect(page.getByLabel("Voltaje F-N, F1")).toHaveValue("127,4");

  // Se envía y lo enviado se lee como lo escribió el técnico.
  await irAlPaso(page, "Cuarto técnico");
  await page.getByRole("textbox", { name: "Potencia nominal" }).fill("12");
  await page.locator("input[type=file]").first().setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: fotoDePrueba() });
  await expect(page.getByRole("img", { name: "Foto 1 de Fotos del equipo" })).toBeVisible();
  await irARevisar(page);
  await page.getByRole("button", { name: "Enviar a oficina" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Enviar levantamiento" }).click();
  await expect(page.getByText("Recibido en oficina")).toBeVisible({ timeout: 30_000 });
  await verLoEnviado(page);
  await expect(page.getByText("8:14 a. m. a 11:30 a. m. · 3 h 16 min")).toBeVisible();
  await expect(page.getByText("CCTV, UPS y otro: cerca eléctrica")).toBeVisible();
  await expect(page.getByText("Parcialmente", { exact: true })).toBeVisible();
});
