import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, test, type Download, type Page } from "@playwright/test";
import { nuevaVisitaConCliente, nuevoUsuario } from "../consola";
import { CAMPO, OFICINA } from "../destino";
import { filaDeLaBandeja, fotoDePrueba, iniciarSesion, irAlPaso, irARevisar, verLoEnviado } from "./ayudas";

const contenido = async (descarga: Download) => (await readFile(await descarga.path())).toString("utf8");
const descargar = async (o: Page, boton: string) => {
  const [descarga] = await Promise.all([o.waitForEvent("download"), o.getByRole("button", { name: boton }).click()]);
  return descarga;
};

test("cantidades: el técnico anota líneas; oficina importa el catálogo, vincula, corrige y exporta (iteración 11)", async ({ page, browser }) => {
  const tecnico = nuevoUsuario("tecnico", "tecnico.e2e");
  const revisora = nuevoUsuario("oficina", "oficina");
  const { cliente } = nuevaVisitaConCliente(tecnico);
  // Códigos únicos por corrida: el catálogo es de la organización y las corridas lo comparten.
  const sufijo = randomBytes(3).toString("hex").toUpperCase();
  const [cable, breaker] = [`C12-${sufijo}`, `B20-${sufijo}`];

  // Campo: texto libre, con la cantidad como la escribe el técnico.
  await page.goto(`${CAMPO}/`);
  await iniciarSesion(page, tecnico);
  const visita = page.getByRole("region", { name: "Siguiente visita" });
  await expect(visita.getByText(cliente)).toBeVisible();
  await visita.getByRole("button", { name: "Iniciar levantamiento" }).click();
  await irAlPaso(page, "Cuarto técnico");
  await page.getByRole("textbox", { name: "Potencia nominal" }).fill("15");
  await page.locator("input[type=file]").first().setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: fotoDePrueba() });
  await expect(page.getByRole("img", { name: "Foto 1 de Fotos del equipo" })).toBeVisible();

  // Materiales es su propio paso; la línea libre es un enlace y la cantidad va con − y + (rediseño Recorrido).
  await irAlPaso(page, "Materiales");
  const lineaLibre = page.getByRole("button", { name: /agregar línea libre$/i });
  await lineaLibre.click();
  await page.getByRole("textbox", { name: "Descripción de la línea 1" }).fill("Cable 12 AWG");
  await page.getByRole("textbox", { name: "Cantidad de la línea 1" }).fill("25,5");
  await page.getByRole("radiogroup", { name: "Unidad de la línea 1" }).getByText("m", { exact: true }).click();
  await lineaLibre.click();
  await page.getByRole("textbox", { name: "Descripción de la línea 2" }).fill("Breaker 20 A");
  await page.getByRole("button", { name: "Más de la línea 2" }).click();
  await expect(page.getByRole("textbox", { name: "Cantidad de la línea 2" })).toHaveValue("2");
  await page.getByRole("group", { name: "Línea 2" }).getByRole("button", { name: "Agregar nota" }).click();
  await page.getByRole("textbox", { name: "Observación de la línea 2 (opcional)" }).fill("Uno de repuesto");
  // Bajar a 0 quita la línea.
  await lineaLibre.click();
  await page.getByRole("button", { name: "Menos de la línea 3" }).click();
  await expect(page.getByRole("group", { name: "Línea 3" })).toHaveCount(0);
  await irARevisar(page);
  await page.getByRole("button", { name: "Enviar a oficina" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Enviar levantamiento" }).click();
  await expect(page.getByText("Recibido en oficina")).toBeVisible({ timeout: 60_000 });
  await verLoEnviado(page);
  // Lo enviado se lee como tabla, con coma decimal.
  await expect(page.getByRole("table", { name: "Materiales" }).getByRole("cell", { name: "25,5" })).toBeVisible();

  const escritorio = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "es-CO", acceptDownloads: true });
  const o = await escritorio.newPage();
  await o.goto(`${OFICINA}/`);
  await iniciarSesion(o, revisora);

  // Catálogo: la lista de TEINS en CSV de Excel (punto y coma, encabezado, BOM).
  await o.getByRole("link", { name: "Catálogo" }).click();
  const csv = `﻿Código;Descripción;Unidad\r\n${cable};Cable THHN 12 AWG;m\r\n${breaker};"Breaker 1P; 20 A";und\r\n`;
  await o.getByRole("button", { name: "Importar CSV" }).click();
  const importar = o.getByRole("dialog", { name: "Importar desde un archivo" });
  await importar.locator("input[type=file]").setInputFiles({ name: "catalogo.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(importar.getByText("catalogo.csv: 2 ítems listos para importar.")).toBeVisible();
  await importar.getByRole("button", { name: "Importar 2 ítems" }).click();
  await expect(o.getByText("Importado: 2 ítems nuevos y 0 actualizados")).toBeVisible();
  await o.getByRole("searchbox", { name: "Buscar por código o descripción" }).fill(sufijo);
  await expect(o.getByRole("table", { name: "Ítems del catálogo" }).getByRole("row").filter({ hasText: sufijo })).toHaveCount(2);

  // Revisión: vincular la línea del cable y corregir la cantidad de breakers.
  await o.getByRole("link", { name: "Levantamientos" }).click();
  await (await filaDeLaBandeja(o, tecnico.nombre)).getByRole("link").click();
  const tabla = o.getByRole("table", { name: "Materiales" });
  await expect(tabla.getByRole("cell", { name: "Sin vincular" })).toHaveCount(2);
  await o.getByRole("button", { name: "Tomar para revisar" }).click();
  await o.getByRole("combobox", { name: "Ítem del catálogo para la línea 1" }).selectOption({ label: `${cable} · Cable THHN 12 AWG (m)` });
  await expect(o.getByText(`“Cable 12 AWG”: sin vincular → ${cable}`)).toBeVisible();

  await o.getByRole("button", { name: "Corregir materiales" }).click();
  const cantidad = o.getByRole("textbox", { name: "Cantidad de la línea 2" });
  await expect(cantidad).toHaveValue("2");
  await cantidad.fill("3");
  await o.getByRole("button", { name: "Guardar corrección" }).click();
  await expect(tabla.getByRole("cell", { name: "3", exact: true })).toBeVisible();
  // El vínculo sigue a la línea por su id: la corrección no lo pierde.
  await expect(o.getByRole("combobox", { name: "Ítem del catálogo para la línea 1" })).toHaveValue(/.+/);
  await expect(o.getByText("materiales: 2 líneas → 2 líneas")).toBeVisible();
  await o.getByRole("button", { name: "Marcar revisado" }).click();
  await o.getByRole("dialog").getByRole("button", { name: "Marcar revisado" }).click();
  await expect(tabla.getByRole("cell", { name: `${cable} · Cable THHN 12 AWG` })).toBeVisible();

  // Exportación de la visita: detalle y resumen para Excel en español.
  await o.getByRole("link", { name: "Visitas" }).click();
  const fila = o.getByRole("row").filter({ hasText: cliente });
  await fila.getByRole("button", { name: `Más acciones para la visita de ${cliente}` }).click();
  await o.getByRole("menuitem", { name: "Exportar cantidades" }).click();
  await expect(o.getByRole("dialog").getByText("2 líneas de 1 levantamiento · 1 sin vincular al catálogo")).toBeVisible();
  const detalle = await contenido(await descargar(o, "Descargar el detalle (CSV)"));
  expect(detalle.startsWith("﻿Fecha de la visita;Cliente;")).toBe(true);
  expect(detalle).toContain(`;Materiales · Materiales;Cable 12 AWG;25,5;m;;${cable};Cable THHN 12 AWG\r\n`);
  expect(detalle).toContain(";Breaker 20 A;3;und;Uno de repuesto;;\r\n");
  const resumen = await contenido(await descargar(o, "Descargar el resumen (CSV)"));
  expect(resumen).toContain(`${cable};Cable THHN 12 AWG;25,5;m;1\r\n`);
  expect(resumen).toContain("Sin vincular;Breaker 20 A;3;und;1\r\n");
  await escritorio.close();
});
