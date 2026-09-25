import { describirValor, esNoObtenido, type ContenidoVersion, type Valor } from "@teins/dominio";

/**
 * Plantilla del informe (ADR-0013): HTML y CSS con la dirección de DESIGN.md. Se arma solo desde la
 * copia congelada de la versión, con la fuente y las fotos incrustadas: no pide nada a la red, así
 * que el mismo contenido produce el mismo documento.
 *
 * Supuestos mientras TEINS responde P22 y P23 (plan de entrega, corte 4): portada, introducción,
 * un capítulo por levantamiento, conclusiones, firma y planos anexos. Lo que falta va como marcador.
 * La marca por organización (ADR-0020) llega con la administración: hoy, los valores de TEINS.
 */
const MARCA = { superficie: "#002B81", acento: "#FFC21A", texto: "#15171A", secundario: "#525152", division: "#DEDBD3", fondo: "#F3F1EC" };

const ZONA = "America/Bogota";
const fecha = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: ZONA });
const fechaHora = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: ZONA });
const dia = (aaaaMmDd: string) => new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${aaaaMmDd}T00:00:00Z`));

/** Todo texto que viene de personas se escapa. */
export function escapar(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const parrafos = (texto: string) =>
  texto
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapar(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

export interface RecursosPlantilla {
  /** Fuente Atkinson Hyperlegible Next en woff2, en base64. */
  fuente: string;
  /** Foto por huella, como data URI. Una que falte se muestra como marcador, nunca se inventa. */
  fotos: ReadonlyMap<string, string>;
}

export function plantillaInforme(c: ContenidoVersion, { fuente, fotos }: RecursosPlantilla): string {
  const capitulos = c.levantamientos
    .map((l, i) => {
      const secciones = l.formato.secciones
        .map((s) => {
          const datos = s.campos
            .filter((campo) => campo.tipo !== "foto")
            .map((campo) => {
              const valor = l.respuestas[s.clave]?.[campo.clave] as Valor | undefined;
              const vacio = valor === undefined || esNoObtenido(valor);
              return `<tr><th>${escapar(campo.etiqueta)}</th><td${vacio ? ' class="tenue"' : ""}>${escapar(describirValor(campo, valor))}</td></tr>`;
            })
            .join("");
          const galerias = s.campos
            .filter((campo) => campo.tipo === "foto")
            .map((campo) => {
              const huellas = l.respuestas[s.clave]?.[campo.clave];
              if (!Array.isArray(huellas) || huellas.length === 0) return "";
              const figuras = (huellas as readonly string[])
                .map((h, n) => {
                  const pie = `Foto ${n + 1} de ${escapar(campo.etiqueta.toLowerCase())}`;
                  const src = fotos.get(h);
                  return src ? `<figure><img src="${src}" alt="${pie}"><figcaption>${pie}</figcaption></figure>` : `<figure class="falta"><div>[FOTO]</div><figcaption>${pie}</figcaption></figure>`;
                })
                .join("");
              return `<h4>${escapar(campo.etiqueta)}</h4><div class="fotos">${figuras}</div>`;
            })
            .join("");
          return `<section class="seccion"><h3>${escapar(s.titulo)}</h3>${datos ? `<table class="datos">${datos}</table>` : ""}${galerias}</section>`;
        })
        .join("");
      return `<article class="capitulo">
        <p class="numero">Levantamiento ${i + 1} de ${c.levantamientos.length}</p>
        <h2>${escapar(l.formato.nombre ?? l.formato.formato)}</h2>
        <p class="meta">Capturado por ${escapar(l.tecnico)} · revisado por ${escapar(l.revisor)} · recibido en oficina el ${fechaHora.format(new Date(l.recibidoEn))}</p>
        ${secciones}
      </article>`;
    })
    .join("");

  const planos = c.planos.length
    ? `<section class="bloque"><h2>Planos anexos</h2><p>Los planos se incluyen al final de este documento, en este orden:</p><ol>${c.planos.map((p) => `<li>${escapar(p.nombre)}</li>`).join("")}</ol></section>`
    : "";

  return `<!doctype html>
