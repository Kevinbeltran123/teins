import { expect, test, type Browser, type Page } from "@playwright/test";
import { comando, nuevaOrganizacion, nuevoUsuario, type Usuario } from "../consola";
import { OFICINA, REMOTO } from "../destino";
import { activarSegundoFactor, iniciarSesion } from "./ayudas";

/**
 * El asistente de datos de oficina (iteración 53, ADR-0060), con el modelo simulado del servidor (ASISTENTE_SIMULADO):
 * un guion por palabras clave que usa las herramientas reales. Los datos de ejemplo van en una organización propia del
 * archivo (`sembrar-asistente`), así que las cifras son exactas: nada de otras pruebas entra en ella.
 */

// Contra un entorno desplegado no hay modelo simulado: las respuestas no serían las del guion.
test.skip(REMOTO, "El asistente se prueba con el modelo simulado, solo en local");

const CABLE = "¿Cuánto cable se gastó en los últimos 12 meses?";
const PRESUPUESTO = "¿Cuánto UTP presupuesto para un cableado de 40 puntos?";
const POR_MES = "¿Cuántas visitas hubo cada mes este año?";
/** Las respuestas de una organización pueden ir en cola, de a una. */
const RESPUESTA = { timeout: 45_000 };
/**
 * Un paso en curso, por su texto (las etiquetas de `herramientas/*.ts`): «Buscando…», «Sumando…» o, entre una consulta y
 * la siguiente vuelta del modelo, «Escribiendo la respuesta». Los hechos van en pasado: «Buscó…», «Sumó…».
 */
const EN_CURSO = /^(Buscando|Sumando|Calculando|Contando|Revisando|Leyendo) |^Escribiendo la respuesta$/;
/** Los cinco cableados revisados que siembra `sembrar-asistente`. */
const CABLEADOS = ["Clínica Santa Lucía del Tolima", "Hotel Mirador del Combeima", "Colegio Bilingüe Los Ocobos", "Distribuidora La Pola", "Centro Médico Los Lagos"];

/** La organización con los datos de ejemplo del asistente, sembrada una vez por archivo y navegador. */
let organizacion = "";
test.beforeAll(() => {
  organizacion = nuevaOrganizacion([]);
  const tecnico = nuevoUsuario("tecnico", "tecnico.chispa", organizacion);
  const revisora = nuevoUsuario("oficina", "revisora.chispa", organizacion);
  comando("sembrar-asistente", ["--organizacion", organizacion, "--tecnico", tecnico.usuario, "--revisor", revisora.usuario]);
});
/** Cada prueba con una persona nueva: su historial empieza vacío. */
const nuevaPersona = () => nuevoUsuario("oficina", "oficina", organizacion);

async function entrarAOficina(browser: Browser, persona: Usuario): Promise<Page> {
  const escritorio = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "es-CO" });
  const page = await escritorio.newPage();
  await page.goto(`${OFICINA}/`);
  await iniciarSesion(page, persona);
  return page;
}

const botonDelAsistente = (page: Page) => page.locator("#boton-asistente");
const panelDelAsistente = (page: Page) => page.getByRole("complementary", { name: "Chispa" });
/** La respuesta terminó: sus consultas quedan plegadas en la pastilla. */
const pastillaDeConsultas = (page: Page) => panelDelAsistente(page).getByRole("button", { name: /consultas? a sus datos/ });

