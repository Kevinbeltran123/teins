import { expect, test, type Page } from "@playwright/test";
import { codigoDelPortal, nuevaVisitaConCliente, nuevoUsuario, ultimoCodigo } from "../consola";
import { CAMPO, OFICINA, PORTAL, REMOTO } from "../destino";
import { iniciarSesion, nuevoContacto } from "./ayudas";

/**
 * Iteración 24 (fallo 12 del grupo A): una ruta que no existe o una pantalla que falla al dibujarse lo dicen en
 * español y dejan una salida, en vez de la pantalla en blanco o el texto en inglés del enrutador.
 */

/** Desde aquí, dibujar un icono (SVG) falla: así se provoca un error al dibujar la pantalla siguiente. */
const romperLosIconos = (p: Page) =>
  p.evaluate(() => {
    Document.prototype.createElementNS = () => {
      throw new Error("Falla de prueba al dibujar");
    };
  });

async function oficina(page: Page) {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(`${OFICINA}/`);
  await iniciarSesion(page, nuevoUsuario("oficina", "oficina"));
  await expect(page.getByRole("tab", { name: /Esperando revisión/ })).toBeVisible();
}

test("oficina: una ruta que no existe lo dice y lleva a Levantamientos", async ({ page }) => {
  await oficina(page);
  await page.goto(`${OFICINA}/no-existe`);
  await expect(page.getByRole("heading", { name: "Esta página no existe" })).toBeVisible();
  await page.getByRole("link", { name: "Ir a Levantamientos" }).click();
  await expect(page.getByRole("tab", { name: /Esperando revisión/ })).toBeVisible();
});

test("oficina: si una pantalla falla al dibujarse, lo dice en español y ofrece volver a cargar", async ({ page }) => {
  await oficina(page);
  await romperLosIconos(page);
  await page.getByRole("navigation", { name: "Secciones" }).getByRole("link", { name: "Visitas" }).click();
  await expect(page.getByText("Algo falló al mostrar esta pantalla.")).toBeVisible();
  await page.getByRole("button", { name: "Volver a cargar" }).click();
  await expect(page.getByRole("heading", { name: "Visitas" })).toBeVisible();
});

test("portal: si la pantalla falla al dibujarse, lo dice y ofrece volver a cargar", async ({ page }) => {
  test.skip(REMOTO, "El código llega a un correo real en el entorno de pruebas.");
  const oficina = nuevoUsuario("oficina", "oficina.e2e");
  const { clienteId } = nuevaVisitaConCliente(nuevoUsuario("tecnico", "tecnico.e2e"));
  const correo = `falla.${clienteId.slice(0, 8)}@cliente.example`;
  await nuevoContacto(oficina, clienteId, { nombre: "Contacto E2E", correo, recibeInformes: true, recibeCotizaciones: false });
  const anterior = ultimoCodigo(correo);
  await page.goto(`${PORTAL}/`);
  await page.getByLabel("Correo").fill(correo);
  await page.getByRole("button", { name: "Enviar código" }).click();
  await page.getByLabel("Código").fill(await codigoDelPortal(correo, anterior));
  await romperLosIconos(page);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("Algo falló al mostrar el portal.")).toBeVisible();
  // Volver a cargar deja el portal funcionando: con la sesión, sus documentos; si el fallo llegó antes de abrirla, el ingreso.
  await page.getByRole("button", { name: "Volver a cargar" }).click();
  await expect(page.getByRole("button", { name: "Salir" }).or(page.getByRole("heading", { name: /^(Sus informes y cotizaciones|Revise su correo)$/ }))).toBeVisible();
  await expect(page.getByText("Algo falló al mostrar el portal.")).toHaveCount(0);
});

test("campo: si la pantalla falla al dibujarse, lo dice y ofrece volver a cargar; lo capturado sigue", async ({ page }) => {
  const tecnico = nuevoUsuario("tecnico", "tecnico.e2e");
  const { cliente } = nuevaVisitaConCliente(tecnico);
  await page.goto(`${CAMPO}/`);
  await iniciarSesion(page, tecnico);
  const visita = page.getByRole("region", { name: "Siguiente visita" });
  await expect(visita.getByText(cliente)).toBeVisible();
  await romperLosIconos(page);
  await visita.getByRole("button", { name: "Iniciar levantamiento" }).click();
  await expect(page.getByText("Algo falló al mostrar esta pantalla.")).toBeVisible();
  await page.getByRole("button", { name: "Volver a cargar" }).click();
  await expect(page.getByText(cliente).first()).toBeVisible();
});
