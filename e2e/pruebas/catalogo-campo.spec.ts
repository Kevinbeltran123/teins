import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { nuevaVisitaConCliente, nuevoUsuario } from "../consola";
import { CAMPO, OFICINA } from "../destino";
import { filaDeLaBandeja, fotoDePrueba, iniciarSesion, irAlPaso, irARevisar } from "./ayudas";

test("catálogo en el teléfono: el técnico elige el material del catálogo y llega vinculado a oficina (iteración 17)", async ({ page, browser }) => {
  const tecnico = nuevoUsuario("tecnico", "tecnico.e2e");
  const revisora = nuevoUsuario("oficina", "oficina");
  const { cliente } = nuevaVisitaConCliente(tecnico);
  // Código y descripción únicos por corrida: el catálogo es de la organización y las corridas lo comparten.
  const sufijo = randomBytes(3).toString("hex").toUpperCase();
  const codigo = `UTP-${sufijo}`;
  const descripcion = `Cable UTP categoría 6A ${sufijo}`;

  // Oficina crea el ítem antes de que el técnico inicie sesión: le llega en la primera bajada.
  const escritorio = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "es-CO" });
  const o = await escritorio.newPage();
  await o.goto(`${OFICINA}/`);
  await iniciarSesion(o, revisora);
  await o.getByRole("link", { name: "Catálogo" }).click();
  await o.getByRole("button", { name: "Nuevo ítem" }).click();
  const nuevo = o.getByRole("dialog", { name: "Nuevo ítem" });
  await nuevo.getByRole("textbox", { name: "Código" }).fill(codigo);
  await nuevo.getByRole("textbox", { name: "Descripción" }).fill(descripcion);
  await nuevo.getByRole("textbox", { name: "Unidad" }).fill("m");
  await nuevo.getByRole("button", { name: "Crear ítem" }).click();
  await expect(nuevo).toHaveCount(0);

  // Campo: busca sin tildes ni mayúsculas, elige y anota la cantidad.
  await page.goto(`${CAMPO}/`);
  await iniciarSesion(page, tecnico);
  const visita = page.getByRole("region", { name: "Siguiente visita" });
  await expect(visita.getByText(cliente)).toBeVisible();
  await visita.getByRole("button", { name: "Iniciar levantamiento" }).click();
  await irAlPaso(page, "Cuarto técnico");
  await page.getByRole("textbox", { name: "Potencia nominal" }).fill("15");
  await page.locator("input[type=file]").first().setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: fotoDePrueba() });
  await expect(page.getByRole("img", { name: "Foto 1 de Fotos del equipo" })).toBeVisible();

  // Materiales es su propio paso: el catálogo en una hoja alta, "Agregar" se vuelve − 1 + (rediseño Recorrido).
  await irAlPaso(page, "Materiales");
  await page.getByRole("button", { name: "Buscar en el catálogo" }).click();
  const hoja = page.getByRole("dialog", { name: "Catálogo" });
  await hoja.getByRole("searchbox", { name: "Buscar en el catálogo" }).fill(`cable categoria ${sufijo.toLowerCase()}`);
  await expect(hoja.getByRole("status")).toHaveText("1 ítem");
  await hoja.getByRole("button", { name: `Agregar ${descripcion}` }).click();
  await expect(hoja.getByRole("button", { name: `Más ${descripcion}` })).toBeVisible();
  await hoja.getByRole("button", { name: /^Listo · 1 material/ }).click();
  await expect(hoja).toHaveCount(0);
  const linea = page.getByRole("group", { name: "Línea 1" });
  await expect(linea.getByText(descripcion)).toBeVisible();
  await expect(linea.getByText(`${codigo} · m`)).toBeVisible();
  await linea.getByRole("textbox", { name: "Cantidad de la línea 1" }).fill("30");

  // Lo que no está entra como línea libre, con lo que ya se escribió.
  await page.getByRole("button", { name: "Buscar en el catálogo" }).click();
  await hoja.getByRole("searchbox", { name: "Buscar en el catálogo" }).fill(`Soporte en L ${sufijo}`);
  await expect(hoja.getByRole("status")).toHaveText("0 ítems");
  await hoja.getByRole("button", { name: `No está: agregar “Soporte en L ${sufijo}” como línea libre` }).click();
  await expect(page.getByRole("textbox", { name: "Descripción de la línea 2" })).toHaveValue(`Soporte en L ${sufijo}`);
  await page.getByRole("textbox", { name: "Cantidad de la línea 2" }).fill("4");

  await irARevisar(page);
  await page.getByRole("button", { name: "Enviar a oficina" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Enviar levantamiento" }).click();
  await expect(page.getByText("Recibido en oficina")).toBeVisible({ timeout: 60_000 });

  // Oficina: la línea llega vinculada y dice que la eligió el técnico; la libre, sin vincular.
  await o.getByRole("link", { name: "Levantamientos" }).click();
  await (await filaDeLaBandeja(o, tecnico.nombre)).getByRole("link").click();
  const tabla = o.getByRole("table", { name: "Materiales" });
  await expect(tabla.getByRole("cell", { name: `${codigo} · ${descripcion} Elegido en campo` })).toBeVisible();
  await expect(tabla.getByRole("cell", { name: "Sin vincular" })).toHaveCount(1);
  await escritorio.close();
});
