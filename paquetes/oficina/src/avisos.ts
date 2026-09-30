import { cliente } from "./api";

/**
 * Avisos push de oficina (ADR-0023): quien los activa sabe de un levantamiento nuevo aunque la pestaña esté
 * cerrada. El service worker (`public/avisos-sw.js`) solo muestra avisos: no guarda nada en caché.
 */
export type EstadoAvisos = "no_disponibles" | "bloqueados" | "sin_activar" | "activos";

const admite = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const registro = () => navigator.serviceWorker.getRegistration("/");

export async function estadoAvisos(): Promise<EstadoAvisos> {
  if (!admite()) return "no_disponibles";
  if (Notification.permission === "denied") return "bloqueados";
  const suscripcion = await (await registro())?.pushManager.getSubscription();
  return Notification.permission === "granted" && suscripcion ? "activos" : "sin_activar";
}

const aBytes = (base64url: string) => {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (base64url.length % 4)) % 4);
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
};

async function suscribir(clavePublica: string) {
  const activo = (await registro()) ?? (await navigator.serviceWorker.register("/avisos-sw.js", { scope: "/" }));
  await navigator.serviceWorker.ready;
  const suscripcion = (await activo.pushManager.getSubscription()) ?? (await activo.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(clavePublica) }));
  const { endpoint, keys } = suscripcion.toJSON();
  if (!endpoint || !keys?.p256dh || !keys.auth) throw new Error("El navegador entregó una suscripción incompleta");
  await cliente.llamar("suscribirAvisos", { cuerpo: { endpoint, claves: { p256dh: keys.p256dh, auth: keys.auth } } });
}

/** Pide el permiso (dentro del clic) y suscribe este navegador. */
export async function activarAvisos(clavePublica: string): Promise<EstadoAvisos> {
  const permiso = await Notification.requestPermission();
  if (permiso === "denied") return "bloqueados";
  if (permiso !== "granted") return "sin_activar";
  await suscribir(clavePublica);
  return "activos";
}

/** Al abrir oficina con sesión: renueva la suscripción si ya estaba activa (el endpoint puede rotar). */
export async function renovarSuscripcion(): Promise<void> {
  if ((await estadoAvisos()) !== "activos") return;
  const { clavePublica } = await cliente.llamar("configuracionAvisos");
  if (clavePublica) await suscribir(clavePublica);
}

/** "Desactivar" y cerrar sesión: el servidor la olvida y el navegador deja de recibirlos. */
export async function desactivarAvisos(): Promise<void> {
  if (!admite()) return;
  const suscripcion = await (await registro())?.pushManager.getSubscription();
  if (!suscripcion) return;
  await cliente.llamar("quitarSuscripcionAvisos", { cuerpo: { endpoint: suscripcion.endpoint } }).catch(() => undefined);
  await suscripcion.unsubscribe();
}
