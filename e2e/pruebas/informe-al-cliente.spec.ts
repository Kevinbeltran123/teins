import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { nuevaVisita, nuevoUsuario, type Usuario } from "../consola";
import { CAMPO, OFICINA } from "../destino";
import { filaDeLaBandeja, fotoDePrueba, guardadoSolo, iniciarSesion, irAlPaso, irARevisar } from "./ayudas";

/**
 * Iteración 20 (ADR-0028): contactos del cliente y el informe publicado por correo y WhatsApp.
 * Usa las direcciones de prueba de Resend: con Resend real (entorno de pruebas) no dañan la reputación del
 * dominio, y simuladas (local) bounced@resend.dev también se rechaza. El rebote real llega unos segundos después.
 */

async function enviarDesdeCampo(page: Page, tecnico: Usuario, cliente: string) {
  await page.goto(`${CAMPO}/`);
  await iniciarSesion(page, tecnico);
  const visita = page.getByRole("region", { name: "Siguiente visita" });
  await expect(visita.getByText(cliente)).toBeVisible();
  await visita.getByRole("button", { name: "Iniciar levantamiento" }).click();
  await irAlPaso(page, "Cuarto técnico");
  await page.getByRole("textbox", { name: "Potencia nominal" }).fill("20");
  await page.getByRole("textbox", { name: "Descripción del sitio" }).fill("Cuarto para el envío al cliente");
  await page.locator("input[type=file]").first().setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: fotoDePrueba() });
  await expect(page.getByRole("img", { name: "Foto 1 de Fotos del equipo" })).toBeVisible();
  await irARevisar(page);
  await page.getByRole("button", { name: "Enviar a oficina" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Enviar levantamiento" }).click();
  await expect(page.getByText("Recibido en oficina")).toBeVisible({ timeout: 30_000 });
}

async function nuevoContacto(o: Page, datos: { nombre: string; correo: string; celular?: string; whatsapp?: boolean }) {
  await o.getByRole("button", { name: "Nuevo contacto" }).click();
  const hoja = o.getByRole("dialog", { name: "Nuevo contacto" });
  await hoja.getByRole("textbox", { name: "Nombre" }).fill(datos.nombre);
  await hoja.getByRole("textbox", { name: "Correo" }).fill(datos.correo);
  if (datos.celular) await hoja.getByRole("textbox", { name: "Celular" }).fill(datos.celular);
  if (datos.whatsapp) {
    await hoja.getByRole("checkbox", { name: "WhatsApp", exact: true }).check();
    // Sin la autorización, WhatsApp no se puede marcar: el formulario lo dice junto a la casilla.
    await hoja.getByRole("button", { name: "Crear contacto" }).click();
    await expect(hoja.getByText("WhatsApp exige que el contacto haya autorizado los mensajes.")).toBeVisible();
    await hoja.getByRole("checkbox", { name: /autorizó recibir el informe por WhatsApp/ }).check();
  }
  await hoja.getByRole("button", { name: "Crear contacto" }).click();
  await expect(o.getByText(`Contacto creado: ${datos.nombre}`)).toBeVisible();
}

test("oficina registra los contactos del cliente, publica con el PDF para ellos y vuelve a enviar lo que no llegó (ADR-0028)", async ({ page, browser }) => {
  const tecnico = nuevoUsuario("tecnico", "tecnico.e2e");
  const revisora = nuevoUsuario("oficina", "oficina");
  const cliente = nuevaVisita(tecnico);
  await enviarDesdeCampo(page, tecnico, cliente);

  const contexto = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "es-CO" });
  const o = await contexto.newPage();
  await o.goto(`${OFICINA}/`);
  await iniciarSesion(o, revisora);
  await expect(o.getByRole("tab", { name: /Esperando revisión/ })).toBeVisible();

  // En Clientes, "Nadie" avisa antes de publicar; la fila abre el cliente.
  await o.getByRole("navigation", { name: "Secciones" }).getByRole("link", { name: "Clientes" }).click();
  await o.getByRole("searchbox", { name: "Buscar cliente" }).fill(cliente);
  const fila = o.getByRole("row").filter({ hasText: cliente });
  await expect(fila.getByText("Nadie")).toBeVisible();
  await fila.getByRole("link", { name: cliente }).click();
  await expect(o.getByRole("heading", { name: cliente, level: 1 })).toBeVisible();
  await expect(o.getByText("Nadie de este cliente recibe los informes")).toBeVisible();

  await nuevoContacto(o, { nombre: "Ana Torres", correo: "delivered@resend.dev", celular: "300 555 0117", whatsapp: true });
  await nuevoContacto(o, { nombre: "Jorge Pardo", correo: "bounced@resend.dev" });
  const contactos = o.getByRole("table", { name: `Contactos de ${cliente}` });
  await expect(contactos.getByRole("row").filter({ hasText: "Ana Torres" })).toContainText("+57 300 555 0117");

  // Revisión mínima y el informe con el levantamiento.
  await o.getByRole("navigation", { name: "Secciones" }).getByRole("link", { name: "Levantamientos" }).click();
  await (await filaDeLaBandeja(o, tecnico.nombre)).getByRole("link").click();
  await o.getByRole("button", { name: "Tomar para revisar" }).click();
  await o.getByRole("button", { name: "Marcar revisado" }).click();
  await o.getByRole("dialog").getByRole("button", { name: "Marcar revisado" }).click();
  await o.getByRole("button", { name: "Abrir el informe" }).click();
  await expect(o.getByRole("heading", { name: `Informe de ${cliente}` })).toBeVisible();
  await o.getByRole("checkbox", { name: new RegExp(`de ${tecnico.nombre}`) }).check();
  await guardadoSolo(o);

  // Publicar: quienes reciben el informe vienen marcados.
  await o.getByRole("button", { name: "Publicar versión 1" }).click();
  const confirmar = o.getByRole("dialog", { name: "¿Publicar la versión 1?" });
  await expect(confirmar.getByRole("checkbox", { name: "Ana Torres" })).toBeChecked();
  await expect(confirmar.getByRole("checkbox", { name: "Jorge Pardo" })).toBeChecked();
  await confirmar.getByRole("button", { name: "Publicar y enviar a 2" }).click();
  await expect(o.getByText("Versión 1 vigente")).toBeVisible();

  // Salen cuando el PDF está listo; el que no llegó queda con su motivo junto a "Volver a enviar".
  const envios = o.getByRole("region", { name: "Envíos de la versión 1" });
  const jorge = envios.getByRole("listitem").filter({ hasText: "Jorge Pardo" });
  await expect(jorge.getByText("No llegó")).toBeVisible({ timeout: 90_000 });
  await expect(jorge).toContainText(/rebotó|no existe/);
  const salio = /^(Enviado|Entregado)$/;
  await expect(envios.getByRole("listitem").filter({ hasText: "Ana Torres" }).filter({ hasText: "WhatsApp" }).getByText(salio)).toBeVisible();
  await expect(envios.getByRole("listitem").filter({ hasText: "Ana Torres" }).filter({ hasText: "Correo" }).getByText(salio)).toBeVisible();
  await expect(envios.getByText("Un envío no llegó.")).toBeVisible();

  // La bandeja de Informes lo muestra hasta que se vuelve a enviar.
  await o.getByRole("navigation", { name: "Secciones" }).getByRole("link", { name: "Informes" }).click();
  await expect(o.getByRole("row").filter({ hasText: cliente }).getByText("Envío sin entregar")).toBeVisible();
  await o.getByRole("row").filter({ hasText: cliente }).getByRole("link").click();

  // Oficina corrige el correo en Clientes y vuelve a enviar solo ese envío.
  await o.getByRole("region", { name: "Envíos de la versión 1" }).getByRole("link", { name: "Clientes" }).click();
  await o.getByRole("row").filter({ hasText: "Jorge Pardo" }).getByRole("button", { name: "Editar a Jorge Pardo" }).click();
  const hoja = o.getByRole("dialog", { name: "Editar a Jorge Pardo" });
  await hoja.getByRole("textbox", { name: "Correo" }).fill("delivered@resend.dev");
  await hoja.getByRole("button", { name: "Guardar contacto" }).click();
  await expect(o.getByText("Contacto guardado: Jorge Pardo")).toBeVisible();
  await o.goBack();
  await expect(o.getByRole("heading", { name: `Informe de ${cliente}` })).toBeVisible();
  await jorge.getByRole("button", { name: "Volver a enviar" }).click();
  await expect(jorge.getByText(salio)).toBeVisible({ timeout: 30_000 });
  await expect(envios.getByText("Un envío no llegó.")).toHaveCount(0);

  await contexto.close();
});

