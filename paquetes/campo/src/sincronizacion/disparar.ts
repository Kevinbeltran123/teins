/**
 * Punto de entrada liviano a la sincronización. El código de red (cliente HTTP, esquemas del
 * contrato) se carga aparte, después del primer dibujo: capturar sin conexión no lo necesita
 * (ADR-0011, presupuesto de rendimiento). El service worker lo guarda igual para usarlo sin señal.
 */
const cargar = () => import("./instancia");

export function sincronizarEnSegundoPlano(opciones: { bajar?: boolean } = {}): void {
  cargar()
    .then((m) => m.sincronizarEnSegundoPlano(opciones))
    .catch((error: unknown) => console.error("No se pudo cargar la sincronización", error));
}

export function programarSincronizacion(): () => void {
  let cancelar: (() => void) | undefined;
  let activo = true;
  cargar()
    .then((m) => {
      if (activo) cancelar = m.programarSincronizacion();
    })
    .catch((error: unknown) => console.error("No se pudo cargar la sincronización", error));
  return () => {
    activo = false;
    cancelar?.();
  };
}
