/**
 * El documento al que lleva el botón de un correo (ADR-0053): `/informes/<id>` o `/cotizaciones/<id>`. El enlace no
 * lleva secretos: sin sesión, el portal pide entrar y después lo muestra resaltado en su lista.
 */
export type Destino = { tipo: "informes" | "cotizaciones"; id: string };

const RUTA = /^\/(informes|cotizaciones)\/([0-9a-f-]{36})\/?$/i;

export function leerDestino(ruta = window.location.pathname): Destino | null {
  const [, tipo, id] = RUTA.exec(ruta) ?? [];
  return tipo && id ? { tipo: tipo.toLowerCase() as Destino["tipo"], id: id.toLowerCase() } : null;
}
