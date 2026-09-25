import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { nuevoUsuario } from "../consola";
import { CAMPO, OFICINA } from "../destino";
import { iniciarSesion } from "./ayudas";

test("oficina crea un cliente, programa una visita que llega al teléfono, la reprograma y la cancela (iteración 7)", async ({ browser }) => {
  const tecnico = nuevoUsuario("tecnico", "tecnico.e2e");
  const programadora = nuevoUsuario("oficina", "oficina");
  const cliente = `Cliente Programado ${randomBytes(3).toString("hex")}`;
  const zona = { locale: "es-CO", timezoneId: "America/Bogota" };

  // Oficina, en escritorio: el cliente con su sitio y la visita para hoy.
  const escritorio = await browser.newContext({ ...zona, viewport: { width: 1366, height: 900 } });
  const o = await escritorio.newPage();
  await o.goto(`${OFICINA}/`);
  await iniciarSesion(o, programadora);
  await o.getByRole("link", { name: "Clientes" }).click();
  await o.getByLabel("Nombre del cliente").fill(cliente);
  await o.getByLabel("Nombre del sitio").fill("Sede norte");
  await o.getByLabel("Dirección del sitio").fill("Calle [N] # [N]-[N]");
  await o.getByRole("button", { name: "Crear cliente" }).click();
  await expect(o.getByRole("heading", { name: cliente })).toBeVisible();

  await o.getByRole("link", { name: "Visitas" }).click();
  await o.getByRole("button", { name: "Programar visita", exact: true }).click();
  await o.getByLabel("Cliente", { exact: true }).selectOption({ label: cliente });
  // Un solo sitio: queda elegido.
  await expect(o.getByLabel("Sitio", { exact: true })).not.toHaveValue("");
  await o.getByRole("checkbox", { name: tecnico.nombre }).check();
  await o.getByRole("button", { name: "Programar la visita", exact: true }).click();
  const fila = o.getByRole("listitem").filter({ has: o.getByRole("heading", { name: cliente }) });
  await expect(fila.getByText(/^Hoy,/)).toBeVisible();

  // El técnico la ve en su teléfono.
  const telefono = await browser.newContext({ ...zona, viewport: { width: 390, height: 844 } });
  const t = await telefono.newPage();
  await t.goto(`${CAMPO}/`);
  await iniciarSesion(t, tecnico);
  const siguiente = t.getByRole("region", { name: "Siguiente visita" });
  await expect(siguiente.getByText(cliente)).toBeVisible();
  await expect(siguiente.getByText("Hoy")).toBeVisible();

  // Reprogramada para mañana: al abrir la app, la fecha cambia.
  await fila.getByRole("button", { name: `Reprogramar la visita de ${cliente}` }).click();
  const manana = new Date(Date.now() + 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  await o.getByLabel("Fecha nueva").fill(manana);
  await o.getByRole("button", { name: "Reprogramar la visita", exact: true }).click();
  await expect(fila.getByText(/^Hoy,/)).toHaveCount(0);
  await t.reload();
  await expect(siguiente.getByText(cliente)).toBeVisible();
  await expect(siguiente.getByText("Mañana")).toBeVisible();

  // Cancelada: sale del teléfono y queda en "Canceladas" con su motivo.
  await fila.getByRole("button", { name: `Cancelar la visita de ${cliente}` }).click();
  await o.getByLabel("Motivo de la cancelación").fill("El cliente la aplazó (E2E)");
  await o.getByRole("button", { name: "Sí, cancelar la visita" }).click();
  await expect(o.getByRole("heading", { name: cliente })).toHaveCount(0);
  await o.getByRole("tab", { name: "Canceladas" }).click();
  await expect(fila.getByText("El cliente la aplazó (E2E)", { exact: false })).toBeVisible();
  await t.reload();
  await expect(t.getByText("Sin visitas asignadas")).toBeVisible();
  await expect(t.getByText(cliente)).toHaveCount(0);

  await telefono.close();
  await escritorio.close();
});
