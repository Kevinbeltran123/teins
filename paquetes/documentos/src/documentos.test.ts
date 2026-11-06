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

  it("en el PDF, una sección cuyo único dato quedó oculto (un croquis, por omisión) no deja su título vacío", () => {
    const conObservaciones: VersionFormato = {
      ...formato,
      secciones: [...formato.secciones, { clave: "observaciones", titulo: "Observaciones adicionales", campos: [{ clave: "hoja", etiqueta: "Observaciones", tipo: "boceto" }] }],
    };
    const conCroquis = { ...informe.levantamientos[0]!, formato: conObservaciones, respuestas: { ...informe.levantamientos[0]!.respuestas, observaciones: { hoja: { boceto: "d".repeat(64) } } } };
    const version = aplicarSeleccion(conCroquis, SELECCION_VACIA);
    const html = plantillaInforme({ ...informe, levantamientos: [version] }, { salida: PDF, fotos: new Map() });
    expect(html).not.toContain("Observaciones adicionales");
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

  it("si el PDF del informe no cabe, remite al portal solo a quien puede entrar; a los demás, que respondan (iteración 51)", () => {
    const informe = { documento: "informe" as const, organizacion: "TEINS", cliente: "Hotel Plaza Real", sitio: "Torre A", motivo: "Mantenimiento", programadaPara: "2026-09-30", numero: 1, nombreArchivo: "Informe.pdf", documentoId: "0192f0e0-0000-7000-8000-000000000001" };
    const conPortal = { ...opciones, sinAdjunto: true, portal: "https://portal.example/informes/0192f0e0-0000-7000-8000-000000000001" };
    const sinPortal = { ...opciones, sinAdjunto: true };
    expect(textoDeCorreo(informe, conPortal)).toContain("El PDF pesa demasiado para el correo: descárguelo del portal.");
    // Sin acceso al portal (ADR-0053) el correo no lleva el botón: mandarlo allá lo dejaría sin el informe.
    for (const mensaje of [informe, { ...informe, personal: { asunto: "Asunto", texto: "Le envío el informe." } }]) {
      expect(textoDeCorreo(mensaje, sinPortal)).toContain("El PDF pesa demasiado para el correo: respóndanos y se lo hacemos llegar.");
      expect(htmlDeCorreo(mensaje, sinPortal)).not.toContain("descárguelo del portal");
    }
  });
});

