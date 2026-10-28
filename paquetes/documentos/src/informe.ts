import {
  aDecimalColombiano,
  bloqueOcultoPorOmision,
  bloques,
  campoOcultoPorOmision,
  claveOcultable,
  describirValor,
  esBoceto,
  esCantidades,
  esFirma,
  esNoObtenido,
  ocultosDe,
  type ContenidoVersion,
  type DefinicionCampo,
  type SeleccionInforme,
  type Valor,
  formatearDia,
  ZONA_COLOMBIA,
  esDatoSimple,
} from "@teins/dominio";
import { escapar } from "./escapar";
import { LOGO_TEINS } from "./logo";
import { estilosDe, type Salida } from "./salida";

/**
 * Plantilla del informe (ADR-0013): HTML y CSS con la dirección de DESIGN.md. El PDF se arma solo desde la
 * copia congelada de la versión, con la fuente y las fotos incrustadas: no pide nada a la red, así que el
 * mismo contenido produce el mismo documento. La vista en vivo de oficina dibuja el borrador con esta misma
 * plantilla (ADR-0031).
 *
 * Supuestos mientras TEINS responde P22 y P23 (docs/proceso/historia/04-informe.md): portada, introducción,
 * un capítulo por levantamiento, conclusiones, firma y planos anexos. Lo que falta va como marcador.
 * La marca por organización (ADR-0020) llega con la administración: hoy, los valores de TEINS.
 */
const MARCA = { superficie: "#002B81", acento: "#FFC21A", texto: "#15171A", secundario: "#525152", division: "#E1E4EA", fondo: "#F5F6F8" };

const fecha = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: ZONA_COLOMBIA });
const fechaHora = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: ZONA_COLOMBIA });
const dia = (aaaaMmDd: string) => formatearDia(aaaaMmDd, { dateStyle: "long" });


