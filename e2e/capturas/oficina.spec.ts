import { expect, test, type Page } from "@playwright/test";
import { codigoDelPortal, ultimoCodigo } from "../consola";
import { OFICINA, PORTAL } from "../destino";
import { filaDeLaBandeja, guardadoSolo, pdfDePrueba } from "../pruebas/ayudas";
import { codigoTotp } from "../totp";
import { aLaVista, capturar, CATALOGO, CLIENTES, CONTRASENA, CONTRASENA_NUEVA, FORMATOS, leerEstado, leerFormato, PERSONAS } from "./comun";

/*
  Oficina y el portal del cliente, en escritorio, en el orden del manual de oficina. Continúa la historia de
  campo.spec.ts: los levantamientos ya están en la bandeja y oficina ya le preguntó algo al técnico.
*/

const A = leerFormato(FORMATOS[0]!);
const minuscula = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

async function ingresar(page: Page, usuario: string, contrasena: string) {
  await page.goto(`${OFICINA}/`);
  await page.getByLabel("Usuario").fill(usuario);
  await page.getByLabel("Contraseña").fill(contrasena);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
}
async function salir(page: Page) {
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await aLaVista(page.getByRole("heading", { name: "Ingresar", exact: true }));
}
const menu = (page: Page, seccion: string) => page.getByRole("navigation", { name: "Secciones" }).getByRole("link", { name: seccion }).click();

