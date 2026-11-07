import { devices, expect, test, type Browser, type Page } from "@playwright/test";
import { CAMPO, OFICINA } from "../destino";
import { arrastrar, filaDeLaBandeja, irAlRecorrido } from "../pruebas/ayudas";
import { codigoTotp } from "../totp";
import { aLaVista, capturar, CLIENTES, CONTRASENA, CONTRASENA_NUEVA, FORMATOS, fotoInventada, leerEstado, leerFormato, PERSONAS, type CampoDeFormato, type Formato, type SeccionDeFormato } from "./comun";

/*
  El teléfono del técnico (Safari de iPhone), en el orden del manual para técnicos. Lo que haga falta de oficina para
  la historia (un comentario) se hace aquí sin capturarlo; sus pantallas las captura oficina.spec.ts.
*/

const A = leerFormato(FORMATOS[0]!);
const B = leerFormato(FORMATOS[1]!);

test.use({ deviceScaleFactor: 2, permissions: ["geolocation"], geolocation: { latitude: 4.43889, longitude: -75.23222, accuracy: 9 } });

/** Lo que ya se capturó: un tipo de dato se muestra una vez, en el primer formato que lo tenga. */
const hechas = new Set<string>();
async function unaVez(page: Page, nombre: string, accion: () => Promise<void>) {
  if (hechas.has(nombre)) return;
  hechas.add(nombre);
  await accion();
}

const minuscula = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
/** El nombre accesible de un dato: su etiqueta, y «obligatorio» pegado si lo es. */
const nombre = (etiqueta: string) => new RegExp(`^${etiqueta.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(obligatorio)?$`);

/** Valores verosímiles por unidad y por etiqueta (inventados, R5). */
function valorDeMedida(c: CampoDeFormato): string {
  const e = c.etiqueta;
  const unidad = c.unidades?.[0] ?? "";
  if (unidad === "V") {
    if (/N-T/.test(e)) return "0,6";
    if (/F-F/.test(e)) return "208,4";
    if (/flotaci/i.test(e)) return "218,5";
    if (/igualaci/i.test(e)) return "226,0";
    if (/^Voltaje$/.test(e)) return "12,0";
    return ["120,3", "121,1", "119,8"][Number(/F(\d)$/.exec(e)?.[1] ?? 1) - 1] ?? "120,3";
  }
  if (unidad === "A") return /flotaci|DC/i.test(e) ? "1,2" : /circuito|tablero|nominal/i.test(e) ? "63" : ["18,4", "16,9", "17,6"][Number(/F(\d)$/.exec(e)?.[1] ?? 1) - 1] ?? "18,4";
  if (unidad === "Hz") return "60";
  if (unidad === "kVA") return "10";
  if (unidad === "%") return "42";
  if (unidad === "Ah") return "9";
  if (unidad === "und") return /banco/i.test(e) ? "1" : /circuito/i.test(e) ? "12" : "16";
  if (unidad === "m") return "4,5";
  if (unidad === "cm") return "40";
  return "10";
}
function valorDeTexto(c: CampoDeFormato): string {
  const e = c.etiqueta;
  const tabla: [RegExp, string][] = [
    [/recibe/i, "Laura Gómez, jefe de mantenimiento"],
    [/^marca/i, "Voltria"],
    [/modelo/i, "VT-10K RT"],
    [/serial/i, "VT10K-2025-04187"],
    [/sim/i, "No aplica"],
    [/referencia/i, "VB12-9"],
    [/daño/i, "El equipo pita y pasa a batería varias veces al día."],
    [/estado inicial/i, "Equipo encendido en línea, con alarma de batería baja."],
    [/diagn/i, "Baterías con más de cuatro años de uso: la autonomía bajó a 3 minutos. Ventiladores con polvo."],
    [/correcci/i, "Se limpiaron los ventiladores y se ajustaron las borneras. Queda pendiente el cambio de baterías."],
    [/trabajo/i, "Mantenimiento preventivo: limpieza interna, ajuste de borneras, prueba de transferencia a batería y medición de entrada y salida."],
    [/observaci/i, "Se recomienda cambiar el banco de baterías en el próximo mantenimiento."],
    [/descripci/i, "Cuarto técnico en el sótano, con aire acondicionado y acceso con llave."],
    [/ubicaci/i, "Sótano"],
    [/estado/i, "En buen estado"],
    [/limpieza/i, "Realizada"],
  ];
  return tabla.find(([r]) => r.test(e))?.[1] ?? "Sin novedad";
}
function opcionElegida(c: CampoDeFormato): string {
  const o = c.opciones ?? [];
  return o.find((x) => /^(Sí|Totalmente|Preventivo|Contrato|Selladas)$/.test(x)) ?? o[0]!;
}

