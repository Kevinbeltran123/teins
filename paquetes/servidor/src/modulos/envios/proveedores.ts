import { randomUUID } from "node:crypto";
import type { Config } from "../../config";

/** El proveedor no lo aceptará nunca (dirección inválida, plantilla inexistente): no se reintenta. */
export class RechazoDefinitivo extends Error {}

/**
 * El proveedor respondió y no lo aceptó por ahora (429, 5xx, 409 de una llave en curso): seguro que no
 * salió, así que se reintenta. Un error sin respuesta (red, tiempo agotado) no dice si salió.
 */
export class NoAceptado extends Error {}

export interface CorreoSaliente {
  /** Id del envío: el proveedor descarta un segundo intento con la misma llave. */
  idempotencia: string;
  de: string;
  para: string;
  responderA: string | undefined;
  asunto: string;
  html: string;
  texto: string;
  adjunto: { nombre: string; contenido: Buffer } | null;
  /** Vuelven en sus eventos: así se encuentra el envío sin buscar en todas las organizaciones. */
  etiquetas: Record<string, string>;
}

export interface WhatsappSaliente {
  /** E.164. */
  para: string;
  plantilla: string;
  idioma: string;
  variables: string[];
  documento: { nombre: string; contenido: Buffer };
  /** Vuelve en los eventos de estado (`biz_opaque_callback_data`). */
  referencia: string;
}

/** Entrega el mensaje y devuelve su id en el proveedor. 429, 5xx o 409 se lanzan como `NoAceptado`: se reintenta. */
export type ProveedorDeCorreo = (correo: CorreoSaliente) => Promise<{ id: string }>;
export type ProveedorDeWhatsapp = (mensaje: WhatsappSaliente) => Promise<{ id: string }>;

export interface Proveedores {
  correo?: ProveedorDeCorreo | undefined;
  whatsapp?: ProveedorDeWhatsapp | undefined;
}

const ESPERA_MAXIMA_MS = 60_000;

/**
 * 2xx devuelve el JSON; 429, 5xx y 409 (Resend: otra solicitud con la misma llave sigue en curso) se
 * reintentan; cualquier otro 4xx es definitivo, con el motivo del proveedor.
 */
async function leerRespuesta<T>(respuesta: Response, proveedor: string): Promise<T> {
  const cuerpo = (await respuesta.json().catch(() => ({}))) as Record<string, unknown>;
  if (respuesta.ok) return cuerpo as T;
  const detalle = motivoDe(cuerpo) ?? `respondió ${respuesta.status}`;
  if (respuesta.status === 429 || respuesta.status === 409 || respuesta.status >= 500) throw new NoAceptado(`${proveedor}: ${detalle}`);
  throw new RechazoDefinitivo(`${proveedor} lo rechazó: ${detalle}`);
}

function motivoDe(cuerpo: Record<string, unknown>): string | undefined {
  const error = cuerpo["error"];
  if (error && typeof error === "object") {
    const e = error as { message?: unknown; error_data?: { details?: unknown } };
    return [e.message, e.error_data?.details].filter((x): x is string => typeof x === "string").join(". ") || undefined;
  }
  return typeof cuerpo["message"] === "string" ? cuerpo["message"] : undefined;
}

