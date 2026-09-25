import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { nuevaVisitaConCliente, nuevoAdministrador } from "../consola";
import { CAMPO, OFICINA, PORTAL } from "../destino";
import { codigoTotp } from "../totp";
import { iniciarSesion } from "./ayudas";

test("administrar exige segundo factor; con él se crea un técnico y el acceso de un cliente, y se ve su teléfono (iteración 6)", async ({ browser }) => {
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
  await page.getByRole("button", { name: "Empezar la activación" }).click();
  await expect(page.getByRole("img", { name: "Código QR para la app autenticadora" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Códigos de respaldo" }).getByRole("listitem")).not.toHaveCount(0);
  const clave = (await page.getByText("Si no puede escanearlo").locator("code").textContent())!;
  await page.getByLabel("Código de 6 dígitos que muestra la app").fill(codigoTotp(clave));
  await page.getByRole("button", { name: "Confirmar y activar" }).click();
  await expect(page.getByRole("tab", { name: "Usuarios" })).toBeVisible();

  // Desde entonces, el ingreso pide el código.
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
  await iniciarSesion(page, admin);
  await expect(page.getByRole("heading", { name: "Código de verificación" })).toBeVisible();
  await page.getByLabel("Código").fill("000000");
  await page.getByRole("button", { name: "Verificar código" }).click();
  await expect(page.getByText("El código no es correcto", { exact: false })).toBeVisible();
  await page.getByLabel("Código").fill(codigoTotp(clave));
  await page.getByRole("button", { name: "Verificar código" }).click();
  await page.getByRole("link", { name: "Administración" }).click();

  // Crear un técnico: la contraseña temporal se muestra una vez.
  const sufijo = randomBytes(3).toString("hex");
  const tecnico = { usuario: `tecnico.adm.${sufijo}`, nombre: `Técnico Administrado ${sufijo}`, contrasena: "" };
  await page.getByLabel("Nombre completo").fill(tecnico.nombre);
  await page.getByLabel("Usuario para iniciar sesión").fill(tecnico.usuario);
  await page.getByRole("button", { name: "Crear usuario" }).click();
  await expect(page.getByRole("heading", { name: `Usuario creado: ${tecnico.nombre}` })).toBeVisible();
  tecnico.contrasena = (await page.getByText("Contraseña temporal:").locator("code").textContent())!;
  await page.getByRole("button", { name: "Ya la entregué" }).click();
  await expect(page.getByRole("row").filter({ hasText: tecnico.nombre })).toContainText("Activo");

  // El técnico entra a campo con esa contraseña; su teléfono aparece en administración.
  const { cliente } = nuevaVisitaConCliente(tecnico);
  const telefono = await browser.newContext({ locale: "es-CO", viewport: { width: 390, height: 844 } });
  const t = await telefono.newPage();
  await t.goto(`${CAMPO}/`);
  await iniciarSesion(t, tecnico);
  await expect(t.getByRole("region", { name: "Siguiente visita" }).getByText(cliente)).toBeVisible();
  await telefono.close();
  await page.getByRole("tab", { name: "Teléfonos de campo" }).click();
  await expect(page.getByRole("row").filter({ hasText: tecnico.nombre })).toContainText("En uso");

  // Acceso del cliente al portal, con QR y clave, que sirve de una vez.
  await page.getByRole("tab", { name: "Accesos de clientes" }).click();
  await page.getByRole("button", { name: `Crear acceso de ${cliente}` }).click();
  await expect(page.getByRole("img", { name: `Código QR del acceso de ${cliente}` })).toBeVisible();
  const claveCliente = (await page.getByText("Clave:").locator("code").textContent())!;
  const identificador = /\(va en el QR\): (\S+)/.exec((await page.getByText("va en el QR").textContent())!)![1]!;
  const celular = await browser.newContext({ locale: "es-CO", viewport: { width: 390, height: 844 } });
  const c = await celular.newPage();
  await c.goto(`${PORTAL}/?acceso=${identificador}`);
  await c.getByLabel("Clave").fill(claveCliente);
  await c.getByRole("button", { name: "Ver mis informes" }).click();
  await expect(c.getByRole("heading", { name: `Informes de ${cliente}` })).toBeVisible();

  // Regenerar cierra la sesión abierta del cliente, y el portal le dice por qué.
  await page.getByRole("button", { name: "Ya la entregué" }).click();
  await page.getByRole("button", { name: `Regenerar el acceso de ${cliente}` }).click();
  await page.getByRole("button", { name: `Sí, regenerar el acceso de ${cliente}` }).click();
  await expect(page.getByRole("img", { name: `Código QR del acceso de ${cliente}` })).toBeVisible();
  await c.reload();
  await expect(c.getByText("Su sesión se cerró", { exact: false })).toBeVisible();
  await expect(c.getByLabel("Clave")).toBeVisible();
  await celular.close();
  await escritorio.close();
});
