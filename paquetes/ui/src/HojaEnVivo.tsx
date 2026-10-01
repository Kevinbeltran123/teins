import { useEffect, useLayoutEffect, useRef } from "react";
import { sinMovimiento } from "./transicion";

/*
  Un documento en vivo (ADR-0031): la hoja que va a recibir el cliente, dibujada en un marco del mismo origen y sin
  scripts. El marco se arma una vez; cada cambio reemplaza solo el cuerpo en el siguiente cuadro, sin recargarlo ni
  perder el desplazamiento, y destella lo que cambió. La hoja se reduce para caber, nunca se amplía.

  El HTML entra con innerHTML porque es la salida de las plantillas de paquetes/documentos, que escapan todo texto
  que viene de personas; además el marco no ejecuta scripts (sandbox) y la CSP no admite manejadores en línea.
*/

/** Una parte del documento a la que llevar la vista; `vez` cambia para volver a llevarla aunque sea la misma. */
export interface AnclaDeHoja {
  selector: string;
  vez: number;
}

interface Props {
  /** El documento completo, en su salida de vista (estilos enlazados, sin nada en línea). */
  html: string;
  /** Ancho de la hoja en píxeles CSS: 816 es una carta. */
  ancho: number;
  /** Nombre accesible del marco. */
  titulo: string;
  /**
   * El correo trae sus estilos en atributos `style` (los lectores de correo no cargan hojas). La CSP de oficina no
   * los admite en el HTML ni por `style.cssText`, pero sí propiedad por propiedad (CSSOM, como React): se pasan a
   * `data-estilo` y se aplican desde aquí.
   */
  estilosEnLinea?: boolean;
  /** Lo que la pantalla marca encima de la hoja después de cada pintada (el dato corregido, una ficha). */
  alPintar?: ((documento: Document) => void) | undefined;
  ancla?: AnclaDeHoja | null | undefined;
}