<html lang="es-CO">
<head>
<meta charset="utf-8">
<title>Informe técnico · ${escapar(c.visita.cliente)} · versión ${c.numero}</title>
<style>
@font-face { font-family: "Atkinson"; src: url(data:font/woff2;base64,${fuente}) format("woff2"); font-weight: 200 800; }
@page { size: Letter; margin: 22mm 18mm 20mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: "Atkinson", sans-serif; font-size: 10.5pt; line-height: 1.45; color: ${MARCA.texto}; }
h1, h2, h3, h4 { margin: 0; line-height: 1.2; }
h2 { font-size: 17pt; font-weight: 800; color: ${MARCA.superficie}; margin-bottom: 6pt; }
h3 { font-size: 12.5pt; font-weight: 800; margin: 14pt 0 6pt; }
h4 { font-size: 10.5pt; font-weight: 700; margin: 10pt 0 6pt; }
p { margin: 0 0 8pt; }
.portada { background: ${MARCA.superficie}; color: #FFFFFF; border-radius: 8px; padding: 26pt; min-height: 200mm; display: flex; flex-direction: column; gap: 14pt; break-after: page; }
.portada .logo { border: 1.5px dashed rgba(255,255,255,.6); border-radius: 6px; width: 120pt; padding: 14pt; text-align: center; font-weight: 700; }
.portada h1 { font-size: 30pt; font-weight: 800; letter-spacing: -0.5pt; margin-top: auto; }
.portada .cliente { font-size: 18pt; font-weight: 700; }
.portada dl { display: grid; grid-template-columns: auto 1fr; gap: 4pt 16pt; margin: 0; }
.portada dt { opacity: .8; }
.portada dd { margin: 0; font-weight: 700; }
.marquilla { display: inline-block; background: ${MARCA.acento}; color: ${MARCA.texto}; font-weight: 800; padding: 4pt 16pt 4pt 10pt; clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%); align-self: flex-start; }
.bloque { margin-bottom: 18pt; }
.capitulo { break-before: page; }
.numero { color: ${MARCA.secundario}; font-weight: 700; margin-bottom: 2pt; }
.meta { color: ${MARCA.secundario}; }
.seccion { break-inside: auto; }
table.datos { width: 100%; border-collapse: collapse; }
table.datos th, table.datos td { text-align: left; vertical-align: top; padding: 5pt 6pt; border-bottom: 1px solid ${MARCA.division}; }
table.datos th { width: 38%; font-weight: 400; color: ${MARCA.secundario}; }
table.datos td { font-weight: 700; }
table.datos tr { break-inside: avoid; }
.tenue { color: ${MARCA.secundario}; font-weight: 400 !important; }
.fotos { display: grid; grid-template-columns: 1fr 1fr; gap: 10pt; }
figure { margin: 0; break-inside: avoid; }
figure img { width: 100%; height: 62mm; object-fit: cover; border-radius: 6px; display: block; }
figure.falta div { height: 62mm; border: 1.5px dashed ${MARCA.division}; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: ${MARCA.secundario}; }
figcaption { font-size: 9pt; color: ${MARCA.secundario}; margin-top: 3pt; }
.firma { break-inside: avoid; margin-top: 24pt; display: grid; grid-template-columns: 1fr 1fr; gap: 24pt; }
.firma div { border-top: 1.5px solid ${MARCA.texto}; padding-top: 6pt; color: ${MARCA.secundario}; }
</style>
</head>
<body>
<section class="portada">
  <div class="logo">[LOGO]</div>
  <h1>Informe técnico</h1>
  <p class="cliente">${escapar(c.visita.cliente)}</p>
  <dl>
    <dt>Sitio</dt><dd>${escapar(c.visita.sitio)}</dd>
    <dt>Dirección</dt><dd>${escapar(c.visita.direccion)}</dd>
    <dt>Motivo</dt><dd>${escapar(c.visita.motivo)}</dd>
    <dt>Visita</dt><dd>${dia(c.visita.programadaPara)}</dd>
    <dt>Publicado</dt><dd>${fecha.format(new Date(c.publicadaEn))}</dd>
  </dl>
  <span class="marquilla">Versión ${c.numero}</span>
  <p>${escapar(c.organizacion.nombre)}</p>
</section>
${c.introduccion.trim() ? `<section class="bloque"><h2>Introducción</h2>${parrafos(c.introduccion)}</section>` : ""}
${capitulos}
<section class="bloque" style="break-before: page">
  ${c.conclusiones.trim() ? `<h2>Conclusiones</h2>${parrafos(c.conclusiones)}` : ""}
  <div class="firma"><div>[FIRMA]<br>Responsable del informe</div><div>[DATOS LEGALES]</div></div>
</section>
${planos}
</body>
</html>`;
}

/** Pie de página con numeración (lo imprime Chromium fuera del flujo del documento). */
export function piePagina(c: ContenidoVersion): string {
  return `<div style="font-family: sans-serif; font-size: 8pt; color: ${MARCA.secundario}; width: 100%; padding: 0 18mm; display: flex; justify-content: space-between;">
    <span>Informe de ${escapar(c.visita.cliente)} · versión ${c.numero}</span>
    <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
  </div>`;
}
