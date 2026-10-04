import { expect, test, type Browser, type Page } from "@playwright/test";
import { nuevaVisitaConCliente, nuevoUsuario } from "../consola";
import { OFICINA } from "../destino";
import { guardadoSolo, iniciarSesion, pdfDePrueba } from "./ayudas";

/**
 * Iteración 36 (prototipos/usabilidad-oficina): la vista previa que se oculta, se amplía y cambia de ancho; el menú
 * plegable; lo que oficina recuerda de cada persona; y ordenar arrastrando, con el puntero y con el teclado.
 */

async function oficinaConInforme(browser: Browser) {
  const tecnico = nuevoUsuario("tecnico", "tecnico.e2e");
  const revisora = nuevoUsuario("oficina", "oficina");
  const { cliente, visitaId } = nuevaVisitaConCliente(tecnico);
  const contexto = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "es-CO" });
  const o = await contexto.newPage();
  await o.goto(`${OFICINA}/`);
  await iniciarSesion(o, revisora);
  await expect(o.getByRole("tab", { name: /Esperando revisión/ })).toBeVisible();
  const respuesta = await o.request.post(`${OFICINA}/api/informes`, { data: { visitaId }, headers: { origin: OFICINA } });
  const { id } = (await respuesta.json()) as { id: string };
  await o.goto(`${OFICINA}/informes/${id}`);
  await expect(o.getByRole("heading", { name: `Informe de ${cliente}` })).toBeVisible();
  return { o, id };
}

const hoja = (o: Page) => o.getByRole("region", { name: "Vista previa" });

test("la vista previa se oculta, se amplía y cambia de ancho; se recuerda en el equipo", async ({ browser }) => {
  const { o, id } = await oficinaConInforme(browser);

  // El divisor: arrastrarlo a la izquierda ensancha la hoja; se recuerda al volver.
  const antes = (await hoja(o).boundingBox())!.width;
  const divisor = o.getByRole("separator", { name: "Ancho de la vista previa" });
  const d = (await divisor.boundingBox())!;
  await o.mouse.move(d.x + d.width / 2, d.y + 200);
  await o.mouse.down();
  await o.mouse.move(d.x - 150, d.y + 200, { steps: 6 });
  await o.mouse.up();
  // La hoja crece hasta donde el editor conserva sus 520 px.
  await expect.poll(async () => (await hoja(o).boundingBox())!.width).toBeGreaterThan(antes + 40);
  const elegido = (await hoja(o).boundingBox())!.width;
  await o.reload();
  await expect.poll(async () => Math.round((await hoja(o).boundingBox())!.width)).toBe(Math.round(elegido));
  // Doble clic: vuelve al ancho de siempre.
  await divisor.dblclick();
  await expect.poll(async () => Math.abs((await hoja(o).boundingBox())!.width - antes)).toBeLessThan(2);

  // Ampliar: la hoja cubre la ventana; Esc vuelve al editor.
  await hoja(o).getByRole("button", { name: "Ampliar la vista previa" }).click();
  const ampliada = o.getByRole("dialog", { name: "Vista previa" });
  await expect(ampliada.getByRole("button", { name: "Volver al editor" })).toBeFocused();
  await expect.poll(async () => (await ampliada.boundingBox())!.width).toBe(1440);
  await o.keyboard.press("Escape");
  await expect(hoja(o).getByRole("button", { name: "Ampliar la vista previa" })).toBeVisible();

  // Ocultar: el editor toma todo el ancho; se recuerda, también en otro documento.
  await hoja(o).getByRole("button", { name: "Ocultar la vista previa" }).click();
  await expect(hoja(o)).toHaveCount(0);
  await o.goto(`${OFICINA}/informes/${id}`);
  await expect(o.getByRole("textbox", { name: "Introducción" })).toBeVisible();
  await expect(hoja(o)).toHaveCount(0);
  await o.getByRole("button", { name: "Mostrar la vista previa" }).click();
  await expect(hoja(o)).toBeVisible();
  await o.context().close();
});

