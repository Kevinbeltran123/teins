import { expect, test } from "@playwright/test";
import { nuevaVisitaConCliente, nuevoUsuario } from "../consola";
import { CAMPO, OFICINA } from "../destino";
import { abrirCroquis, arrastrar, filaDeLaBandeja, fotoDePrueba, iniciarSesion, irAlPaso, irARevisar, verLoEnviado } from "./ayudas";

test("bocetos: el técnico dibuja un trazo, una línea enderezada y texto, deshace y rehace, envía; oficina ve el croquis (iteraciones 10 y 18)", async ({ page, browser }) => {
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

  // El editor, a pantalla completa.
  // El croquis es su propio paso: abre el editor directamente (rediseño Recorrido).
  await abrirCroquis(page);
  const editor = page.getByRole("dialog", { name: "Boceto: Croquis del cuarto" });
  const hoja = editor.getByRole("img", { name: "Croquis del cuarto" });
  await arrastrar(page, [[0.1, 0.2], [0.2, 0.35], [0.3, 0.3], [0.4, 0.5]]);
  // Una línea a mano, con el dedo quieto al terminar, queda recta (ADR-0026).
  await arrastrar(page, [[0.1, 0.8], [0.5, 0.81], [0.9, 0.8]], { quieto: 700 });
  await expect(hoja.locator("line")).toHaveCount(1);
  await editor.getByRole("button", { name: "Texto" }).click();
  await arrastrar(page, [[0.5, 0.6], [0.5, 0.6]]);
  const texto = page.getByRole("dialog", { name: "Poner texto" });
  await texto.getByRole("textbox", { name: "Texto del boceto" }).fill("Tablero");
  await texto.getByRole("button", { name: "Poner texto" }).click();
  await expect(hoja.getByText("Tablero")).toBeVisible();

  await editor.getByRole("button", { name: "Deshacer" }).click();
  await expect(hoja.getByText("Tablero")).toHaveCount(0);
  await editor.getByRole("button", { name: "Rehacer" }).click();
  await expect(hoja.getByText("Tablero")).toBeVisible();
  await expect(editor.getByText("Guardado en este teléfono")).toBeAttached();
  await editor.getByRole("button", { name: "Volver a la captura" }).click();

  // El boceto sube al enviar; lo enviado lo muestra en miniatura.
  await irARevisar(page);
  await page.getByRole("button", { name: "Enviar a oficina" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Enviar levantamiento" }).click();
  await expect(page.getByText("Recibido en oficina")).toBeVisible({ timeout: 60_000 });
  await verLoEnviado(page);
  await expect(page.getByRole("img", { name: "Boceto de croquis del cuarto" }).getByText("Tablero")).toBeVisible();

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
