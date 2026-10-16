import { useSyncExternalStore } from "react";

/*
  Una pestaña abierta desde antes de un despliegue pide piezas que ya cambiaron de nombre. Vite avisa con
  `vite:preloadError`: se marca una sola vez y el marco ofrece recargar, en vez de dejar que cada acción falle con un
  error genérico (iteración 29).
*/
let hayNueva = false;
const oyentes = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", () => {
    hayNueva = true;
    oyentes.forEach((o) => o());
  });
}

export function useVersionNueva(): boolean {
  return useSyncExternalStore(
    (o) => {
      oyentes.add(o);
      return () => oyentes.delete(o);
    },
    () => hayNueva,
  );
}
