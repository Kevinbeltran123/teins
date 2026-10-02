import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { nuevaVisitaConCliente, nuevoUsuario } from "../consola";
import { CAMPO, OFICINA } from "../destino";
import { iniciarSesion, irAlPaso, irAlRecorrido } from "./ayudas";

const zona = { locale: "es-CO", timezoneId: "America/Bogota" };

test("oficina corrige un cliente: lo renombra, archiva un sitio, no archiva con visitas por hacer y recupera el cliente (ADR-0035)", async ({ browser }) => {
  const tecnico = nuevoUsuario("tecnico", "tecnico.e2e");
  const con = nuevaVisitaConCliente(tecnico);
  const persona = nuevoUsuario("oficina", "oficina");
  const nombre = `Cliente Corregido ${randomBytes(3).toString("hex")}`;
  const contexto = await browser.newContext({ ...zona, viewport: { width: 1366, height: 900 } });
  const o = await contexto.newPage();
  await o.goto(`${OFICINA}/`);
  await iniciarSesion(o, persona);
  await expect(o.getByRole("tab", { name: /Esperando revisión/ })).toBeVisible();

  // Con una visita por hacer no se archiva: el diálogo dice cuál y lleva a Visitas.
  await o.goto(`${OFICINA}/clientes/${con.clienteId}`);
  await o.getByRole("button", { name: `Más acciones para ${con.cliente}` }).click();
  await o.getByRole("menuitem", { name: "Archivar cliente" }).click();
  const bloqueo = o.getByRole("dialog");
  await expect(bloqueo.getByText("primero cancele o reprograme su visita", { exact: false })).toBeVisible();
  await expect(bloqueo.getByText(`Sede E2E · ${tecnico.nombre}`, { exact: false })).toBeVisible();
  await expect(bloqueo.getByRole("link", { name: "Ver sus visitas" })).toBeVisible();
  await bloqueo.getByRole("button", { name: "Volver" }).click();

  // Un cliente sin visitas, con dos sitios.
  await o.goto(`${OFICINA}/clientes`);
  await o.getByRole("button", { name: "Nuevo cliente" }).click();
  await o.getByLabel("Nombre del cliente").fill(`${nombre} (antes)`);
  await o.getByLabel("Nombre del sitio").fill("Sede norte");
  await o.getByLabel("Dirección del sitio").fill("Calle [N] # [N]-[N]");
  // El cliente llega con su contacto principal (iteración 29).
  await o.getByLabel("Nombre", { exact: true }).fill("Contacto E2E");
  await o.getByRole("textbox", { name: "Correo" }).fill("contacto@example.com");
  await o.getByRole("button", { name: "Crear cliente" }).click();
  await o.getByRole("link", { name: `${nombre} (antes)` }).click();

  // El único sitio activo no se archiva.
  await o.getByRole("button", { name: "Más acciones para Sede norte" }).click();
  await o.getByRole("menuitem", { name: "Archivar sitio" }).click();
  await expect(o.getByRole("dialog").getByText("Un cliente activo necesita al menos un sitio", { exact: false })).toBeVisible();
  await o.getByRole("dialog").getByRole("button", { name: "Volver" }).click();

  await o.getByRole("button", { name: `Agregar sitio a ${nombre} (antes)` }).click();
  await o.getByLabel("Nombre del sitio").fill("Bodega sur");
  await o.getByRole("dialog").getByLabel("Dirección", { exact: true }).fill("Carrera [N] # [N]-[N]");
  await o.getByRole("dialog").getByRole("button", { name: "Agregar sitio" }).click();
  const bodega = o.locator("li.fila").filter({ hasText: "Bodega sur" });
  await expect(bodega).toBeVisible();

  // Renombrar: el encabezado dice quién lo cambió.
  await o.getByRole("button", { name: "Editar", exact: true }).click();
  await o.getByLabel("Nombre del cliente").fill(nombre);
  await o.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(o.getByRole("heading", { name: nombre, exact: true })).toBeVisible();
  await expect(o.getByText(`Cambiado por ${persona.nombre}`, { exact: false })).toBeVisible();

  // Archivar un sitio sin visitas: se deshace desde la notificación.
  await o.getByRole("button", { name: "Más acciones para Bodega sur" }).click();
  await o.getByRole("menuitem", { name: "Archivar sitio" }).click();
  await o.getByRole("dialog").getByRole("button", { name: "Archivar sitio" }).click();
  await expect(bodega.getByText("Archivado", { exact: true })).toBeVisible();
  await o.getByRole("button", { name: "Deshacer" }).click();
  await expect(bodega.getByText("Archivado", { exact: true })).toHaveCount(0);

  // Archivar el cliente: sale de Activos, aparece en Archivados y se recupera.
  await o.getByRole("button", { name: `Más acciones para ${nombre}` }).click();
  await o.getByRole("menuitem", { name: "Archivar cliente" }).click();
  await o.getByRole("dialog").getByRole("button", { name: "Archivar cliente" }).click();
  await expect(o.getByRole("heading", { name: "Clientes" })).toBeVisible();
  await expect(o.getByRole("row").filter({ hasText: nombre })).toHaveCount(0);
  await o.getByRole("button", { name: "Ver en Archivados" }).click();
  await expect(o.getByRole("tab", { name: /Archivados/, selected: true })).toBeVisible();
  const archivado = o.getByRole("row").filter({ hasText: nombre });
  await expect(archivado.getByText(persona.nombre, { exact: false })).toBeVisible();
  await archivado.getByRole("button", { name: "Recuperar" }).click();
  await expect(archivado).toHaveCount(0);
  await o.getByRole("tab", { name: /Activos/ }).click();
  await expect(o.getByRole("row").filter({ hasText: nombre })).toBeVisible();
  await contexto.close();
});

