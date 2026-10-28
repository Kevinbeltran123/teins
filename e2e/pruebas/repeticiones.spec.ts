import { expect, test } from "@playwright/test";
import { nuevaVisitaConCliente, nuevoUsuario } from "../consola";
import { CAMPO, OFICINA } from "../destino";
import { filaDeLaBandeja, fotoDePrueba, iniciarSesion, irAlPaso, irARevisar } from "./ayudas";

test("secciones repetibles: el técnico agrega tableros y quita uno; oficina los ve con su nombre y corrige uno (iteración 9)", async ({ page, browser }) => {
  const tecnico = nuevoUsuario("tecnico", "tecnico.e2e");
  const revisora = nuevoUsuario("oficina", "oficina");
  const { cliente } = nuevaVisitaConCliente(tecnico);

  // Campo: el formato vigente (v4) trae la sección repetible "Tableros".
  await page.goto(`${CAMPO}/`);
  await iniciarSesion(page, tecnico);
  const visita = page.getByRole("region", { name: "Siguiente visita" });
  await expect(visita.getByText(cliente)).toBeVisible();
  await visita.getByRole("button", { name: "Iniciar levantamiento" }).click();
  await irAlPaso(page, "Cuarto técnico");
  await page.getByRole("textbox", { name: "Potencia nominal" }).fill("15");
  await page.locator("input[type=file]").first().setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: fotoDePrueba() });
  await expect(page.getByRole("img", { name: "Foto 1 de Fotos del equipo" })).toBeVisible();

  // Tableros es un paso del recorrido: cada tablero, una tarjeta que se abre (rediseño Recorrido).
  await page.getByRole("button", { name: "Siguiente: tableros" }).click();
  const tableros = page.getByRole("region", { name: "Tableros" });
  await expect(tableros.getByText("Agrega uno por cada tablero", { exact: false })).toBeVisible();
  for (const [i, [ubicacion, corriente]] of ([["Sótano", "63"], ["Piso 2", "32"]] as const).entries()) {
    await tableros.getByRole("button", { name: "Agregar tablero" }).click();
    const nuevo = page.getByRole("article", { name: `Tablero ${i + 1}` });
    await nuevo.getByRole("textbox", { name: "Ubicación del tablero" }).fill(ubicacion);
    await nuevo.getByRole("textbox", { name: "Corriente nominal" }).fill(corriente);
    // El último de la lista vuelve a ella (iteración 32).
    await page.getByRole("button", { name: /^Listo, ver / }).click();
    await expect(tableros.getByRole("button", { name: `Tablero ${i + 1}` })).toContainText("Completo");
  }
  // El primero cambia de nombre; un tercero se agrega y se quita.
  // El primero cambia de nombre desde el menú ⋯; abajo sigue al siguiente sin volver a la lista (iteración 32).
  await tableros.getByRole("button", { name: /^Tablero 1/ }).click();
  await page.getByRole("button", { name: "Opciones de Tablero 1" }).click();
  await page.getByRole("menuitem", { name: "Cambiar nombre" }).click();
  await page.getByRole("textbox", { name: "Nombre del tablero" }).fill("Tablero principal");
  await page.getByRole("button", { name: "Listo", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Tablero principal" })).toBeVisible();
  await page.getByRole("button", { name: "Siguiente: Tablero 2" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Tablero 2" })).toBeVisible();
  await page.getByRole("button", { name: /^Listo, ver / }).click();
  await expect(tableros.getByRole("button", { name: /^Tablero principal/ })).toBeVisible();
  await tableros.getByRole("button", { name: "Agregar tablero" }).click();
  // Quitar es al instante, desde el menú, y se deshace desde la notificación (iteración 24c).
  await page.getByRole("button", { name: "Opciones de Tablero 3" }).click();
  await page.getByRole("menuitem", { name: "Quitar tablero" }).click();
  await expect(tableros.getByRole("button", { name: /^Tablero/ })).toHaveCount(2);

  await irARevisar(page);
  await page.getByRole("button", { name: "Enviar a oficina" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Enviar levantamiento" }).click();
  await expect(page.getByText("Recibido en oficina")).toBeVisible({ timeout: 30_000 });

  // Oficina: cada tablero es una sección con su nombre; corrige el segundo y el historial dice cuál.
  const escritorio = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "es-CO" });
  const o = await escritorio.newPage();
  await o.goto(`${OFICINA}/`);
  await iniciarSesion(o, revisora);
  await (await filaDeLaBandeja(o, tecnico.nombre)).getByRole("link").click();
  const principal = o.getByRole("region", { name: "Tableros · Tablero principal" });
  const segundo = o.getByRole("region", { name: "Tableros · Tablero 2" });
  await expect(principal.getByText("Sótano")).toBeVisible();
  await expect(segundo.getByText("32 A")).toBeVisible();

  await o.getByRole("button", { name: "Tomar para revisar" }).click();
  await segundo.getByRole("button", { name: "Corregir ubicación del tablero" }).click();
  await segundo.getByRole("textbox", { name: "Nuevo valor de ubicación del tablero" }).fill("Piso 3");
  await segundo.getByRole("textbox", { name: "Motivo de la corrección" }).fill("La placa dice piso 3");
  await segundo.getByRole("button", { name: "Guardar corrección" }).click();
  await expect(segundo.getByText("Piso 3", { exact: true })).toBeVisible();
  await o.getByRole("tab", { name: "Historial" }).click();
  await expect(o.getByText("Tableros · Tablero 2 · Ubicación del tablero: Piso 2 → Piso 3")).toBeVisible();

  // El informe se publica con los dos tableros.
  await o.getByRole("button", { name: "Marcar revisado" }).click();
  await o.getByRole("dialog").getByRole("button", { name: "Marcar revisado" }).click();
  await o.getByRole("button", { name: "Abrir el informe" }).click();
  await o.getByRole("checkbox", { name: new RegExp(`de ${tecnico.nombre}`) }).check();
  await o.getByRole("button", { name: "Publicar versión 1" }).click();
  await o.getByRole("dialog").getByRole("button", { name: "Publicar versión 1" }).click();
  await expect(o.getByRole("button", { name: "Descargar PDF de la versión 1" })).toBeVisible({ timeout: 60_000 });
  await escritorio.close();
});

test("«Completar ahora» con un dato de un tablero abre ese tablero y enfoca lo que falta", async ({ page }) => {
  const tecnico = nuevoUsuario("tecnico", "tecnico.e2e");
  const { cliente } = nuevaVisitaConCliente(tecnico);
  await page.goto(`${CAMPO}/`);
  await iniciarSesion(page, tecnico);
  const visita = page.getByRole("region", { name: "Siguiente visita" });
  await expect(visita.getByText(cliente)).toBeVisible();
  await visita.getByRole("button", { name: "Iniciar levantamiento" }).click();
  await irAlPaso(page, "Tableros");
  await page.getByRole("region", { name: "Tableros" }).getByRole("button", { name: "Agregar tablero" }).click();
  await page.getByRole("button", { name: /^Listo, ver / }).click();

  // Los datos que faltan son del tablero, que no está a la vista en la lista del paso.
  await page.getByRole("button", { name: "Siguiente: materiales" }).click();
  await page.getByRole("dialog", { name: /datos? en tableros/ }).getByRole("button", { name: "Completar ahora" }).click();
  const tablero = page.getByRole("article", { name: "Tablero 1" });
  await expect(tablero).toBeVisible();
  await expect(tablero.locator(":focus")).toHaveCount(1);
});