describe("el informe con la estructura del formato (iteración 47, ADR-0050 y ADR-0051)", () => {
  const formatoTeins: VersionFormato = {
    formato: "servicio-ups",
    version: 1,
    nombre: "Servicio de UPS",
    secciones: [
      {
        clave: "servicio",
        titulo: "Servicio",
        campos: [
          { clave: "horario", etiqueta: "Hora de entrada y salida", tipo: "horario" },
          { clave: "tipo", etiqueta: "Tipo de servicio", tipo: "opciones", opciones: ["Instalación", "Correctivo", "Preventivo"], otro: true },
          { clave: "solucionado", etiqueta: "Solucionado", tipo: "opcion", opciones: ["Totalmente", "Parcialmente", "No solucionado"] },
        ],
      },
      {
        clave: "acometida",
        titulo: "Acometida",
        tablas: [
          {
            titulo: "Voltajes y corrientes",
            columnas: ["F1", "F2", "F3"],
            filas: [
              { etiqueta: "Voltaje F-N", campos: ["v1", "v2", "v3"] },
              { etiqueta: "Frecuencia", campos: ["hz"] },
            ],
          },
        ],
        campos: [
          { clave: "v1", etiqueta: "V F-N F1", tipo: "medida", unidades: ["V"] },
          { clave: "v2", etiqueta: "V F-N F2", tipo: "medida", unidades: ["V"] },
          { clave: "v3", etiqueta: "V F-N F3", tipo: "medida", unidades: ["V"] },
          { clave: "hz", etiqueta: "Frecuencia", tipo: "medida", unidades: ["Hz"] },
          { clave: "nota", etiqueta: "Nota", tipo: "texto" },
        ],
      },
      { clave: "firmas", titulo: "Firmas", campos: [{ clave: "cliente", etiqueta: "Nombre y sello del cliente", tipo: "firma", documento: "opcional" }] },
    ],
  };
  const huellaFirma = "d".repeat(64);
  const conTodo: ContenidoVersion = {
    ...informe,
    visita: {
      ...informe.visita,
      nit: "900.123.456-7",
      ciudad: "Ibagué",
      solicitante: { nombre: "Laura Gómez", telefono: "+573105550142" },
      ordenDeServicio: "0042",
      referencia: "TKT-4821",
    },
    levantamientos: [
      {
        id: "0192f0e0-0000-7000-8000-000000000002",
        formato: formatoTeins,
        tecnico: "Juan Pérez",
        tecnicoDocumento: "79888777",
        revisor: "Laura Méndez",
        revisorDocumento: "52123456",
        revisadoEn: "2026-09-29T14:15:00.000Z",
        recibidoEn: "2026-09-28T21:40:00.000Z",
        respuestas: {
          servicio: { horario: { desde: "08:14", hasta: "11:30" }, tipo: { elegidas: ["Correctivo"], otro: "cerca eléctrica" }, solucionado: "Parcialmente" },
          acometida: { v1: { valor: "127.4", unidad: "V" }, v3: { valor: "126", unidad: "V" }, hz: { valor: "60", unidad: "Hz" }, nota: "Sin novedad" },
          firmas: { cliente: { firma: huellaFirma, nombre: "Martha Gómez", firmadoEn: "2026-09-28T20:40:00.000Z", declaracion: "Confirmo la visita.", documento: "1098765432" } },
        },
      },
    ],
  };
  const pdf = (c: ContenidoVersion) => plantillaInforme(c, { salida: PDF, fotos: new Map(), firmas: new Map([[huellaFirma, '<svg id="trazo"></svg>']]) });

  it("el encabezado va en rejilla con lo de la visita, y lo que falta va como marcador", () => {
    const html = pdf(conTodo);
    expect(html).toContain('class="encabezado"');
    for (const dato of ["900.123.456-7", "0042", "Ibagué", "Laura Gómez", "+57 310 555 0142", "TKT-4821"]) expect(html).toContain(dato);
    for (const rotulo of ["Cliente", "NIT", "Orden de servicio", "Dirección", "Ciudad", "Sede", "Solicitante", "Teléfono", "Fecha", "Referencia del cliente"]) expect(html).toContain(`>${rotulo}<`);
    const vacio = pdf({ ...conTodo, visita: informe.visita });
    for (const marcador of ["[NIT]", "[Ciudad]", "[Solicitante]", "[N.º de orden]"]) expect(vacio).toContain(marcador);
    // Sin referencia no se inventa la línea.
    expect(vacio).not.toContain("Referencia del cliente");
  });

  it("cada selección sale con todas sus opciones, marcadas o no, y su «Otro»", () => {
    const html = pdf(conTodo);
    expect(html).toContain('<span class="op marcada"><i></i>Correctivo</span>');
    expect(html).toContain('<span class="op"><i></i>Instalación</span>');
    expect(html).toContain('<span class="op"><i></i>Preventivo</span>');
    expect(html).toContain('<span class="op marcada"><i></i>Otro: cerca eléctrica</span>');
    expect(html).toContain('<span class="op marcada"><i></i>Parcialmente</span>');
    expect(html).toContain('<span class="op"><i></i>Totalmente</span>');
    // Sin «Otro» elegido, el formato que lo admite lo muestra vacío.
    const sinOtro = pdf({ ...conTodo, levantamientos: [{ ...conTodo.levantamientos[0]!, respuestas: { ...conTodo.levantamientos[0]!.respuestas, servicio: { tipo: { elegidas: ["Instalación"] } } } }] });
    expect(sinOtro).toContain('<span class="op"><i></i>Otro</span>');
  });

  it("el horario sale con las dos horas y el total", () => {
    expect(pdf(conTodo)).toContain("8:14 a. m. a 11:30 a. m. · 3 h 16 min");
  });

  it("las mediciones salen en una tabla con sus columnas, y lo que no se midió queda en blanco; esas celdas no se repiten como datos", () => {
    const html = pdf(conTodo);
    expect(html).toContain('<table class="medidas">');
    expect(html).toMatch(/<th[^>]*>F1<\/th><th[^>]*>F2<\/th><th[^>]*>F3<\/th>/);
    expect(html).toContain("Voltaje F-N");
    expect(html).toContain("127,4");
    expect(html).toContain("126");
    expect(html).toMatch(/Frecuencia<\/th><td[^>]*>60 Hz|60/);
    // Cada celda aparece en la tabla, no en la lista de datos; la nota que no es de la tabla, sí.
    expect(html).not.toContain("<th>V F-N F1</th>");
    expect(html).toContain("<th>Nota</th>");
  });

  it("la fila de firmas lleva al técnico, a quien acompañó y al revisor, con su cédula y su hora", () => {
    const html = pdf(conTodo);
    expect(html).toContain('class="firmas tres"');
    expect(html).toContain("Técnico que asistió");
    expect(html).toContain("Juan Pérez");
    expect(html).toContain("C. C. 79888777");
    expect(html).toMatch(/Firmó electrónicamente al enviar, el 28 de septiembre de 2026/);
    expect(html).toContain("Nombre y sello del cliente");
    expect(html).toContain('<div class="trazo"><svg id="trazo"></svg><p><strong>Martha Gómez</strong>');
    expect(html).toContain("C. C. 1098765432");
    expect(html).toContain("Supervisado o validado por");
    expect(html).toContain("Laura Méndez");
    expect(html).toContain("C. C. 52123456");
    expect(html).toMatch(/Validó en TEINS el 29 de septiembre de 2026/);
  });

  it("sin cédula, el marcador; sin campo de firma en el formato, solo el técnico y el revisor", () => {
    const sinCedula = pdf({ ...conTodo, levantamientos: [{ ...conTodo.levantamientos[0]!, tecnicoDocumento: undefined, revisorDocumento: undefined }] });
    expect(sinCedula.match(/\[C\. C\.\]/g)).toHaveLength(2);
    const sinCampo = pdf({ ...informe });
    expect(sinCampo).toContain('class="firmas dos"');
    expect(sinCampo).toContain("Técnico que asistió");
    expect(sinCampo).toContain("Supervisado o validado por");
    expect(sinCampo).not.toContain("Nombre y sello del cliente");
  });

  it("con dos firmas en el formato, las dos salen en la fila, cada una con su rótulo", () => {
    const otraFirma = "e".repeat(64);
    const [l] = conTodo.levantamientos;
    const secciones = l!.formato.secciones.map((s) =>
      s.clave === "firmas" ? { ...s, campos: [...s.campos, { clave: "acompana", etiqueta: "Quien acompañó", tipo: "firma" as const }] } : s,
    );
    const dos = plantillaInforme(
      {
        ...conTodo,
        levantamientos: [
          {
            ...l!,
            formato: { ...l!.formato, secciones },
            respuestas: { ...l!.respuestas, firmas: { ...l!.respuestas.firmas, acompana: { firma: otraFirma, nombre: "Pedro Ruiz", firmadoEn: "2026-09-28T20:41:00.000Z", declaracion: "Confirmo la visita." } } },
          },
        ],
      },
      { salida: PDF, fotos: new Map(), firmas: new Map([[huellaFirma, '<svg id="trazo"></svg>'], [otraFirma, '<svg id="otro-trazo"></svg>']]) },
    );
    expect(dos).toContain('class="firmas cuatro"');
    expect(dos).toContain("Nombre y sello del cliente");
    expect(dos).toContain('<div class="trazo"><svg id="otro-trazo"></svg><p><strong>Pedro Ruiz</strong>');
    expect(dos).toContain("Quien acompañó");
  });

  it("una versión anterior, sin nada de esto, se dibuja igual que antes", () => {
    const html = pdf(informe);
    expect(html).toContain("Cuarto técnico");
    expect(html).toContain("[NIT]");
    expect(html).not.toContain("undefined");
  });
});