async function tomarFotos(page: Page, c: CampoDeFormato) {
  for (const puesto of c.puestos ?? [c.etiqueta]) {
    const entrada = c.puestos ? page.getByLabel(`Tomar foto: ${puesto}`) : page.locator("input[type=file]").first();
    await entrada.setInputFiles({ name: `${puesto}.jpg`, mimeType: "image/jpeg", buffer: await fotoInventada(page, `${c.etiqueta} ${puesto}`) });
    await expect(page.getByText("Guardando foto…")).toHaveCount(0, { timeout: 20_000 });
  }
  await aLaVista(page.getByRole("img", { name: `Foto ${(c.puestos ?? [""]).length} de ${c.etiqueta}` }));
}

/** Llena un dato como lo haría el técnico. Devuelve falso si no es un dato que se llene en el paso (boceto, firma, cantidades). */
async function llenar(page: Page, c: CampoDeFormato, donde = page.locator("body")) {
  const caja = donde.getByRole("textbox", { name: nombre(c.etiqueta) }).first();
  switch (c.tipo) {
    case "texto":
      await caja.fill(valorDeTexto(c));
      return true;
    case "medida":
      await caja.fill(valorDeMedida(c));
      return true;
    case "opcion":
      await donde.getByRole("radiogroup", { name: nombre(c.etiqueta) }).getByText(opcionElegida(c), { exact: true }).click();
      return true;
    case "opciones": {
      const grupo = donde.getByRole("group", { name: nombre(c.etiqueta) });
      for (const o of (c.opciones ?? []).filter((x) => /^(UPS|Red de energía|Preventivo|Contrato|Baterías)$/.test(x)).slice(0, 2)) await grupo.getByText(o, { exact: true }).click();
      if (!(await grupo.getByRole("checkbox", { checked: true }).count())) await grupo.getByText(c.opciones![0]!, { exact: true }).click();
      return true;
    }
    case "horario": {
      await donde.getByLabel("Llegada", { exact: true }).fill("08:10");
      await donde.getByLabel("Salida", { exact: true }).fill("10:45");
      return true;
    }
    case "foto":
      await tomarFotos(page, c);
      return true;
    default:
      return false;
  }
}

/** Abre un paso desde el recorrido. El croquis abre el editor directamente; los demás, su página. */
const c11Motivo = (c: CampoDeFormato) => (c.tipo === "medida" ? "La placa del equipo está borrada y no se alcanza a leer." : "El cliente pidió terminar antes: no hubo tiempo de escribirlo en el sitio.");

async function abrirPaso(page: Page, s: SeccionDeFormato) {
  const recorrido = await irAlRecorrido(page);
  await recorrido.getByRole("button", { name: new RegExp(`^${s.titulo}`) }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: s.titulo }).or(page.getByLabel("Lienzo del boceto"))).toBeVisible();
}

async function firmar(page: Page) {
  const recuadro = page.getByLabel("Espacio para firmar con el dedo");
  await recuadro.scrollIntoViewIfNeeded();
  const caja = (await recuadro.boundingBox())!;
  const puntos: [number, number][] = [[0.08, 0.62], [0.16, 0.38], [0.22, 0.7], [0.3, 0.42], [0.36, 0.66], [0.45, 0.5], [0.52, 0.58], [0.6, 0.35], [0.66, 0.68], [0.76, 0.48], [0.9, 0.55]];
  const en = ([x, y]: [number, number]) => [caja.x + x * caja.width, caja.y + y * caja.height] as const;
  await page.mouse.move(...en(puntos[0]!));
  await page.mouse.down();
  for (const p of puntos.slice(1)) await page.mouse.move(...en(p), { steps: 6 });
  await page.mouse.up();
}

