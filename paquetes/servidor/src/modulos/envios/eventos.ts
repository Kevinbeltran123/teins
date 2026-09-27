import { createHmac, timingSafeEqual } from "node:crypto";

/** Lo que un evento del proveedor le hace a un envío. */
export interface EventoDeEnvio {
  organizacionId: string;
  envioId: string;
  proveedorId: string;
  estado: "entregado" | "fallido";
  motivo?: string;
  /** Rebote de correo: marca al contacto (ADR-0028, parte 4). */
  rebote?: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Un evento viejo reenviado por alguien que lo capturó no se acepta (la firma incluye la hora). */
const TOLERANCIA_SEGUNDOS = 5 * 60;

const iguales = (a: Buffer, b: Buffer) => a.length === b.length && timingSafeEqual(a, b);

/**
 * Firma de Resend (Svix): HMAC-SHA256 en base64 sobre `id.hora.cuerpo`, con la clave del secreto
 * `whsec_…` decodificada. La cabecera puede traer varias firmas separadas por espacios ("v1,…").
 */
export function firmaSvixValida(secreto: string, cabeceras: { id: string | undefined; hora: string | undefined; firma: string | undefined }, cuerpo: Buffer, ahora = Date.now()): boolean {
  const { id, hora, firma } = cabeceras;
  if (!id || !hora || !firma || !/^\d+$/.test(hora)) return false;
  if (Math.abs(ahora / 1000 - Number(hora)) > TOLERANCIA_SEGUNDOS) return false;
  const clave = Buffer.from(secreto.replace(/^whsec_/, ""), "base64");
  const esperada = createHmac("sha256", clave).update(`${id}.${hora}.`).update(cuerpo).digest();
  return firma.split(" ").some((parte) => {
    const [version, valor] = parte.split(",");
    return version === "v1" && valor !== undefined && iguales(Buffer.from(valor, "base64"), esperada);
  });
}

/** Firma de Meta: `sha256=` y el HMAC-SHA256 en hexadecimal del cuerpo, con el secreto de la app. */
export function firmaMetaValida(secretoApp: string, firma: string | undefined, cuerpo: Buffer): boolean {
  if (!firma?.startsWith("sha256=")) return false;
  const esperada = createHmac("sha256", secretoApp).update(cuerpo).digest();
  return iguales(Buffer.from(firma.slice("sha256=".length), "hex"), esperada);
}

/** Eventos de Resend que cambian el estado; los demás (enviado, abierto, demorado) no cambian nada. */
export function eventoDeResend(carga: unknown): EventoDeEnvio | null {
  const e = carga as { type?: string; data?: { email_id?: string; tags?: Record<string, string>; bounce?: { message?: string }; failed?: { reason?: string } } };
  const organizacionId = e.data?.tags?.["organizacion"];
  const envioId = e.data?.tags?.["envio"];
  const proveedorId = e.data?.email_id;
  if (!organizacionId || !envioId || !proveedorId || !UUID.test(organizacionId) || !UUID.test(envioId)) return null;
  const base = { organizacionId, envioId, proveedorId };
  switch (e.type) {
    case "email.delivered":
      return { ...base, estado: "entregado" };
    case "email.bounced":
      return { ...base, estado: "fallido", rebote: true, motivo: `El correo rebotó${e.data?.bounce?.message ? `: ${e.data.bounce.message}` : ""}` };
    case "email.failed":
      return { ...base, estado: "fallido", motivo: `El correo no salió${e.data?.failed?.reason ? `: ${e.data.failed.reason}` : ""}` };
    case "email.suppressed":
      return { ...base, estado: "fallido", rebote: true, motivo: "Resend no envía a esta dirección porque rebotó antes" };
    default:
      return null;
  }
}

/** Estados de WhatsApp (entregado, leído o fallido) de todas las entradas del evento. */
export function eventosDeWhatsapp(carga: unknown): EventoDeEnvio[] {
  const c = carga as {
    entry?: { changes?: { value?: { statuses?: { id?: string; status?: string; biz_opaque_callback_data?: string; errors?: { title?: string; message?: string; error_data?: { details?: string } }[] }[] } }[] }[];
  };
  const eventos: EventoDeEnvio[] = [];
  for (const estado of (c.entry ?? []).flatMap((e) => (e.changes ?? []).flatMap((x) => x.value?.statuses ?? []))) {
    const [organizacionId, envioId] = (estado.biz_opaque_callback_data ?? "").split(":");
    if (!estado.id || !organizacionId || !envioId || !UUID.test(organizacionId) || !UUID.test(envioId)) continue;
    const base = { organizacionId, envioId, proveedorId: estado.id };
    if (estado.status === "delivered" || estado.status === "read") eventos.push({ ...base, estado: "entregado" });
    else if (estado.status === "failed") {
      const error = estado.errors?.[0];
      const detalle = [error?.title ?? error?.message, error?.error_data?.details].filter(Boolean).join(". ");
      eventos.push({ ...base, estado: "fallido", motivo: `WhatsApp no lo entregó${detalle ? `: ${detalle}` : ""}` });
    }
  }
  return eventos;
}
