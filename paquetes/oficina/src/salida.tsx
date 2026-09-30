import type { ReactNode } from "react";
import { useBlocker } from "@tanstack/react-router";
import { Confirmacion } from "@teins/ui";

/**
 * Salir de una pantalla con cambios sin guardar pregunta antes, también al cerrar o recargar la pestaña (DESIGN.md:
 * "Los formularios con cambios sin guardar avisan antes de salir"). Devuelve la confirmación, que la pantalla pinta.
 */
export function useSalidaProtegida(cambiado: boolean): ReactNode {
  const salida = useBlocker({ shouldBlockFn: () => cambiado, enableBeforeUnload: () => cambiado, withResolver: true });
  if (salida.status !== "blocked") return null;
  return (
    <Confirmacion titulo="¿Salir sin guardar?" confirmar="Salir sin guardar" descartar="Seguir editando" nivel="irreversible" mensajeDeError={() => ""} alCerrar={salida.reset} accion={async () => salida.proceed()}>
      <p>Los cambios que no guardó se pierden.</p>
    </Confirmacion>
  );
}