async function croquis(page: Page, etiqueta: string, capturas: boolean) {
  const lienzo = page.getByLabel("Lienzo del boceto");
  if (!(await lienzo.isVisible())) await page.getByRole("button", { name: /^(Dibujar|Editar) boceto/ }).first().click();
  await expect(lienzo).toBeVisible();
  const editor = page.getByRole("dialog", { name: `Boceto: ${etiqueta}` });
  // El cuarto: un rectángulo que se endereza al dejar el dedo quieto.
  await arrastrar(page, [[0.12, 0.2], [0.88, 0.2], [0.88, 0.72], [0.12, 0.72], [0.12, 0.205]], { quieto: 800 });
  // La puerta, a mano.
  await arrastrar(page, [[0.4, 0.72], [0.4, 0.8], [0.55, 0.8]]);
  await editor.getByRole("button", { name: "Cota" }).click();
  await arrastrar(page, [[0.12, 0.15], [0.88, 0.15]]);
  const medida = page.getByRole("dialog", { name: "Medida de la cota" });
  await medida.getByRole("textbox", { name: "Medida" }).fill("4,50 m");
  await medida.getByRole("button", { name: "Poner medida" }).click();
  await editor.getByRole("button", { name: "Símbolos" }).click();
  const biblioteca = page.getByRole("dialog", { name: "Símbolos" });
  await biblioteca.getByRole("searchbox", { name: "Buscar símbolo" }).fill("ups");
  await biblioteca.getByRole("button", { name: "UPS" }).click();
  await expect(biblioteca).toHaveCount(0);
  // El símbolo cae en el centro y queda elegido: se lleva a la esquina.
  await arrastrar(page, [[0.5, 0.5], [0.3, 0.38]]);
  await editor.getByRole("button", { name: "Texto" }).click();
  await arrastrar(page, [[0.55, 0.42], [0.55, 0.42]]);
  const texto = page.getByRole("dialog", { name: "Poner texto" });
  await texto.getByRole("textbox", { name: "Texto del boceto" }).fill("Tablero general");
  await texto.getByRole("button", { name: "Poner texto" }).click();
  await editor.getByRole("button", { name: "Trazo" }).click();
  if (capturas) await capturar(page, "tecnicos-15-croquis", { resaltar: editor.getByRole("toolbar", { name: "Herramientas" }) });
  await editor.getByRole("button", { name: "Volver a la captura" }).click();
  await expect(lienzo).toHaveCount(0);
}

async function materiales(page: Page, capturas: boolean, aparte: boolean) {
  // Con otros datos en la misma sección, los materiales son una página aparte: la siguiente.
  const catalogo = page.getByRole("button", { name: "Buscar en el catálogo" });
  if (aparte) await page.getByRole("button", { name: /^Siguiente: / }).click();
  await catalogo.click();
  const hoja = page.getByRole("dialog", { name: "Agregar del catálogo" });
  const buscar = hoja.getByRole("searchbox", { name: "Buscar en el catálogo" });
  await buscar.fill("cable");
  await hoja.getByRole("button", { name: "Agregar Cable encauchetado 3x12 AWG" }).click();
  if (capturas) await capturar(page, "tecnicos-16-catalogo", { resaltar: hoja.getByRole("button", { name: "Agregar Cable encauchetado 3x10 AWG" }) });
  await buscar.fill("breaker 2x40");
  await hoja.getByRole("button", { name: "Agregar Breaker 2x40 A" }).click();
  await buscar.fill("canaleta");
  await hoja.getByRole("button", { name: "Agregar Canaleta 40x25 mm con adhesivo" }).click();
  await hoja.getByRole("button", { name: "Ver materiales" }).click();
  await expect(hoja).toHaveCount(0);
  for (const [i, n] of ["18", "1", "6"].entries()) await page.getByRole("textbox", { name: `Cantidad de la línea ${i + 1}` }).fill(n);
  await page.getByRole("button", { name: /^No está en el catálogo/ }).click();
  await page.getByRole("textbox", { name: "Descripción de la línea 4" }).fill("Soporte en L galvanizado para canaleta");
  await page.getByRole("textbox", { name: "Cantidad de la línea 4" }).fill("8");
  await page.getByRole("textbox", { name: "Cantidad de la línea 4" }).blur();
  // Que se vaya la notificación de lo agregado.
  if (capturas) await page.waitForTimeout(6_000);
  if (capturas) await capturar(page, "tecnicos-17-materiales", { resaltar: page.getByRole("button", { name: "Buscar en el catálogo" }) });
}

