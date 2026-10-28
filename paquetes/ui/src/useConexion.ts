import { useSyncExternalStore } from "react";

function suscribir(avisar: () => void) {
  window.addEventListener("online", avisar);
  window.addEventListener("offline", avisar);
  return () => {
    window.removeEventListener("online", avisar);
    window.removeEventListener("offline", avisar);
  };
}

/** Si el navegador tiene conexión, y vuelve a pintar al perderla o recuperarla (oficina y portal; campo tiene la suya). */
export const useConexion = () => useSyncExternalStore(suscribir, () => navigator.onLine);
