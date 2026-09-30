import { TARIFA_IVA } from "@teins/dominio";
import { escapar } from "../../../plataforma/html";
import type { ContenidoCotizacion } from "../esquema";

/**
 * Plantilla de la cotización (ADR-0029), con la dirección de DESIGN.md y la maqueta aprobada (lienzo,
 * "v1.1 · Cotizaciones"). Se arma solo desde la copia congelada de la versión, con la fuente incrustada.
 * Lo que TEINS no ha entregado (NIT, dirección, forma de pago) va como marcador, nunca inventado.
 */
const MARCA = { superficie: "#002B81", texto: "#15171A", secundario: "#525152", division: "#E1E4EA", suave: "#F3F6FC" };

const ZONA = "America/Bogota";
const fecha = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: ZONA });
const dia = (aaaaMmDd: string) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${aaaaMmDd}T00:00:00Z`)).replace(/\./g, "").replace(/ de /g, " ");
const pesos = (n: number) => `$ ${n.toLocaleString("es-CO")}`;
const cantidad = (decimal: string) => decimal.replace(".", ",");


/** "10" → "10 %"; "2.5" → "2,5 %". */
const pct = (p: string) => `${p.replace(".", ",")} %`;

export function plantillaCotizacion(c: ContenidoCotizacion, { fuente }: { fuente: string }): string {
  const publicada = new Date(c.publicadaEn);
  const validaHasta = new Date(publicada.getTime() + c.condiciones.validezDias * 86_400_000);
  const t = c.totales;
  const filas = c.lineas
    .map(
      (l, i) =>
        `<tr><td>${escapar(l.codigo ?? "")}</td><td>${escapar(l.descripcion)}</td><td class="numero">${cantidad(l.cantidad)}</td><td>${escapar(l.unidad)}</td><td class="numero">${pesos(l.precio ?? 0)}</td><td class="numero fuerte">${pesos(t.lineas[i] ?? 0)}</td></tr>`,
    )
    .join("");
  const totales = [
    ["Subtotal", t.subtotal],
    ...(c.impuestos.tipo === "iva"
      ? [[`IVA ${TARIFA_IVA} %`, t.iva]]
      : [
          [`Administración ${pct(c.impuestos.administracion)}`, t.aiu!.administracion],
          [`Imprevistos ${pct(c.impuestos.imprevistos)}`, t.aiu!.imprevistos],
          [`Utilidad ${pct(c.impuestos.utilidad)}`, t.aiu!.utilidad],
          [`IVA ${TARIFA_IVA} % sobre la utilidad`, t.aiu!.ivaUtilidad],
        ]),
  ] as [string, number][];

  return `<!doctype html>
<html lang="es-CO">
<head>
<meta charset="utf-8">
<title>Cotización ${escapar(c.numero)} · versión ${c.version}</title>
<style>
@font-face { font-family: "Atkinson"; src: url(data:font/woff2;base64,${fuente}) format("woff2"); font-weight: 200 800; }
@page { size: Letter; margin: 20mm 18mm 20mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: "Atkinson", sans-serif; font-size: 9.5pt; line-height: 1.45; color: ${MARCA.texto}; font-variant-numeric: tabular-nums; }
.encabezado { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2.5pt solid ${MARCA.superficie}; padding-bottom: 10pt; }
.marca { font-size: 20pt; font-weight: 800; color: ${MARCA.superficie}; letter-spacing: 0.5pt; }
.secundario { color: ${MARCA.secundario}; }
.documento { text-align: right; }
.documento h1 { margin: 0; font-size: 14pt; font-weight: 800; }
.partes { display: grid; grid-template-columns: 1fr 1fr; gap: 12pt; margin: 14pt 0; }
.partes strong { font-size: 11pt; }
table { width: 100%; border-collapse: collapse; }
table.lineas th { background: ${MARCA.suave}; text-align: left; padding: 5pt 6pt; font-weight: 700; }
table.lineas td { padding: 5pt 6pt; border-bottom: 0.75pt solid ${MARCA.division}; vertical-align: top; }
table.lineas tr { break-inside: avoid; }
.numero { text-align: right; white-space: nowrap; }
.fuerte { font-weight: 700; }
.totales { display: flex; justify-content: flex-end; margin-top: 10pt; break-inside: avoid; }
.totales table { width: 250pt; }
.totales td { padding: 3pt 6pt; }
.totales tr.total td { font-size: 11pt; font-weight: 800; border-top: 1.5pt solid ${MARCA.superficie}; padding-top: 5pt; }
.condiciones { margin-top: 16pt; break-inside: avoid; }
.condiciones p { margin: 0 0 3pt; }
</style>
</head>
<body>
<header class="encabezado">
  <div><div class="marca">${escapar(c.organizacion.nombre)}</div><div class="secundario">[LOGO] · NIT [N] · [Dirección] · [Teléfono]</div></div>
  <div class="documento"><h1>Cotización ${escapar(c.numero)}</h1><div>Versión ${c.version} · ${fecha.format(publicada)}</div><div>Válida hasta el ${fecha.format(validaHasta)}</div></div>
</header>
<section class="partes">
  <div><div class="secundario">Cliente</div><strong>${escapar(c.visita.cliente)}</strong><div>[NIT del cliente]</div></div>
  <div><div class="secundario">Sitio</div><strong>${escapar(c.visita.sitio)}</strong><div>${escapar(c.visita.direccion)} · visita del ${dia(c.visita.programadaPara)}</div></div>
</section>
<table class="lineas">
  <thead><tr><th>Código</th><th>Descripción</th><th class="numero">Cantidad</th><th>Unidad</th><th class="numero">Precio unitario</th><th class="numero">Total</th></tr></thead>
  <tbody>${filas}</tbody>
</table>
<div class="totales"><table>
  ${totales.map(([nombre, valor]) => `<tr><td>${nombre}</td><td class="numero fuerte">${pesos(valor)}</td></tr>`).join("")}
  <tr class="total"><td>Total</td><td class="numero">${pesos(t.total)}</td></tr>
</table></div>
<section class="condiciones">
  <p><strong>Condiciones</strong></p>
  <p>Validez: ${c.condiciones.validezDias} días. Forma de pago: ${c.condiciones.formaPago ? escapar(c.condiciones.formaPago) : "[Forma de pago]"}.</p>
  ${c.condiciones.notas
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapar(p)}</p>`)
    .join("")}
</section>
</body>
</html>`;
}

export function piePaginaCotizacion(c: ContenidoCotizacion): string {
  return `<div style="font-family: sans-serif; font-size: 8pt; color: ${MARCA.secundario}; width: 100%; padding: 0 18mm; display: flex; justify-content: space-between;">
    <span>${escapar(c.organizacion.nombre)} · Cotización ${escapar(c.numero)} · versión ${c.version}</span>
    <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
  </div>`;
}
