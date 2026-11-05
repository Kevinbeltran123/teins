import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { nuevaVisitaConCliente, nuevoAdministrador } from "../consola";
import { CAMPO, OFICINA } from "../destino";
import { codigoTotp } from "../totp";
import { dejarPasar, iniciarSesion, volverALaPestana } from "./ayudas";

test("los códigos de respaldo siguen a la vista hasta decir que se guardaron, aunque la sesión se relea (iteración 24)", async ({ browser }) => {
  const admin = nuevoAdministrador();
  const escritorio = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "es-CO" });
  const page = await escritorio.newPage();
  // El reloj del navegador se adelanta para que la sesión quede vieja (se relee pasado un minuto).
  await page.clock.install();
  await page.goto(`${OFICINA}/`);
  await iniciarSesion(page, admin);
  await page.getByRole("link", { name: "Administración" }).click();
  await page.getByLabel("Su contraseña").fill(admin.contrasena);
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByText("¿No puede escanearlo?").click();
  const clave = (await page.locator("details code").textContent())!.replace(/\s/g, "");
  await page.getByLabel("Código de 6 dígitos que muestra la app").fill(codigoTotp(clave));
  await page.getByRole("button", { name: "Verificar y activar" }).click();
  const codigos = page.getByRole("list", { name: "Códigos de respaldo" }).getByRole("listitem");
  await expect(codigos).not.toHaveCount(0);

  // Ya activo en el servidor: la sesión releída lo dice, pero los códigos no se vuelven a mostrar nunca.
  await page.clock.fastForward("01:01");
  const releida = page.waitForResponse((r) => r.url().endsWith("/api/sesion"));
  await volverALaPestana(page);
  await releida;
  await dejarPasar(page, 500);
  await expect(codigos).not.toHaveCount(0);

  await page.getByRole("button", { name: "Ya los guardé" }).click();
  await expect(page.getByRole("tab", { name: "Usuarios" })).toBeVisible();
  await escritorio.close();
});

