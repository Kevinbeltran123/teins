import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { comando, nuevaVisitaConCliente, nuevoUsuario, ORGANIZACION, type Usuario } from "../consola";
import { CAMPO, OFICINA } from "../destino";
import { filaDeLaBandeja, fotoDePrueba, iniciarSesion, irAlPaso, irARevisar } from "./ayudas";

/*
  Robustez de oficina: un técnico desactivado no traba una visita, un conflicto no se repite al reintentar y lo
  escrito en la revisión no se pierde sin aviso.
*/

const abiertos: BrowserContext[] = [];
test.afterEach(async () => {
  await Promise.all(abiertos.splice(0).map((c) => c.close()));
});

/** Una persona de oficina en su propio navegador de escritorio, con el panel de la revisión al lado. */
async function oficina(browser: Browser, usuario: Usuario): Promise<Page> {
  const contexto = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "es-CO", timezoneId: "America/Bogota" });
  abiertos.push(contexto);
  const pagina = await contexto.newPage();
  await pagina.goto(`${OFICINA}/`);
  await iniciarSesion(pagina, usuario);
  await expect(pagina.getByRole("tab", { name: /Esperando revisión/ })).toBeVisible();
  return pagina;
}

async function abrirReasignar(o: Page, cliente: string) {
  await o.getByRole("link", { name: "Visitas" }).click();
  const fila = o.getByRole("row").filter({ hasText: cliente });
  await fila.getByRole("button", { name: `Más acciones para la visita de ${cliente}` }).click();
  await o.getByRole("menuitem", { name: "Reasignar técnicos" }).click();
  return { fila, dialogo: o.getByRole("dialog", { name: "Reasignar técnicos" }) };
}

async function elegirTecnico(dialogo: Locator, tecnico: Usuario) {
  await dialogo.getByLabel("Buscar técnico").fill(tecnico.nombre);
  await dialogo.getByRole("checkbox", { name: tecnico.nombre }).check();
}

test("una visita con su técnico desactivado se marca en la lista y se reasigna sin trabarse", async ({ browser }) => {
  const [tecnico, reemplazo] = [nuevoUsuario("tecnico", "tecnico.e2e"), nuevoUsuario("tecnico", "tecnico.e2e")];
  const programadora = nuevoUsuario("oficina", "oficina");
  const { cliente } = nuevaVisitaConCliente(tecnico);
  comando("desactivar-usuario", ["--usuario", tecnico.usuario]);

  const o = await oficina(browser, programadora);
  const { fila, dialogo } = await abrirReasignar(o, cliente);
  // En la lista: nadie activo la tiene.
  await expect(fila.getByText("Sin técnico", { exact: true })).toBeVisible();
  await expect(fila.getByText(`Se desactivó a ${tecnico.nombre}`)).toBeVisible();

  // El desactivado no está en la lista de técnicos (solo trae activos): sale al guardar, y se dice.
  await expect(dialogo.getByRole("list", { name: "Lo que cambia" })).toContainText(`Se desactivó a ${tecnico.nombre}: sale de la visita.`);
  await dialogo.getByRole("button", { name: `Quitar a ${tecnico.nombre}` }).click();
  await expect(dialogo.getByText("Asigne al menos un técnico.")).toBeVisible();
  await elegirTecnico(dialogo, reemplazo);
  await expect(dialogo.getByText("Asigne al menos un técnico.")).toHaveCount(0);
  await dialogo.getByRole("button", { name: `Reasignar a ${reemplazo.nombre}` }).click();
  await expect(o.getByText(`Técnicos reasignados: ${cliente}`)).toBeVisible();
  await expect(fila).toContainText(reemplazo.nombre);
  await expect(fila.getByText("Sin técnico", { exact: true })).toHaveCount(0);
});