const cuerpoDe = (html: string) => html.slice(html.indexOf(">", html.indexOf("<body")) + 1, html.lastIndexOf("</body>"));
const sinEstilosEnLinea = (html: string) => html.replace(/ style="/g, ' data-estilo="');
/** "color:#002B81;padding:20px 32px" → una propiedad a la vez; ningún valor del correo lleva ";". */
function aplicarEstilo(el: HTMLElement, declaraciones: string) {
  for (const declaracion of declaraciones.split(";")) {
    const i = declaracion.indexOf(":");
    if (i > 0) el.style.setProperty(declaracion.slice(0, i).trim(), declaracion.slice(i + 1).trim());
  }
}
/** Lo que se lee de la hoja: los elementos sin hijos que tienen texto. */
const hojasDe = (raiz: Element) => [...raiz.querySelectorAll("*")].filter((n) => n.children.length === 0 && n.textContent?.trim());

/** Lo que se desplaza alrededor de la hoja: el lienzo. */
function desplazable(el: HTMLElement | null): HTMLElement | null {
  for (let n = el?.parentElement ?? null; n; n = n.parentElement) {
    const { overflowY } = getComputedStyle(n);
    if (overflowY === "auto" || overflowY === "scroll") return n;
  }
  return null;
}

/** El color de lo que rodea la hoja, para la franja de los saltos de página. */
function fondoAlrededor(el: HTMLElement | null): string {
  for (let n = el?.parentElement ?? null; n; n = n.parentElement) {
    const fondo = getComputedStyle(n).backgroundColor;
    if (fondo && fondo !== "transparent" && !fondo.startsWith("rgba(0, 0, 0, 0")) return fondo;
  }
  return "#E9EBEF";
}

export function HojaEnVivo({ html, ancho, titulo, estilosEnLinea = false, alPintar, ancla }: Props) {
  const caja = useRef<HTMLDivElement>(null);
  const marco = useRef<HTMLIFrameElement>(null);
  const escala = useRef(1);
  // Lo vigente, para el marco que termina de cargar después de varias teclas.
  const vigente = useRef({ html, alPintar, estilosEnLinea });
  vigente.current = { html, alPintar, estilosEnLinea };
  const cargado = useRef(false);
  const anclaVigente = useRef(ancla);
  anclaVigente.current = ancla;
  // El primer HTML arma el marco; los siguientes solo cambian el cuerpo.
  const inicial = useRef(estilosEnLinea ? sinEstilosEnLinea(html) : html);

  function medir() {
    const f = marco.current, c = caja.current, doc = f?.contentDocument;
    if (!f || !c || !doc?.documentElement) return;
    const s = Math.min(1, c.clientWidth / ancho);
    escala.current = s;
    // El cuerpo y no el documento: el documento nunca mide menos que el marco, y la hoja no podría encogerse.
    const alto = doc.body ? Math.ceil(doc.body.getBoundingClientRect().height) : doc.documentElement.scrollHeight;
    f.style.width = `${ancho}px`;
    f.style.height = `${alto}px`;
    f.style.transform = `scale(${s})`;
    const hoja = f.parentElement!;
    hoja.style.width = `${ancho * s}px`;
    hoja.style.height = `${alto * s}px`;
  }

  function pintar(destellar: boolean) {
    const doc = marco.current?.contentDocument;
    if (!doc?.body) return;
    const { html: actual, alPintar: marcar, estilosEnLinea: enLinea } = vigente.current;
    if (destellar) {
      const antes = hojasDe(doc.body).map((n) => n.textContent);
      doc.body.innerHTML = cuerpoDe(enLinea ? sinEstilosEnLinea(actual) : actual);
      const despues = hojasDe(doc.body);
      if (despues.length === antes.length) despues.forEach((n, i) => n.textContent !== antes[i] && n.classList.add("vista-cambio"));
    }
    if (enLinea) for (const el of doc.querySelectorAll<HTMLElement>("[data-estilo]")) aplicarEstilo(el, el.dataset.estilo ?? "");
    doc.documentElement.style.setProperty("--vista-fondo", fondoAlrededor(caja.current));
    marcar?.(doc);
    medir();
    // Las fotos y la fuente llegan después: la hoja crece.
    for (const ms of [150, 700]) setTimeout(medir, ms);
    void doc.fonts?.ready.then(medir);
  }

  function alCargar() {
    cargado.current = true;
    const doc = marco.current?.contentDocument;
    doc?.addEventListener("load", medir, true);
    // Si cambió mientras cargaba, se pone al día sin destello.
    const actual = vigente.current.estilosEnLinea ? sinEstilosEnLinea(vigente.current.html) : vigente.current.html;
    if (actual !== inicial.current && doc?.body) doc.body.innerHTML = cuerpoDe(actual);
    pintar(false);
    // Si había adónde ir antes de que cargara (la pestaña se abrió a mitad de una corrección), va ahora.
    irAlAncla();
  }

  function irAlAncla() {
    const a = anclaVigente.current;
    const el = a ? marco.current?.contentDocument?.querySelector(a.selector) : null;
    const lienzo = desplazable(caja.current);
    if (!el || !lienzo || !marco.current) return;
    // La posición dentro de la hoja, reducida, más donde empieza la hoja en el lienzo; deja ver la cabecera fija.
    const inicio = marco.current.parentElement!.getBoundingClientRect().top - lienzo.getBoundingClientRect().top + lienzo.scrollTop;
    const cabecera = lienzo.querySelector<HTMLElement>(":scope > .lienzo-cab")?.offsetHeight ?? 0;
    lienzo.scrollTo({ top: inicio + el.getBoundingClientRect().top * escala.current - cabecera - 16, behavior: sinMovimiento() ? "auto" : "smooth" });
  }

  // Al escribir: el cuerpo nuevo en el siguiente cuadro, una sola vez por cuadro.
  useEffect(() => {
    if (!cargado.current) return;
    const cuadro = requestAnimationFrame(() => pintar(true));
    return () => cancelAnimationFrame(cuadro);
  }, [html, alPintar]);

  useLayoutEffect(() => {
    const c = caja.current;
    if (!c) return;
    const observador = new ResizeObserver(() => medir());
    observador.observe(c);
    return () => observador.disconnect();
  }, [ancho]);

  useEffect(() => {
    if (ancla && cargado.current) irAlAncla();
  }, [ancla?.selector, ancla?.vez]);

  return (
    <div ref={caja} className="hoja-en-vivo">
      <div className="hoja-marco">
        <iframe ref={marco} title={titulo} sandbox="allow-same-origin" srcDoc={inicial.current} onLoad={alCargar} />
      </div>
    </div>
  );
}
