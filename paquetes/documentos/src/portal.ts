import { escapar } from "./escapar";
import { primerNombre } from "./mensajes";

/** Un correo listo para el proveedor: asunto, HTML con estilos en línea y texto plano. */
export interface CorreoDelPortal {
  asunto: string;
  html: string;
  texto: string;
}

/** «482 915»: en dos grupos se lee y se copia sin perderse. */
const enGrupos = (codigo: string) => `${codigo.slice(0, 3)} ${codigo.slice(3)}`;

/** El mismo marco que el correo de los documentos (`htmlDeCorreo`): la marca arriba, el pie abajo. */
function marco(organizacion: string, asunto: string, cuerpo: string, pie: string): string {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapar(asunto)}</title></head>
<body style="margin:0;padding:24px 12px;background:#E9ECF1;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;color:#15171A">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:12px">
<tr><td style="padding:20px 32px;border-bottom:3px solid #002B81;font-size:22px;font-weight:800;color:#002B81;letter-spacing:0.02em">${escapar(organizacion)}</td></tr>
<tr><td style="padding:28px 32px 12px;font-size:16px;line-height:1.55">
${cuerpo}
</td></tr>
<tr><td style="padding:16px 32px;background:#F8F9FB;border-top:1px solid #E1E4EA;border-radius:0 0 12px 12px;font-size:13px;line-height:1.5;color:#525152">${pie}</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

const parrafo = (html: string, estilo = "") => `<p style="margin:0 0 16px${estilo}">${html}</p>`;
const SECUNDARIO = ";font-size:14px;color:#525152";

/** El código para entrar al portal (ADR-0053): en el asunto y en grande, con su vencimiento. */
export function correoDeCodigo({ organizacion, codigo }: { organizacion: string; codigo: string }): CorreoDelPortal {
  const legible = enGrupos(codigo);
  const asunto = `Su código para entrar al portal de ${organizacion}: ${legible}`;
  const aviso = `Si usted no lo pidió, ignore este correo. ${organizacion} nunca le pedirá este código por teléfono ni por WhatsApp.`;
  return {
    asunto,
    texto: [`Su código para entrar al portal: ${legible}`, "Vence en 10 minutos.", aviso].join("\n\n"),
    html: marco(
      organizacion,
      asunto,
      parrafo("Su código para entrar al portal:") +
        `<p style="margin:0 0 16px;font-size:34px;font-weight:700;letter-spacing:0.18em;font-variant-numeric:tabular-nums">${legible}</p>` +
        parrafo("Vence en 10 minutos.") +
        parrafo(escapar(aviso), SECUNDARIO),
      `${escapar(organizacion)}. Recibe este correo porque alguien pidió entrar al portal con esta dirección.`,
    ),
  };
}

/** Lo que el contacto ve en el portal, como se dice en el correo. */
const queVe = (ve: { informes: boolean; cotizaciones: boolean }) => (ve.informes && ve.cotizaciones ? "informes y cotizaciones" : ve.informes ? "informes" : "cotizaciones");

/**
 * La invitación al activar el acceso (ADR-0053): nombra solo lo que el contacto ve, y el botón lleva al portal, sin
 * secretos en el enlace. Sin la dirección del portal en el entorno, sale sin botón.
 */
export function correoDeInvitacion({
  organizacion,
  nombre,
  cliente,
  portal,
  ve,
}: {
  organizacion: string;
  nombre: string;
  cliente: string;
  portal: string | null;
  ve: { informes: boolean; cotizaciones: boolean };
}): CorreoDelPortal {
  const asunto = `${organizacion} le dio acceso a sus ${queVe(ve)}`;
  const presentacion = `${organizacion} le dio acceso al portal, donde puede ver y descargar las ${queVe(ve)} de ${cliente}.`;
  const comoEntrar = "Para entrar, escriba su correo y le enviaremos un código. No necesita clave.";
  const pie = `${organizacion}. Recibe este correo porque es contacto de ${cliente}.`;
  return {
    asunto,
    texto: [`Hola, ${primerNombre(nombre)}:`, presentacion, ...(portal ? [`Portal: ${portal}`] : []), comoEntrar, "", pie].join("\n\n"),
    html: marco(
      organizacion,
      asunto,
      parrafo(`Hola, ${escapar(primerNombre(nombre))}:`) +
        parrafo(escapar(presentacion)) +
        (portal
          ? parrafo(`<a href="${escapar(portal)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#002B81;color:#FFFFFF;font-weight:700;text-decoration:none">Entrar al portal</a>`)
          : "") +
        parrafo(escapar(comoEntrar), SECUNDARIO),
      escapar(pie),
    ),
  };
}
