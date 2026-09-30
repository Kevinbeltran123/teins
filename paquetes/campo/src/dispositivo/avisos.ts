import { cliente } from "../sincronizacion/instancia";
import { admiteAvisos, estadoAvisos } from "./estadoAvisos";

/**
 * Suscripción a los avisos push (ADR-0023). Se carga aparte: trae el cliente de red. El servidor decide a
 * quién pertenece la suscripción (la sesión) y desde qué superficie (el rol).
 */

const aBytes = (base64url: string) => {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (base64url.length % 4)) % 4);
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
};

const mismaClave = (a: ArrayBuffer | null | undefined, b: Uint8Array) => a !== null && a !== undefined && a.byteLength === b.length && new Uint8Array(a).every((x, i) => x === b[i]);

/** Suscribe este navegador (o reutiliza la suscripción que ya tiene) y se la entrega al servidor. */
async function suscribir(clavePublica: string): Promise<void> {
  const registro = await navigator.serviceWorker.ready;
  const clave = aBytes(clavePublica);
  let suscripcion = await registro.pushManager.getSubscription();
  // Si el entorno cambió de claves, la suscripción vieja ya no sirve: el servicio de avisos la rechazaría.
  if (suscripcion && !mismaClave(suscripcion.options.applicationServerKey, clave)) {
    await suscripcion.unsubscribe();
    suscripcion = null;
  }
  suscripcion ??= await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: clave });
  const { endpoint, keys } = suscripcion.toJSON();
  if (!endpoint || !keys?.p256dh || !keys.auth) throw new Error("El navegador entregó una suscripción incompleta");
  await cliente.llamar("suscribirAvisos", { cuerpo: { endpoint, claves: { p256dh: keys.p256dh, auth: keys.auth } } });
}

/** Clave pública del entorno; nula si los avisos están apagados en él. */
export const clavePublicaDeAvisos = async () => (await cliente.llamar("configuracionAvisos")).clavePublica;

/**
 * Pide el permiso y suscribe. Se llama dentro del toque en "Activar avisos": iPhone solo muestra la
 * pregunta si viene de un gesto, así que la clave se trae antes, al mostrar la tarjeta.
 */
export async function activarAvisos(clavePublica: string): Promise<"activos" | "bloqueados" | "sin_decidir"> {
  const permiso = await Notification.requestPermission();
  if (permiso === "denied") return "bloqueados";
  if (permiso !== "granted") return "sin_decidir";
  await suscribir(clavePublica);
  return "activos";
}

/**
 * Al abrir la app con sesión: si el permiso ya está dado, renueva la suscripción en el servidor (un teléfono
 * compartido la pasa a quien inició sesión; un navegador puede rotar su endpoint). Nunca pregunta nada.
 */
export async function renovarSuscripcion(): Promise<void> {
  if (estadoAvisos() !== "activos") return;
  const clave = await clavePublicaDeAvisos();
  if (clave) await suscribir(clave);
}

/** Al cerrar sesión: este navegador deja de recibir los avisos de la persona (con la sesión todavía abierta). */
export async function quitarSuscripcion(): Promise<void> {
  if (!admiteAvisos()) return;
  const suscripcion = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
  if (!suscripcion) return;
  await cliente.llamar("quitarSuscripcionAvisos", { cuerpo: { endpoint: suscripcion.endpoint } }).catch(() => undefined);
  await suscripcion.unsubscribe();
}