async function modificador(page: Page) {
  const esMac = await page.evaluate(() => /mac|iphone|ipad/i.test((navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform));
  return esMac ? "Meta" : "Control";
}

test("una pregunta con datos: pasos, tabla del UTP, fuentes y el anuncio de que respondió (iteración 53)", async ({ browser }) => {
  const page = await entrarAOficina(browser, nuevaPersona());
  const boton = page.getByRole("button", { name: "Chispa", exact: true });
  await expect(boton).toHaveAttribute("aria-expanded", "false");
  await boton.click();
  await expect(boton).toHaveAttribute("aria-expanded", "true");

  const panel = panelDelAsistente(page);
  await expect(panel.getByRole("heading", { name: "Hola, Oficina" })).toBeVisible();
  await expect(panel.getByText(/^Respondo con 5 levantamientos revisados, del /)).toBeVisible();
  const sugerencias = panel.getByRole("group", { name: "Preguntas sugeridas" }).getByRole("button");
  await expect(sugerencias).toHaveCount(4);
  await sugerencias.filter({ hasText: CABLE }).click();

  // La pregunta en su burbuja y, mientras responde, las consultas abiertas: lo hecho en pasado y algo en curso.
  await expect(panel.getByRole("heading", { name: `Usted preguntó: ${CABLE}` })).toBeVisible();
  const pasos = panel.getByRole("list", { name: "Consultas a sus datos" });
  await expect(pasos).toContainText("Buscó «cable» en el catálogo");
  await expect(pasos.getByText(EN_CURSO).first()).toBeVisible();
  await expect(pastillaDeConsultas(page)).toHaveCount(0);

  // Al terminar, plegadas en la pastilla; abiertas, todas en pasado.
  await expect(pastillaDeConsultas(page)).toBeVisible(RESPUESTA);
  await pastillaDeConsultas(page).click();
  await expect(pasos.getByRole("listitem")).toHaveText([/^Buscó «cable» en el catálogo · \d+ ítems?$/, "Sumó el cable de 5 visitas revisadas · 4 filas"]);
  await expect(pasos.getByText(EN_CURSO)).toHaveCount(0);

  // 4.485 m en las 5 visitas revisadas; la sexta, sin revisar, queda fuera.
  const tabla = panel.getByRole("table", { name: "Cable por material" });
  const utp = tabla.getByRole("row").filter({ hasText: "CAB-UTP6" });
  await expect(utp.getByRole("cell").first()).toContainText("Cable UTP categoría 6");
  await expect(utp.getByRole("cell").nth(1)).toHaveText("4.485 m");
  await expect(utp.getByRole("cell").nth(2)).toHaveText("5");

  // Las fuentes son las visitas que aportaron: los cinco cableados y el sin revisar que tenía cable.
  await panel.getByRole("button", { name: "De 5 visitas revisadas y 1 sin revisar", exact: true }).click();
  const fuentes = panel.getByRole("listitem");
  await expect(fuentes.getByRole("link")).toHaveCount(6);
  for (const cliente of CABLEADOS) await expect(fuentes.filter({ hasText: cliente }).filter({ hasNotText: "Sin revisar" })).toHaveCount(1);
  await expect(fuentes.filter({ hasText: "Hotel Mirador del Combeima" }).filter({ hasText: "Sin revisar" })).toHaveCount(1);

  // El lector de pantalla oye que respondió.
  await expect(panel.locator('[aria-live="polite"]').filter({ hasText: /^Chispa respondió$/ })).toHaveCount(1);

  // Una fuente lleva a su levantamiento; el panel, sin velo, sigue abierto.
  await fuentes.filter({ hasText: CABLEADOS[0]! }).getByRole("link").click();
  await expect(page).toHaveURL(/\/levantamientos\/[0-9a-f-]{36}$/);
  await expect(panel).toBeVisible();
  await page.context().close();
});

test("el estimado de UTP para 40 puntos trae las dos cifras en el destacado (iteración 53)", async ({ browser }) => {
  const page = await entrarAOficina(browser, nuevaPersona());
  await page.getByRole("button", { name: "Chispa", exact: true }).click();
  const panel = panelDelAsistente(page);
  await panel.getByRole("group", { name: "Preguntas sugeridas" }).getByRole("button").filter({ hasText: PRESUPUESTO }).click();

  await expect(pastillaDeConsultas(page)).toBeVisible(RESPUESTA);
  // El destacado no tiene un rol propio: es la primera parte de la respuesta.
  const cifras = panel.locator(".asis-resultado .asis-cifra");
  await expect(cifras).toHaveText(["1.215m", "$ 3.523.500"]);
  const percentil = panel.getByRole("table", { name: "Cable UTP categoría 6 por punto de red" }).getByRole("row").filter({ hasText: "Percentil 80" });
  await expect(percentil).toContainText("1.215 m");
  await expect(percentil).toContainText("$ 3.523.500");
  await page.context().close();
});

test("con el panel cerrado, la respuesta llega en una notificación y el botón lo dice (iteración 53)", async ({ browser }) => {
  const page = await entrarAOficina(browser, nuevaPersona());
  const boton = botonDelAsistente(page);
  await page.getByRole("button", { name: "Chispa", exact: true }).click();
  const panel = panelDelAsistente(page);
  // Al abrirlo, el foco va a la caja.
  const caja = panel.getByRole("textbox", { name: "Pregunta" });
  await expect(caja).toBeFocused();

  // Tres vueltas del guion: da tiempo de cerrar antes de que termine.
  const pregunta = "¿Cuánto cable se usó este año?";
  await caja.fill(pregunta);
  await caja.press("Enter");
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(boton).toBeFocused();
  await expect(boton).toHaveAccessibleName("Chispa: respondiendo");

  const aviso = page.getByRole("status").filter({ hasText: `Chispa respondió: ${pregunta}` });
  await expect(aviso).toBeVisible(RESPUESTA);
  await expect(boton).toHaveAccessibleName("Chispa: hay una respuesta lista");

  await aviso.getByRole("button", { name: "Ver" }).click();
  await expect(panel.getByRole("heading", { name: `Usted preguntó: ${pregunta}` })).toBeVisible();
  await expect(panel.getByRole("table", { name: "Cable por material" })).toBeVisible();
  await expect(boton).toHaveAccessibleName("Chispa");
  await page.context().close();
});

test("el historial guarda la conversación; eliminarla se deshace desde la notificación (iteración 53)", async ({ browser }) => {
  const page = await entrarAOficina(browser, nuevaPersona());
  await page.getByRole("button", { name: "Chispa", exact: true }).click();
  const panel = panelDelAsistente(page);
  await panel.getByRole("group", { name: "Preguntas sugeridas" }).getByRole("button").filter({ hasText: POR_MES }).click();
  await expect(pastillaDeConsultas(page)).toBeVisible(RESPUESTA);

  await panel.getByRole("button", { name: "Conversaciones", exact: true }).click();
  await expect(panel.getByRole("heading", { name: "Conversaciones" })).toBeVisible();
  // Persona nueva: su única conversación.
  // Por el comienzo del nombre: «Más acciones para …» también lo lleva.
  const conversacion = panel.getByRole("button", { name: new RegExp(`^${POR_MES.replace("?", "\\?")}`) });
  await expect(conversacion).toHaveCount(1);

  await panel.getByRole("button", { name: /^Más acciones para / }).click();
  await page.getByRole("menuitem", { name: "Eliminar conversación" }).click();
  await expect(conversacion).toHaveCount(0);
  await expect(panel.getByText("Todavía no tiene conversaciones.")).toBeVisible();

  await page.getByRole("status").filter({ hasText: "Conversación eliminada" }).getByRole("button", { name: "Deshacer" }).click();
  await expect(conversacion).toHaveCount(1);
  await page.context().close();
});

test("detener una respuesta en curso y seguir preguntando en la misma conversación (iteración 53)", async ({ browser }) => {
  const page = await entrarAOficina(browser, nuevaPersona());
  await page.getByRole("button", { name: "Chispa", exact: true }).click();
  const panel = panelDelAsistente(page);
  await panel.getByRole("group", { name: "Preguntas sugeridas" }).getByRole("button").filter({ hasText: CABLE }).click();

  // El guion del cable da tres vueltas: hay tiempo de detenerlo a mitad.
  const detener = panel.getByRole("button", { name: "Detener la respuesta" });
  await detener.click();
  const primera = panel.getByRole("article").first();
  await expect(primera.getByText("Detuvo la respuesta.", { exact: false })).toBeVisible(RESPUESTA);
  await expect(panel.locator('[aria-live="polite"]').filter({ hasText: /^Detuvo la respuesta$/ })).toHaveCount(1);
  await expect(primera.getByRole("button", { name: "Volver a preguntar" })).toBeEnabled();
  await expect(detener).toHaveCount(0);
  const caja = panel.getByRole("textbox", { name: "Pregunta" });
  await expect(caja).toBeEnabled();

  // Otra pregunta en la misma conversación sí responde.
  await caja.fill(PRESUPUESTO);
  await caja.press("Enter");
  const segunda = panel.getByRole("article").nth(1);
  await expect(segunda.getByRole("heading", { name: `Usted preguntó: ${PRESUPUESTO}` })).toBeVisible();
  await expect(segunda.getByRole("button", { name: /consultas? a sus datos/ })).toBeVisible(RESPUESTA);
  await expect(segunda).toContainText("$ 3.523.500");
  await expect(panel.getByRole("article")).toHaveCount(2);
  await page.context().close();
});

test("seguir preguntando: dos intercambios en orden y una sola conversación en el historial (iteración 53)", async ({ browser }) => {
  const page = await entrarAOficina(browser, nuevaPersona());
  await page.getByRole("button", { name: "Chispa", exact: true }).click();
  const panel = panelDelAsistente(page);
  await panel.getByRole("group", { name: "Preguntas sugeridas" }).getByRole("button").filter({ hasText: POR_MES }).click();
  const intercambios = panel.getByRole("article");
  await expect(intercambios.first().getByRole("button", { name: /consultas? a sus datos/ })).toBeVisible(RESPUESTA);

  const caja = panel.getByRole("textbox", { name: "Pregunta" });
  await expect(caja).toHaveAttribute("placeholder", "Pregúntele algo más a Chispa");
  await caja.fill(PRESUPUESTO);
  await caja.press("Enter");
  await expect(intercambios).toHaveCount(2);
  await expect(intercambios.nth(1).getByRole("button", { name: /consultas? a sus datos/ })).toBeVisible(RESPUESTA);

  // En orden, cada pregunta con su respuesta: el gráfico en la primera, el estimado en la segunda.
  await expect(intercambios.nth(0).getByRole("heading", { name: `Usted preguntó: ${POR_MES}` })).toBeVisible();
  await expect(intercambios.nth(0).getByRole("figure")).toBeVisible();
  await expect(intercambios.nth(1).getByRole("heading", { name: `Usted preguntó: ${PRESUPUESTO}` })).toBeVisible();
  await expect(intercambios.nth(1)).toContainText("$ 3.523.500");
  await expect(intercambios.nth(1).getByRole("figure")).toHaveCount(0);

  // Una sola conversación, con el título de la primera pregunta.
  await panel.getByRole("button", { name: "Conversaciones", exact: true }).click();
  const conversaciones = panel.getByRole("button", { name: /preguntas? · / });
  await expect(conversaciones).toHaveCount(1);
  await expect(conversaciones).toContainText(POR_MES);
  await expect(conversaciones).toContainText("2 preguntas");
  await page.context().close();
});

test("desde Buscar se le pregunta a Chispa y la respuesta trae el gráfico de la serie (iteración 53)", async ({ browser }) => {
  const page = await entrarAOficina(browser, nuevaPersona());
  await expect(page.getByRole("button", { name: "Chispa", exact: true })).toBeVisible();

  await page.keyboard.press(`${await modificador(page)}+k`);
  const busqueda = page.getByRole("dialog", { name: "Buscar en oficina" });
  await busqueda.getByRole("combobox").fill("visitas por mes");
  const opcion = busqueda.getByRole("group", { name: "Chispa" }).getByRole("option", { name: "Preguntarle a Chispa «visitas por mes»" });
  await expect(opcion).toBeVisible();
  // Va al final de los resultados: desde el primero, la flecha arriba da la vuelta hasta ella.
  await page.keyboard.press("ArrowUp");
  await expect(opcion).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(busqueda).toHaveCount(0);

  const panel = panelDelAsistente(page);
  await expect(panel.getByRole("heading", { name: "Usted preguntó: visitas por mes" })).toBeVisible();
  // Las 41 visitas de UPS de los últimos 11 meses, más los cableados del año.
  const grafico = panel.getByRole("figure");
  await expect(grafico).toBeVisible(RESPUESTA);
  await expect(grafico.getByRole("heading", { name: "Visitas por mes" })).toBeVisible();
  await expect(grafico.getByRole("img", { name: /^\p{L}{3}( \d{2})?: [\d.]+$/u }).first()).toBeVisible();
  await grafico.getByRole("button", { name: "Ver los datos" }).click();
  await expect(grafico.getByRole("table", { name: "Visitas por mes" }).getByRole("row")).not.toHaveCount(0);
  await page.context().close();
});

// El tope es de toda la organización: esta prueba usa una propia, así no frena a las demás ni la deja en 0 si falla.
test("con el tope agotado no se puede preguntar; quien administra lo cambia desde el aviso (iteración 53)", async ({ browser }) => {
  const admin = nuevoUsuario("oficina", "admin", nuevaOrganizacion([]));
  comando("marcar-administrador", ["--usuario", admin.usuario]);
  const escritorio = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "es-CO" });
  const page = await escritorio.newPage();
  await activarSegundoFactor(page, OFICINA, admin);
  await page.goto(`${OFICINA}/`);
  await page.getByRole("navigation", { name: "Secciones" }).getByRole("link", { name: "Administración" }).click();
  await page.getByRole("tab", { name: "Chispa" }).click();
  await page.getByRole("tabpanel", { name: "Chispa" }).getByRole("button", { name: "Cambiar el tope" }).click();
  const dialogo = page.getByRole("dialog", { name: "Tope mensual de Chispa" });
  await dialogo.getByRole("textbox", { name: "Tope en dólares (US$)" }).fill("0");
  await dialogo.getByRole("button", { name: "Guardar el tope" }).click();
  await expect(dialogo).toHaveCount(0);
  await expect(page.getByRole("meter", { name: "Gasto del mes" })).toHaveAttribute("aria-valuenow", "100");

  // En otra sección: el aviso del panel lleva de vuelta a Administración.
  await page.getByRole("navigation", { name: "Secciones" }).getByRole("link", { name: "Levantamientos" }).click();
  await page.getByRole("button", { name: "Chispa", exact: true }).click();
  const panel = panelDelAsistente(page);
  await expect(panel.getByText(/^Se usó el tope de Chispa de este mes\. Se puede volver a preguntar el 1 de \p{L}+\.$/u)).toBeVisible();
  await expect(panel.getByRole("textbox", { name: "Pregunta" })).toBeDisabled();

  // Desde el aviso del panel, Administración abre el diálogo del tope.
  await panel.getByRole("button", { name: "Cambiar el tope" }).click();
  await dialogo.getByRole("textbox", { name: "Tope en dólares (US$)" }).fill("5");
  await dialogo.getByRole("button", { name: "Guardar el tope" }).click();
  await expect(dialogo).toHaveCount(0);
  await expect(panel.getByText(/^Se usó el tope de Chispa/)).toHaveCount(0);
  await expect(panel.getByRole("textbox", { name: "Pregunta" })).toBeEnabled();
  await escritorio.close();
});
