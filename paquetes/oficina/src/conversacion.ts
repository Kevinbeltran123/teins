/*
  Las conversaciones y los avisos (ADR-0040): la pantalla le dice al service worker qué conversación tiene a la vista,
  para que no muestre su aviso, y escucha cuando un aviso tocado pide abrir una conversación o consultar ya.
*/

export function avisarConversacionAbierta(levantamientoId: string | null): void {
  navigator.serviceWorker?.controller?.postMessage({ tipo: "conversacion", etiqueta: levantamientoId ? `conversacion:${levantamientoId}` : null });
}

/** Mensajes del service worker. Devuelve cómo dejar de escuchar. */
export function escucharAvisos({ abrir, consultar }: { abrir: (ruta: string) => void; consultar: () => void }): () => void {
  const sw = navigator.serviceWorker;
  if (!sw) return () => undefined;
  const alRecibir = (evento: MessageEvent) => {
    const datos = evento.data as { tipo?: string; navigate?: string } | null;
    if (datos?.tipo === "abrir" && datos.navigate) {
      try {
        const url = new URL(datos.navigate, location.origin);
        // Solo rutas de la propia oficina.
        if (url.origin === location.origin) abrir(`${url.pathname}${url.search}`);
      } catch {
        // Una dirección que no se entiende no abre nada.
      }
    }
    if (datos?.tipo === "consultar") consultar();
  };
  sw.addEventListener("message", alRecibir);
  return () => sw.removeEventListener("message", alRecibir);
}
