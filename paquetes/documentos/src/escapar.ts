/** Todo texto que viene de personas se escapa antes de ir a un HTML (informe, cotización o correo). */
export function escapar(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
