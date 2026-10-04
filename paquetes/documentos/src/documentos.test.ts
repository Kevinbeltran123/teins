import { describe, expect, it } from "vitest";
import { aplicarSeleccion, calcularTotales, SELECCION_VACIA, type ContenidoVersion, type LineaDeCotizacion, type VersionFormato } from "@teins/dominio";
import { asunto, ESTILOS_COTIZACION, ESTILOS_INFORME, hojaDeLaVista, htmlDeCorreo, plantillaCotizacion, textoBase, textoDeCorreo, plantillaDeWhatsapp, plantillaInforme, variablesDeWhatsapp, type ContenidoCotizacion, type MensajeDeEnvio, type Salida } from "./index";

const formato: VersionFormato = {
  formato: "prueba-ups",
  version: 1,
  secciones: [
    {
      clave: "cuarto_tecnico",
      titulo: "Cuarto técnico",
      campos: [
        { clave: "descripcion", etiqueta: "Descripción del sitio", tipo: "texto" },
        { clave: "potencia_nominal", etiqueta: "Potencia nominal", tipo: "medida", unidades: ["kVA", "kW"] },
        { clave: "fotos_equipo", etiqueta: "Fotos del equipo", tipo: "foto" },
      ],
    },
  ],
};

const PDF: Salida = { tipo: "pdf", fuente: "RlVFTlRF" };
const VISTA: Salida = { tipo: "vista" };

const informe: ContenidoVersion = {
  formatoContenido: 1,
  numero: 2,
  publicadaEn: "2026-10-01T15:00:00.000Z",
  publicadaPor: "Laura Méndez",
  organizacion: { nombre: "TEINS" },
  visita: { cliente: "Cliente <de> prueba", sitio: "Sede Norte", direccion: "Calle [N]", motivo: "Mantenimiento", programadaPara: "2026-09-28" },
  introduccion: "Primer párrafo.\n\nSegundo párrafo.",
  conclusiones: "Cambiar las baterías.",
  levantamientos: [
    {
      id: "0192f0e0-0000-7000-8000-000000000001",
      formato,
      tecnico: "Juan Pérez",
      revisor: "Laura Méndez",
      recibidoEn: "2026-09-28T21:40:00.000Z",
      respuestas: { cuarto_tecnico: { descripcion: "Cuarto <b>sótano</b>", potencia_nominal: { valor: "10", unidad: "kVA" }, fotos_equipo: ["a".repeat(64)] } },
    },
  ],
  planos: [{ huella: "b".repeat(64), nombre: "Unifilar" }],
};

const linea = (id: string, precio: number | null): LineaDeCotizacion => ({ id, itemId: null, codigo: "BAT-12", descripcion: "Batería 12 V", cantidad: "4", unidad: "und", precio, precioCatalogo: null, origen: "oficina" });
const cotizacion = (lineas: LineaDeCotizacion[]): ContenidoCotizacion => ({
  numero: "COT-2026-0045",
  version: 2,
  publicadaEn: "2026-10-01T15:00:00.000Z",
  publicadaPor: "Laura Méndez",
  organizacion: { nombre: "TEINS" },
  visita: { cliente: "Cliente de prueba", sitio: "Sede Norte", direccion: "Calle [N]", programadaPara: "2026-09-28" },
  lineas,
  impuestos: { tipo: "iva" },
  condiciones: { validezDias: 30, formaPago: "", notas: "" },
  totales: calcularTotales(lineas, { tipo: "iva" }),
});

/** Lo que llega en el <head> como estilos: un <style> en el PDF o un <link> en la vista. */
const sinEstilos = (html: string) => html.replace(/<style>[\s\S]*?<\/style>|<link rel="stylesheet"[^>]*>/, "[ESTILOS]");

