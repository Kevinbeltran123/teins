import { expect, test, type Browser } from "@playwright/test";
import { nuevaVisitaConCliente, nuevoUsuario } from "../consola";
import { OFICINA } from "../destino";
import { iniciarSesion, volverALaPestana } from "./ayudas";

/**
 * Iteración 24 (fallos 1 a 3 del grupo A): el borrador de un informe solo se pierde si la persona lo descarta.
 * Ni un fallo de red al volver a la pestaña, ni otra persona que guarda, ni "Guardar y publicar", ni la sesión vencida.
 */

async function informeEnBorrador(browser: Browser) {
  const tecnico = nuevoUsuario("tecnico", "tecnico.e2e");
  const revisora = nuevoUsuario("oficina", "oficina");
  const { cliente, visitaId } = nuevaVisitaConCliente(tecnico);
  const contexto = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "es-CO" });
  const o = await contexto.newPage();
  await o.goto(`${OFICINA}/`);
  await iniciarSesion(o, revisora);
  await expect(o.getByRole("tab", { name: /Esperando revisión/ })).toBeVisible();
  // Un informe vacío basta: lo que se prueba es el borrador, no su contenido.
  const respuesta = await o.request.post(`${OFICINA}/api/informes`, { data: { visitaId }, headers: { origin: OFICINA } });
  expect(respuesta.ok()).toBe(true);
  const { id } = (await respuesta.json()) as { id: string };
  await o.goto(`${OFICINA}/informes/${id}`);
  await expect(o.getByRole("heading", { name: `Informe de ${cliente}` })).toBeVisible();
  return { o, id, revisora };
}

const leerInforme = (id: string) => (r: { url(): string; request(): { method(): string } }) => r.url().endsWith(`/api/informes/${id}`) && r.request().method() === "GET";

test("un fallo de red al volver a la pestaña no borra el borrador del informe", async ({ browser }) => {
  const { o, id } = await informeEnBorrador(browser);
  const introduccion = o.getByRole("textbox", { name: "Introducción" });
  await introduccion.fill("Escrito sin guardar");

  let fallos = 0;
  await o.route(`**/api/informes/${id}`, (ruta) => {
    fallos++;
    return ruta.abort("internetdisconnected");
  });
  await volverALaPestana(o);
  // La consulta se rinde después de sus reintentos (unos 7 s).
  await expect.poll(() => fallos, { timeout: 20_000 }).toBeGreaterThanOrEqual(4);
  await o.waitForTimeout(1_000);
  await expect(introduccion).toHaveValue("Escrito sin guardar");
  await expect(o.getByText("Cambios sin guardar")).toBeVisible();

  await o.unroute(`**/api/informes/${id}`);
  await o.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(o.getByText("Todo guardado")).toBeVisible();
  await o.context().close();
});

test("si otra persona guarda mientras tanto, el borrador sigue y guardar lo avisa en vez de pisarla", async ({ browser }) => {
  const { o, id } = await informeEnBorrador(browser);
  const introduccion = o.getByRole("textbox", { name: "Introducción" });
  await introduccion.fill("Lo mío");

  const otra = await o.context().newPage();
  await otra.goto(`${OFICINA}/informes/${id}`);
  await otra.getByRole("textbox", { name: "Conclusiones" }).fill("Lo de la otra pestaña");
  await otra.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(otra.getByText("Todo guardado")).toBeVisible();
  await otra.close();

  const releido = o.waitForResponse(leerInforme(id));
  await volverALaPestana(o);
  await releido;
  await o.waitForTimeout(500);
  await expect(introduccion).toHaveValue("Lo mío");

  await o.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(o.getByText(/Otra persona guardó o publicó este informe/)).toBeVisible();
  await expect(introduccion).toHaveValue("Lo mío");

  // Recargar trae lo de la otra persona: es la única forma de descartar lo propio.
  await o.getByRole("button", { name: "Recargar" }).click();
  await expect(o.getByRole("textbox", { name: "Conclusiones" })).toHaveValue("Lo de la otra pestaña");
  await expect(introduccion).toHaveValue("");
  await expect(o.getByText("Todo guardado")).toBeVisible();
  await o.context().close();
});

test("guardar y publicar deja ver el error de publicar en el diálogo", async ({ browser }) => {
  const { o } = await informeEnBorrador(browser);
  await o.getByRole("textbox", { name: "Introducción" }).fill("Sin levantamientos todavía");
  await o.getByRole("button", { name: "Publicar versión 1" }).click();
  const dialogo = o.getByRole("dialog");
  await dialogo.getByRole("button", { name: "Publicar versión 1" }).click();
  // Se guardó primero; publicar falla porque no hay levantamientos revisados.
  await expect(dialogo.getByText("Incluya al menos un levantamiento revisado antes de publicar.")).toBeVisible();
  await expect(o.getByText("Todo guardado")).toBeVisible();
  await o.context().close();
});

test("con la sesión vencida, ingresar de nuevo conserva el borrador y se puede guardar", async ({ browser }) => {
  const { o, revisora } = await informeEnBorrador(browser);
  const introduccion = o.getByRole("textbox", { name: "Introducción" });
  await introduccion.fill("Escrito antes de que venciera la sesión");

  await o.context().clearCookies();
  await o.getByRole("button", { name: "Guardar borrador" }).click();
  const vencida = o.getByRole("dialog", { name: "Su sesión venció" });
  await expect(vencida).toBeVisible();
  await iniciarSesion(o, revisora);
  await expect(vencida).toHaveCount(0);

  await expect(introduccion).toHaveValue("Escrito antes de que venciera la sesión");
  await o.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(o.getByText("Todo guardado")).toBeVisible();
  await o.context().close();
});

test("salir con cambios sin guardar pregunta antes; seguir editando los conserva (iteración 24, salida protegida)", async ({ browser }) => {
  const { o } = await informeEnBorrador(browser);
  const introduccion = o.getByRole("textbox", { name: "Introducción" });
  await introduccion.fill("Todavía sin guardar");
  const menu = o.getByRole("navigation", { name: "Secciones" });

  await menu.getByRole("link", { name: "Visitas" }).click();
  const pregunta = o.getByRole("dialog", { name: /^¿Guardar los cambios/ });
  await pregunta.getByRole("button", { name: "Seguir editando" }).click();
  await expect(pregunta).toHaveCount(0);
  await expect(introduccion).toHaveValue("Todavía sin guardar");

  await menu.getByRole("link", { name: "Visitas" }).click();
  await o.getByRole("dialog", { name: /^¿Guardar los cambios/ }).getByRole("button", { name: "Salir sin guardar" }).click();
  await expect(o.getByRole("heading", { name: "Visitas" })).toBeVisible();
  await o.context().close();
});

test("salir con cambios ofrece «Guardar y salir» primero, y guarda antes de irse (iteración 24c)", async ({ browser }) => {
  const { o } = await informeEnBorrador(browser);
  await o.getByRole("textbox", { name: "Introducción" }).fill("Se guarda al salir");
  await o.getByRole("navigation", { name: "Secciones" }).getByRole("link", { name: "Visitas" }).click();
  const guardarYSalir = o.getByRole("dialog", { name: /^¿Guardar los cambios/ }).getByRole("button", { name: "Guardar y salir" });
  await expect(guardarYSalir).toBeFocused();
  await guardarYSalir.click();
  await expect(o.getByRole("heading", { name: "Visitas" })).toBeVisible();
  await o.goBack();
  await expect(o.getByRole("textbox", { name: "Introducción" })).toHaveValue("Se guarda al salir");
  await o.context().close();
});
