import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { expect, test, type Page } from "@playwright/test";

const usuarios = () =>
  JSON.parse(readFileSync("test-results/usuarios.json", "utf8")) as Record<"tecnico" | "oficina", { usuario: string; nombre: string; contrasena: string }>;

/** Imagen de prueba (ficticia, R5): la app la recodifica a JPEG como una foto de la cámara. */
function fotoDePrueba(): Buffer {
  const [ancho, alto] = [640, 480];
  const fila = (y: number) => Buffer.concat([Buffer.from([0]), Buffer.alloc(ancho * 3, y % 2 ? 90 : 200)]);
  const datos = deflateSync(Buffer.concat(Array.from({ length: alto }, (_, y) => fila(y))));
  const trozo = (tipo: string, contenido: Buffer) => {
    const largo = Buffer.alloc(4);
    largo.writeUInt32BE(contenido.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(tipo), contenido])));
    return Buffer.concat([largo, Buffer.from(tipo), contenido, crc]);
  };
  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(ancho, 0);
  cabecera.writeUInt32BE(alto, 4);
  cabecera.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), trozo("IHDR", cabecera), trozo("IDAT", datos), trozo("IEND", Buffer.alloc(0))]);
}

function crc32(b: Buffer): number {
  let c = ~0;
  for (const byte of b) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

async function iniciarSesion(page: Page, u: { usuario: string; contrasena: string }) {
  await page.getByLabel("Usuario").fill(u.usuario);
  await page.getByLabel("Contraseña").fill(u.contrasena);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
}

test("un levantamiento capturado sin conexión llega completo a la bandeja de oficina", async ({ page, context, browser, browserName }) => {
  const { tecnico, oficina } = usuarios();
  page.on("console", (m) => {
    if (m.type() === "error") console.log(`[${browserName}] consola:`, m.text());
  });

  // Campo: primera instalación con conexión.
  await page.goto("http://localhost:5173/");
  await iniciarSesion(page, tecnico);
  await expect(page.getByRole("heading", { name: "Levantamientos" })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);

  // Sin señal. En Chromium se corta desde el inicio y se recarga, para probar que el service worker
  // sirve la app y que se captura todo sin red. La emulación sin red de WebKit en Playwright también
  // bloquea las URL blob: locales (no así Safari real, validado en iPhone en modo avión, corte 0), así
  // que en WebKit la red se corta después de la foto y antes de enviar (ADR-0002, ADR-0018).
  const capturaCompletaSinRed = browserName === "chromium";
  if (capturaCompletaSinRed) {
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Levantamientos" })).toBeVisible();
  }
  await page.getByRole("button", { name: "Nuevo levantamiento" }).click();
  await page.getByRole("button", { name: "Enviar a oficina" }).click();
  await page.getByRole("button", { name: "Confirmar envío" }).click();
  await expect(page.getByText("Faltan 2 datos por completar.", { exact: false })).toBeVisible();

  await page.getByRole("textbox", { name: "Potencia nominal" }).fill("12,5");
  await page.getByRole("textbox", { name: "Descripción del sitio" }).fill("Cuarto de prueba E2E");
  await page.locator("input[type=file]").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: fotoDePrueba() });
  await expect(page.getByRole("img", { name: "Foto 1 de Fotos del equipo" })).toBeVisible();
  if (!capturaCompletaSinRed) await context.setOffline(true);
  await page.getByRole("button", { name: "Enviar a oficina" }).click();
  await page.getByRole("button", { name: "Confirmar envío" }).click();
  await expect(page.getByText("Sin conexión: se enviará al recuperar señal")).toBeVisible();

  // Vuelve la señal: el envío sale solo.
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByText("Recibido en oficina")).toBeVisible({ timeout: 30_000 });

  // Oficina, en su propio navegador de escritorio.
  const escritorio = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "es-CO" });
  const bandeja = await escritorio.newPage();
  await bandeja.goto("http://localhost:5174/");
  await iniciarSesion(bandeja, oficina);
  await expect(bandeja.getByRole("heading", { name: "Esperando revisión" })).toBeVisible();
  const fila = bandeja.getByRole("row").filter({ hasText: tecnico.nombre }).last();
  await fila.getByRole("link").click();

  await expect(bandeja.getByRole("heading", { name: `Levantamiento de ${tecnico.nombre}` })).toBeVisible();
  await expect(bandeja.getByText("12,5 kVA")).toBeVisible();
  await expect(bandeja.getByText("Cuarto de prueba E2E")).toBeVisible();
  const foto = bandeja.getByRole("img", { name: "Foto 1 de Fotos del equipo" });
  await expect(foto).toBeVisible();
  // La foto llegó recodificada: JPEG real, con su tamaño, servido por URL firmada.
  await expect.poll(() => foto.evaluate((img: HTMLImageElement) => (img.complete ? img.naturalWidth : 0))).toBe(640);
  await escritorio.close();
});
