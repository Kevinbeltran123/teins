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
      titulo="¿Guardar los cambios antes de salir?"
      ancho="medio"
      alCerrar={quedarse}
      cerrable={!guardando}
      pie={
        <>
          <Boton variante="fantasma" className="texto-peligro mr-auto" onClick={salir} disabled={guardando}>
            Salir sin guardar
          </Boton>
          {/* El atajo va solo en la acción principal: Esc cierra cualquier diálogo y con los dos el pie no cabía en una fila. */}
          <Boton onClick={quedarse} disabled={guardando}>
            Seguir editando
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
      <p className="text-texto-secundario">{que[0]!.toUpperCase() + que.slice(1)} · se guarda el borrador; lo publicado no cambia.</p>
      {error && <Aviso tono="error">{error}</Aviso>}
    </Dialogo>
  );
}