test("el técnico descarta un levantamiento empezado y lo recupera desde Descartados (ADR-0035)", async ({ browser }) => {
  const tecnico = nuevoUsuario("tecnico", "tecnico.e2e");
  const { cliente } = nuevaVisitaConCliente(tecnico);
  const contexto = await browser.newContext({ ...zona, viewport: { width: 390, height: 844 } });
  const t = await contexto.newPage();
  await t.goto(`${CAMPO}/`);
  await iniciarSesion(t, tecnico);
  const siguiente = t.getByRole("region", { name: "Siguiente visita" });
  await siguiente.getByRole("button", { name: "Iniciar levantamiento" }).click();
  await irAlPaso(t, "Cuarto técnico");
  await t.getByRole("textbox", { name: "Descripción del sitio" }).fill("Empezado por error (E2E)");
  await irAlRecorrido(t);

  // Al final del recorrido; la hoja dice lo que pasa antes de descartar.
  await t.getByRole("button", { name: "Descartar levantamiento" }).click();
  await expect(t.getByRole("dialog").getByText("¿Descartar este levantamiento?")).toBeVisible();
  await t.getByRole("dialog").getByRole("button", { name: "Descartar", exact: true }).click();
  await expect(siguiente.getByText(cliente)).toBeVisible();
  await expect(siguiente.getByRole("button", { name: "Iniciar levantamiento" })).toBeVisible();

  // "Ver en Descartados" abre la papelera, con la fecha en que se borra.
  await t.getByRole("button", { name: "Ver en Descartados" }).click();
  const papelera = t.getByRole("dialog", { name: "Descartados" });
  await expect(papelera.getByText(`${cliente} · Sede E2E`, { exact: false })).toBeVisible();
  await expect(papelera.getByText(/^Se borra el /)).toBeVisible();
  await papelera.getByRole("button", { name: "Recuperar" }).click();
  await expect(t.getByText("Levantamiento recuperado", { exact: false })).toBeVisible();
  await expect(papelera.getByText("Nada descartado")).toBeVisible();
  await papelera.getByRole("button", { name: "Cerrar" }).click();
  await expect(siguiente.getByRole("button", { name: "Continuar levantamiento" })).toBeVisible();
  await contexto.close();
});
