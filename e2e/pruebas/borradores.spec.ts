import { expect, test, type Browser } from "@playwright/test";
import { nuevaVisitaConCliente, nuevoUsuario } from "../consola";
import { OFICINA } from "../destino";
import { guardadoSolo, iniciarSesion, volverALaPestana } from "./ayudas";

/**
 * El borrador de un informe solo se pierde si la persona lo descarta (iteración 24) y se guarda solo (iteración 36,
 * prototipos/usabilidad-oficina): ni un fallo de red, ni otra persona que guarda, ni la sesión vencida, ni salir de la
 * pantalla o cerrar la pestaña antes de que se guarde.
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
  return { o, id, revisora, cliente };
}

const leerInforme = (id: string) => `**/api/informes/${id}`;
const guardarInforme = (id: string) => `**/api/informes/${id}/borrador`;

test("se guarda solo al dejar de escribir, sin botón", async ({ browser }) => {
  const { o, id } = await informeEnBorrador(browser);
  await expect(o.getByRole("button", { name: "Guardar borrador" })).toHaveCount(0);
  await o.getByRole("textbox", { name: "Introducción" }).fill("Escrito y guardado solo");
  await expect(o.getByRole("status").filter({ hasText: /^Sin guardar$/ })).toBeVisible();
  await guardadoSolo(o);
  await o.goto(`${OFICINA}/informes/${id}`);
  await expect(o.getByRole("textbox", { name: "Introducción" })).toHaveValue("Escrito y guardado solo");
  await o.context().close();
});

test("un fallo de red al volver a la pestaña no borra el borrador del informe", async ({ browser }) => {
  const { o, id } = await informeEnBorrador(browser);
  const introduccion = o.getByRole("textbox", { name: "Introducción" });
  await introduccion.fill("Escrito antes del fallo");
  await guardadoSolo(o);

  let fallos = 0;
  await o.route(leerInforme(id), (ruta) => {
    fallos++;
    return ruta.abort("internetdisconnected");
  });
  await volverALaPestana(o);
  // La consulta se rinde después de sus reintentos (unos 7 s).
  await expect.poll(() => fallos, { timeout: 20_000 }).toBeGreaterThanOrEqual(4);
  await o.waitForTimeout(1_000);
  await expect(introduccion).toHaveValue("Escrito antes del fallo");
  await o.unroute(leerInforme(id));
  await o.context().close();
});

test("si otra persona guarda mientras tanto, no se pisa: se elige con cuál seguir", async ({ browser }) => {
  const { o, id } = await informeEnBorrador(browser);
  const introduccion = o.getByRole("textbox", { name: "Introducción" });
  await introduccion.fill("Lo mío");
  await guardadoSolo(o);
  // Esta pestaña no vuelve a leer el informe: así no se entera de lo que guarda la otra hasta guardar.
  await o.route(leerInforme(id), (ruta) => ruta.abort("internetdisconnected"));

  const otra = await o.context().newPage();
  await otra.goto(`${OFICINA}/informes/${id}`);
  await otra.getByRole("textbox", { name: "Conclusiones" }).fill("Lo de la otra pestaña");
  await guardadoSolo(otra);
  await otra.close();

  await introduccion.fill("Lo mío, con más");
  await expect(o.getByText("Otra persona guardó este informe mientras usted escribía.")).toBeVisible({ timeout: 15_000 });
  await expect(o.getByRole("status").filter({ hasText: "No se guardó" })).toBeVisible();
  await expect(introduccion).toHaveValue("Lo mío, con más");
  await expect(o.getByRole("button", { name: /^Publicar versión/ })).toBeDisabled();

  await o.unroute(leerInforme(id));
  await o.getByRole("button", { name: "Cargar la guardada" }).click();
  await expect(o.getByRole("textbox", { name: "Conclusiones" })).toHaveValue("Lo de la otra pestaña");
  await expect(introduccion).toHaveValue("Lo mío");
  await guardadoSolo(o);
  await o.context().close();
});

test("guardar y publicar deja ver el error de publicar en el diálogo", async ({ browser }) => {
  const { o } = await informeEnBorrador(browser);
  await o.getByRole("textbox", { name: "Introducción" }).fill("Sin levantamientos todavía");
  // Publicar enseguida: lo pendiente se guarda antes.
  await o.getByRole("button", { name: "Publicar versión 1" }).click();
  const dialogo = o.getByRole("dialog");
  await dialogo.getByRole("button", { name: "Publicar versión 1" }).click();
  // Se guardó primero; publicar falla porque no hay levantamientos revisados.
  await expect(dialogo.getByText("Incluya al menos un levantamiento revisado antes de publicar.")).toBeVisible();
  await guardadoSolo(o);
  await o.context().close();
});

test("con la sesión vencida, ingresar de nuevo conserva el borrador y se guarda solo", async ({ browser }) => {
  const { o, id, revisora } = await informeEnBorrador(browser);
  const introduccion = o.getByRole("textbox", { name: "Introducción" });
  await o.context().clearCookies();
  await introduccion.fill("Escrito antes de que venciera la sesión");
  const vencida = o.getByRole("dialog", { name: "Su sesión venció" });
  await expect(vencida).toBeVisible({ timeout: 15_000 });
  await iniciarSesion(o, revisora);
  await expect(vencida).toHaveCount(0);

  await expect(introduccion).toHaveValue("Escrito antes de que venciera la sesión");
  await guardadoSolo(o);
  await o.goto(`${OFICINA}/informes/${id}`);
  await expect(introduccion).toHaveValue("Escrito antes de que venciera la sesión");
  await o.context().close();
});

test("salir enseguida no pregunta y lo escrito se guarda igual", async ({ browser }) => {
  const { o } = await informeEnBorrador(browser);
  await o.getByRole("textbox", { name: "Introducción" }).fill("Se guarda al salir");
  await o.getByRole("navigation", { name: "Secciones" }).getByRole("link", { name: "Visitas" }).click();
  await expect(o.getByRole("dialog", { name: /^¿Guardar los cambios/ })).toHaveCount(0);
  await expect(o.getByRole("heading", { name: "Visitas" })).toBeVisible();
  await o.waitForTimeout(1_000);
  await o.goBack();
  await expect(o.getByRole("textbox", { name: "Introducción" })).toHaveValue("Se guarda al salir");
  await o.context().close();
});

test("sin conexión, lo escrito queda en el equipo: vuelve al abrir el informe y se guarda", async ({ browser }) => {
  const { o, id } = await informeEnBorrador(browser);
  await o.route(guardarInforme(id), (ruta) => ruta.abort("internetdisconnected"));
  await o.getByRole("textbox", { name: "Introducción" }).fill("Escrito sin señal");
  await expect(o.getByRole("status").filter({ hasText: "Sin conexión · se guarda al volver" })).toBeVisible({ timeout: 15_000 });
  // Se cierra la pestaña sin que se haya guardado.
  await o.close();

  const otra = await o.context().newPage();
  await otra.goto(`${OFICINA}/informes/${id}`);
  await expect(otra.getByRole("textbox", { name: "Introducción" })).toHaveValue("Escrito sin señal");
  await guardadoSolo(otra);
  await otra.context().close();
});

test("si lo que quedó en el equipo es de antes de lo que otra persona guardó, se pregunta; «Guardar la mía encima» lo guarda", async ({ browser }) => {
  const { o, id } = await informeEnBorrador(browser);
  await o.route(guardarInforme(id), (ruta) => ruta.abort("internetdisconnected"));
  await o.getByRole("textbox", { name: "Introducción" }).fill("Lo que no alcanzó a guardarse");
  await expect(o.getByRole("status").filter({ hasText: "Sin conexión · se guarda al volver" })).toBeVisible({ timeout: 15_000 });
  await o.close();

  // Otra persona guarda (por la API, como lo haría desde otro equipo).
  const pagina = await o.context().newPage();
  const actual = (await (await pagina.request.get(`${OFICINA}/api/informes/${id}`)).json()) as { version: number };
  const guardada = await pagina.request.post(`${OFICINA}/api/informes/${id}/borrador`, {
    headers: { origin: OFICINA },
    data: { version: actual.version, introduccion: "", conclusiones: "Lo de otra persona", levantamientos: [], planos: [], seleccion: { ocultos: [], mostrados: [] } },
  });
  expect(guardada.ok()).toBe(true);

  await pagina.goto(`${OFICINA}/informes/${id}`);
  await expect(pagina.getByText("Lo que escribió en este equipo no alcanzó a guardarse, y después otra persona guardó este informe.")).toBeVisible();
  await expect(pagina.getByRole("textbox", { name: "Conclusiones" })).toHaveValue("Lo de otra persona");
  await pagina.getByRole("button", { name: "Guardar la mía encima" }).click();
  await expect(pagina.getByRole("textbox", { name: "Introducción" })).toHaveValue("Lo que no alcanzó a guardarse");
  await guardadoSolo(pagina);
  await pagina.goto(`${OFICINA}/informes/${id}`);
  await expect(pagina.getByRole("textbox", { name: "Introducción" })).toHaveValue("Lo que no alcanzó a guardarse");
  await pagina.context().close();
});

