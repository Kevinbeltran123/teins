/*
  Una plantilla, dos salidas (ADR-0031). El PDF lleva los estilos en <style> y Geist incrustada: no depende de
  las fuentes del servidor (ADR-0013). La vista en vivo de oficina enlaza una hoja de estilos y la fuente
  servidas por oficina, porque su CSP solo admite estilos del propio origen. El cuerpo es el mismo.
*/

export type Salida = { tipo: "pdf"; fuente: string } | { tipo: "vista" };

export type Documento = "informe" | "cotizacion";

/** Dónde sirve oficina las hojas de estilos y la fuente de la vista. */
export const RUTA_DOCUMENTOS = "/documentos";
export const ARCHIVO_FUENTE = "geist.woff2";

const caraDeFuente = (src: string) => `@font-face { font-family: "Geist"; src: url(${src}) format("woff2"); font-weight: 100 900; }`;

/** Lo que va en el <head>: los estilos en línea para el PDF, o el enlace a la hoja de la vista. */
export function estilosDe(documento: Documento, estilos: string, salida: Salida): string {
  if (salida.tipo === "pdf") return `<style>\n${caraDeFuente(`data:font/woff2;base64,${salida.fuente}`)}\n${estilos}\n</style>`;
  return `<link rel="stylesheet" href="${RUTA_DOCUMENTOS}/${documento}.css">`;
}

/*
  Lo propio de la pantalla, que el PDF no lleva: la hoja continua al ancho de una carta (los márgenes que en el
  PDF pone @page), el destello de lo que cambió al escribir y una franja donde el PDF salta de página.
*/
const vista = (margenes: string) => `
html { background: #FFFFFF; }
body { width: 816px; padding: ${margenes}; background: #FFFFFF; }
.vista-cambio { animation: vista-destello 1.4s cubic-bezier(0.2, 0, 0, 1); border-radius: 2px; }
@keyframes vista-destello { from { background: rgb(47 95 232 / .22); box-shadow: 0 0 0 2px rgb(47 95 232 / .22); } }
@media (prefers-reduced-motion: reduce) { .vista-cambio { animation: none; } }
`;

/* La franja del salto: el ancho completo de la hoja, en el color del fondo del lienzo (--vista-fondo, de oficina). */
const franja = (selector: string, margenLateral: string) => `
${selector} { position: relative; margin-top: 30mm !important; }
${selector.split(",").map((s) => `${s.trim()}::before`).join(", ")} { content: ""; position: absolute; left: -${margenLateral}; right: -${margenLateral}; top: -19mm; height: 8mm; background: var(--vista-fondo, #E9EBEF); }
`;

const VISTA_INFORME = `${vista("22mm 18mm 20mm")}
${franja(".portada + .bloque, .portada + .capitulo, .capitulo, .cierre", "18mm")}
/* El capítulo solo, en la revisión: sin portada ni cierre, con márgenes cortos para que se lea en el carril. */
html.vista-capitulo body { width: 740px; padding: 8mm; }
html.vista-capitulo .portada, html.vista-capitulo .bloque, html.vista-capitulo .cierre, html.vista-capitulo .capitulo > .numero { display: none; }
html.vista-capitulo .capitulo { margin-top: 0 !important; }
html.vista-capitulo .capitulo::before { display: none; }
/* El dato corregido: resaltado, con el valor anterior debajo. */
tr.vista-corregido td { background: rgb(47 95 232 / .08); }
tr.vista-editando th, tr.vista-editando td { background: rgb(47 95 232 / .12); }
tr.vista-editando { outline: 1.5px solid #2F5FE8; outline-offset: -1px; }
td[data-antes]::after { content: attr(data-antes); display: block; font-weight: 400; font-size: 8.5pt; color: #2F5FE8; margin-top: 1pt; }
/* Un plano anexo no se dibuja: una ficha con su nombre y sus páginas. */
.vista-anexo { margin-top: 8pt; display: flex; gap: 10pt; align-items: center; border: 1px dashed #C9CED8; border-radius: 6px; padding: 9pt 11pt; color: #525152; break-inside: avoid; }
.vista-anexo b { color: #15171A; font-weight: 600; }
.vista-anexo.ilegible { border-color: #E5484D; background: #FFF5F5; color: #B42318; }
.vista-anexo i { font-style: normal; font-size: 8pt; font-weight: 600; color: #C0262D; background: #FBE9EA; border-radius: 3px; padding: 1pt 4pt; }
`;

const VISTA_COTIZACION = vista("20mm 18mm 20mm");

/** La hoja de estilos que sirve oficina para la vista: la misma del PDF, la fuente por archivo y lo de la pantalla. */
export function hojaDeLaVista(documento: Documento, estilos: string): string {
  return `${caraDeFuente(ARCHIVO_FUENTE)}\n${estilos}\n${documento === "informe" ? VISTA_INFORME : VISTA_COTIZACION}`;
}
