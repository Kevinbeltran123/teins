import { escapar } from "../../plataforma/html";
import type { MensajeDeEnvio } from "./esquema";

const fechaCorta = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fechaLarga = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
/** "3 oct 2026": la visita tiene día, no hora. */
export const diaCorto = (aaaaMmDd: string) => fechaCorta.format(new Date(`${aaaaMmDd}T00:00:00Z`)).replace(/\./g, "").replace(/ de /g, " ");
const diaLargo = (aaaaMmDd: string) => fechaLarga.format(new Date(`${aaaaMmDd}T00:00:00Z`));

/** El saludo va con el primer nombre, como lo diría alguien de oficina. */
export const primerNombre = (nombre: string) => nombre.trim().split(/\s+/)[0] ?? nombre;

const version = (m: MensajeDeEnvio) => (m.numero > 1 ? ` (versión ${m.numero})` : "");

export function asunto(m: MensajeDeEnvio): string {
  return m.documento === "cotizacion" ? `Cotización ${m.cotizacion} · ${m.sitio}${version(m)}` : `Informe de la visita del ${diaCorto(m.programadaPara)} · ${m.sitio}${version(m)}`;
}

/** Qué se envía, en texto y en HTML (ADR-0028; la cotización, ADR-0029). */
function presentacion(m: MensajeDeEnvio, sinAdjunto: boolean, fuerte: (t: string) => string, texto: (t: string) => string): string {
  if (m.documento === "cotizacion") {
    return `Le enviamos la cotización ${fuerte(texto(m.cotizacion))} para ${fuerte(texto(m.sitio))}. ${sinAdjunto ? "El PDF pesa demasiado para el correo: respóndanos y se lo hacemos llegar." : "Va adjunta en PDF."}`;
  }
  return `Le enviamos el informe de la visita del ${fuerte(diaLargo(m.programadaPara))} a ${fuerte(texto(m.sitio))} (${texto(m.motivo)}). ${sinAdjunto ? "El PDF pesa demasiado para el correo: descárguelo del portal." : "Va adjunto en PDF."}`;
}

const tema = (m: MensajeDeEnvio) => (m.documento === "cotizacion" ? "las cotizaciones" : "los informes técnicos");

export interface OpcionesDeCorreo {
  nombre: string;
  portal: string | undefined;
  /** El PDF no cabe en el correo: se dice y se remite al portal. */
  sinAdjunto: boolean;
}

/** Texto plano del correo: el mismo contenido que el HTML, para los lectores que no lo muestran. */
export function textoDeCorreo(m: MensajeDeEnvio, o: OpcionesDeCorreo): string {
  return [
    `Hola, ${primerNombre(o.nombre)}:`,
    presentacion(m, o.sinAdjunto, (t) => t, (t) => t),
    ...(m.numero > 1 ? [`Es la versión ${m.numero}: reemplaza a las anteriores.`] : []),
    ...(o.portal ? [`Portal de ${m.organizacion}: ${o.portal}`, "En el portal están todos sus informes. Si no tiene acceso, respóndanos este correo."] : []),
    "",
    `${m.organizacion}. Recibe este correo porque es contacto de ${m.cliente} para ${tema(m)}. Para dejar de recibirlos, respóndanos este correo.`,
  ].join("\n\n");
}

/** HTML del correo con estilos en línea (los lectores de correo no cargan hojas de estilo), con los colores de la marca. */
export function htmlDeCorreo(m: MensajeDeEnvio, o: OpcionesDeCorreo): string {
  const e = { organizacion: escapar(m.organizacion), cliente: escapar(m.cliente) };
  const parrafo = (html: string) => `<p style="margin:0 0 16px">${html}</p>`;
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapar(asunto(m))}</title></head>
<body style="margin:0;padding:24px 12px;background:#E9ECF1;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;color:#15171A">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:12px">
<tr><td style="padding:20px 32px;border-bottom:3px solid #002B81;font-size:22px;font-weight:800;color:#002B81;letter-spacing:0.02em">${e.organizacion}</td></tr>
<tr><td style="padding:28px 32px 12px;font-size:16px;line-height:1.55">
${parrafo(`Hola, ${escapar(primerNombre(o.nombre))}:`)}
${parrafo(presentacion(m, o.sinAdjunto, (t) => `<strong>${t}</strong>`, escapar))}
${m.numero > 1 ? parrafo(`Es la <strong>versión ${m.numero}</strong>: reemplaza a las anteriores.`) : ""}
${
  o.portal
    ? `<p style="margin:0 0 16px"><a href="${escapar(o.portal)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#002B81;color:#FFFFFF;font-weight:700;text-decoration:none">Ver en el portal de ${e.organizacion}</a></p>
<p style="margin:0 0 16px;font-size:14px;color:#525152">En el portal están todos sus informes. Si no tiene acceso, respóndanos este correo.</p>`
    : ""
}
</td></tr>
<tr><td style="padding:16px 32px;background:#F8F9FB;border-top:1px solid #E1E4EA;border-radius:0 0 12px 12px;font-size:13px;line-height:1.5;color:#525152">${e.organizacion}. Recibe este correo porque es contacto de ${e.cliente} para ${tema(m)}. Para dejar de recibirlos, respóndanos este correo.</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

/**
 * Variables de la plantilla: `informe_publicado` lleva nombre, fecha, sitio y versión (ADR-0028, parte 3);
 * `cotizacion_publicada`, nombre, número de la cotización, sitio y versión (ADR-0029).
 */
export const variablesDeWhatsapp = (m: MensajeDeEnvio, nombre: string) =>
  m.documento === "cotizacion" ? [primerNombre(nombre), m.cotizacion, m.sitio, String(m.numero)] : [primerNombre(nombre), diaCorto(m.programadaPara), m.sitio, String(m.numero)];
