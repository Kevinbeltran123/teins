import { expect, test, type Page } from "@playwright/test";
import { comando, nuevaVisita, nuevoUsuario } from "../consola";
import { CAMPO } from "../destino";
import { iniciarSesion, irAlPaso, irAlRecorrido } from "./ayudas";

/** Un técnico con una visita, con sesión en campo y un borrador empezado en esa visita. */
async function tecnicoConBorrador(page: Page) {
  const tecnico = nuevoUsuario("tecnico", "tecnico.e2e");
  const cliente = nuevaVisita(tecnico);
  await page.goto(`${CAMPO}/`);
  await iniciarSesion(page, tecnico);
  const visita = page.getByRole("region", { name: "Siguiente visita" });
  await expect(visita.getByText(cliente)).toBeVisible();
  await visita.getByRole("button", { name: "Iniciar levantamiento" }).click();
  await irAlPaso(page, "Cuarto técnico");
  await page.getByRole("textbox", { name: "Descripción del sitio" }).fill("Borrador E2E");
  await irAlRecorrido(page);
  await expect(page.getByText("Guardado en este teléfono", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Volver a mis visitas" }).click();
  return { tecnico, visita };
}

/** Lee la base local con IndexedDB directo: la prueba no depende del código de la app. */
const contar = (page: Page, tabla: string) =>
  page.evaluate(
    (t) =>
      new Promise<number>((resolver, rechazar) => {
        const apertura = indexedDB.open("teins-campo");
        apertura.onerror = () => rechazar(apertura.error);
        apertura.onsuccess = () => {
          const conteo = apertura.result.transaction(t).objectStore(t).count();
          conteo.onsuccess = () => {
            resolver(conteo.result);
            apertura.result.close();
          };
        };
      }),
    tabla,
  );

test("con el permiso local vencido la captura se bloquea sin borrar nada, y al conectarse se renueva (ADR-0009)", async ({ page, context, browserName }) => {
  // WebKit de Playwright no recarga sin red ("internal error"); Safari real sí (corte 0, modo avión).
  test.skip(browserName === "webkit", "Recargar sin red: se cubre en Chromium y en el iPhone");
  const { visita } = await tecnicoConBorrador(page);

  // El permiso vence: se simula moviendo su fecha al pasado, sin red para que no se renueve al abrir.
  await context.setOffline(true);
  await page.evaluate(
    () =>
      new Promise<void>((resolver, rechazar) => {
        const apertura = indexedDB.open("teins-campo");
        apertura.onerror = () => rechazar(apertura.error);
        apertura.onsuccess = () => {
          const tx = apertura.result.transaction(["bajadas"], "readwrite");
          const bajadas = tx.objectStore("bajadas");
          const cursor = bajadas.openCursor();
          cursor.onsuccess = () => {
            if (!cursor.result) return;
            cursor.result.update({ ...cursor.result.value, permisoLocalHasta: "2000-01-01T00:00:00.000Z" });
            cursor.result.continue();
          };
          tx.oncomplete = () => {
            apertura.result.close();
            resolver();
          };
        };
      }),
  );
  await page.reload();
  await expect(page.getByText("la captura quedó bloqueada por seguridad", { exact: false })).toBeVisible();
  await visita.getByRole("button", { name: "Continuar levantamiento" }).click();
  // El borrador se ve pero no se edita.
  await expect(page.getByText("Borrador E2E")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Descripción del sitio" })).toHaveCount(0);
  expect(await contar(page, "levantamientos")).toBe(1);

  // Con señal, la bajada renueva el permiso y la captura vuelve.
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  // Vuelve editable, en su recorrido (rediseño Recorrido): el borrador ya tenía datos.
  await expect(page.getByRole("navigation", { name: "Recorrido de la visita" })).toBeVisible({ timeout: 30_000 });
});

test("un técnico revocado pierde el acceso y el teléfono borra sus datos en el siguiente contacto (QA-5)", async ({ page }) => {
  const { tecnico } = await tecnicoConBorrador(page);
  expect(await contar(page, "levantamientos")).toBe(1);

  comando("desactivar-usuario", ["--usuario", tecnico.usuario]);
  // Siguiente contacto: recuperar señal pide la bajada, el servidor rechaza la sesión y el
  // dispositivo consulta con su secreto si tiene orden de borrado.
  await page.evaluate(() => window.dispatchEvent(new Event("online")));

  await expect(page.getByText(`Se cerró el acceso de ${tecnico.nombre} en este teléfono y se borraron sus datos.`)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Hola de nuevo" })).toBeVisible();
  expect(await contar(page, "levantamientos")).toBe(0);
  expect(await contar(page, "visitas")).toBe(0);

  // No vuelve a entrar.
  await iniciarSesion(page, tecnico);
  await expect(page.getByText("Usuario o contraseña incorrectos.")).toBeVisible();
});