test("el menú se pliega con su botón o con el atajo, y se recuerda", async ({ browser }) => {
  const { o } = await oficinaConInforme(browser);
  await o.goto(`${OFICINA}/`);
  const menu = o.locator("aside.menu");
  const ancho = async () => Math.round((await menu.boundingBox())!.width);
  expect(await ancho()).toBeGreaterThan(200);
  await o.getByRole("button", { name: "Plegar el menú" }).click();
  await expect.poll(ancho).toBeLessThan(70);
  await o.reload();
  await expect(o.getByRole("tab", { name: /Esperando revisión/ })).toBeVisible();
  await expect.poll(ancho).toBeLessThan(70);
  // El atajo y su etiqueta son los del sistema que ve la página (el proyecto emula un teléfono Android: Ctrl).
  const esMac = await o.evaluate(() => /mac|iphone|ipad/i.test((navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform));
  await o.keyboard.press(esMac ? "Meta+b" : "Control+b");
  await expect.poll(ancho).toBeGreaterThan(200);
  await expect(o.getByRole("button", { name: "Plegar el menú" })).toContainText(esMac ? "⌘B" : "Ctrl + B");
  // Con la otra tecla no pasa nada: en Mac, Ctrl + B es de los campos de texto.
  await o.keyboard.press(esMac ? "Control+b" : "Meta+b");
  await o.waitForTimeout(300);
  expect(await ancho()).toBeGreaterThan(200);
  await o.context().close();
});

test("la bandeja recuerda la pestaña; la búsqueda y la fila abierta, mientras la pestaña siga abierta", async ({ browser }) => {
  const { o } = await oficinaConInforme(browser);
  await o.goto(`${OFICINA}/`);
  await o.getByRole("tab", { name: /Revisados/ }).click();
  await expect(o.getByRole("tab", { name: /Revisados/ })).toHaveAttribute("aria-selected", "true");
  await o.reload();
  await expect(o.getByRole("tab", { name: /Revisados/ })).toHaveAttribute("aria-selected", "true");

  await o.getByRole("tab", { name: /Esperando revisión/ }).click();
  await expect(o.getByRole("tab", { name: /Esperando revisión/ })).toHaveAttribute("aria-selected", "true");
  const buscar = o.getByRole("searchbox", { name: "Buscar levantamientos" });
  await buscar.fill("e2e");
  await o.reload();
  await expect(buscar).toHaveValue("e2e");

  // En otra pestaña del navegador la búsqueda empieza vacía; la pestaña de la lista, no.
  const otra = await o.context().newPage();
  await otra.goto(`${OFICINA}/`);
  await expect(otra.getByRole("searchbox", { name: "Buscar levantamientos" })).toHaveValue("");
  await expect(otra.getByRole("tab", { name: /Esperando revisión/ })).toHaveAttribute("aria-selected", "true");
  await o.context().close();
});

test("los planos se ordenan arrastrando y con el teclado; la hoja sigue el orden", async ({ browser }) => {
  const { o } = await oficinaConInforme(browser);
  const archivo = (nombre: string) => ({ name: `${nombre}.pdf`, mimeType: "application/pdf", buffer: pdfDePrueba(nombre) });
  await o.locator("input[type=file]").setInputFiles([archivo("Plano A"), archivo("Plano B"), archivo("Plano C")]);
  const nombres = () => o.getByRole("textbox", { name: /^Nombre del plano/ }).evaluateAll((l) => l.map((x) => (x as HTMLInputElement).value));
  await expect.poll(nombres).toEqual(["Plano A", "Plano B", "Plano C"]);
  await expect(o.getByRole("button", { name: /^Subir el plano/ })).toHaveCount(0);

  // Con el puntero: C al principio.
  const asaC = o.getByRole("button", { name: "Mover Plano C" });
  const asaA = o.getByRole("button", { name: "Mover Plano A" });
  const c = (await asaC.boundingBox())!;
  const a = (await asaA.boundingBox())!;
  await o.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
  await o.mouse.down();
  await o.mouse.move(c.x + c.width / 2, a.y - 10, { steps: 10 });
  await o.mouse.up();
  await expect.poll(nombres).toEqual(["Plano C", "Plano A", "Plano B"]);

  // Con el teclado: A baja una posición.
  await o.getByRole("button", { name: "Mover Plano A" }).focus();
  await o.keyboard.press("Space");
  await o.keyboard.press("ArrowDown");
  await o.keyboard.press("Space");
  await expect.poll(nombres).toEqual(["Plano C", "Plano B", "Plano A"]);
  await expect(o.getByRole("button", { name: "Mover Plano A" })).toBeFocused();
  // Esc devuelve a donde estaba.
  await o.keyboard.press("Space");
  await o.keyboard.press("ArrowUp");
  await o.keyboard.press("ArrowUp");
  await o.keyboard.press("Escape");
  await expect.poll(nombres).toEqual(["Plano C", "Plano B", "Plano A"]);

  await guardadoSolo(o);
  await o.reload();
  await expect.poll(nombres).toEqual(["Plano C", "Plano B", "Plano A"]);
  const fichas = o.frameLocator('iframe[title^="Vista previa del informe"]').locator(".vista-anexo b");
  await expect(fichas).toHaveText(["Plano C", "Plano B", "Plano A"]);
  await o.context().close();
});

/** ⌘ en Mac y Ctrl en lo demás, según el sistema que ve la página (el proyecto emula un teléfono Android). */
async function modificador(o: Page) {
  const esMac = await o.evaluate(() => /mac|iphone|ipad/i.test((navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform));
  return esMac ? "Meta" : "Control";
}

test("buscar en todo: abre con el atajo, va a un cliente, lo recuerda y lanza acciones (iteración 37)", async ({ browser }) => {
  const tecnico = nuevoUsuario("tecnico", "tecnico.e2e");
  const revisora = nuevoUsuario("oficina", "oficina");
  const { cliente } = nuevaVisitaConCliente(tecnico);
  const contexto = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "es-CO" });
  const o = await contexto.newPage();
  await o.goto(`${OFICINA}/`);
  await iniciarSesion(o, revisora);
  await expect(o.getByRole("tab", { name: /Esperando revisión/ })).toBeVisible();
  const mod = await modificador(o);

  await o.keyboard.press(`${mod}+k`);
  const busqueda = o.getByRole("dialog", { name: "Buscar en oficina" });
  await expect(busqueda.getByRole("group", { name: "Acciones" })).toBeVisible();
  await busqueda.getByRole("combobox").fill(cliente);
  await expect(busqueda.getByRole("group", { name: "Clientes" }).getByRole("option", { name: new RegExp(cliente) })).toBeVisible();
  await o.keyboard.press("Enter");
  await expect(busqueda).toHaveCount(0);
  await expect(o.getByRole("heading", { name: cliente })).toBeVisible();

  // Desde el menú, vacía: lo reciente arriba.
  await o.getByRole("button", { name: "Buscar" }).click();
  await expect(busqueda.getByRole("group", { name: "Recientes" }).getByRole("option").first()).toContainText(cliente);
  await o.keyboard.press("Escape");
  await expect(busqueda).toHaveCount(0);

  // Una acción: «Programar visita» abre su formulario en Visitas.
  await o.keyboard.press(`${mod}+k`);
  await busqueda.getByRole("combobox").fill("programar");
  await o.keyboard.press("Enter");
  await expect(o.getByRole("dialog", { name: /Programar visita/ })).toBeVisible();
  await contexto.close();
});

