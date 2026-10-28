export interface EstadoAlmacenamiento {
  persistente: boolean;
  usoBytes: number | undefined;
  cuotaBytes: number | undefined;
}

/** Libre bajo esta parte de la cuota, el diagnóstico avisa de poco espacio y ofrece vaciar Descartados (ADR-0035). */
const PARTE_LIBRE_MINIMA = 0.1;

export function pocoEspacio({ usoBytes, cuotaBytes }: Pick<EstadoAlmacenamiento, "usoBytes" | "cuotaBytes">): boolean {
  return usoBytes !== undefined && cuotaBytes !== undefined && cuotaBytes - usoBytes < cuotaBytes * PARTE_LIBRE_MINIMA;
}

/** ADR-0002: sin almacenamiento persistente, Safari puede borrar los datos bajo presión de espacio. */
export async function solicitarPersistencia(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  return (await navigator.storage.persisted()) || navigator.storage.persist();
}

export async function estadoAlmacenamiento(): Promise<EstadoAlmacenamiento> {
  const persistente = (await navigator.storage?.persisted?.()) ?? false;
  const estimacion = await navigator.storage?.estimate?.();
  return { persistente, usoBytes: estimacion?.usage, cuotaBytes: estimacion?.quota };
}

/** Abierta desde la pantalla de inicio. En iPhone es la condición para que los datos no expiren. */
export function estaInstalada(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
