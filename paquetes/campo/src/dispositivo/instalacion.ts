import { estaInstalada } from "./almacenamiento";

/**
 * Instalación de la app (ADR-0023, parte 3). En iPhone la app instalada no comparte datos con Safari y solo
 * ella recibe avisos: se guía antes de iniciar sesión. En Android, Chrome ofrece su propio diálogo.
 */
export type Plataforma = "iphone" | "android" | "otra";

export function plataforma(): Plataforma {
  const agente = navigator.userAgent;
  // iPadOS se presenta como Mac; lo delata la pantalla táctil.
  if (/iPhone|iPad|iPod/.test(agente) || (/Macintosh/.test(agente) && navigator.maxTouchPoints > 1)) return "iphone";
  if (/Android/.test(agente)) return "android";
  return "otra";
}

interface EventoDeInstalacion extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let aplazado: EventoDeInstalacion | null = null;
const oyentes = new Set<() => void>();
const avisarCambio = () => oyentes.forEach((oyente) => oyente());

// Chrome lo dispara al cargar la página: se guarda para ofrecerlo con el botón de la guía.
window.addEventListener("beforeinstallprompt", (evento) => {
  evento.preventDefault();
  aplazado = evento as EventoDeInstalacion;
  avisarCambio();
});
window.addEventListener("appinstalled", () => {
  aplazado = null;
  avisarCambio();
});

/** El navegador permite instalar con un botón propio (Chrome en Android). */
export const puedeInstalarConBoton = () => aplazado !== null;

export function alCambiarInstalacion(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => void oyentes.delete(oyente);
}

/** Abre el diálogo del navegador. Devuelve true si la persona aceptó. */
export async function instalar(): Promise<boolean> {
  const evento = aplazado;
  if (!evento) return false;
  aplazado = null;
  await evento.prompt();
  const { outcome } = await evento.userChoice;
  avisarCambio();
  return outcome === "accepted";
}

/** "Seguir en Safari": por teléfono, una comodidad y no un dato del negocio (como "Ahora no" de la llave). */
const OMITIDA = "teins-instalacion-omitida";

/** En un teléfono sin la app instalada, la guía va antes de iniciar sesión (salvo que la persona siga sin ella). */
export function debeGuiarInstalacion(): boolean {
  if (plataforma() === "otra" || estaInstalada()) return false;
  try {
    return localStorage.getItem(OMITIDA) === null;
  } catch {
    return true;
  }
}

export function omitirInstalacion(): void {
  try {
    localStorage.setItem(OMITIDA, new Date().toISOString());
  } catch {
    // Sin almacenamiento, la guía vuelve a salir la próxima vez: no pasa nada.
  }
}
