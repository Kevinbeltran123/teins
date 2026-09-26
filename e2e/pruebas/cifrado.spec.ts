import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { nuevaVisitaConCliente, nuevoUsuario } from "../consola";
import { CAMPO } from "../destino";
import { fotoDePrueba, iniciarSesion } from "./ayudas";

/** Lo que hay en la base del teléfono tal como está guardado, sin pasar por la app. */
function baseCruda(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolver, fallar) => {
      const pedido = indexedDB.open("teins-campo");
      pedido.onsuccess = () => resolver(pedido.result);
      pedido.onerror = () => fallar(pedido.error);
    });
    const tablas: Record<string, unknown[]> = {};
    for (const nombre of [...db.objectStoreNames]) {
      tablas[nombre] = await new Promise<unknown[]>((resolver) => {
        const pedido = db.transaction(nombre).objectStore(nombre).getAll();
        pedido.onsuccess = () => resolver(pedido.result);
      });
    }
    db.close();
    const texto = JSON.stringify(tablas, (_k, v: unknown) => (v instanceof ArrayBuffer ? new TextDecoder().decode(v) : v));
    const claves = (tablas.claves as { clave: CryptoKey }[]).map((c) => ({ esClave: c.clave instanceof CryptoKey, extraible: c.clave.extractable }));
    const archivos = (tablas.archivos as { iv?: Uint8Array; cifrado?: number }[]).map((a) => ({ conIv: a.iv instanceof Uint8Array, cifrado: a.cifrado }));
    return { texto, claves, archivos };
  });
}

test("cifrado local: lo capturado queda cifrado en el teléfono, se lee al volver a abrir y se envía (iteración 12)", async ({ page }) => {
  const tecnico = nuevoUsuario("tecnico", "tecnico.e2e");
  const { cliente } = nuevaVisitaConCliente(tecnico);
  const secreto = `Tablero ${randomBytes(4).toString("hex")}`;

  await page.goto(`${CAMPO}/`);
  await iniciarSesion(page, tecnico);
  const visita = page.getByRole("region", { name: "Siguiente visita" });
  await expect(visita.getByText(cliente)).toBeVisible();
  await visita.getByRole("button", { name: "Iniciar levantamiento" }).click();
  await page.getByRole("textbox", { name: "Descripción del sitio" }).fill(secreto);
  await page.getByRole("textbox", { name: "Potencia nominal" }).fill("15");
  await page.locator("input[type=file]").first().setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: fotoDePrueba() });
  await expect(page.getByRole("img", { name: "Foto 1 de Fotos del equipo" })).toBeVisible();

  // Ni lo escrito ni el cliente de la visita se leen en la base; la foto va cifrada y la clave no sale.
  await expect.poll(async () => (await baseCruda(page)).archivos).toEqual([{ conIv: true, cifrado: 1 }]);
  const cruda = await baseCruda(page);
  expect(cruda.texto).not.toContain(secreto);
  expect(cruda.texto).not.toContain(cliente);
  expect(cruda.claves).toEqual([{ esClave: true, extraible: false }]);

  // Al volver a abrir la app, todo se lee igual.
  await page.reload();
  await page.getByRole("region", { name: "Siguiente visita" }).getByRole("button", { name: "Continuar levantamiento" }).click();
  await expect(page.getByRole("textbox", { name: "Descripción del sitio" })).toHaveValue(secreto);
  await expect(page.getByRole("img", { name: "Foto 1 de Fotos del equipo" })).toBeVisible();

  // Y se envía: al servidor llegan los datos abiertos y la foto con la huella que la nombra.
  await page.getByRole("button", { name: "Enviar a oficina" }).click();
  await page.getByRole("button", { name: "Confirmar envío" }).click();
  await expect(page.getByText("Recibido en oficina")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(secreto)).toBeVisible();
  expect((await baseCruda(page)).texto).not.toContain(secreto);
});
