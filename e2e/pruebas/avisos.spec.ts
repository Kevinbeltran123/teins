import { expect, test, type Page } from "@playwright/test";
import { nuevaVisitaConCliente, nuevoUsuario } from "../consola";
import { CAMPO, OFICINA } from "../destino";
import { iniciarSesion } from "./ayudas";

/**
 * Servicio de avisos simulado en el navegador: el permiso empieza sin decidir y aceptarlo no depende de un
 * diálogo; la suscripción apunta a FCM, pero nadie envía (en el extremo a extremo no corre el worker, y en el
 * entorno de pruebas el servicio de avisos la rechaza y el servidor la borra).
 */
async function conAvisosSimulados(pagina: Page) {
  await pagina.addInitScript(() => {
    let permiso: NotificationPermission = "default";
    Object.defineProperty(Notification, "permission", { get: () => permiso, configurable: true });
    Notification.requestPermission = async () => (permiso = "granted");
    const clave = (bytes: number) => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(bytes)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    let actual: PushSubscription | null = null;
    const suscripcion = {
      endpoint: `https://fcm.googleapis.com/fcm/send/e2e-${crypto.randomUUID()}`,
      options: { applicationServerKey: null, userVisibleOnly: true },
      toJSON: () => ({ endpoint: suscripcion.endpoint, keys: { p256dh: clave(65), auth: clave(16) } }),
      unsubscribe: async () => {
        actual = null;
        return true;
      },
    } as unknown as PushSubscription;
    PushManager.prototype.getSubscription = async () => actual;
    PushManager.prototype.subscribe = async () => (actual = suscripcion);
  });
}

const alSuscribirse = (pagina: Page) => pagina.waitForResponse((r) => r.url().endsWith("/api/avisos/suscripciones") && r.request().method() === "POST");

test("en un teléfono sin la app instalada, campo guía la instalación antes de iniciar sesión (iteración 15)", async ({ page, browserName }) => {
  await page.goto(`${CAMPO}/`);
  await expect(page.getByRole("heading", { name: "Instala la app" })).toBeVisible();
  if (browserName === "webkit") {
    // iPhone: la app instalada no ve lo capturado en Safari, y los pasos son los de Safari.
    await expect(page.getByText("lo que captures aquí en Safari no pasa a la app instalada")).toBeVisible();
    const pasos = page.getByRole("list", { name: "Pasos para instalar" });
    await expect(pasos.getByRole("listitem")).toHaveCount(3);
    await expect(pasos.getByRole("img", { name: "ícono de Compartir" })).toBeVisible();
    await page.getByRole("button", { name: "Seguir en Safari" }).click();
  } else {
    await page.getByRole("button", { name: "Seguir en el navegador" }).click();
  }
  await expect(page.getByLabel("Usuario")).toBeVisible();
  // La decisión se recuerda en este teléfono.
  await page.reload();
  await expect(page.getByLabel("Usuario")).toBeVisible();
});

test("el técnico activa los avisos en su teléfono y oficina en su navegador (ADR-0023)", async ({ page, browser, browserName }) => {
  test.skip(browserName === "webkit", "En iPhone los avisos exigen la app instalada, que WebKit de escritorio no simula: se prueba en el iPhone");
  const tecnico = nuevoUsuario("tecnico", "tecnico.e2e");
  const revisora = nuevoUsuario("oficina", "oficina");
  nuevaVisitaConCliente(tecnico);

  // Campo: la tarjeta aparece bajo la siguiente visita y se activa con un toque.
  await conAvisosSimulados(page);
  await page.goto(`${CAMPO}/`);
  await iniciarSesion(page, tecnico);
  const tarjeta = page.getByRole("region", { name: "Avisos en este teléfono" });
  await expect(tarjeta).toBeVisible();
  const suscrita = alSuscribirse(page);
  await tarjeta.getByRole("button", { name: "Activar avisos" }).click();
  expect((await suscrita).status()).toBe(200);
  await expect(page.getByText("Avisos activados en este teléfono.")).toBeVisible();
  await expect(tarjeta).toHaveCount(0);
  await page.getByRole("button", { name: "Tu cuenta" }).click();
  await page.getByText("Diagnóstico del teléfono").click();
  await expect(page.getByRole("definition").filter({ hasText: /^Activos$/ })).toBeVisible();

  // Oficina: "Mi cuenta" los activa en este navegador y los desactiva.
  const escritorio = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "es-CO" });
  const o = await escritorio.newPage();
  await conAvisosSimulados(o);
  await o.goto(`${OFICINA}/`);
  await iniciarSesion(o, revisora);
  await o.getByRole("link", { name: /^Mi cuenta/ }).click();
  // Los avisos son una fila de Preferencias, con botón secundario (iteración 29).
  const avisos = o.getByRole("region", { name: "Preferencias" });
  const deOficina = alSuscribirse(o);
  await avisos.getByRole("button", { name: "Activar avisos" }).click();
  expect((await deOficina).status()).toBe(200);
  await expect(avisos.getByText("Activos en este navegador")).toBeVisible();
  await avisos.getByRole("button", { name: "Desactivar" }).click();
  await expect(avisos.getByRole("button", { name: "Activar avisos" })).toBeVisible();
  await escritorio.close();
});