test("si el PDF no se pudo generar, el envío no se ofrece otra vez: se publica una versión nueva", async ({ page, browser }) => {
  const tecnico = nuevoUsuario("tecnico", "tecnico.e2e");
  const revisora = nuevoUsuario("oficina", "oficina");
  const cliente = nuevaVisita(tecnico);
  await enviarDesdeCampo(page, tecnico, cliente);

  const contexto = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "es-CO" });
  const o = await contexto.newPage();
  await o.goto(`${OFICINA}/`);
  await iniciarSesion(o, revisora);
  await o.getByRole("navigation", { name: "Secciones" }).getByRole("link", { name: "Clientes" }).click();
  await o.getByRole("searchbox", { name: "Buscar cliente" }).fill(cliente);
  await o.getByRole("row").filter({ hasText: cliente }).getByRole("link", { name: cliente }).click();
  await expect(o.getByRole("heading", { name: cliente, level: 1 })).toBeVisible();
  await nuevoContacto(o, { nombre: "Ana Torres", correo: "delivered@resend.dev" });

  await o.getByRole("navigation", { name: "Secciones" }).getByRole("link", { name: "Levantamientos" }).click();
  await (await filaDeLaBandeja(o, tecnico.nombre)).getByRole("link").click();
  await o.getByRole("button", { name: "Tomar para revisar" }).click();
  await o.getByRole("button", { name: "Marcar revisado" }).click();
  await o.getByRole("dialog").getByRole("button", { name: "Marcar revisado" }).click();
  await o.getByRole("button", { name: "Abrir el informe" }).click();
  await expect(o.getByRole("heading", { name: `Informe de ${cliente}` })).toBeVisible();
  await o.getByRole("checkbox", { name: new RegExp(`de ${tecnico.nombre}`) }).check();
  // Empieza como un PDF, así que se verifica, pero no se puede anexar: el PDF del informe falla.
  await o.locator("input[type=file]").setInputFiles({ name: "Plano dañado.pdf", mimeType: "application/pdf", buffer: Buffer.from(`%PDF-1.7 ${randomUUID()} sin estructura`) });
  await expect(o.getByRole("textbox", { name: "Nombre del plano 1" })).toHaveValue("Plano dañado");
  // Al verificarlo, el servidor ve que no se puede anexar: lo dicen la fila, la ficha de la hoja y la confirmación.
  await expect(o.getByText("No se puede anexar al informe", { exact: false })).toBeVisible({ timeout: 30_000 });
  await expect(o.frameLocator('iframe[title^="Vista previa del informe"]').locator(".vista-anexo.ilegible")).toContainText("no se puede anexar");
  await guardadoSolo(o);
  await o.getByRole("button", { name: "Publicar versión 1" }).click();
  await expect(o.getByRole("dialog").getByText("El plano «Plano dañado» no se puede anexar")).toBeVisible();
  await expect(async () => {
    await o.getByRole("dialog").getByRole("button", { name: /^Publicar/ }).click();
    await expect(o.getByText("Versión 1 vigente")).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });

  const envios = o.getByRole("region", { name: "Envíos de la versión 1" });
  await expect(envios.getByText("No llegó", { exact: true })).toBeVisible({ timeout: 90_000 });
  await expect(envios).toContainText("No se pudo generar el PDF");
  await expect(envios.getByRole("button", { name: "Volver a enviar" })).toHaveCount(0);
  await expect(envios.getByRole("button", { name: /^Enviar a/ })).toHaveCount(0);
  await expect(envios.getByText("Revise el contacto")).toHaveCount(0);

  await contexto.close();
});