describe("una plantilla, dos salidas (ADR-0031)", () => {
  it("el informe y la cotización solo difieren en cómo llegan los estilos y la fuente", () => {
    const fotos = new Map([["a".repeat(64), "data:image/jpeg;base64,AAAA"]]);
    expect(sinEstilos(plantillaInforme(informe, { salida: VISTA, fotos }))).toBe(sinEstilos(plantillaInforme(informe, { salida: PDF, fotos })));
    const c = cotizacion([linea("a0000001", 25000)]);
    expect(sinEstilos(plantillaCotizacion(c, { salida: VISTA }))).toBe(sinEstilos(plantillaCotizacion(c, { salida: PDF })));
  });

  it("el PDF incrusta la fuente y los estilos; la vista enlaza la hoja que sirve oficina", () => {
    const pdf = plantillaInforme(informe, { salida: PDF, fotos: new Map() });
    expect(pdf).toContain("url(data:font/woff2;base64,RlVFTlRF)");
    expect(pdf).not.toContain("<link");
    const vista = plantillaInforme(informe, { salida: VISTA, fotos: new Map() });
    expect(vista).toContain('<link rel="stylesheet" href="/documentos/informe.css">');
    // La CSP de oficina no admite estilos en línea: la vista no lleva ninguno.
    expect(vista).not.toMatch(/<style|style="/);
    expect(plantillaCotizacion(cotizacion([linea("a0000001", 1)]), { salida: VISTA })).not.toMatch(/<style|style="/);
  });

  it("la hoja de la vista son los estilos del PDF, la fuente por archivo y lo propio de la pantalla", () => {
    const hoja = hojaDeLaVista("informe", ESTILOS_INFORME);
    expect(hoja).toContain(ESTILOS_INFORME);
    expect(hoja).toContain("url(geist.woff2)");
    expect(hoja).toContain(".vista-cambio");
    expect(hojaDeLaVista("cotizacion", ESTILOS_COTIZACION)).toContain(ESTILOS_COTIZACION);
  });
});

describe("plantillas", () => {
  it("el informe marca cada dato y cada parte para que la vista los encuentre", () => {
    const html = plantillaInforme(informe, { salida: VISTA, fotos: new Map() });
    expect(html).toContain('<tr data-dato="cuarto_tecnico/descripcion">');
    for (const id of ['id="introduccion"', 'id="capitulo-0192f0e0-0000-7000-8000-000000000001"', 'id="conclusiones"', 'id="planos"']) expect(html).toContain(id);
    expect(html).toContain("Cuarto &lt;b&gt;sótano&lt;/b&gt;");
    expect(html).toContain("Cliente &lt;de&gt; prueba");
    // La foto que no llegó va como marcador, nunca se inventa.
    expect(html).toContain("[FOTO]");
  });

  it("una línea sin precio, que solo existe en el borrador, va como marcador y sin total", () => {
    const html = plantillaCotizacion(cotizacion([linea("a0000001", 25000), linea("a0000002", null)]), { salida: VISTA });
    expect(html).toContain("[Precio]");
    // 4 × 25.000 con IVA 19 %: la línea sin precio no suma.
    expect(html).toContain("$ 119.000");
  });

  it("la plantilla de WhatsApp tiene una marca por cada variable que se envía", () => {
    const informe: MensajeDeEnvio = { organizacion: "TEINS", cliente: "C", sitio: "S", motivo: "M", programadaPara: "2026-09-28", numero: 1, nombreArchivo: "a.pdf" };
    const cotizacionM: MensajeDeEnvio = { documento: "cotizacion", organizacion: "TEINS", cliente: "C", sitio: "S", cotizacion: "COT-1", numero: 1, nombreArchivo: "a.pdf" };
    for (const m of [informe, cotizacionM]) {
      const marcas = plantillaDeWhatsapp(m).texto.match(/\{\{\d\}\}/g) ?? [];
      expect(marcas).toEqual(variablesDeWhatsapp(m, "Ana Torres").map((_, i) => `{{${i + 1}}}`));
    }
    // La cotización no lleva el botón del portal: el portal solo muestra informes (ADR-0029).
    expect(plantillaDeWhatsapp(cotizacionM).boton).toBeNull();
  });
});

describe("qué sale en el informe (ADR-0039)", () => {
  const id = "0192f0e0-0000-7000-8000-000000000001";
  const conLlegada: VersionFormato = {
    ...formato,
    secciones: [{ clave: "llegada", titulo: "Llegada", soloEmpresa: true, campos: [{ clave: "fotos_llegada", etiqueta: "Fotos de llegada", tipo: "foto" }] }, ...formato.secciones],
  };
  const borrador: ContenidoVersion = {
    ...informe,
    levantamientos: [{ ...informe.levantamientos[0]!, formato: conLlegada, respuestas: { ...informe.levantamientos[0]!.respuestas, llegada: { fotos_llegada: ["c".repeat(64)] } } }],
  };

  it("en el PDF, lo que quedó fuera de la versión no deja rastro: ni la sección ni su título", () => {
    const version = aplicarSeleccion(borrador.levantamientos[0]!, SELECCION_VACIA);
    const html = plantillaInforme({ ...borrador, levantamientos: [version] }, { salida: PDF, fotos: new Map() });
    expect(html).not.toContain("Llegada");
    expect(html).not.toContain("vista-ocultar");
    expect(html).toContain("Cuarto técnico");
  });

  it("en la vista de oficina, lo oculto es una franja con «Mostrar» y lo que sale tiene «Ocultar», con su clave", () => {
    const html = plantillaInforme(borrador, { salida: VISTA, fotos: new Map(), seleccion: SELECCION_VACIA });
    expect(html).toContain(`data-mostrar="${id}|llegada" data-omision="1"`);
    expect(html).toContain("solo para la empresa");
    expect(html).toContain(`data-ocultar="${id}|cuarto_tecnico" data-omision="0"`);
    expect(html).toContain(`data-ocultar="${id}|cuarto_tecnico|fotos_equipo|${"a".repeat(64)}"`);
  });
});

describe("el correo que escribe oficina (iteración 30)", () => {
  const m = {
    documento: "cotizacion" as const,
    organizacion: "TEINS",
    cliente: "Hotel Plaza Real",
    sitio: "Torre A",
    cotizacion: "COT-2026-0006",
    numero: 1,
    nombreArchivo: "Cotización COT-2026-0006 - Hotel Plaza Real - versión 1.pdf",
  };
  const opciones = { nombre: "Ana Torres", portal: undefined, sinAdjunto: false };

  it("sin cambios, el asunto y el texto son los de TEINS, y el texto base es lo que se puede editar", () => {
    expect(asunto(m)).toBe("Cotización COT-2026-0006 · Torre A");
    expect(textoBase(m)).toBe("Le enviamos la cotización COT-2026-0006 para Torre A. Va adjunta en PDF.");
    expect(htmlDeCorreo(m, opciones)).toContain('data-editable="texto"');
  });

  it("con su texto, el saludo, el pie y el adjunto los sigue poniendo TEINS; lo escrito va escapado", () => {
    const propio = { ...m, personal: { asunto: "Su cotización de cableado", texto: "Le enviamos la cotización.\n\nCualquier duda <me escribe>." } };
    expect(asunto(propio)).toBe("Su cotización de cableado");
    const html = htmlDeCorreo(propio, opciones);
    expect(html).toContain("Hola, Ana:");
    expect(html).toContain("Cualquier duda &lt;me escribe&gt;.");
    expect(html).not.toContain("Va adjunta en PDF.");
    expect(html).toContain("Recibe este correo porque es contacto de Hotel Plaza Real");
    const texto = textoDeCorreo(propio, opciones);
    expect(texto).toContain("Hola, Ana:\n\nLe enviamos la cotización.\n\nCualquier duda <me escribe>.");
  });

  it("si el PDF no cabe, lo dice aunque el texto sea propio", () => {
    const propio = { ...m, personal: { asunto: "Asunto", texto: "Va adjunta." } };
    expect(htmlDeCorreo(propio, { ...opciones, sinAdjunto: true })).toContain("El PDF pesa demasiado para el correo");
  });
});