/** Resend por su API HTTPS: Railway bloquea SMTP (ADR-0028, parte 2). */
export function correoResend(claveApi: string): ProveedorDeCorreo {
  return async (c) => {
    const respuesta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${claveApi}`, "content-type": "application/json", "idempotency-key": c.idempotencia },
      body: JSON.stringify({
        from: c.de,
        to: [c.para],
        ...(c.responderA ? { reply_to: c.responderA } : {}),
        subject: c.asunto,
        html: c.html,
        text: c.texto,
        ...(c.adjunto ? { attachments: [{ filename: c.adjunto.nombre, content: c.adjunto.contenido.toString("base64") }] } : {}),
        tags: Object.entries(c.etiquetas).map(([name, value]) => ({ name, value })),
      }),
      signal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
    });
    const { id } = await leerRespuesta<{ id: string }>(respuesta, "Resend");
    return { id };
  };
}

/**
 * Cloud API de Meta: el PDF se sube como medio y va en el encabezado de la plantilla; el número
 * sale sin el "+" (ADR-0028, parte 3).
 */
export function whatsappMeta({ token, numeroId, versionApi }: { token: string; numeroId: string; versionApi: string }): ProveedorDeWhatsapp {
  const base = `https://graph.facebook.com/${versionApi}/${numeroId}`;
  const autorizacion = { authorization: `Bearer ${token}` };
  return async (m) => {
    const formulario = new FormData();
    formulario.set("messaging_product", "whatsapp");
    formulario.set("type", "application/pdf");
    formulario.set("file", new Blob([new Uint8Array(m.documento.contenido)], { type: "application/pdf" }), m.documento.nombre);
    // Subir el medio no envía nada: si falla la red aquí, reintentar no duplica.
    const subida = await fetch(`${base}/media`, { method: "POST", headers: autorizacion, body: formulario, signal: AbortSignal.timeout(ESPERA_MAXIMA_MS) }).catch((error: unknown) => {
      throw new NoAceptado(`WhatsApp: ${error instanceof Error ? error.message : String(error)}`);
    });
    const { id: medio } = await leerRespuesta<{ id: string }>(subida, "WhatsApp");

    const respuesta = await fetch(`${base}/messages`, {
      method: "POST",
      headers: { ...autorizacion, "content-type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: m.para.replace(/^\+/, ""),
        type: "template",
        biz_opaque_callback_data: m.referencia,
        template: {
          name: m.plantilla,
          language: { code: m.idioma },
          components: [
            { type: "header", parameters: [{ type: "document", document: { id: medio, filename: m.documento.nombre } }] },
            { type: "body", parameters: m.variables.map((text) => ({ type: "text", text })) },
          ],
        },
      }),
      signal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
    });
    const { messages } = await leerRespuesta<{ messages?: { id: string }[] }>(respuesta, "WhatsApp");
    if (!messages?.[0]) throw new Error("WhatsApp no devolvió el id del mensaje");
    return { id: messages[0].id };
  };
}

/** Marca de prueba: una dirección o un número con esto se rechaza, para ver el camino de "No llegó". */
/** También la dirección de prueba de rebote de Resend: la misma prueba sirve simulada y con Resend real. */
const RECHAZA = /rebota|^bounced(\+[^@]*)?@resend\.dev$/;

/**
 * Proveedores simulados (ADR-0028, parte 2): desarrollo, pruebas y el entorno de pruebas sin cuentas.
 * Aceptan todo menos lo que contiene "rebota" o es bounced@resend.dev (en el celular, los dígitos 000).
 */
export function proveedoresSimulados(): Required<Proveedores> {
  return {
    correo: async (c) => {
      if (RECHAZA.test(c.para)) throw new RechazoDefinitivo("La dirección no existe (envío simulado)");
      return { id: `simulado-${randomUUID()}` };
    },
    whatsapp: async (m) => {
      if (m.para.endsWith("000")) throw new RechazoDefinitivo("El número no tiene WhatsApp (envío simulado)");
      return { id: `simulado-${randomUUID()}` };
    },
  };
}

/** Proveedores según la configuración; un canal sin configurar queda sin proveedor y sus envíos no llegan, con ese motivo. */
export function proveedoresSegunConfig(config: Config): Proveedores {
  const simulados = proveedoresSimulados();
  return {
    correo: config.ENVIOS_SIMULADOS.correo ? simulados.correo : config.RESEND_CLAVE_API ? correoResend(config.RESEND_CLAVE_API) : undefined,
    whatsapp: config.ENVIOS_SIMULADOS.whatsapp
      ? simulados.whatsapp
      : config.WHATSAPP_TOKEN && config.WHATSAPP_NUMERO_ID
        ? whatsappMeta({ token: config.WHATSAPP_TOKEN, numeroId: config.WHATSAPP_NUMERO_ID, versionApi: config.WHATSAPP_VERSION_API })
        : undefined,
  };
}
