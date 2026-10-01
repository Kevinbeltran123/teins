import { randomBytes } from "node:crypto";
import { expect, test, type Browser } from "@playwright/test";
import { nuevaVisitaConCliente, nuevoAdministrador } from "../consola";
import { CAMPO, OFICINA } from "../destino";
import { activarSegundoFactor, crearUsuarioDesdeAdministracion, iniciarSesion } from "./ayudas";

/** Oficina se usa en un monitor de escritorio (docs/diseno/pendientes.md). */
const escritorio = (browser: Browser) => browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "es-CO" });

test("quien entra con una temporal la cambia antes de cualquier otra cosa, y después la cambia desde Mi cuenta (iteración 25)", async ({ browser }) => {
  const admin = nuevoAdministrador();
  const contextoAdmin = await escritorio(browser);
  const a = await contextoAdmin.newPage();
  await activarSegundoFactor(a, OFICINA, admin);
  await a.goto(`${OFICINA}/`);
  await a.getByRole("link", { name: "Administración" }).click();
  const sufijo = randomBytes(3).toString("hex");
  const persona = { usuario: `oficina.temp.${sufijo}`, nombre: `Oficina Temporal ${sufijo}` };
  const temporal = await crearUsuarioDesdeAdministracion(a, persona, "Oficina");
  await expect(a.getByRole("row").filter({ hasText: persona.nombre })).toContainText("Debe cambiar su contraseña");

  const contexto = await escritorio(browser);
  const page = await contexto.newPage();
  await page.goto(`${OFICINA}/`);
  await iniciarSesion(page, { usuario: persona.usuario, contrasena: temporal });
  // Solo esta pantalla: sin menú. La temporal ya la tiene la app, así que pide solo la nueva.
  await expect(page.getByRole("heading", { name: "Cree su contraseña" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Secciones" })).toHaveCount(0);
  await expect(page.getByLabel("Contraseña temporal")).toHaveCount(0);
  await page.getByLabel("Contraseña nueva", { exact: true }).fill("una-propia-de-oficina");
  await page.getByLabel("Repita la contraseña nueva").fill("otra-distinta-de-oficina");
  await page.getByRole("button", { name: "Guardar y entrar" }).click();
  await expect(page.getByText("No coincide con la nueva.")).toBeVisible();
  await page.getByLabel("Repita la contraseña nueva").fill("una-propia-de-oficina");
  await page.getByRole("button", { name: "Guardar y entrar" }).click();
  await expect(page.getByRole("heading", { name: "Contraseña cambiada" })).toBeVisible();
  await page.getByRole("button", { name: "Ir a Levantamientos" }).click();
  await expect(page.getByRole("navigation", { name: "Secciones" })).toBeVisible();
  // En Administración ya no queda pendiente.
  await a.reload();
  await expect(a.getByRole("row").filter({ hasText: persona.nombre })).not.toContainText("Debe cambiar su contraseña");

  // Desde Mi cuenta, con la actual: equivocada no pasa; bien escrita la cambia y la sesión sigue abierta.
  await page.getByRole("link", { name: /^Mi cuenta/ }).click();
  await page.getByRole("button", { name: "Cambiar contraseña" }).click();
  const hoja = page.getByRole("dialog", { name: "Cambiar contraseña" });
  await hoja.getByLabel("Contraseña actual").fill("no-es-la-actual");
  await hoja.getByLabel("Contraseña nueva", { exact: true }).fill("la-segunda-propia");
  await hoja.getByLabel("Repita la contraseña nueva").fill("la-segunda-propia");
  await hoja.getByRole("button", { name: "Cambiar contraseña" }).click();
  await expect(hoja.getByText("La contraseña actual no es correcta.")).toBeVisible();
  await hoja.getByLabel("Contraseña actual").fill("una-propia-de-oficina");
  await hoja.getByRole("button", { name: "Cambiar contraseña" }).click();
  await expect(page.getByText("Contraseña cambiada · se cerraron las demás sesiones")).toBeVisible();
  await expect(page.getByText("Cambiada hace un momento")).toBeVisible();

  // Quien administra no puede quitarse el segundo factor: se dice, sin botón.
  await a.getByRole("link", { name: /^Mi cuenta/ }).click();
  await expect(a.getByText("Activo · obligatorio para administrar, no se puede quitar")).toBeVisible();
  await expect(a.getByRole("button", { name: "Quitar segundo factor" })).toHaveCount(0);
  await contexto.close();
  await contextoAdmin.close();
});

test("reactivar entrega una temporal y el técnico crea la suya al entrar en campo (iteración 25)", async ({ browser }) => {
  const admin = nuevoAdministrador();
  const contextoAdmin = await escritorio(browser);
  const a = await contextoAdmin.newPage();
  await activarSegundoFactor(a, OFICINA, admin);
  await a.goto(`${OFICINA}/`);
  await a.getByRole("link", { name: "Administración" }).click();
  const sufijo = randomBytes(3).toString("hex");
  const tecnico = { usuario: `tecnico.react.${sufijo}`, nombre: `Técnico Reactivado ${sufijo}` };
  await crearUsuarioDesdeAdministracion(a, tecnico, "Técnico (campo)");

  const fila = a.getByRole("row").filter({ hasText: tecnico.nombre });
  await fila.getByRole("button", { name: `Más acciones para ${tecnico.nombre}` }).click();
  await a.getByRole("menuitem", { name: "Desactivar usuario" }).click();
  await a.getByRole("dialog").getByRole("button", { name: "Desactivar usuario" }).click();
  await expect(fila).toContainText("Desactivado");

  // Reactivar dice lo que pasa antes de hacerlo y entrega la temporal una sola vez.
  await fila.getByRole("button", { name: "Reactivar usuario" }).click();
  const confirmar = a.getByRole("dialog", { name: `¿Reactivar a ${tecnico.nombre}?` });
  await expect(confirmar.getByText("No recupera sesiones, llaves ni segundo factor")).toBeVisible();
  await expect(confirmar.getByText("Su teléfono empieza de cero")).toBeVisible();
  await confirmar.getByRole("button", { name: "Reactivar usuario" }).click();
  const entrega = a.getByRole("dialog", { name: "Usuario reactivado" });
  const temporal = (await entrega.locator("dt:has-text('Contraseña temporal') + dd code").textContent())!;
  await entrega.getByRole("button", { name: "Ya la entregué" }).click();
  await expect(fila).toContainText("Activo");
  await expect(fila).toContainText("Debe cambiar su contraseña");

  // En campo: crea la suya antes de ver sus visitas.
  const { cliente } = nuevaVisitaConCliente({ ...tecnico, contrasena: temporal });
  const telefono = await browser.newContext({ locale: "es-CO", viewport: { width: 390, height: 844 } });
  const t = await telefono.newPage();
  await t.goto(`${CAMPO}/`);
  await iniciarSesion(t, { usuario: tecnico.usuario, contrasena: temporal });
  await expect(t.getByRole("heading", { name: "Crea tu contraseña" })).toBeVisible();
  await t.getByLabel("Contraseña nueva", { exact: true }).fill("la-de-mi-telefono");
  await t.getByLabel("Repite la contraseña nueva").fill("la-de-mi-telefono");
  await t.getByRole("button", { name: "Guardar y entrar" }).click();
  await expect(t.getByRole("heading", { name: "Listo" })).toBeVisible();
  await t.getByRole("button", { name: "Ir a mis visitas" }).click();
  await expect(t.getByRole("region", { name: "Siguiente visita" }).getByText(cliente)).toBeVisible();

  // Y la puede cambiar después desde "Tu cuenta".
  await t.getByRole("button", { name: "Tu cuenta" }).click();
  await t.getByRole("button", { name: "Cambiar contraseña" }).click();
  const hoja = t.getByRole("dialog", { name: "Cambiar contraseña" });
  await hoja.getByLabel("Contraseña actual").fill("la-de-mi-telefono");
  await hoja.getByLabel("Contraseña nueva", { exact: true }).fill("la-segunda-del-telefono");
  await hoja.getByLabel("Repite la contraseña nueva").fill("la-segunda-del-telefono");
  await hoja.getByRole("button", { name: "Cambiar" }).click();
  await expect(t.getByText("Contraseña cambiada · se cerraron tus otras sesiones")).toBeVisible();
  await telefono.close();
  await contextoAdmin.close();
});
