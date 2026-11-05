import { expect, test } from "@playwright/test";
import { nuevaOrganizacion, nuevaVisitaConCliente, nuevoUsuario } from "../consola";
import { CAMPO, OFICINA, REMOTO } from "../destino";
import { filaDeLaBandeja, iniciarSesion, irAlPaso, irARevisar } from "./ayudas";

/*
  El caso de producción con los dos formatos de TEINS (iteración 47): con dos formatos vigentes, la visita ofrece un
  botón por formato, el levantamiento sigue el elegido y, enviado ese, la misma visita todavía ofrece el otro. Corre en
  una organización propia: las demás pruebas tienen un solo formato vigente y esperan «Iniciar levantamiento».
*/

test("con dos formatos vigentes, la visita ofrece los dos, el levantamiento sigue el elegido y oficina lo recibe", async ({ page, browser }) => {
  test.skip(REMOTO, "Publica formatos en una organización propia: solo en local.");
  test.setTimeout(120_000);
  const organizacion = nuevaOrganizacion(["prueba-ups.v10.json", "prueba-visita.v1.json"]);
  const tecnico = nuevoUsuario("tecnico", "tecnico.e2e", organizacion);
  const oficina = nuevoUsuario("oficina", "oficina.e2e", organizacion);
  const { cliente } = nuevaVisitaConCliente(tecnico, 0, organizacion);

  await page.goto(`${CAMPO}/`);
  await iniciarSesion(page, tecnico);
  const visita = page.getByRole("region", { name: "Siguiente visita" });
  await expect(visita.getByText(cliente)).toBeVisible();
  // Un botón por formato, con el nombre que ve el técnico, en lugar de «Iniciar levantamiento».
  await expect(visita.getByRole("button", { name: "Formato de prueba" })).toBeVisible();
  await expect(visita.getByRole("button", { name: "Iniciar levantamiento" })).toHaveCount(0);
  await visita.getByRole("button", { name: "Visita de prueba" }).click();

  // El recorrido es el del formato general, no el de UPS.
  await expect(page.getByRole("heading", { level: 1, name: "Llegada" })).toBeVisible();
  await irAlPaso(page, "Diagnóstico");
  await page.getByRole("textbox", { name: "Diagnóstico" }).fill("Diagnóstico de prueba E2E");
  await irARevisar(page);
  await page.getByRole("button", { name: "Enviar a oficina" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Enviar levantamiento" }).click();
  await expect(page.getByText("Recibido en oficina")).toBeVisible({ timeout: 30_000 });

  // Un levantamiento por visita (ADR-0054): la atendida ya no ofrece ningún formato, solo ver lo enviado.
  await page.getByRole("button", { name: "Volver a mis visitas" }).click();
  const atendida = page.getByRole("region", { name: "Atendidas hoy" });
  await atendida.getByRole("button", { name: new RegExp(cliente) }).click();
  await expect(atendida.getByRole("button", { name: "Ver lo que enviaste" })).toBeVisible();
  await expect(atendida.getByRole("button", { name: "Formato de prueba" })).toHaveCount(0);
  await expect(atendida.getByRole("button", { name: "Visita de prueba" })).toHaveCount(0);

  // Oficina recibe el levantamiento con lo escrito en el formato elegido.
  const escritorio = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "es-CO" });
  const bandeja = await escritorio.newPage();
  await bandeja.goto(`${OFICINA}/`);
  await iniciarSesion(bandeja, oficina);
  const fila = await filaDeLaBandeja(bandeja, tecnico.nombre);
  await expect(fila).toContainText(cliente);
  await fila.getByRole("link").click();
  await expect(bandeja.getByRole("heading", { name: `${cliente} · Sede E2E`, level: 1 })).toBeVisible();
  await expect(bandeja.getByText("Diagnóstico de prueba E2E")).toBeVisible();
  await escritorio.close();
});