/**
 * Recorre un formato de punta a punta y captura cada tipo de dato la primera vez que aparece. Con `capturas` en falso
 * solo llena (el segundo técnico, para que la bandeja de oficina tenga más de un levantamiento).
 */
async function recorrer(page: Page, f: Formato, capturas: boolean) {
  const cap = (nombre: string, accion: () => Promise<void>) => (capturas ? unaVez(page, nombre, accion) : Promise.resolve());
  for (const s of f.secciones) {
    await abrirPaso(page, s);
    if (s.repetible) {
      const etiqueta = s.repetible.etiqueta;
      for (const [i, n] of ["1", "2"].entries()) {
        await page.getByRole("region", { name: s.titulo }).getByRole("button", { name: `Agregar ${minuscula(etiqueta)}` }).click();
        const articulo = page.getByRole("article", { name: `${etiqueta} ${n}` });
        for (const c of s.campos) if (c.tipo !== "foto" || i === 0) await llenar(page, c, articulo);
        if (i === 0) await cap("tecnicos-14-repeticion", () => capturar(page, "tecnicos-14-repeticion", { resaltar: page.getByRole("button", { name: `Opciones de ${etiqueta} 1` }) }));
        await page.getByRole("button", { name: /^Listo, ver / }).click();
        await expect(articulo).toHaveCount(0);
      }
      continue;
    }
    const requeridos = s.campos.filter((c) => c.obligatorio && c.tipo !== "firma");
    if (capturas && requeridos.length && !hechas.has("tecnicos-11-faltan-datos")) {
      hechas.add("tecnicos-11-faltan-datos");
      await page.getByRole("button", { name: /^Siguiente: / }).click();
      const hoja = page.getByRole("dialog", { name: /^Faltan? \d+ datos? en / });
      await capturar(page, "tecnicos-11-faltan-datos", { resaltar: hoja.getByRole("button", { name: "Completar ahora" }) });
      await hoja.getByRole("button", { name: "Completar ahora" }).click();
    }
    const dato = requeridos.find((c) => c.tipo === "texto" || c.tipo === "medida");
    if (capturas && dato && !hechas.has("tecnicos-12-no-se-pudo-obtener")) {
      {
        await page.locator("label").filter({ has: page.getByRole("checkbox", { name: `${dato.etiqueta}: no se pudo obtener` }) }).click();
        const motivo = page.getByRole("textbox", { name: "Motivo", exact: true }).first();
        await motivo.fill(c11Motivo(dato));
        await capturar(page, "tecnicos-12-no-se-pudo-obtener", { resaltar: [page.locator("label").filter({ hasText: "No se pudo obtener" }).first(), motivo] });
        hechas.add("tecnicos-12-no-se-pudo-obtener");
        // Al final sí se pudo leer: se desmarca y se escribe el dato.
        await page.locator("label").filter({ has: page.getByRole("checkbox", { name: `${dato.etiqueta}: no se pudo obtener` }) }).click();
      }
    }
    for (const c of s.campos) {
      if (c.tipo === "boceto") {
        await croquis(page, c.etiqueta, capturas && !hechas.has("tecnicos-15-croquis"));
        if (capturas) hechas.add("tecnicos-15-croquis");
        continue;
      }
      if (c.tipo === "cantidades") {
        await materiales(page, capturas && !hechas.has("tecnicos-17-materiales"), s.campos.length > 1);
        if (capturas) hechas.add("tecnicos-16-catalogo").add("tecnicos-17-materiales");
        continue;
      }
      if (c.tipo === "firma") {
        await page.getByRole("button", { name: "Entregar el teléfono" }).click();
        const hoja = page.getByRole("dialog", { name: "Constancia de visita" });
        await hoja.getByRole("textbox", { name: "Su nombre" }).fill(CLIENTES.clinica.contacto.nombre);
        await hoja.getByRole("textbox", { name: "Cargo (opcional)" }).fill(CLIENTES.clinica.contacto.cargo);
        const cedula = hoja.getByRole("textbox", { name: /^Cédula/ });
        if (await cedula.count()) await cedula.fill("38246190");
        await firmar(page);
        await cap("tecnicos-18-firma", () => capturar(page, "tecnicos-18-firma", { resaltar: hoja.getByRole("button", { name: "Firmar" }) }));
        await hoja.getByRole("button", { name: "Firmar" }).click();
        await expect(hoja).toHaveCount(0);
        continue;
      }
      // En una tabla, la fila de una sola casilla se nombra con la etiqueta de la fila.
      const fila = s.tablas?.flatMap((t) => t.filas).find((f) => f.campos.length === 1 && f.campos[0] === c.clave);
      await llenar(page, fila ? { ...c, etiqueta: fila.etiqueta } : c);
      if (c.tipo === "foto" && c.sello) await cap("tecnicos-08-foto-de-llegada", () => capturar(page, "tecnicos-08-foto-de-llegada", { resaltar: page.getByRole("img", { name: `Foto 1 de ${c.etiqueta}` }) }));
    }
    const tipos = new Set(s.campos.map((c) => c.tipo));
    if (tipos.has("horario")) {
      const c = s.campos.find((x) => x.tipo === "horario")!;
      await cap("tecnicos-09-horario-y-opciones", () => capturar(page, "tecnicos-09-horario-y-opciones", { resaltar: page.getByText(c.etiqueta).first() }));
    }
    if (tipos.has("foto") && tipos.has("medida") && !s.campos.some((c) => c.sello)) {
      const foto = s.campos.find((c) => c.tipo === "foto")!;
      await cap("tecnicos-13-medidas-y-fotos", async () => {
        await page.getByRole("img", { name: `Foto 1 de ${foto.etiqueta}` }).evaluate((el) => el.scrollIntoView({ block: "center" }));
        await capturar(page, "tecnicos-13-medidas-y-fotos");
      });
    }
    if (s.tablas?.length) await cap("tecnicos-10-tabla-de-medidas", () => capturar(page, "tecnicos-10-tabla-de-medidas", { resaltar: page.getByText(s.tablas![0]!.titulo ?? s.tablas![0]!.filas[0]!.etiqueta).first() }));
  }
}

