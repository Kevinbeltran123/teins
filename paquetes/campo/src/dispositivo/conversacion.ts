/*
  El chat y los avisos (ADR-0040): la pantalla le dice al service worker qué conversación tiene abierta, para que no
  muestre su aviso, y escucha cuando un aviso pide abrir un chat o consultar de una vez.
*/

export const etiquetaDeConversacion = (levantamientoId: string) => `conversacion:${levantamientoId}`;

export function avisarConversacionAbierta(levantamientoId: string | null): void {
  navigator.serviceWorker?.controller?.postMessage({ tipo: "conversacion", etiqueta: levantamientoId ? etiquetaDeConversacion(levantamientoId) : null });
}

/** El levantamiento cuyo chat pide abrir una dirección de aviso (`/?conversacion=<id>`), o null. */
export function conversacionPedida(direccion: string): string | null {
  try {
    return new URL(direccion, location.origin).searchParams.get("conversacion");
  } catch {
    return null;
  }
}

/** Mensajes del service worker: abrir lo de un aviso tocado o consultar ya. Devuelve cómo dejar de escuchar. */
export function escucharAvisos({ abrir, consultar }: { abrir: (direccion: string) => void; consultar: () => void }): () => void {
  const sw = navigator.serviceWorker;
  if (!sw) return () => undefined;
  const alRecibir = (evento: MessageEvent) => {
    const datos = evento.data as { tipo?: string; navigate?: string } | null;
    if (datos?.tipo === "abrir" && datos.navigate) abrir(datos.navigate);
    if (datos?.tipo === "consultar") consultar();
  };
  sw.addEventListener("message", alRecibir);
  return () => sw.removeEventListener("message", alRecibir);
}
