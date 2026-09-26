import { estaInstalada } from "./almacenamiento";
import { plataforma } from "./instalacion";

/**
 * Estado de los avisos push en este teléfono (ADR-0023), sin tocar la red: lo leen el inicio y el
 * diagnóstico, que están en el JavaScript inicial. Suscribirse vive aparte, en `avisos.ts`.
 */
export type EstadoAvisos = "requiere_instalar" | "no_disponibles" | "sin_activar" | "activos" | "bloqueados";

export const admiteAvisos = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export function estadoAvisos(): EstadoAvisos {
  // En iPhone, una pestaña de Safari nunca recibe avisos: solo la app instalada.
  if (plataforma() === "iphone" && !estaInstalada()) return "requiere_instalar";
  if (!admiteAvisos()) return "no_disponibles";
  if (Notification.permission === "denied") return "bloqueados";
  if (Notification.permission === "granted") return "activos";
  return "sin_activar";
}
