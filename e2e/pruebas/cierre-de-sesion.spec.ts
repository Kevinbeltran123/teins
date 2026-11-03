import { expect, test } from "@playwright/test";
import { nuevaVisitaConCliente, nuevoUsuario } from "../consola";
import { CAMPO, REMOTO } from "../destino";
import { entrarAlPortal, iniciarSesion, nuevoContacto } from "./ayudas";

test("campo: cerrar sesión sin señal cierra la sesión del servidor en cuanto vuelve la señal", async ({ page, context }) => {
  const tecnico = nuevoUsuario("tecnico", "tecnico.e2e");
  await page.goto(`${CAMPO}/`);
  await iniciarSesion(page, tecnico);
  const sesionEnServidor = () => page.evaluate(async () => (await fetch("/api/sesion")).status);
  await expect(page.getByRole("button", { name: "Tu cuenta" })).toBeVisible();
  expect(await sesionEnServidor()).toBe(200);

  await context.setOffline(true);
  await page.getByRole("button", { name: "Tu cuenta" }).click();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page.getByLabel("Usuario")).toBeVisible();

  await context.setOffline(false);
  await expect.poll(sesionEnServidor).toBe(401);
});

test("portal: si salir no llega al servidor, lo dice y los documentos no quedan abiertos en silencio", async ({ page }) => {
  test.skip(REMOTO, "El código llega a un correo real en el entorno de pruebas.");
  const oficina = nuevoUsuario("oficina", "oficina.e2e");
  const { cliente, clienteId } = nuevaVisitaConCliente(nuevoUsuario("tecnico", "tecnico.e2e"));
  const correo = `salir.${clienteId.slice(0, 8)}@cliente.example`;
  await nuevoContacto(oficina, clienteId, { nombre: "Contacto E2E", correo, recibeInformes: true, recibeCotizaciones: false });
  await entrarAlPortal(page, correo);
  const titulo = page.getByRole("heading", { level: 1, name: cliente });
  await expect(titulo).toBeVisible();

  await page.route("**/api/portal/salir", (ruta) => ruta.abort());
  await page.getByRole("button", { name: "Salir" }).click();
  await expect(page.getByText("No se pudo cerrar la sesión", { exact: false })).toBeVisible();
  await expect(titulo).toBeVisible();

  await page.unroute("**/api/portal/salir");
  await page.getByRole("button", { name: "Salir" }).click();
  await expect(page.getByRole("button", { name: "Enviar código" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Enviar código" })).toBeVisible();
});
