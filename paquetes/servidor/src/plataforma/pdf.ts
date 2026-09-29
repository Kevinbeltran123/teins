import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium, type Browser } from "playwright-core";
import { PDFDocument } from "pdf-lib";

/*
  Impresión de documentos a PDF (ADR-0013): la usan el informe y la cotización (ADR-0029). Vive en la
  plataforma porque un módulo no importa las partes internas de otro.
*/

const requerir = createRequire(import.meta.url);
let fuente: string | undefined;
/** La misma familia de la interfaz, incrustada: el PDF no depende de las fuentes del servidor (ADR-0013). */
export const fuenteIncrustada = () =>
  (fuente ??= readFileSync(requerir.resolve("@fontsource-variable/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-normal.woff2")).toString("base64"));

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
 * Un Chromium por proceso, que atiende todos los documentos en curso y se cierra tras un minuto sin
 * ninguno: arrancarlo para cada PDF cuesta segundos y memoria, y tenerlo siempre abierto cuesta memoria
 * todo el día. Cada documento usa su propio contexto, aislado de los demás.
 */
const INACTIVIDAD_MS = 60_000;
let navegador: Promise<Browser> | undefined;
let enCurso = 0;
let cierre: NodeJS.Timeout | undefined;

function abrirNavegador(chromiumRuta: string | undefined): Promise<Browser> {
  if (navegador) return navegador;
  // Si este Chromium se cae o no arranca, el siguiente documento abre otro. Solo se olvida si sigue siendo
  // el vigente: el aviso de uno ya cerrado no debe soltar al que lo reemplazó.
  const olvidar = () => void (navegador === lanzado && (navegador = undefined));
  const lanzado: Promise<Browser> = chromium
    .launch({
      ...(chromiumRuta ? { executablePath: chromiumRuta } : {}),
      // En el contenedor corre sin privilegios y sin el espacio de nombres que pide el sandbox de Chromium;
      // lo que se renderiza es nuestra propia plantilla, sin JavaScript ni red.
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    })
    .then(
      (abierto) => abierto.on("disconnected", olvidar),
      (error: unknown) => {
        olvidar();
        throw error;
      },
    );
  return (navegador = lanzado);
}

/** Cierra el Chromium compartido, si hay uno: al apagar el worker y al terminar las pruebas. */
export async function cerrarNavegador(): Promise<void> {
  clearTimeout(cierre);
  const abierto = navegador;
  navegador = undefined;
  await abierto?.then(
    (b) => b.close(),
    () => undefined,
  );
}

/**
 * Imprime el documento con Chromium sin interfaz y anexa los planos con pdf-lib. La página no ejecuta
 * JavaScript ni sale a la red: todo lo que muestra viene incrustado en el HTML.
 */
export async function imprimirPdf({ html, pie, planos, metadatos, chromiumRuta }: Impresion): Promise<Uint8Array> {
  clearTimeout(cierre);
  enCurso++;
  let base: Uint8Array;
  try {
    const contexto = await (await abrirNavegador(chromiumRuta)).newContext({ javaScriptEnabled: false, offline: true });
    try {
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
      await contexto.close();
    }
  } finally {
    if (--enCurso === 0) cierre = setTimeout(() => void cerrarNavegador(), INACTIVIDAD_MS).unref();
  }

  const documento = await PDFDocument.load(base);
  for (const [i, plano] of planos.entries()) {
    // pdf-lib carga algunos PDF dañados sin quejarse y falla al copiar sus páginas: los dos pasos son del plano.
    let paginas;
    try {
      const origen = await PDFDocument.load(plano);
      paginas = await documento.copyPages(origen, origen.getPageIndices());
    } catch {
      throw new PlanoIlegible(i + 1);
    }
    for (const pagina of paginas) documento.addPage(pagina);
  }
  documento.setTitle(metadatos.titulo);
  documento.setAuthor(metadatos.autor);
  documento.setProducer("TEINS");
  documento.setCreator("TEINS");
  documento.setCreationDate(metadatos.fecha);
  documento.setModificationDate(metadatos.fecha);
  return documento.save();
}
