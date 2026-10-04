/*
  Atajos de teclado (DESIGN.md, "Atajos"): en Mac con ⌘ y en Windows con Ctrl, escritos como los conoce cada sistema.
  Las etiquetas salen del sistema del equipo; nunca se muestra ⌘ a quien usa Windows.
*/

export type Plataforma = "mac" | "windows";

export function plataforma(): Plataforma {
  const nav = typeof navigator === "undefined" ? undefined : navigator;
  // Algunos navegadores dan la plataforma vacía en userAgentData: entonces cuenta navigator.platform.
  const nombre = (nav as (Navigator & { userAgentData?: { platform?: string } }) | undefined)?.userAgentData?.platform || nav?.platform || "";
  return /mac|iphone|ipad/i.test(nombre) ? "mac" : "windows";
}

/** «⌘K» en Mac; «Ctrl + K» en Windows. */
export const etiquetaAtajo = (tecla: string, p: Plataforma = plataforma()) => (p === "mac" ? `⌘${tecla}` : `Ctrl + ${tecla}`);

/** «↵» en Mac; «Enter» en Windows, como dice la tecla. */
export const etiquetaEnter = (p: Plataforma = plataforma()) => (p === "mac" ? "↵" : "Enter");

/**
 * ¿Es ⌘ + tecla (Mac) o Ctrl + tecla (Windows)? En Mac no se toma Ctrl: en los campos de texto, Ctrl + K borra hasta el
 * final de la línea. Con Alt o Mayúscula no es el atajo.
 */
export function esAtajo(e: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">, tecla: string, p: Plataforma = plataforma()): boolean {
  const modificador = p === "mac" ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
  return modificador && !e.altKey && !e.shiftKey && e.key.toLowerCase() === tecla.toLowerCase();
}

/** Las letras sueltas no hacen nada mientras se escribe (DESIGN.md, "Atajos"). */
export const escribiendoEn = (destino: EventTarget | null) =>
  destino instanceof HTMLElement && (destino.isContentEditable || destino.matches("input, textarea, select"));