const parrafos = (texto: string) =>
  texto
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapar(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

/** Una hoja de un boceto, ya en SVG (ADR-0019, ADR-0026). */
export interface HojaDelInforme {
  nombre: string;
  /** Las verticales van de a dos por fila; una apaisada (boceto de la versión 1) ocupa la fila. */
  vertical: boolean;
  svg: string;
}

export interface RecursosPlantilla {
  /** PDF (estilos y fuente incrustados) o vista en vivo de oficina (ADR-0031). */
  salida: Salida;
  /** Foto por huella: data URI en el PDF, URL firmada en la vista. Una que falte se muestra como marcador, nunca se inventa. */
  fotos: ReadonlyMap<string, string>;
  /** Hojas de cada boceto por huella, ya en SVG. Uno que falte se muestra como marcador. */
  bocetos?: ReadonlyMap<string, readonly HojaDelInforme[]>;
  /** Firma por huella, en SVG sin cuadrícula y recortada a sus trazos (ADR-0024). */
  firmas?: ReadonlyMap<string, string>;
  /**
   * La vista de oficina mientras compone (ADR-0039): el contenido llega completo y lo oculto se dibuja como una franja
   * con «Mostrar»; lo que sale lleva «Ocultar». Sin ella (el PDF), lo oculto ya no viene y se salta.
   */
  seleccion?: SeleccionInforme | undefined;
}

/** «Ocultar» y «Mostrar» de la vista: la pantalla los atiende por su clave y si la parte sale o no por omisión. */
const botonOcultar = (clave: string, omision: boolean) => `<button type="button" class="vista-ocultar" data-ocultar="${escapar(clave)}" data-omision="${omision ? 1 : 0}">Ocultar</button>`;
const franjaOculta = (titulo: string, porque: string, clave: string, omision: boolean) =>
  `<div class="vista-oculto"><span><b>${escapar(titulo)}</b> no sale en el informe${porque ? ` · <i>${porque}</i>` : ""}</span><button type="button" data-mostrar="${escapar(clave)}" data-omision="${omision ? 1 : 0}">Mostrar</button></div>`;

/**
 * Nombre con que se guarda el PDF al descargarlo y se adjunta: quien lo recibe lo encuentra después en su carpeta
 * de descargas por el cliente, el sitio y la versión. Sin los caracteres que un sistema de archivos no admite.
 */
export const nombreDelPdfDeInforme = (visita: { cliente: string; sitio: string }, numero: number) =>
  `Informe ${visita.cliente} - ${visita.sitio} - versión ${numero}.pdf`.replace(/[/\\:*?"<>|]/g, "-");

export function plantillaInforme(c: ContenidoVersion, { salida, fotos, bocetos = new Map(), firmas = new Map(), seleccion }: RecursosPlantilla): string {
  const capitulos = c.levantamientos
    .map((l, i) => {
      // Lo oculto (ADR-0039): mientras se compone, según la selección del borrador; en la versión, lo que quedó fuera.
      const elegidos = seleccion ? ocultosDe(seleccion, l.id) : undefined;
      const fuera = new Set(l.ocultos ?? []);
      // Cada sección, y cada repetición de las repetibles con su nombre, en orden (iteración 9).
      const secciones = bloques(l.formato, l.repeticiones ?? {})
        .map((bloque) => {
          const { seccion: s, clave, titulo } = bloque;
          const claveBloque = claveOcultable(l.id, clave);
          if (elegidos ? elegidos.bloque(bloque) : fuera.has(clave)) {
            return seleccion ? `<section class="seccion">${franjaOculta(titulo, bloqueOcultoPorOmision(bloque) ? "solo para la empresa" : "", claveBloque, bloqueOcultoPorOmision(bloque))}</section>` : "";
          }
          const campoFuera = (campo: DefinicionCampo) => (elegidos ? elegidos.campo(bloque, campo) : fuera.has(claveOcultable(clave, campo.clave)));
          /** Un campo con bloque propio (fotos, croquis, cantidades, firma): oculto, su franja en la vista; si sale, con «Ocultar». */
          const propio = (campo: DefinicionCampo, html: string) => {
            if (!html) return "";
            const claveCampo = claveOcultable(l.id, clave, campo.clave);
            if (!seleccion) return html;
            if (campoFuera(campo)) return franjaOculta(campo.etiqueta, campo.tipo === "boceto" ? "croquis de campo: adjunte el plano en Planos anexos" : "", claveCampo, campoOcultoPorOmision(campo));
            return `<div class="vista-ocultable">${botonOcultar(claveCampo, campoOcultoPorOmision(campo))}${html}</div>`;
          };
          const datos = s.campos
            // Fotos, bocetos, cantidades y firmas tomadas van en su propio bloque; "no se pudo obtener"
            // de cualquier tipo, y una firma sin tomar, van como cualquier dato, con su motivo.
            .filter((campo) => {
              const valor = l.respuestas[clave]?.[campo.clave] as Valor | undefined;
              if (!seleccion && campoFuera(campo)) return false;
              if (valor !== undefined && esNoObtenido(valor)) return true;
              return esDatoSimple(campo) || (campo.tipo === "firma" && !esFirma(valor));
            })
            .map((campo) => {
              const valor = l.respuestas[clave]?.[campo.clave] as Valor | undefined;
              const vacio = valor === undefined || esNoObtenido(valor);
              // data-dato: la revisión resalta en la vista el dato corregido; el PDF lo ignora.
              return `<tr data-dato="${escapar(`${clave}/${campo.clave}`)}"><th>${escapar(campo.etiqueta)}</th><td${vacio ? ' class="tenue"' : ""}>${escapar(describirValor(campo, valor))}</td></tr>`;
            })
            .join("");
          const galerias = s.campos
            .filter((campo) => campo.tipo === "foto")
            .map((campo) => {
              const huellas = l.respuestas[clave]?.[campo.clave];
              if (!Array.isArray(huellas) || huellas.length === 0) return "";
              const figuras = (huellas as readonly string[])
                .map((h, n) => {
                  const pie = `Foto ${n + 1} de ${escapar(campo.etiqueta.toLowerCase())}`;
                  const claveFoto = claveOcultable(l.id, clave, campo.clave, h);
                  if (seleccion && !campoFuera(campo) && elegidos!.foto(bloque, campo, h))
                    return `<figure class="vista-foto-oculta"><div>No sale</div><button type="button" data-mostrar="${escapar(claveFoto)}" data-omision="0">Mostrar</button></figure>`;
                  const src = fotos.get(h);
                  const ocultar = seleccion ? botonOcultar(claveFoto, false) : "";
                  return src ? `<figure>${ocultar}<img src="${src}" alt="${pie}"><figcaption>${pie}</figcaption></figure>` : `<figure class="falta">${ocultar}<div>[FOTO]</div><figcaption>${pie}</figcaption></figure>`;
                })
                .join("");
              return propio(campo, `<h4>${escapar(campo.etiqueta)}</h4><div class="fotos">${figuras}</div>`);
            })
            .join("");
          const croquis = s.campos
            .filter((campo) => campo.tipo === "boceto")
            .map((campo) => {
              const valor = l.respuestas[clave]?.[campo.clave];
              if (!esBoceto(valor)) return "";
              const hojas = bocetos.get(valor.boceto);
              if (!hojas) return propio(campo, `<h4>${escapar(campo.etiqueta)}</h4><figure class="boceto"><div class="falta">[BOCETO]</div></figure>`);
              // El nombre de cada hoja ("Segundo piso") sale cuando hay más de una.
              const figuras = hojas
                .map((h) => `<figure class="boceto${h.vertical ? "" : " apaisada"}">${h.svg}${hojas.length > 1 ? `<figcaption>${escapar(h.nombre)}</figcaption>` : ""}</figure>`)
                .join("");
              return propio(campo, `<h4>${escapar(campo.etiqueta)}</h4><div class="hojas">${figuras}</div>`);
            })
            .join("");
          // Cantidades (F9): una tabla por campo, sin precios (regla 7).
          const cantidades = s.campos
            .filter((campo) => campo.tipo === "cantidades")
            .map((campo) => {
              const valor = l.respuestas[clave]?.[campo.clave];
              if (!esCantidades(valor) || valor.length === 0) return "";
              const filas = valor
                .map((linea) => `<tr><td>${escapar(linea.descripcion)}</td><td class="numero">${aDecimalColombiano(linea.cantidad)}</td><td>${escapar(linea.unidad)}</td><td>${escapar(linea.observacion ?? "")}</td></tr>`)
                .join("");
              return propio(campo, `<h4>${escapar(campo.etiqueta)}</h4><table class="cantidades"><colgroup><col><col class="c-cantidad"><col class="c-unidad"><col class="c-observacion"></colgroup><thead><tr><th>Descripción</th><th class="numero">Cantidad</th><th>Unidad</th><th>Observación</th></tr></thead><tbody>${filas}</tbody></table>`);
            })
            .join("");
          // Constancia de visita (ADR-0024): lo que leyó quien firmó, su firma y cuándo.
          const constancias = s.campos
            .filter((campo) => campo.tipo === "firma")
            .map((campo) => {
              const valor = l.respuestas[clave]?.[campo.clave];
              if (!esFirma(valor)) return "";
              const trazo = firmas.get(valor.firma) ?? '<div class="falta">[FIRMA]</div>';
              return propio(campo, `<section class="constancia"><h4>Constancia de visita</h4><p>${escapar(valor.declaracion)}</p><div class="firmado"><div class="trazo">${trazo}<p><strong>${escapar(valor.nombre)}</strong>${valor.cargo ? `<br><span class="tenue">${escapar(valor.cargo)}</span>` : ""}</p></div><p class="tenue">Firmado en el sitio el ${fechaHora.format(new Date(valor.firmadoEn))}, en el teléfono del técnico.</p></div></section>`);
            })
            .join("");
          return `<section class="seccion${seleccion ? " vista-ocultable" : ""}">${seleccion ? botonOcultar(claveBloque, bloqueOcultoPorOmision(bloque)) : ""}<h3>${escapar(titulo)}</h3>${datos ? `<table class="datos">${datos}</table>` : ""}${cantidades}${galerias}${croquis}${constancias}</section>`;
        })
        .join("");
      return `<article class="capitulo" id="capitulo-${escapar(l.id)}">
        <p class="numero">Levantamiento ${i + 1} de ${c.levantamientos.length}</p>
        <h2>${escapar(l.formato.nombre ?? l.formato.formato)}</h2>
        <p class="meta">Capturado por ${escapar(l.tecnico)} · revisado por ${escapar(l.revisor)} · recibido en oficina el ${fechaHora.format(new Date(l.recibidoEn))}</p>
        ${secciones}
      </article>`;
    })
    .join("");

  const planos = c.planos.length
    ? `<section class="bloque" id="planos"><h2>Planos anexos</h2><p>Los planos se incluyen al final de este documento, en este orden:</p><ol>${c.planos.map((p) => `<li>${escapar(p.nombre)}</li>`).join("")}</ol></section>`
    : "";

  return `<!doctype html>
<html lang="es-CO">
<head>
<meta charset="utf-8">
<title>Informe técnico · ${escapar(c.visita.cliente)} · versión ${c.numero}</title>
${estilosDe("informe", ESTILOS_INFORME, salida)}
</head>
<body>
<section class="portada">
  <img class="logo" src="${LOGO_TEINS}" alt="TEINS">
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
${c.introduccion.trim() ? `<section class="bloque" id="introduccion"><h2>Introducción</h2>${parrafos(c.introduccion)}</section>` : ""}
${capitulos}
<section class="bloque cierre" id="conclusiones">
  ${c.conclusiones.trim() ? `<h2>Conclusiones</h2>${parrafos(c.conclusiones)}` : ""}
  <div class="firma"><div>[FIRMA]<br>Responsable del informe</div><div>[DATOS LEGALES]</div></div>
</section>
${planos}
</body>
</html>`;
}

/** Los estilos del informe: los mismos en el PDF y en la vista. */
export const ESTILOS_INFORME = `@page { size: Letter; margin: 22mm 18mm 20mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: "Geist", sans-serif; font-size: 10.5pt; line-height: 1.45; color: ${MARCA.texto}; }
h1, h2, h3, h4 { margin: 0; line-height: 1.2; }
h2 { font-size: 17pt; font-weight: 600; color: ${MARCA.superficie}; margin-bottom: 6pt; }
h3 { font-size: 12.5pt; font-weight: 600; margin: 14pt 0 6pt; }
h4 { font-size: 10.5pt; font-weight: 600; margin: 10pt 0 6pt; }
p { margin: 0 0 8pt; }
.portada { background: ${MARCA.superficie}; color: #FFFFFF; border-radius: 8px; padding: 26pt; min-height: 200mm; display: flex; flex-direction: column; gap: 14pt; break-after: page; }
.portada .logo { display: block; height: 40pt; width: auto; align-self: flex-start; filter: brightness(0) invert(1); }
.portada h1 { font-size: 30pt; font-weight: 600; letter-spacing: -0.5pt; margin-top: auto; }
.portada .cliente { font-size: 18pt; font-weight: 600; }
.portada dl { display: grid; grid-template-columns: auto 1fr; gap: 4pt 16pt; margin: 0; }
.portada dt { opacity: .8; }
.portada dd { margin: 0; font-weight: 600; }
.marquilla { display: inline-block; background: ${MARCA.acento}; color: ${MARCA.texto}; font-weight: 600; padding: 4pt 16pt 4pt 10pt; clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%); align-self: flex-start; }
.bloque { margin-bottom: 18pt; }
.capitulo { break-before: page; }
.cierre { break-before: page; }
.numero { color: ${MARCA.secundario}; font-weight: 600; margin-bottom: 2pt; }
.meta { color: ${MARCA.secundario}; }
.seccion { break-inside: auto; }
table.datos { width: 100%; border-collapse: collapse; }
table.datos th, table.datos td { text-align: left; vertical-align: top; padding: 5pt 6pt; border-bottom: 1px solid ${MARCA.division}; }
table.datos th { width: 38%; font-weight: 400; color: ${MARCA.secundario}; }
table.datos td { font-weight: 600; }
table.datos tr { break-inside: avoid; }
/* Columnas de ancho fijo (iteración 29): la tabla queda pareja en la vista y en el PDF, sin importar el texto */
table.cantidades { width: 100%; border-collapse: collapse; margin-bottom: 8pt; table-layout: fixed; }
table.cantidades col.c-cantidad { width: 14%; } table.cantidades col.c-unidad { width: 11%; } table.cantidades col.c-observacion { width: 30%; }
table.cantidades th.numero, table.cantidades td.numero { padding-right: 14pt; }
table.cantidades th { text-align: left; font-weight: 400; color: ${MARCA.secundario}; border-bottom: 1px solid ${MARCA.division}; padding: 4pt 6pt 4pt 0; }
table.cantidades td { padding: 4pt 6pt 4pt 0; border-bottom: 1px solid ${MARCA.division}; vertical-align: top; }
table.cantidades tr { break-inside: avoid; }
table.cantidades .numero { text-align: right; font-variant-numeric: tabular-nums; }
.tenue { color: ${MARCA.secundario}; font-weight: 400 !important; }
.fotos { display: grid; grid-template-columns: 1fr 1fr; gap: 10pt; }
figure { margin: 0; break-inside: avoid; }
.hojas { display: grid; grid-template-columns: 1fr 1fr; gap: 10pt; }
.hojas .apaisada { grid-column: 1 / -1; }
figure.boceto svg { width: 100%; height: auto; display: block; border: 1px solid ${MARCA.division}; border-radius: 6px; }
.constancia { break-inside: avoid; border: 1px solid ${MARCA.division}; border-radius: 6px; padding: 10pt 12pt; margin-top: 8pt; }
.constancia h4 { margin-top: 0; }
.constancia .firmado { display: flex; align-items: flex-end; gap: 18pt; }
.constancia .trazo { width: 72mm; }
.constancia .trazo svg { width: 100%; height: auto; max-height: 30mm; display: block; }
.constancia .trazo p { border-top: 1.5px solid ${MARCA.texto}; padding-top: 4pt; margin: 0; }
figure.boceto .falta { height: 62mm; border: 1.5px dashed ${MARCA.division}; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: ${MARCA.secundario}; }
figure img { width: 100%; height: 62mm; object-fit: cover; border-radius: 6px; display: block; }
figure.falta div { height: 62mm; border: 1.5px dashed ${MARCA.division}; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: ${MARCA.secundario}; }
figcaption { font-size: 9pt; color: ${MARCA.secundario}; margin-top: 3pt; }
.firma { break-inside: avoid; margin-top: 24pt; display: grid; grid-template-columns: 1fr 1fr; gap: 24pt; }
.firma div { border-top: 1.5px solid ${MARCA.texto}; padding-top: 6pt; color: ${MARCA.secundario}; }
`;

/** Pie de página con numeración (lo imprime Chromium fuera del flujo del documento). */
export function piePagina(c: ContenidoVersion): string {
  return `<div style="font-family: sans-serif; font-size: 8pt; color: ${MARCA.secundario}; width: 100%; padding: 0 18mm; display: flex; justify-content: space-between;">
    <span>Informe de ${escapar(c.visita.cliente)} · versión ${c.numero}</span>
    <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
  </div>`;
}