async function entrar(page: Page, usuario: string, contrasena: string) {
  await page.goto(`${CAMPO}/`);
  await page.getByRole("button", { name: /^Seguir en (Safari|el navegador)$/ }).click();
  await page.getByLabel("Usuario").fill(usuario);
  await page.getByLabel("Contraseña").fill(contrasena);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
}

async function enviar(page: Page) {
  const recorrido = await irAlRecorrido(page);
  await recorrido.getByRole("button", { name: /^Revisar y enviar/ }).click();
  await page.getByRole("button", { name: "Enviar a oficina" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Enviar levantamiento" }).click();
  await expect(page.getByText("Recibido en oficina")).toBeVisible({ timeout: 60_000 });
}

/** Oficina le pregunta al técnico por un dato (sin capturas: eso lo muestra oficina.spec.ts). */
async function oficinaComenta(browser: Browser, campo: CampoDeFormato) {
  const contexto = await browser.newContext({ viewport: { width: 1366, height: 860 }, locale: "es-CO", timezoneId: "America/Bogota" });
  const o = await contexto.newPage();
  await o.goto(`${OFICINA}/`);
  await o.getByLabel("Usuario").fill(PERSONAS.admin.usuario);
  await o.getByLabel("Contraseña").fill(CONTRASENA);
  await o.getByRole("button", { name: "Ingresar", exact: true }).click();
  await o.getByLabel("Código").fill(codigoTotp(leerEstado().secretoAdmin));
  await o.getByRole("button", { name: "Verificar", exact: true }).click();
  await (await filaDeLaBandeja(o, CLIENTES.clinica.nombre)).getByRole("link").click();
  await o.getByRole("button", { name: `Comentar ${minuscula(campo.etiqueta)}` }).first().click();
  await o.getByRole("textbox", { name: "Nuevo comentario" }).fill(`Andrés, ¿puedes confirmar el dato «${campo.etiqueta}»? En la foto de la placa no se alcanza a leer.`);
  await o.getByRole("button", { name: "Enviar comentario" }).first().click();
  await expect(o.getByRole("textbox", { name: "Nuevo comentario" })).toHaveCount(0);
  await contexto.close();
}

test("el teléfono del técnico", async ({ page, context, browser }) => {
  const estado = leerEstado();

  // 2. Instalar y entrar por primera vez.
  await page.goto(`${CAMPO}/`);
  await aLaVista(page.getByRole("heading", { name: "Instala la app" }));
  await capturar(page, "tecnicos-01-instalar", { resaltar: page.getByText("Toca Compartir") });
  await page.getByRole("button", { name: /^Seguir en (Safari|el navegador)$/ }).click();
  await page.getByLabel("Usuario").fill(PERSONAS.tecnico.usuario);
  await page.getByLabel("Contraseña").fill(estado.temporalTecnico);
  await capturar(page, "tecnicos-02-ingresar", { resaltar: page.getByRole("button", { name: "Ingresar", exact: true }) });
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await page.getByLabel("Contraseña nueva", { exact: true }).fill(CONTRASENA_NUEVA);
  await page.getByLabel("Repite la contraseña nueva").fill(CONTRASENA_NUEVA);
  await capturar(page, "tecnicos-03-crea-tu-contrasena", { resaltar: page.getByRole("button", { name: "Guardar y entrar" }) });
  await page.getByRole("button", { name: "Guardar y entrar" }).click();
  await page.getByRole("button", { name: "Ir a mis visitas" }).click();

  // 3. El inicio.
  const siguiente = page.getByRole("region", { name: "Siguiente visita" });
  await aLaVista(siguiente.getByText(CLIENTES.clinica.nombre));
  await page.evaluate(() => navigator.serviceWorker.ready);
  await capturar(page, "tecnicos-04-inicio");
  const botonA = siguiente.getByRole("button", { name: A.nombre, exact: true });
  await capturar(page, "tecnicos-05-tarjeta-de-visita", { elemento: siguiente, resaltar: [botonA, siguiente.getByRole("button", { name: B.nombre, exact: true })] });
  const despues = page.getByRole("region", { name: "Después" });
  const manana = despues.getByRole("article").filter({ hasText: CLIENTES.colegio.nombre });
  await manana.getByRole("button", { name: new RegExp(CLIENTES.colegio.nombre) }).click();
  await capturar(page, "tecnicos-06-otro-dia", { elemento: despues, resaltar: manana.getByText(/^Podrás iniciarla/) });
  await manana.getByRole("button", { name: new RegExp(CLIENTES.colegio.nombre) }).click();

  // 4. El levantamiento de la visita principal, con el formato de servicio.
  await botonA.click();
  await aLaVista(page.getByRole("heading", { level: 1, name: A.secciones[0]!.titulo }));
  await recorrer(page, A, true);
  await irAlRecorrido(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await capturar(page, "tecnicos-07-recorrido");
  const recorrido = await irAlRecorrido(page);
  await recorrido.getByRole("button", { name: /^Revisar y enviar/ }).click();
  await aLaVista(page.getByRole("heading", { level: 1, name: "Revisa y envía" }));
  await capturar(page, "tecnicos-19-revisa-y-envia", { resaltar: page.getByRole("button", { name: "Enviar a oficina" }) });
  await page.getByRole("button", { name: "Enviar a oficina" }).click();
  const confirmar = page.getByRole("dialog");

  // 5. Sin señal: queda en el teléfono y sale solo al volver.
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await confirmar.getByRole("button", { name: "Enviar levantamiento" }).click();
  await aLaVista(page.getByText("Sin conexión: se enviará al recuperar señal"));
  await capturar(page, "tecnicos-20-envio-sin-senal", { resaltar: page.getByText("Sin conexión: se enviará al recuperar señal") });
  await page.getByRole("button", { name: "Volver a mis visitas" }).click();
  await aLaVista(page.getByText(/^Sin señal/));
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await aLaVista(page.getByRole("region", { name: "Enviados" }).getByText("Recibido", { exact: true }), 60_000);

  // 6. Después de enviar: oficina pregunta, el técnico responde.
  const conComentario = A.secciones.flatMap((s) => (s.repetible ? [] : s.campos)).find((c) => c.tipo === "medida") ?? A.secciones.flatMap((s) => s.campos).find((c) => c.tipo === "texto")!;
  await oficinaComenta(browser, conComentario);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  const atencion = page.getByRole("region", { name: "Necesita atención" });
  await aLaVista(atencion.getByText("Oficina te escribió"), 40_000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await capturar(page, "tecnicos-21-oficina-te-escribio", { resaltar: atencion.getByRole("button").first() });
  await atencion.getByRole("button").first().click();
  const chat = page.getByRole("dialog", { name: "Chat con oficina" });
  await chat.getByRole("textbox", { name: "Respuesta para oficina" }).fill(`Sí: ${valorDeMedida(conComentario)} ${conComentario.unidades?.[0] ?? ""}. Te mando la foto de la placa más de cerca si la necesitas.`.replace(" .", "."));
  await chat.getByRole("button", { name: "Enviar" }).click();
  await aLaVista(chat.getByText("Enviado", { exact: true }), 30_000);
  await capturar(page, "tecnicos-22-chat", { resaltar: chat.getByRole("textbox", { name: "Respuesta para oficina" }) });
  await chat.getByRole("button", { name: "Volver", exact: true }).click();
  await expect(chat).toHaveCount(0);
  const volver = page.getByRole("button", { name: "Volver a mis visitas" });
  if (await volver.isVisible()) await volver.click();

  // 7. Descartar y recuperar: la segunda visita, con el formato general.
  const bodegas = page.getByRole("region", { name: "Siguiente visita" }).filter({ hasText: CLIENTES.bodegas.nombre });
  await aLaVista(bodegas);
  await bodegas.getByRole("button", { name: B.nombre, exact: true }).click();
  await aLaVista(page.getByRole("heading", { level: 1, name: B.secciones[0]!.titulo }));
  await irAlRecorrido(page);
  await page.getByRole("button", { name: "Descartar levantamiento" }).click();
  await capturar(page, "tecnicos-23-descartar", { resaltar: page.getByRole("dialog").getByRole("button", { name: "Descartar", exact: true }) });
  await page.getByRole("dialog").getByRole("button", { name: "Descartar", exact: true }).click();
  await page.getByRole("button", { name: "Ver en Descartados" }).click();
  const papelera = page.getByRole("dialog", { name: "Descartados" });
  await capturar(page, "tecnicos-24-descartados", { resaltar: papelera.getByRole("button", { name: "Recuperar" }).first() });
  await papelera.getByRole("button", { name: "Recuperar" }).first().click();
  await aLaVista(page.getByText("Levantamiento recuperado", { exact: false }));
  await page.keyboard.press("Escape");
  await expect(papelera).toHaveCount(0);
  // Lo recuperado sigue donde estaba: se completa y se envía (con los formatos de TEINS, aquí están el croquis y los materiales).
  await page.getByRole("region", { name: "Siguiente visita" }).getByRole("button", { name: "Continuar levantamiento" }).click();
  await recorrer(page, B, true);
  await enviar(page);
  await page.getByRole("button", { name: "Volver a mis visitas" }).click();
  await aLaVista(page.getByRole("region", { name: "Enviados" }));

  // Otro técnico envía el suyo: así la bandeja de oficina tiene más de uno.
  const otro = await browser.newContext({ ...devices["iPhone 13"], locale: "es-CO", timezoneId: "America/Bogota" });
  const t = await otro.newPage();
  await entrar(t, PERSONAS.tecnico2.usuario, CONTRASENA);
  const suya = t.getByRole("region", { name: "Siguiente visita" });
  await aLaVista(suya.getByText(CLIENTES.hotel.nombre));
  await suya.getByRole("button", { name: A.nombre, exact: true }).click();
  await recorrer(t, A, false);
  await enviar(t);
  await otro.close();
});