test("reasignar después de que otra persona cambió la visita: el aviso sale una vez y el reintento se guarda", async ({ browser }) => {
  const [primero, segundo, tercero] = [nuevoUsuario("tecnico", "tecnico.e2e"), nuevoUsuario("tecnico", "tecnico.e2e"), nuevoUsuario("tecnico", "tecnico.e2e")];
  const programadora = nuevoUsuario("oficina", "oficina");
  const { cliente, visitaId } = nuevaVisitaConCliente(primero);

  const o = await oficina(browser, programadora);
  const { fila, dialogo } = await abrirReasignar(o, cliente);
  await elegirTecnico(dialogo, segundo);
  // Mientras tanto, otra persona la reasigna: la versión que tiene abierta el diálogo ya no es la vigente.
  comando("reasignar-visita", ["--organizacion", ORGANIZACION, "--visita", visitaId, "--tecnicos", `${primero.usuario},${tercero.usuario}`]);
  await dialogo.getByRole("button", { name: `Reasignar a ${segundo.nombre}` }).click();
  await expect(dialogo.getByText("Otra persona cambió esta visita mientras usted la tenía abierta", { exact: false })).toBeVisible();
  // El diálogo sigue con la visita releída: lo que cambia ahora es frente a lo que dejó la otra persona.
  await expect(dialogo.getByRole("list", { name: "Lo que cambia" })).toContainText(`${tercero.nombre} deja de verla en su teléfono`);
  await dialogo.getByRole("button", { name: `Reasignar a ${segundo.nombre}` }).click();
  await expect(o.getByText(`Técnicos reasignados: ${cliente}`)).toBeVisible();
  await expect(fila).toContainText(segundo.nombre);
});