async function abrirDeLaBandeja(page: Page, cliente: string) {
  await menu(page, "Levantamientos");
  await (await filaDeLaBandeja(page, cliente)).getByRole("link").click();
}
async function tomarYMarcarRevisado(page: Page) {
  await page.getByRole("button", { name: "Tomar para revisar" }).click();
  await page.getByRole("button", { name: "Marcar revisado" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Marcar revisado" }).click();
  await aLaVista(page.getByRole("button", { name: "Abrir el informe" }));
}

test("oficina y el portal", async ({ page, browser }) => {
  const estado = leerEstado();

  // 2. Entrar: primera vez, con la contraseña temporal.
  await page.goto(`${OFICINA}/`);
  await page.getByLabel("Usuario").fill(PERSONAS.oficina.usuario);
  await page.getByLabel("Contraseña").fill(estado.temporalOficina);
  await capturar(page, "oficina-01-ingresar", { resaltar: page.getByRole("button", { name: "Ingresar", exact: true }) });
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await page.getByLabel("Contraseña nueva", { exact: true }).fill(CONTRASENA_NUEVA);
  await page.getByLabel("Repita la contraseña nueva").fill(CONTRASENA_NUEVA);
  await capturar(page, "oficina-02-cree-su-contrasena", { resaltar: page.getByRole("button", { name: "Guardar y entrar" }) });
  await page.getByRole("button", { name: "Guardar y entrar" }).click();
  await page.getByRole("button", { name: "Ir a Levantamientos" }).click();
  await aLaVista(page.getByRole("tab", { name: /Esperando revisión/ }));
  await salir(page);

  // Segundo factor de quien administra: lo activa en pantalla.
  await ingresar(page, PERSONAS.admin2.usuario, CONTRASENA);
  await menu(page, "Administración");
  await page.getByLabel("Su contraseña").fill(CONTRASENA);
  await page.getByRole("button", { name: "Continuar" }).click();
  await aLaVista(page.getByRole("img", { name: "Código QR para la app autenticadora" }));
  await page.getByText("¿No puede escanearlo?").click();
  const clave = (await page.locator("details code").textContent())!.replace(/\s/g, "");
  await page.getByLabel("Código de 6 dígitos que muestra la app").fill(codigoTotp(clave));
  await capturar(page, "oficina-03-segundo-factor", { resaltar: page.getByRole("button", { name: "Verificar y activar" }) });
  await page.getByRole("button", { name: "Verificar y activar" }).click();
  await aLaVista(page.getByRole("list", { name: "Códigos de respaldo" }));
  await page.getByRole("button", { name: "Ya los guardé" }).click();
  await salir(page);
  await ingresar(page, PERSONAS.admin2.usuario, CONTRASENA);
  await aLaVista(page.getByRole("heading", { name: "Código de verificación" }));
  // Un código nuevo: el de la activación ya se usó.
  await page.waitForTimeout(31_000 - (Date.now() % 30_000));
  await page.getByLabel("Código").fill(codigoTotp(clave));
  await capturar(page, "oficina-04-codigo-de-verificacion", { resaltar: page.getByRole("button", { name: "Verificar", exact: true }) });
  await page.getByRole("button", { name: "Verificar", exact: true }).click();
  await aLaVista(page.getByRole("tab", { name: /Esperando revisión/ }));

  // 3. Clientes, contactos y visitas.
  await menu(page, "Clientes");
  await aLaVista(page.getByRole("row").filter({ hasText: CLIENTES.clinica.nombre }));
  await capturar(page, "oficina-05-clientes", { resaltar: page.getByRole("button", { name: "Nuevo cliente" }) });
  await page.getByRole("row").filter({ hasText: CLIENTES.clinica.nombre }).getByRole("link", { name: CLIENTES.clinica.nombre }).click();
  await aLaVista(page.getByRole("switch", { name: `Acceso al portal de ${CLIENTES.clinica.contacto.nombre}` }));
  await capturar(page, "oficina-06-cliente", { resaltar: page.getByRole("button", { name: "Nuevo contacto" }) });

  await menu(page, "Visitas");
  await aLaVista(page.getByRole("row").filter({ hasText: CLIENTES.bodegas.nombre }));
  await capturar(page, "oficina-07-visitas", { resaltar: page.getByRole("button", { name: "Programar visita", exact: true }) });
  await page.getByRole("button", { name: "Programar visita", exact: true }).click();
  await page.getByLabel("Cliente", { exact: true }).selectOption({ label: CLIENTES.hotel.nombre });
  await expect(page.getByLabel("Sitio", { exact: true })).not.toHaveValue("");
  const solicitante = page.getByLabel("Solicitante");
  await expect(solicitante.locator("option", { hasText: CLIENTES.hotel.contacto.nombre })).toHaveCount(1);
  await solicitante.selectOption((await solicitante.locator("option", { hasText: CLIENTES.hotel.contacto.nombre }).getAttribute("value"))!);
  await page.getByLabel("Referencia del cliente").fill("SOL-0457");
  // Con dos formatos no hay servicio puesto: se elige el primero, el de servicio (ADR-0057).
  await page.getByLabel("Servicio", { exact: true }).selectOption({ index: 1 });
  await page.getByRole("checkbox", { name: new RegExp(`^${PERSONAS.tecnico2.nombre}`) }).check();
  const programar = page.getByRole("button", { name: /^Programar (con |la visita)/ });
  await capturar(page, "oficina-08-programar-visita", { resaltar: programar });
  await programar.click();
  await aLaVista(page.getByRole("row").filter({ hasText: CLIENTES.hotel.nombre }));

  // 4. La bandeja y la revisión.
  await menu(page, "Levantamientos");
  await aLaVista(page.getByRole("tabpanel", { name: "Esperando revisión" }).getByRole("row").filter({ hasText: CLIENTES.clinica.nombre }));
  await capturar(page, "oficina-09-bandeja", { resaltar: page.getByRole("button", { name: "Tomar el más antiguo" }) });
  await (await filaDeLaBandeja(page, CLIENTES.clinica.nombre)).getByRole("link").click();
  await page.getByRole("button", { name: "Tomar para revisar" }).click();
  await aLaVista(page.getByRole("region", { name: "Revisión" }).getByText("la tomó usted"));
  await capturar(page, "oficina-10-revision", { resaltar: page.getByRole("button", { name: "Marcar revisado" }) });

  // Una corrección: el nombre completo de quien recibió, o el primer texto del formato.
  const texto = A.secciones.flatMap((s) => (s.repetible ? [] : s.campos)).find((c) => c.tipo === "texto")!;
  await page.getByRole("button", { name: `Corregir ${minuscula(texto.etiqueta)}` }).first().click();
  const nuevo = page.getByRole("textbox", { name: `Nuevo valor de ${minuscula(texto.etiqueta)}` });
  await nuevo.fill(/recibe/i.test(texto.etiqueta) ? `${CLIENTES.clinica.contacto.nombre}, jefe de mantenimiento` : /marca/i.test(texto.etiqueta) ? "Voltria Power" : "Sin novedad. Se verificó con el cliente.");
  await page.getByRole("textbox", { name: "Motivo de la corrección" }).fill("Así aparece en la constancia firmada por el cliente.");
  await capturar(page, "oficina-11-corregir", { resaltar: page.getByRole("button", { name: "Guardar corrección" }) });
  await page.getByRole("button", { name: "Guardar corrección" }).click();
  await expect(page.getByRole("button", { name: "Guardar corrección" })).toHaveCount(0);

  await page.getByRole("tab", { name: /^Comentarios/ }).click();
  const hilo = page.getByRole("region", { name: /^Conversación sobre / }).first();
  await aLaVista(hilo);
  await hilo.getByRole("textbox", { name: /^Responder a / }).fill("Gracias, Andrés. Así queda en el informe.");
  await capturar(page, "oficina-12-comentarios", { resaltar: hilo.getByRole("textbox", { name: /^Responder a / }) });
  await hilo.getByRole("textbox", { name: /^Responder a / }).press("Enter");
  await aLaVista(hilo.getByText("Gracias, Andrés. Así queda en el informe."));

  await page.getByRole("button", { name: "Marcar revisado" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Marcar revisado" }).click();
  await aLaVista(page.getByRole("button", { name: "Abrir el informe" }));
  await page.getByRole("tab", { name: "Historial" }).click();
  await aLaVista(page.getByText("Historial íntegro"));
  await capturar(page, "oficina-13-historial", { resaltar: page.getByText("Historial íntegro") });

  // Los otros dos levantamientos quedan revisados (la cotización puede salir del segundo).
  await abrirDeLaBandeja(page, CLIENTES.bodegas.nombre);
  await tomarYMarcarRevisado(page);
  await abrirDeLaBandeja(page, CLIENTES.hotel.nombre);
  await tomarYMarcarRevisado(page);

  // 5. El informe de la visita principal.
  await page.goto(`${OFICINA}/visitas`);
  await page.getByRole("tab", { name: "Próximas" }).click();
  const filaVisita = page.getByRole("row").filter({ hasText: CLIENTES.clinica.nombre });
  await filaVisita.getByRole("button", { name: "Abrir el informe" }).click();
  await aLaVista(page.getByRole("heading", { name: `Informe de ${CLIENTES.clinica.nombre}` }));
  await page.getByRole("checkbox", { name: new RegExp(`de ${PERSONAS.tecnico.nombre}`) }).check();
  await page.getByRole("textbox", { name: "Introducción" }).fill(
    `El ${new Date().toLocaleDateString("es-CO", { day: "numeric", month: "long", timeZone: "America/Bogota" })} visitamos la sede principal de la clínica para el mantenimiento preventivo de la UPS que respalda el área de urgencias.`,
  );
  await page.getByRole("textbox", { name: "Conclusiones" }).fill("El equipo queda funcionando en línea. Recomendamos cambiar el banco de baterías en los próximos tres meses: la autonomía medida es menor a la que necesita el área.");
  await page.locator("input[type=file][accept='application/pdf']").setInputFiles({ name: "Plano eléctrico del cuarto técnico.pdf", mimeType: "application/pdf", buffer: pdfDePrueba(`Plano electrico del cuarto tecnico, revision ${Date.now()}`) });
  await aLaVista(page.getByText("1 página", { exact: true }), 40_000);
  await guardadoSolo(page);
  await page.getByRole("textbox", { name: "Introducción" }).evaluate((el) => el.scrollIntoView({ block: "center" }));
  await capturar(page, "oficina-14-informe", { resaltar: page.getByRole("button", { name: "Publicar versión 1" }) });
  const queSale = page.getByRole("group", { name: /^Qué sale de/ });
  await queSale.scrollIntoViewIfNeeded();
  await capturar(page, "oficina-15-que-sale", { resaltar: queSale });

  await page.getByRole("button", { name: "Publicar versión 1" }).click();
  const publicar = page.getByRole("dialog");
  await capturar(page, "oficina-16-publicar", { resaltar: publicar.getByRole("button", { name: /^Publicar y enviar a / }) });
  await expect(async () => {
    await publicar.getByRole("button", { name: /^Publicar (y enviar a |versión 1)/ }).click();
    await expect(page.getByText("Versión 1 vigente")).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 40_000 });
  await aLaVista(page.getByRole("button", { name: "Descargar PDF de la versión 1" }), 90_000);
  const envios = page.getByRole("region", { name: "Envíos de la versión 1" });
  await aLaVista(envios.getByText("Enviado", { exact: true }), 60_000);
  await capturar(page, "oficina-17-envios", { resaltar: envios });

  // 6. Cotización, desde la visita que tiene materiales.
  const deMateriales = A.secciones.some((s) => s.campos.some((c) => c.tipo === "cantidades")) ? CLIENTES.clinica.nombre : CLIENTES.bodegas.nombre;
  await menu(page, "Cotizaciones");
  await page.getByRole("button", { name: "Nueva cotización" }).click();
  const hojaNueva = page.getByRole("dialog", { name: "Nueva cotización" });
  await hojaNueva.getByRole("radio", { name: new RegExp(deMateriales) }).check();
  await hojaNueva.getByRole("button", { name: "Crear cotización" }).click();
  await aLaVista(page.getByRole("heading", { name: /^Cotización COT-/, level: 1 }));
  await page.getByRole("button", { name: "Agregar línea" }).click();
  await page.getByRole("textbox", { name: "Descripción de la línea nueva" }).fill("Mano de obra de instalación y pruebas");
  await page.getByRole("textbox", { name: "Precio de Mano de obra de instalación y pruebas" }).fill("450.000");
  await page.getByRole("textbox", { name: "Precio de Soporte en L galvanizado para canaleta" }).fill("6.500").catch(() => undefined);
  await page.getByLabel("Forma de pago").fill("50 % de anticipo y 50 % contra entrega");
  await page.getByLabel("Notas para el cliente").fill("Incluye instalación, pruebas y retiro de escombros. No incluye obra civil.");
  await guardadoSolo(page);
  await page.getByRole("heading", { name: /^Cotización COT-/, level: 1 }).evaluate((el) => el.scrollIntoView({ block: "start" }));
  await capturar(page, "oficina-18-cotizacion", { resaltar: page.getByRole("button", { name: "Publicar versión 1" }) });

  // 7. Catálogo.
  await menu(page, "Catálogo");
  await aLaVista(page.getByRole("row").filter({ hasText: CATALOGO[0].codigo }));
  await capturar(page, "oficina-19-catalogo", { resaltar: page.getByRole("button", { name: "Importar CSV" }) });
  await page.getByRole("button", { name: "Importar CSV" }).click();
  const csv = ["Código,Descripción,Unidad,Precio", ...CATALOGO.map((i) => `${i.codigo},${i.descripcion},${i.unidad},${"precio" in i ? i.precio : ""}`), "CAJ-PVC,Caja de paso PVC 10x10 cm,und,5900", "UPS-6K,UPS en línea 6 kVA 208/120 V,und,"].join("\n");
  await page.locator("input[type=file][accept*='csv']").setInputFiles({ name: "catalogo-teins.csv", mimeType: "text/csv", buffer: Buffer.from(csv, "utf8") });
  await aLaVista(page.getByRole("button", { name: /^Importar \d+ ítems?$/ }));
  await capturar(page, "oficina-20-importar-csv", { resaltar: page.getByRole("button", { name: /^Importar \d+ ítems?$/ }) });
  await page.getByRole("button", { name: /^Importar \d+ ítems?$/ }).click();
  await aLaVista(page.getByText(/^Importado: /));

  // 8. Portal del cliente: oficina da el acceso y la contacta entra con su código.
  await menu(page, "Clientes");
  await page.getByRole("row").filter({ hasText: CLIENTES.clinica.nombre }).getByRole("link", { name: CLIENTES.clinica.nombre }).click();
  const laura = CLIENTES.clinica.contacto;
  await page.getByRole("switch", { name: `Acceso al portal de ${laura.nombre}` }).click();
  const dar = page.getByRole("dialog", { name: `¿Dar acceso al portal a ${laura.nombre}?` });
  await capturar(page, "oficina-21-dar-acceso-portal", { resaltar: dar.getByRole("button", { name: "Dar acceso" }) });
  await dar.getByRole("button", { name: "Dar acceso" }).click();
  await aLaVista(page.getByText("Aún no entra"));

  const cliente = await browser.newContext({ viewport: { width: 1366, height: 860 }, locale: "es-CO", timezoneId: "America/Bogota" });
  const c = await cliente.newPage();
  const anterior = ultimoCodigo(laura.correo);
  await c.goto(`${PORTAL}/`);
  await c.getByLabel("Correo").fill(laura.correo);
  await capturar(c, "oficina-22-portal-ingresar", { resaltar: c.getByRole("button", { name: "Enviar código" }) });
  await c.getByRole("button", { name: "Enviar código" }).click();
  await aLaVista(c.getByRole("heading", { name: "Revise su correo" }));
  await c.getByLabel("Código").fill(await codigoDelPortal(laura.correo, anterior));
  await c.getByRole("button", { name: "Entrar" }).click();
  await aLaVista(c.getByRole("button", { name: /Descargar/ }).or(c.getByRole("link", { name: /Descargar/ })));
  await capturar(c, "oficina-23-portal-documentos", { resaltar: c.getByRole("button", { name: /Descargar/ }).or(c.getByRole("link", { name: /Descargar/ })).first() });
  await cliente.close();

  // 9. Administración.
  await menu(page, "Administración");
  await aLaVista(page.getByRole("tab", { name: "Usuarios" }));
  await page.getByRole("button", { name: "Nuevo usuario" }).click();
  const hoja = page.getByRole("dialog", { name: "Nuevo usuario" });
  await hoja.getByLabel("Nombre completo").fill("Natalia Bermúdez Salazar");
  await hoja.getByLabel("Usuario para iniciar sesión").fill(PERSONAS.oficina.usuario.replace("camilo.herrera", "natalia.bermudez"));
  await hoja.getByRole("radio", { name: "Técnico (campo)" }).check();
  await hoja.getByLabel("Cédula").fill("1110593274");
  await hoja.getByRole("button", { name: "Crear usuario" }).click();
  const entrega = page.getByRole("dialog", { name: "Usuario creado" });
  await capturar(page, "oficina-24-usuario-creado", { resaltar: entrega.getByRole("button", { name: "Copiar la contraseña temporal" }) });
  await entrega.getByRole("button", { name: "Ya la entregué" }).click();
  await page.getByRole("tab", { name: "Teléfonos de campo" }).click();
  await aLaVista(page.getByRole("row").filter({ hasText: PERSONAS.tecnico.nombre }));
  await capturar(page, "oficina-25-telefonos-de-campo");

  // 10. Búsqueda.
  await page.getByRole("navigation", { name: "Secciones" }).getByRole("button", { name: "Buscar" }).click();
  const paleta = page.getByRole("dialog", { name: "Buscar en oficina" });
  await paleta.getByLabel("Buscar clientes, visitas, levantamientos, informes y cotizaciones").fill("santa lucia");
  await page.waitForTimeout(1500);
  await capturar(page, "oficina-26-buscar");
});