test("administrar exige segundo factor; con él se crea un técnico y se ve su teléfono (iteración 6)", async ({ browser }) => {
  const admin = nuevoAdministrador();
  // Oficina se usa en un monitor de escritorio (docs/diseno/pendientes.md).
  const escritorio = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "es-CO" });
  const page = await escritorio.newPage();
  await page.goto(`${OFICINA}/`);
  await iniciarSesion(page, admin);

  // Sin segundo factor, la sección pide activarlo.
  await page.getByRole("link", { name: "Administración" }).click();
  await expect(page.getByRole("heading", { name: "Active el segundo factor para administrar" })).toBeVisible();
  await page.getByLabel("Su contraseña").fill(admin.contrasena);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("img", { name: "Código QR para la app autenticadora" })).toBeVisible();
  // La clave para escribir a mano está detrás de "¿No puede escanearlo?", en bloques de cuatro.
  await page.getByText("¿No puede escanearlo?").click();
  const clave = (await page.locator("details code").textContent())!.replace(/\s/g, "");
  await page.getByLabel("Código de 6 dígitos que muestra la app").fill(codigoTotp(clave));
  await page.getByRole("button", { name: "Verificar y activar" }).click();
  // Los códigos de respaldo se muestran después de verificar, antes de entrar a administrar.
  await expect(page.getByRole("list", { name: "Códigos de respaldo" }).getByRole("listitem")).not.toHaveCount(0);
  await page.getByRole("button", { name: "Ya los guardé" }).click();
  await expect(page.getByRole("tab", { name: "Usuarios" })).toBeVisible();

  // Desde entonces, el ingreso pide el código.
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Ingresar", exact: true })).toBeVisible();
  await iniciarSesion(page, admin);
  await expect(page.getByRole("heading", { name: "Código de verificación" })).toBeVisible();
  await page.getByLabel("Código").fill("000000");
  await page.getByRole("button", { name: "Verificar", exact: true }).click();
  await expect(page.getByText("El código no es correcto", { exact: false })).toBeVisible();
  await page.getByLabel("Código").fill(codigoTotp(clave));
  await page.getByRole("button", { name: "Verificar", exact: true }).click();
  await page.getByRole("link", { name: "Administración" }).click();

  // Crear un técnico: la contraseña temporal se muestra una vez.
  const sufijo = randomBytes(3).toString("hex");
  const tecnico = { usuario: `tecnico.adm.${sufijo}`, nombre: `Técnico Administrado ${sufijo}`, contrasena: "" };
  await page.getByRole("button", { name: "Nuevo usuario" }).click();
  // Dentro de la hoja: buscar en toda la página recorre la tabla de usuarios (lento en WebKit con muchas filas).
  const hoja = page.getByRole("dialog", { name: "Nuevo usuario" });
  await hoja.getByLabel("Nombre completo").fill(tecnico.nombre);
  await hoja.getByLabel("Usuario para iniciar sesión").fill(tecnico.usuario);
  await hoja.getByRole("button", { name: "Crear usuario" }).click();
  const entrega = page.getByRole("dialog", { name: "Usuario creado" });
  await expect(entrega.getByText(tecnico.nombre)).toBeVisible();
  tecnico.contrasena = (await entrega.locator("dt:has-text('Contraseña temporal') + dd code").textContent())!;
  await entrega.getByRole("button", { name: "Ya la entregué" }).click();
  // El usuario nuevo queda primero en la tabla.
  await expect(page.getByRole("row").nth(1)).toContainText(tecnico.nombre);
  await expect(page.getByRole("row").filter({ hasText: tecnico.nombre })).toContainText("Activo");

  // Restablecer lista todo lo que pasa, también el segundo factor; para uno mismo no se ofrece (iteración 24c).
  await page.getByRole("row").filter({ hasText: tecnico.nombre }).getByRole("button", { name: `Más acciones para ${tecnico.nombre}` }).click();
  await page.getByRole("menuitem", { name: "Restablecer contraseña" }).click();
  const restablecer = page.getByRole("dialog", { name: `¿Restablecer la contraseña de ${tecnico.nombre}?` });
  await expect(restablecer.getByText("Se quitan su segundo factor y sus llaves de acceso")).toBeVisible();
  await restablecer.getByRole("button", { name: "Cancelar" }).click();
  await page.getByRole("searchbox", { name: "Buscar usuarios" }).fill(admin.usuario);
  await expect(page.getByRole("row").filter({ hasText: admin.usuario })).toBeVisible();
  // La propia cuenta solo ofrece la cédula (iteración 47): restablecerse, desactivarse o quitarse la administración no.
  await page.getByRole("button", { name: `Más acciones para ${admin.nombre}` }).click();
  await expect(page.getByRole("menuitem", { name: "Poner cédula" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /Restablecer contraseña|Desactivar usuario|administración/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByRole("searchbox", { name: "Buscar usuarios" }).fill("");

  // El técnico entra a campo con esa contraseña; su teléfono aparece en administración.
  const { cliente } = nuevaVisitaConCliente(tecnico);
  const telefono = await browser.newContext({ locale: "es-CO", viewport: { width: 390, height: 844 } });
  const t = await telefono.newPage();
  await t.goto(`${CAMPO}/`);
  await iniciarSesion(t, tecnico);
  // Es temporal: crea la suya antes de ver sus visitas (iteración 25).
  await t.getByLabel("Contraseña nueva", { exact: true }).fill("propia-del-tecnico");
  await t.getByLabel("Repite la contraseña nueva").fill("propia-del-tecnico");
  await t.getByRole("button", { name: "Guardar y entrar" }).click();
  await t.getByRole("button", { name: "Ir a mis visitas" }).click();
  await expect(t.getByRole("region", { name: "Siguiente visita" }).getByText(cliente)).toBeVisible();
  await telefono.close();
  await page.getByRole("tab", { name: "Teléfonos de campo" }).click();
  await expect(page.getByRole("row").filter({ hasText: tecnico.nombre })).toContainText("En uso");
  await escritorio.close();
});
