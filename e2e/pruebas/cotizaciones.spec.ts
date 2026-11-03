import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { nuevaVisitaConCliente, nuevoAdministrador, nuevoUsuario } from "../consola";
import { CAMPO, OFICINA } from "../destino";
import { activarSegundoFactor, filaDeLaBandeja, fotoDePrueba, iniciarSesion, irAlPaso, irARevisar } from "./ayudas";

/**
 * Iteración 21 (ADR-0029): administración pone el precio; el técnico anota el material del catálogo;
 * oficina cotiza desde las cantidades revisadas, agrega mano de obra, elige AIU, publica y envía el PDF.
 */
test("cotización desde las cantidades revisadas: precio de la lista, mano de obra, AIU, PDF y envío (ADR-0029)", async ({ page, browser }) => {
  const tecnico = nuevoUsuario("tecnico", "tecnico.e2e");
  const admin = nuevoAdministrador();
  const { cliente } = nuevaVisitaConCliente(tecnico);
  // Código único por corrida: el catálogo es de la organización y las corridas lo comparten.
  const sufijo = randomBytes(3).toString("hex").toUpperCase();
  const codigo = `UTP-${sufijo}`;
  const descripcion = `Cable UTP categoría 6A ${sufijo}`;

  // Administración (con segundo factor) crea el ítem y le pone precio, antes de que el técnico inicie sesión.
  const escritorio = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "es-CO" });
  const o = await escritorio.newPage();
  await activarSegundoFactor(o, OFICINA, admin);
  await o.goto(`${OFICINA}/`);
  const menu = o.getByRole("navigation", { name: "Secciones" });
  await menu.getByRole("link", { name: "Catálogo" }).click();
  await o.getByRole("button", { name: "Nuevo ítem" }).click();
  const nuevo = o.getByRole("dialog", { name: "Nuevo ítem" });
  await nuevo.getByRole("textbox", { name: "Código" }).fill(codigo);
  await nuevo.getByRole("textbox", { name: "Descripción" }).fill(descripcion);
  await nuevo.getByRole("textbox", { name: "Unidad" }).fill("m");
  await nuevo.getByRole("button", { name: "Crear ítem" }).click();
  const fila = o.getByRole("row").filter({ hasText: codigo });
  await expect(fila.getByText("Sin precio")).toBeVisible();
  await fila.getByRole("button", { name: `Cambiar el precio de ${codigo}` }).click();
  const hojaPrecio = o.getByRole("dialog", { name: `Cambiar precio de ${codigo}` });
  await expect(hojaPrecio.getByText("Todavía no tiene precio.")).toBeVisible();
  await hojaPrecio.getByRole("textbox", { name: "Precio unitario sin IVA" }).fill("4.800");
  await hojaPrecio.getByRole("button", { name: "Guardar precio" }).click();
  await expect(fila.getByText("$ 4.800")).toBeVisible();

  // Campo: el material del catálogo, sin precio a la vista (regla 7).
  await page.goto(`${CAMPO}/`);
  await iniciarSesion(page, tecnico);
  const visita = page.getByRole("region", { name: "Siguiente visita" });
  await expect(visita.getByText(cliente)).toBeVisible();
  await visita.getByRole("button", { name: "Iniciar levantamiento" }).click();
  await irAlPaso(page, "Cuarto técnico");
  await page.getByRole("textbox", { name: "Potencia nominal" }).fill("15");
  await page.locator("input[type=file]").first().setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: fotoDePrueba() });
  await expect(page.getByRole("img", { name: "Foto 1 de Fotos del equipo" })).toBeVisible();
  await irAlPaso(page, "Materiales");
  await page.getByRole("button", { name: "Buscar en el catálogo" }).click();
  const catalogo = page.getByRole("dialog", { name: "Agregar del catálogo" });
  await catalogo.getByRole("searchbox", { name: "Buscar en el catálogo" }).fill(codigo);
  await catalogo.getByRole("button", { name: `Agregar ${descripcion}` }).click();
  await catalogo.getByRole("button", { name: "Ver materiales" }).click();
  await page.getByRole("textbox", { name: "Cantidad de la línea 1" }).fill("30");
  await expect(page.getByText("4.800")).toHaveCount(0);
  await irARevisar(page);
  await page.getByRole("button", { name: "Enviar a oficina" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Enviar levantamiento" }).click();
  await expect(page.getByText("Recibido en oficina")).toBeVisible({ timeout: 60_000 });

  // Oficina revisa y registra quién recibe cotizaciones del cliente.
  await menu.getByRole("link", { name: "Levantamientos" }).click();
  await (await filaDeLaBandeja(o, tecnico.nombre)).getByRole("link").click();
  await o.getByRole("button", { name: "Tomar para revisar" }).click();
  await o.getByRole("button", { name: "Marcar revisado" }).click();
  await o.getByRole("dialog").getByRole("button", { name: "Marcar revisado" }).click();
  await expect(o.getByText("Revisado", { exact: true }).first()).toBeVisible();
  await menu.getByRole("link", { name: "Clientes" }).click();
  await o.getByRole("searchbox", { name: "Buscar cliente" }).fill(cliente);
  await o.getByRole("row").filter({ hasText: cliente }).getByRole("link", { name: cliente }).click();
  await o.getByRole("button", { name: "Nuevo contacto" }).click();
  const hojaContacto = o.getByRole("dialog", { name: "Nuevo contacto" });
  await hojaContacto.getByRole("textbox", { name: "Nombre" }).fill("Marta Gil");
  await hojaContacto.getByRole("textbox", { name: "Correo" }).fill("delivered@resend.dev");
  await hojaContacto.getByRole("checkbox", { name: "Los informes" }).uncheck();
  await hojaContacto.getByRole("checkbox", { name: "Las cotizaciones" }).check();
  await hojaContacto.getByRole("button", { name: "Crear contacto" }).click();
  await expect(o.getByText("Contacto creado: Marta Gil")).toBeVisible();

  // Nueva cotización desde la visita: la línea llega con el precio de la lista.
  await menu.getByRole("link", { name: "Cotizaciones" }).click();
  await o.getByRole("button", { name: "Nueva cotización" }).click();
  const hojaNueva = o.getByRole("dialog", { name: "Nueva cotización" });
  await hojaNueva.getByRole("radio", { name: new RegExp(cliente) }).check();
  await hojaNueva.getByRole("button", { name: "Crear cotización" }).click();
  await expect(o.getByRole("heading", { name: /^Cotización COT-\d{4}-\d{4,}$/, level: 1 })).toBeVisible();
  const lineas = o.getByRole("table", { name: /^Líneas de la cotización/ });
  const cable = lineas.getByRole("row").filter({ hasText: codigo });
  await expect(cable.getByRole("textbox", { name: `Precio de ${descripcion}` })).toHaveValue("4.800");
  await expect(cable.getByText("$ 144.000")).toBeVisible();

  // Al lado, la hoja que recibe el cliente, dibujada con la plantilla del PDF mientras se escribe (ADR-0031).
  const hoja = o.frameLocator('iframe[title^="Vista previa de la cotización"]');
  await expect(hoja.getByText(descripcion)).toBeVisible();
  await expect(hoja.getByRole("heading", { name: /^Cotización COT-/ })).toBeVisible();

  // Mano de obra: sin precio no se publica, y lo dice junto a la línea; en la hoja va como marcador.
  await o.getByRole("button", { name: "Agregar línea" }).click();
  await o.getByRole("textbox", { name: "Descripción de la línea nueva" }).fill("Mano de obra de instalación");
  await expect(o.getByRole("button", { name: "Falta el precio de 1 línea" })).toBeVisible();
  await expect(o.getByRole("button", { name: "Publicar versión 1" })).toBeDisabled();
  await expect(hoja.getByText("Mano de obra de instalación")).toBeVisible();
  await expect(hoja.getByText("[Precio]")).toBeVisible();
  await o.getByRole("textbox", { name: "Precio de Mano de obra de instalación" }).fill("850.000");
  await expect(hoja.getByText("$ 850.000").first()).toBeVisible();
  await expect(hoja.getByText("[Precio]")).toHaveCount(0);

  // AIU: 994.000 + A 99.400 + I 29.820 + U 49.700 + IVA sobre U 9.443.
  await o.getByRole("radio", { name: "AIU, con IVA sobre la utilidad" }).check();
  const totales = o.getByRole("region", { name: "Totales" });
  await expect(totales.getByText("$ 994.000")).toBeVisible();
  await expect(totales.getByText("$ 9.443")).toBeVisible();
  await expect(totales.getByText("$ 1.182.363")).toBeVisible();
  await expect(hoja.getByText("Imprevistos 3 %")).toBeVisible();
  await expect(hoja.getByText("$ 1.182.363")).toBeVisible();

  // "Correo": lo que le llega a quien recibe cotizaciones, con el asunto y el adjunto.
  await o.getByRole("tab", { name: "Correo" }).click();
  const vistaCorreo = o.getByRole("region", { name: "Vista previa" });
  await expect(vistaCorreo.getByLabel("Asunto del correo")).toHaveValue(/^Cotización COT-\d{4}-\d{4,} · /);
  await expect(vistaCorreo.getByText(/^Cotización COT-.* - versión 1\.pdf$/)).toBeVisible();
  await expect(o.frameLocator('iframe[title="Correo a Marta Gil"]').getByText("Hola, Marta:")).toBeVisible();
  // Se escribe sobre el correo (ADR-0036): el texto dentro del correo (también en Safari, donde el marco no entrega sus
  // eventos) y el asunto en su lugar; sale así al publicar.
  const textoDelCorreo = o.frameLocator('iframe[title="Correo a Marta Gil"]').locator('[data-editable="texto"]');
  await textoDelCorreo.click();
  await o.keyboard.press("End");
  await o.keyboard.type(" Quedo atento.");
  await expect(o.getByRole("button", { name: "Volver al texto de TEINS" })).toBeVisible();
  await o.getByLabel("Asunto del correo").fill("Su cotización de cableado");
  await o.getByRole("tab", { name: "Cotización" }).click();

  // Publicar: quien recibe cotizaciones viene marcado; el PDF se genera y sale.
  await o.getByRole("button", { name: "Publicar versión 1" }).click();
  const confirmar = o.getByRole("dialog", { name: /¿Publicar la versión 1 de COT-/ });
  // Lo que se publica es lo que mostró la vista previa: la confirmación ya no carga el PDF del servidor.
  await expect(confirmar.getByText("Queda congelada con sus precios e impuestos, por $ 1.182.363")).toBeVisible();
  await expect(confirmar.getByText("Es el documento de la vista previa")).toBeVisible();
  await expect(confirmar.getByRole("checkbox", { name: "Marta Gil" })).toBeChecked();
  await confirmar.getByRole("button", { name: "Publicar y enviar a 1" }).click();
  await expect(o.getByText("Versión 1 vigente")).toBeVisible();
  const descargar = o.getByRole("button", { name: "Descargar PDF de la versión 1" });
  await expect(descargar).toBeVisible({ timeout: 90_000 });
  const envios = o.getByRole("region", { name: "Envíos de la versión 1" });
  await expect(envios.getByRole("listitem").filter({ hasText: "Marta Gil" }).getByText(/^(Enviado|Entregado)$/)).toBeVisible({ timeout: 60_000 });
  await expect(envios.getByRole("listitem").filter({ hasText: "Marta Gil" })).toContainText("con su texto");
  // A otro contacto: quien ya la recibió no se vuelve a ofrecer (iteración 29).
  await envios.getByRole("button", { name: "Enviar a otro contacto" }).click();
  await expect(o.getByRole("dialog", { name: /Enviar la versión 1 a otro contacto/ }).getByText("Todos los contactos ya la recibieron")).toBeVisible();
  await o.keyboard.press("Escape");
  // Con las versiones y sus envíos al final del editor, la página no se alarga más que la ventana: cada columna baja
  // sola y la rueda no deja ver el fondo vacío debajo (iteración 29).
  expect(await o.evaluate(() => document.scrollingElement!.scrollHeight - innerHeight)).toBeLessThanOrEqual(0);
  const pdf = o.waitForEvent("download");
  await descargar.click();
  // WebKit entrega el nombre en forma descompuesta (NFD, como macOS): se compara normalizado. En Linux, desde Playwright
  // 1.64, cambia los espacios por guiones bajos: el nombre que manda el servidor es el mismo.
  expect((await pdf).suggestedFilename().normalize("NFC")).toMatch(/^Cotización[ _]COT-\d{4}-\d{4,}[ _]-[ _].*[ _]-[ _]versión[ _]1\.pdf$/);

  // La lista muestra el total publicado.
  await menu.getByRole("link", { name: "Cotizaciones" }).click();
  await expect(o.getByRole("row").filter({ hasText: cliente })).toContainText("$ 1.182.363");
  await escritorio.close();
});
