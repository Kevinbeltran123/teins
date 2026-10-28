import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { nuevaVisitaConCliente, nuevoUsuario } from "../consola";
import { CAMPO, OFICINA } from "../destino";
import { iniciarSesion, irAlPaso, irAlRecorrido } from "./ayudas";

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
  await o.getByRole("button", { name: "Nuevo cliente" }).click();
  await o.getByLabel("Nombre del cliente").fill(cliente);
  await o.getByLabel("Nombre del sitio").fill("Sede norte");
  await o.getByLabel("Dirección del sitio").fill("Calle [N] # [N]-[N]");
  // El cliente llega con su contacto principal (iteración 29).
  await o.getByLabel("Nombre", { exact: true }).fill("Contacto E2E");
  await o.getByRole("textbox", { name: "Correo" }).fill("contacto@example.com");
  await o.getByRole("button", { name: "Crear cliente" }).click();
  // Lo recién creado queda primero en la lista y una notificación lo confirma.
  await expect(o.getByRole("row").nth(1)).toContainText(cliente);
  await expect(o.getByText(`Cliente creado: ${cliente}`)).toBeVisible();

  await o.getByRole("link", { name: "Visitas" }).click();
  await o.getByRole("button", { name: "Programar visita", exact: true }).click();
  await o.getByLabel("Cliente", { exact: true }).selectOption({ label: cliente });
  // Un solo sitio: queda elegido.
  await expect(o.getByLabel("Sitio", { exact: true })).not.toHaveValue("");
  // Por omisión, de 9:00 a 11:00 (ADR-0037); el técnico nuevo está libre y se encuentra por su nombre.
  await expect(o.getByText("De 9:00 a. m. a 11:00 a. m.")).toBeVisible();
  await o.getByLabel("Buscar técnico").fill(tecnico.nombre);
  await o.getByRole("checkbox", { name: tecnico.nombre }).check();
  await o.getByRole("button", { name: /^Programar con / }).click();
  const fila = o.getByRole("row").filter({ hasText: cliente });
  await expect(fila).toContainText("9:00 a. m. a 11:00 a. m.");
  // Las visitas van agrupadas por día: la de hoy queda bajo "Hoy · …" (rediseño de oficina, iteración 23).
  const diaDe = () => o.locator("tbody").filter({ has: fila }).getByText(/^Hoy · /);
  await expect(diaDe()).toBeVisible();

  // El técnico la ve en su teléfono.
  const telefono = await browser.newContext({ ...zona, viewport: { width: 390, height: 844 } });
  const t = await telefono.newPage();
  await t.goto(`${CAMPO}/`);
  await iniciarSesion(t, tecnico);
  const siguiente = t.getByRole("region", { name: "Siguiente visita" });
  await expect(siguiente.getByText(cliente)).toBeVisible();
  await expect(siguiente.getByText("Hoy")).toBeVisible();

  // Reprogramada para mañana: al abrir la app, la fecha cambia.
  await fila.getByRole("button", { name: `Más acciones para la visita de ${cliente}` }).click();
  await o.getByRole("menuitem", { name: "Reprogramar" }).click();
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const manana = new Date(Date.now() + 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  // La fecha se elige en el calendario propio (no el del navegador).
  await o.getByRole("button", { name: /^Fecha: / }).click();
  if (manana.slice(0, 7) !== hoy.slice(0, 7)) await o.getByRole("button", { name: "Mes siguiente" }).click();
  await o.getByRole("option", { name: String(Number(manana.slice(8))), exact: true }).click();
  await o.getByRole("button", { name: "Reprogramar la visita", exact: true }).click();
  await expect(diaDe()).toHaveCount(0);
  await t.reload();
  await expect(siguiente.getByText(cliente)).toBeVisible();
  await expect(siguiente.getByText("Mañana")).toBeVisible();

  // El técnico ya empezó algo en esa visita.
  await siguiente.getByRole("button", { name: "Iniciar levantamiento" }).click();
  await irAlPaso(t, "Cuarto técnico");
  await t.getByRole("textbox", { name: "Descripción del sitio" }).fill("Empezado antes de cancelar (E2E)");
  await irAlRecorrido(t);
  await expect(t.getByText("Guardado en este teléfono", { exact: false })).toBeVisible();
  await t.getByRole("button", { name: "Volver a mis visitas" }).click();

  // Cancelada: queda en "Canceladas" con su motivo; en el teléfono solo sigue lo empezado, con el aviso (regla 17).
  await fila.getByRole("button", { name: `Más acciones para la visita de ${cliente}` }).click();
  await o.getByRole("menuitem", { name: "Cancelar visita" }).click();
  await o.getByLabel("Motivo de la cancelación").fill("El cliente la aplazó (E2E)");
  await o.getByRole("dialog").getByRole("button", { name: "Cancelar visita" }).click();
  await expect(fila).toHaveCount(0);
  await o.getByRole("tab", { name: "Canceladas" }).click();
  await expect(fila.getByText("El cliente la aplazó (E2E)", { exact: false })).toBeVisible();
  await t.reload();
  await expect(siguiente.getByText(cliente)).toBeVisible();
  await expect(siguiente.getByText("Oficina canceló esta visita.", { exact: false })).toBeVisible();
  await expect(siguiente.getByRole("button", { name: "Continuar levantamiento" })).toBeVisible();
  await expect(t.getByRole("button", { name: "Iniciar levantamiento" })).toHaveCount(0);

  await telefono.close();
  await escritorio.close();
});

test("lo que uno crea queda primero aunque otra persona cree un cliente al mismo tiempo", async ({ browser }) => {
  const o = await (await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "es-CO" })).newPage();
  await o.goto(`${OFICINA}/`);
  await iniciarSesion(o, nuevoUsuario("oficina", "oficina"));
  await o.getByRole("link", { name: "Clientes" }).click();
  await expect(o.getByRole("button", { name: "Nuevo cliente" })).toBeVisible();
  await expect(o.getByRole("row").nth(1)).toBeVisible();
  // Otra persona crea uno mientras la pantalla está abierta; su nombre va antes del nuestro en el orden alfabético.
  nuevaVisitaConCliente(nuevoUsuario("tecnico", "tecnico.e2e"));
  const cliente = `Cliente Programado ${randomBytes(3).toString("hex")}`;
  await o.getByRole("button", { name: "Nuevo cliente" }).click();
  await o.getByLabel("Nombre del cliente").fill(cliente);
  await o.getByLabel("Nombre del sitio").fill("Sede norte");
  await o.getByLabel("Dirección del sitio").fill("Calle [N] # [N]-[N]");
  await o.getByLabel("Nombre", { exact: true }).fill("Contacto E2E");
  await o.getByRole("textbox", { name: "Correo" }).fill("contacto@example.com");
  await o.getByRole("button", { name: "Crear cliente" }).click();
  await expect(o.getByText(`Cliente creado: ${cliente}`)).toBeVisible();
  await expect(o.getByRole("row").nth(1)).toContainText(cliente);
  await o.context().close();
});