test("revisar en serie con el teclado: J, Enter, T, R y S; «?» muestra los atajos (iteración 37)", async ({ browser }) => {
  const revisora = nuevoUsuario("oficina", "oficina");
  const contexto = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "es-CO" });
  const o = await contexto.newPage();
  await o.goto(`${OFICINA}/`);
  await iniciarSesion(o, revisora);
  const esperando = o.getByRole("tab", { name: /Esperando revisión/ });
  await expect(esperando).toBeVisible();
  const filas = o.getByRole("tabpanel").getByRole("row");
  await expect.poll(() => filas.count()).toBeGreaterThan(0);
  // Los levantamientos los dejan enviados las pruebas de campo que corren antes; sin ellos no hay nada que revisar.
  test.skip((await filas.count()) < 3, "No hay levantamientos esperando revisión");

  await o.keyboard.press("?");
  const atajos = o.getByRole("dialog", { name: "Atajos del teclado" });
  await expect(atajos.getByText("Marcar revisado")).toBeVisible();
  await o.keyboard.press("Escape");
  await expect(atajos).toHaveCount(0);

  await o.keyboard.press("j");
  await expect(o.locator("tr.marcada")).toHaveCount(1);
  await o.keyboard.press("j");
  await o.keyboard.press("Enter");
  const revision = o.getByRole("region", { name: "Revisión" });
  await expect(revision).toBeVisible();
  const primero = o.url();

  await o.keyboard.press("t");
  await expect(revision.getByText("La tomó usted")).toBeVisible();
  await o.keyboard.press("r");
  const confirmar = o.getByRole("dialog", { name: /^¿Marcar revisado/ });
  await expect(confirmar).toBeVisible();
  await o.keyboard.press("Enter");
  await expect(revision.getByText("Revisado", { exact: true })).toBeVisible();

  await o.keyboard.press("s");
  await expect.poll(() => o.url()).not.toBe(primero);
  await expect(revision.getByText("Esperando revisión")).toBeVisible();

  // Esc vuelve a la bandeja.
  await o.keyboard.press("Escape");
  await expect(esperando).toBeVisible();
  await contexto.close();
});
