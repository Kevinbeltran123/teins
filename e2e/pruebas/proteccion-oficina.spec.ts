import { randomBytes } from "node:crypto";
import { expect, test as base, type Page } from "@playwright/test";
import { nuevaVisitaConCliente, nuevoUsuario } from "../consola";
import { OFICINA } from "../destino";
import { iniciarSesion } from "./ayudas";

/** Iteración 24c: en oficina, cada acción se confirma, se deshace o se valida según lo que cuesta (DESIGN.md). */

// Oficina se usa en un monitor de escritorio (docs/diseno/pendientes.md), no en el teléfono del proyecto.
const test = base.extend<{ page: Page }>({
  page: async ({ browser }, usar) => {
    const escritorio = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "es-CO", timezoneId: "America/Bogota" });
    await usar(await escritorio.newPage());
    await escritorio.close();
  },
});

test("desactivar un ítem del catálogo es al instante y «Deshacer» lo vuelve a activar", async ({ page }) => {
  const revisora = nuevoUsuario("oficina", "oficina");
  const codigo = `D24-${randomBytes(3).toString("hex").toUpperCase()}`;
  await page.goto(`${OFICINA}/`);
  await iniciarSesion(page, revisora);
  await page.getByRole("link", { name: "Catálogo" }).click();
  await page.getByRole("button", { name: "Importar CSV" }).click();
  const importar = page.getByRole("dialog", { name: "Importar desde un archivo" });
  await importar.locator("input[type=file]").setInputFiles({ name: "catalogo.csv", mimeType: "text/csv", buffer: Buffer.from(`Código;Descripción;Unidad\r\n${codigo};Canaleta de prueba;und\r\n`) });
  await importar.getByRole("button", { name: "Importar 1 ítem" }).click();
  await expect(page.getByText(/^Importado:/)).toBeVisible();
  await page.getByRole("searchbox", { name: "Buscar por código o descripción" }).fill(codigo);
  const fila = page.getByRole("table", { name: "Ítems del catálogo" }).getByRole("row").filter({ hasText: codigo });

  await fila.getByRole("button", { name: `Más acciones para ${codigo}` }).click();
  await page.getByRole("menuitem", { name: "Desactivar" }).click();
  // Sin diálogo: se revierte con un toque, así que no se pregunta.
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(fila).toContainText("Inactivo");
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(fila).not.toContainText("Inactivo");
  await expect(fila).toContainText("Activo");
});

test("reasignar dice quién deja de ver la visita y quién la recibe, y el botón nombra a quien la recibe", async ({ page }) => {
  const tecnico = nuevoUsuario("tecnico", "tecnico.e2e");
  const otro = nuevoUsuario("tecnico", "tecnico.e2e");
  const programadora = nuevoUsuario("oficina", "oficina");
  const { cliente } = nuevaVisitaConCliente(tecnico);
  await page.goto(`${OFICINA}/`);
  await iniciarSesion(page, programadora);
  await page.getByRole("link", { name: "Visitas" }).click();
  await page.getByRole("searchbox", { name: "Buscar visitas" }).fill(cliente);
  const fila = page.getByRole("row").filter({ hasText: cliente });
  await fila.getByRole("button", { name: `Más acciones para la visita de ${cliente}` }).click();
  await page.getByRole("menuitem", { name: "Reasignar técnicos" }).click();
  const hoja = page.getByRole("dialog", { name: "Reasignar técnicos" });
  // Los elegidos van primero; a los demás técnicos libres se los encuentra por el nombre (ADR-0037).
  await hoja.getByRole("checkbox", { name: tecnico.nombre }).uncheck();
  await hoja.getByLabel("Buscar técnico").fill(otro.nombre);
  await hoja.getByRole("checkbox", { name: otro.nombre }).check();
  await expect(hoja.getByText(`${tecnico.nombre} deja de verla en su teléfono`, { exact: false })).toBeVisible();
  await expect(hoja.getByText(`${otro.nombre} la recibe en su teléfono`, { exact: false })).toBeVisible();
  await hoja.getByRole("button", { name: `Reasignar a ${otro.nombre}` }).click();
  await expect(hoja).toHaveCount(0);
  await expect(fila).toContainText(otro.nombre);
});

test("un contacto con errores dice qué falta en cada campo y lleva el foco al primero", async ({ page }) => {
  const tecnico = nuevoUsuario("tecnico", "tecnico.e2e");
  const programadora = nuevoUsuario("oficina", "oficina");
  const { cliente } = nuevaVisitaConCliente(tecnico);
  await page.goto(`${OFICINA}/`);
  await iniciarSesion(page, programadora);
  await page.getByRole("link", { name: "Clientes" }).click();
  await page.getByRole("searchbox").fill(cliente);
  await page.getByRole("link", { name: cliente }).click();
  await page.getByRole("button", { name: "Nuevo contacto" }).click();
  const hoja = page.getByRole("dialog", { name: "Nuevo contacto" });
  await expect(hoja.getByRole("textbox", { name: "Correo" })).toHaveAttribute("type", "email");
  await expect(hoja.getByRole("textbox", { name: "Celular" })).toHaveAttribute("type", "tel");
  await hoja.getByRole("textbox", { name: "Nombre" }).fill("Marta Gil");
  await hoja.getByRole("textbox", { name: "Correo" }).fill("marta.gil@");
  await hoja.getByRole("button", { name: "Crear contacto" }).click();
  await expect(hoja.getByText("Revise el correo", { exact: false })).toBeVisible();
  await expect(hoja.getByRole("textbox", { name: "Correo" })).toBeFocused();
});

test("programar y reprogramar no aceptan fechas pasadas", async ({ page }) => {
  const programadora = nuevoUsuario("oficina", "oficina");
  await page.goto(`${OFICINA}/`);
  await iniciarSesion(page, programadora);
  await page.getByRole("link", { name: "Visitas" }).click();
  await page.getByRole("button", { name: "Programar visita", exact: true }).click();
  // El calendario propio no deja elegir un día pasado ni volver a un mes anterior (ADR-0037).
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  await page.getByRole("button", { name: /^Fecha: / }).click();
  await expect(page.getByRole("button", { name: "Mes anterior" })).toBeDisabled();
  await expect(page.getByRole("option", { name: String(Number(hoy.slice(8))), exact: true })).toBeEnabled();
  if (Number(hoy.slice(8)) > 1) await expect(page.getByRole("option", { name: String(Number(hoy.slice(8)) - 1), exact: true })).toBeDisabled();
});