test("lo escrito en la revisión sigue ahí al cambiar de pestaña o de globo, y «Marcar revisado» dice qué se pierde", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const tecnico = nuevoUsuario("tecnico", "tecnico.e2e");
  const revisora = nuevoUsuario("oficina", "oficina");
  const { cliente } = nuevaVisitaConCliente(tecnico);

  // Campo: captura y envía.
  await page.goto(`${CAMPO}/`);
  await iniciarSesion(page, tecnico);
  const visita = page.getByRole("region", { name: "Siguiente visita" });
  await expect(visita.getByText(cliente)).toBeVisible();
  await visita.getByRole("button", { name: "Iniciar levantamiento" }).click();
  await irAlPaso(page, "Cuarto técnico");
  await page.getByRole("textbox", { name: "Potencia nominal" }).fill("10");
  await page.getByRole("textbox", { name: "Descripción del sitio" }).fill("Cuarto para lo escrito sin guardar (E2E)");
  await page.locator("input[type=file]").first().setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: fotoDePrueba() });
  await expect(page.getByRole("img", { name: "Foto 1 de Fotos del equipo" })).toBeVisible();
  await irARevisar(page);
  await page.getByRole("button", { name: "Enviar a oficina" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Enviar levantamiento" }).click();
  await expect(page.getByText("Recibido en oficina")).toBeVisible({ timeout: 30_000 });

  const o = await oficina(browser, revisora);
  await (await filaDeLaBandeja(o, tecnico.nombre)).getByRole("link").click();
  await o.getByRole("button", { name: "Tomar para revisar" }).click();
  await expect(o.getByRole("region", { name: "Revisión" }).getByText("la tomó usted")).toBeVisible();

  // Una medida que no se lee impide guardar; marcar «No se pudo obtener» lo vuelve a permitir, y desmarcarlo vuelve a
  // lo que muestra el campo.
  await o.getByRole("button", { name: "Corregir potencia nominal" }).click();
  const potencia = o.locator("#dato-cuarto_tecnico-potencia_nominal");
  await potencia.getByRole("textbox", { name: "Nuevo valor de potencia nominal" }).fill("abc");
  await expect(potencia.getByRole("button", { name: "Guardar corrección" })).toBeDisabled();
  const marca = potencia.getByRole("checkbox", { name: "Potencia nominal: no se pudo obtener" });
  await marca.locator("xpath=ancestor::label").click();
  await expect(potencia.getByRole("button", { name: "Guardar corrección" })).toBeEnabled();
  await marca.locator("xpath=ancestor::label").click();
  await expect(potencia.getByRole("button", { name: "Guardar corrección" })).toBeDisabled();
  await potencia.getByRole("button", { name: "Cancelar" }).click();

  // Abrir el globo de otra fila no borra el comentario a medias.
  await o.getByRole("button", { name: "Comentar potencia nominal" }).click();
  await o.getByRole("textbox", { name: "Nuevo comentario" }).fill("Borrador sobre la potencia (E2E)");
  await o.getByRole("button", { name: "Comentar descripción del sitio" }).click();
  await expect(o.getByRole("textbox", { name: "Nuevo comentario" })).toHaveValue("");
  await o.getByRole("button", { name: "Comentar potencia nominal" }).click();
  await expect(o.getByRole("textbox", { name: "Nuevo comentario" })).toHaveValue("Borrador sobre la potencia (E2E)");

  // Cambiar de pestaña del panel u ocultarlo no borra la respuesta a medias ni el comentario general.
  await o.getByRole("tab", { name: /^Comentarios/ }).click();
  const comentarios = o.getByRole("region", { name: "Comentarios al técnico" });
  await comentarios.getByRole("textbox", { name: "Comentario general" }).fill("Conversación para responder (E2E)");
  await comentarios.getByRole("button", { name: "Enviar comentario" }).click();
  const general = comentarios.getByRole("region", { name: "Conversación general" });
  await expect(general.getByText("Conversación para responder (E2E)")).toBeVisible();
  await general.getByRole("textbox", { name: `Responder a ${tecnico.nombre}` }).fill("Respuesta a medias (E2E)");
  await comentarios.getByRole("textbox", { name: "Comentario general" }).fill("Comentario general a medias (E2E)");
  await o.getByRole("tab", { name: "Historial" }).click();
  await o.getByRole("tab", { name: /^Comentarios/ }).click();
  await expect(general.getByRole("textbox", { name: `Responder a ${tecnico.nombre}` })).toHaveValue("Respuesta a medias (E2E)");
  await expect(comentarios.getByRole("textbox", { name: "Comentario general" })).toHaveValue("Comentario general a medias (E2E)");
  await o.getByRole("button", { name: "Ocultar el panel" }).click();
  await o.getByRole("button", { name: "Mostrar el panel" }).click();
  await expect(general.getByRole("textbox", { name: `Responder a ${tecnico.nombre}` })).toHaveValue("Respuesta a medias (E2E)");

  // «Marcar revisado» dice primero lo que se pierde y lo que el técnico ya no podrá responder.
  await o.getByRole("button", { name: "Corregir descripción del sitio" }).click();
  await o.getByRole("textbox", { name: "Nuevo valor de descripción del sitio" }).fill("Cambio sin guardar (E2E)");
  await o.getByRole("button", { name: "Marcar revisado" }).click();
  const confirmacion = o.getByRole("dialog");
  await expect(confirmacion).toContainText("la corrección sin guardar de «Descripción del sitio»");
  await expect(confirmacion).toContainText("la respuesta sin enviar en la conversación general");
  await expect(confirmacion).toContainText(`${tecnico.nombre} no podrá responder`);
  await expect(confirmacion).toContainText("el comentario sin enviar sobre «Potencia nominal»");
  await confirmacion.getByRole("button", { name: "Marcar revisado" }).click();
  // Revisado, la corrección que ya no se puede guardar se cierra.
  await expect(o.getByRole("region", { name: "Revisión" }).getByText("por usted", { exact: false })).toBeVisible();
  await expect(o.getByRole("textbox", { name: "Nuevo valor de descripción del sitio" })).toHaveCount(0);
});
