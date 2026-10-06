import { expect, test, type Page } from "@playwright/test";
import { nuevaVisitaConCliente, nuevoUsuario } from "../consola";
import { CAMPO, OFICINA } from "../destino";
import { abrirCroquis, arrastrar, filaDeLaBandeja, fotoDePrueba, iniciarSesion, irAlPaso, irARevisar, verLoEnviado } from "./ayudas";

/**
 * Dos dedos que se deslizan a lo ancho de la hoja (solo Chromium: el protocolo de depuración simula el toque
 * con varios dedos; en WebKit se pasa de hoja con el menú).
 */
async function deslizarConDosDedos(page: Page, desde: number, hasta: number) {
  const caja = (await page.getByLabel("Lienzo del boceto").boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const y = caja.y + caja.height / 2;
  const dedos = (x: number) => [
    { x: caja.x + x * caja.width, y, id: 1 },
    { x: caja.x + x * caja.width, y: y + 80, id: 2 },
  ];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: dedos(desde) });
  for (let paso = 1; paso <= 10; paso++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: dedos(desde + ((hasta - desde) * paso) / 10) });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

test("croquis: formas enderezadas, cota, mover y duplicar, y dos hojas con nombre hasta oficina (iteración 18, ADR-0026)", async ({ page, browser, browserName }) => {
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

  // Enderezar: una pared en L y un rectángulo, dibujados a mano, con el dedo quieto al terminar.
  await arrastrar(page, [[0.15, 0.25], [0.15, 0.6], [0.8, 0.6]], { quieto: 700 });
  await expect(hoja.locator("polyline")).toHaveCount(1);
  await arrastrar(page, [[0.25, 0.7], [0.7, 0.7], [0.7, 0.9], [0.25, 0.9], [0.25, 0.705]], { quieto: 700 });
  await expect(hoja.locator("polygon")).toHaveCount(1);

  // La cota se traza y se escribe su medida.
  await editor.getByRole("button", { name: "Cota" }).click();
  await arrastrar(page, [[0.15, 0.15], [0.8, 0.15]]);
  const medida = page.getByRole("dialog", { name: "Medida de la cota" });
  await medida.getByRole("textbox", { name: "Medida" }).fill("5,50 m");
  await medida.getByRole("button", { name: "Poner medida" }).click();
  await expect(hoja.getByText("5,50 m")).toBeVisible();

  // Mover: tocar el rectángulo lo elige; "Duplicar" deja una copia corrida.
  await editor.getByRole("button", { name: "Mover" }).click();
  await arrastrar(page, [[0.45, 0.7], [0.45, 0.7]]);
  await editor.getByRole("toolbar", { name: "Elemento elegido" }).getByRole("button", { name: "Duplicar" }).click();
  await expect(hoja.locator("polygon")).toHaveCount(2);
  await editor.getByRole("button", { name: "Deshacer" }).click();
  await expect(hoja.locator("polygon")).toHaveCount(1);

  // Hojas: la primera se nombra; la segunda se agrega desde el menú y pide su nombre al crearla.
  await editor.getByRole("button", { name: "Hojas: Hoja 1, hoja 1 de 1" }).click();
  await editor.getByRole("menuitem", { name: "Cambiar nombre" }).click();
  let nombre = page.getByRole("dialog", { name: "Nombre de la hoja 1" });
  await nombre.getByRole("textbox", { name: "Nombre" }).fill("Primer piso");
  await nombre.getByRole("button", { name: "Guardar" }).click();
  await editor.getByRole("button", { name: "Hojas: Primer piso, hoja 1 de 1" }).click();
  await editor.getByRole("menuitem", { name: "Agregar hoja" }).click();
  nombre = page.getByRole("dialog", { name: "Nombre de la hoja 2" });
  await expect(nombre.getByRole("button", { name: "Dejar «Hoja 2»" })).toBeVisible();
  await nombre.getByRole("textbox", { name: "Nombre" }).fill("Segundo piso");
  await nombre.getByRole("button", { name: "Guardar" }).click();
  await expect(editor.getByRole("button", { name: "Hojas: Segundo piso, hoja 2 de 2" })).toBeVisible();
  await expect(hoja.locator("polygon")).toHaveCount(0);
  await arrastrar(page, [[0.2, 0.3], [0.5, 0.5], [0.3, 0.7]]);

  // Con dos dedos, de vuelta a la primera.
  if (browserName === "chromium") await deslizarConDosDedos(page, 0.2, 0.8);
  else {
    await editor.getByRole("button", { name: "Hojas: Segundo piso, hoja 2 de 2" }).click();
    await editor.getByRole("menuitemradio", { name: /Primer piso/ }).click();
  }
  await expect(editor.getByRole("button", { name: "Hojas: Primer piso, hoja 1 de 2" })).toBeVisible();
  await expect(hoja.locator("polygon")).toHaveCount(1);
  await editor.getByRole("button", { name: "Volver a la captura" }).click();

  // Volver al paso abre el croquis con sus hojas.
  await abrirCroquis(page);
  await expect(editor.getByRole("button", { name: /^Hojas: .*de 2$/ })).toBeVisible();
  await editor.getByRole("button", { name: "Volver a la captura" }).click();

  await irARevisar(page);
  await page.getByRole("button", { name: "Enviar a oficina" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Enviar levantamiento" }).click();
  await expect(page.getByText("Recibido en oficina")).toBeVisible({ timeout: 60_000 });
  await verLoEnviado(page);
  // Lo enviado muestra cada hoja con su nombre.
  await expect(page.getByRole("img", { name: "Boceto de croquis del cuarto: Primer piso" }).getByText("5,50 m")).toBeVisible();

  // Oficina ve las dos hojas con su nombre, y el PDF se genera con ellas.
  const escritorio = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "es-CO" });
  const o = await escritorio.newPage();
  await o.goto(`${OFICINA}/`);
  await iniciarSesion(o, revisora);
  await (await filaDeLaBandeja(o, tecnico.nombre)).getByRole("link").click();
  await expect(o.getByRole("img", { name: "Boceto de croquis del cuarto: Primer piso" }).getByText("5,50 m")).toBeVisible();
  await expect(o.getByRole("img", { name: "Boceto de croquis del cuarto: Segundo piso" })).toBeVisible();
  await expect(o.getByText("Segundo piso", { exact: true })).toBeVisible();
  await o.getByRole("button", { name: "Tomar para revisar" }).click();
  await o.getByRole("button", { name: "Marcar revisado" }).click();
  await o.getByRole("dialog").getByRole("button", { name: "Marcar revisado" }).click();
  await o.getByRole("button", { name: "Abrir el informe" }).click();
  await o.getByRole("checkbox", { name: new RegExp(`de ${tecnico.nombre}`) }).check();
  await o.getByRole("button", { name: "Publicar versión 1" }).click();
  await o.getByRole("dialog").getByRole("button", { name: "Publicar versión 1" }).click();
  await expect(o.getByRole("button", { name: "Descargar PDF de la versión 1" })).toBeVisible({ timeout: 60_000 });
  await escritorio.close();
});
