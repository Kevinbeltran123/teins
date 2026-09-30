import { useEffect, useId, useState, type ReactNode } from "react";
import { useBlocker } from "@tanstack/react-router";
import { Aviso, Boton, Dialogo } from "@teins/ui";
import { mensajeDeError } from "./mensajes";

/**
 * Salir de una pantalla con cambios sin guardar pregunta antes, también al cerrar o recargar la pestaña (DESIGN.md:
 * "Los formularios con cambios sin guardar avisan antes de salir"). La salida que casi siempre se quiere va primero:
 * "Guardar y salir" (iteración 24c); descartar queda a la izquierda, en rojo. Devuelve el diálogo, que la pantalla pinta.
 */
export function useSalidaProtegida(cambiado: boolean, { que, guardar }: { que: string; guardar: () => Promise<unknown> }): ReactNode {
  const salida = useBlocker({ shouldBlockFn: () => cambiado, enableBeforeUnload: () => cambiado, withResolver: true });
  if (salida.status !== "blocked") return null;
  return <GuardarAntesDeSalir que={que} guardar={guardar} salir={salida.proceed} quedarse={salida.reset} />;
}

function GuardarAntesDeSalir({ que, guardar, salir, quedarse }: { que: string; guardar: () => Promise<unknown>; salir: () => void; quedarse: () => void }) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idGuardar = useId();
  // El diálogo ya se abrió (efecto del hijo): "Guardar y salir" recibe el foco y ↵ lo confirma.
  useEffect(() => document.getElementById(idGuardar)?.focus(), [idGuardar]);

  async function guardarYSalir() {
    setGuardando(true);
    setError(null);
    try {
      await guardar();
      salir();
    } catch (e) {
      setError(mensajeDeError(e));
      setGuardando(false);
    }
  }

  return (
    <Dialogo
      titulo={`¿Guardar los cambios de ${que} antes de salir?`}
      alCerrar={quedarse}
      cerrable={!guardando}
      pie={
        <>
          <Boton variante="fantasma" className="texto-peligro mr-auto" onClick={salir} disabled={guardando}>
            Salir sin guardar
          </Boton>
          <Boton onClick={quedarse} disabled={guardando}>
            Seguir editando
            <span aria-hidden className="kbd">
              Esc
            </span>
          </Boton>
          <Boton id={idGuardar} variante="principal" cargando={guardando} onClick={() => void guardarYSalir()}>
            Guardar y salir
            <span aria-hidden className="kbd">
              ↵
            </span>
          </Boton>
        </>
      }
    >
      <p>Se guarda el borrador; lo publicado no cambia.</p>
      {error && <Aviso tono="error">{error}</Aviso>}
    </Dialogo>
  );
}
