import { useEffect, useRef } from "react";
import { escribiendoEn } from "@teins/ui";

/*
  Las teclas sueltas de oficina (iteración 37, prototipos/usabilidad-oficina, «Revisar con el teclado»): J y K en la
  bandeja, T, R y S en la revisión, «/» para buscar en la lista y «?» para la lista de atajos. No hacen nada mientras se
  escribe en un campo ni con un diálogo abierto, y nunca con ⌘, Ctrl o Alt (esas son de los atajos con modificador).
*/

export function esTeclaSuelta(e: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey">, tecla: string, { escribiendo, dialogoAbierto }: { escribiendo: boolean; dialogoAbierto: boolean }): boolean {
  if (escribiendo || dialogoAbierto || e.metaKey || e.ctrlKey || e.altKey) return false;
  return e.key.length === 1 ? e.key.toLowerCase() === tecla.toLowerCase() : e.key === tecla;
}

/** La copia de un diálogo que se está cerrando (`capa-saliendo`, 200 ms) no cuenta; la hoja ampliada sí, aunque no sea un `<dialog>`. */
const hayDialogoAbierto = () => document.querySelector("dialog[open]:not(.capa-saliendo), [role='dialog'][aria-modal='true']") !== null;

/** Una tecla suelta mientras la pantalla está a la vista. `teclas`: varias que hacen lo mismo («j» y «ArrowDown»). */
export function useTeclaSuelta(teclas: string | readonly string[], accion: (e: KeyboardEvent) => void, activa = true) {
  const vigente = useRef(accion);
  vigente.current = accion;
  const lista = typeof teclas === "string" ? [teclas] : teclas;
  const clave = lista.join(" ");
  useEffect(() => {
    if (!activa) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      // Enter y Espacio sobre un botón o un enlace hacen lo de ese botón o enlace.
      if ((e.key === "Enter" || e.key === " ") && e.target instanceof Element && e.target.closest("a, button, [role='button'], [role='tab'], summary")) return;
      const estado = { escribiendo: escribiendoEn(e.target), dialogoAbierto: hayDialogoAbierto() };
      if (!clave.split(" ").some((t) => esTeclaSuelta(e, t, estado))) return;
      e.preventDefault();
      vigente.current(e);
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [clave, activa]);
}
