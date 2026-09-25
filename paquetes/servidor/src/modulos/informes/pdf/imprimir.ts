import { chromium } from "playwright-core";
import { PDFDocument } from "pdf-lib";

export interface Impresion {
  html: string;
  pie: string;
  /** Planos en PDF, en el orden de oficina: se anexan como páginas del mismo documento (ADR-0013). */
  planos: readonly Uint8Array[];
  metadatos: { titulo: string; autor: string; fecha: Date };
  /** Sin valor: el Chromium que instala Playwright (desarrollo y pruebas). */
  chromiumRuta?: string | undefined;
}

export class PlanoIlegible extends Error {
  constructor(readonly posicion: number) {
    super(`El plano ${posicion} no es un PDF que se pueda anexar`);
    this.name = "PlanoIlegible";
  }
}

/**
 * Imprime el informe con Chromium sin interfaz y anexa los planos con pdf-lib. La página no ejecuta
 * JavaScript ni sale a la red: todo lo que muestra viene incrustado en el HTML.
 */
export async function imprimirInforme({ html, pie, planos, metadatos, chromiumRuta }: Impresion): Promise<Uint8Array> {
  const navegador = await chromium.launch({
    ...(chromiumRuta ? { executablePath: chromiumRuta } : {}),
    // En el contenedor corre sin privilegios y sin el espacio de nombres que pide el sandbox de Chromium;
    // lo que se renderiza es nuestra propia plantilla, sin JavaScript ni red.
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  let base: Uint8Array;
  try {
    const contexto = await navegador.newContext({ javaScriptEnabled: false, offline: true });
    const pagina = await contexto.newPage();
    await pagina.route("**/*", (ruta) => ruta.abort());
    await pagina.setContent(html, { waitUntil: "load" });
    base = await pagina.pdf({
      format: "Letter",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: pie,
    });
  } finally {
    await navegador.close();
  }

  const documento = await PDFDocument.load(base);
  for (const [i, plano] of planos.entries()) {
    let origen: PDFDocument;
    try {
      origen = await PDFDocument.load(plano);
    } catch {
      throw new PlanoIlegible(i + 1);
    }
    for (const pagina of await documento.copyPages(origen, origen.getPageIndices())) documento.addPage(pagina);
  }
  documento.setTitle(metadatos.titulo);
  documento.setAuthor(metadatos.autor);
  documento.setProducer("TEINS");
  documento.setCreator("TEINS");
  documento.setCreationDate(metadatos.fecha);
  documento.setModificationDate(metadatos.fecha);
  return documento.save();
}
