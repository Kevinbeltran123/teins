import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { sinMovimiento } from "./transicion";

export interface Notificacion {
  /** Qué pasó, en participio: "Cliente creado", "Foto eliminada". Nunca un error: esos quedan donde ocurrieron. */
  texto: string;
  /**
   * Una sola acción corta: el siguiente paso de lo recién hecho ("Agregar contactos", "Ver en Canceladas"), algo que
   * también exista en la pantalla o deshacerlo.
   */
  accion?: { texto: string; alHacer: () => void } | undefined;
}

interface Visible extends Notificacion {
  id: number;
  /** Sale en 200 ms antes de quitarse (iteración 27). */
  saliendo?: boolean;
}

/** 5 s; con acción, 10 s para alcanzar a usarla (Polaris). Nunca más de tres a la vez. */
const DURACION_MS = 5_000;
const DURACION_CON_ACCION_MS = 10_000;
const MAXIMO = 3;

const Contexto = createContext<(notificacion: Notificacion) => void>(() => undefined);

/** Avisa de algo que ya pasó y no exige respuesta (DESIGN.md: notificaciones). */
export const useNotificar = () => useContext(Contexto);

/**
 * Región de notificaciones de la superficie. Oficina las muestra abajo a la derecha; campo abajo, sobre la
 * barra de acciones cuando la pantalla tiene una.
 */
export function ProveedorNotificaciones({ children, lugar }: { children: ReactNode; lugar: "abajo-derecha" | "abajo" }) {
  const [visibles, setVisibles] = useState<Visible[]>([]);
  const siguiente = useRef(0);
  const temporizadores = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const quitar = useCallback((id: number) => {
    clearTimeout(temporizadores.current.get(id));
    temporizadores.current.delete(id);
    if (sinMovimiento()) {
      setVisibles((lista) => lista.filter((n) => n.id !== id));
      return;
    }
    setVisibles((lista) => lista.map((n) => (n.id === id ? { ...n, saliendo: true } : n)));
    temporizadores.current.set(
      id,
      setTimeout(() => {
        temporizadores.current.delete(id);
        setVisibles((lista) => lista.filter((n) => n.id !== id));
      }, 200),
    );
  }, []);

  const notificar = useCallback(
    (notificacion: Notificacion) => {
      const id = siguiente.current++;
      setVisibles((lista) => [...lista.filter((n) => !n.saliendo), { ...notificacion, id }].slice(-MAXIMO));
      temporizadores.current.set(
        id,
        setTimeout(() => quitar(id), notificacion.accion ? DURACION_CON_ACCION_MS : DURACION_MS),
      );
    },
    [quitar],
  );

  useEffect(() => {
    const pendientes = temporizadores.current;
    return () => pendientes.forEach(clearTimeout);
  }, []);

  // Con un diálogo modal abierto (el visor de fotos), todo lo de fuera queda inerte y debajo, también un popover:
  // las notificaciones van dentro del diálogo de encima, para que "Deshacer" se vea y se pueda tocar.
  const [capa, setCapa] = useState<HTMLDialogElement | null>(null);
  const hayVisibles = visibles.length > 0;
  useEffect(() => {
    if (!hayVisibles) return;
    const revisar = () => setCapa([...document.querySelectorAll("dialog")].filter((d) => d.matches(":modal")).at(-1) ?? null);
    revisar();
    const observador = new MutationObserver(revisar);
    observador.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["open"] });
    return () => observador.disconnect();
  }, [hayVisibles]);

  const posicion =
    lugar === "abajo-derecha"
      ? "right-6 bottom-6 w-[min(400px,calc(100vw-48px))]"
      : "right-3 bottom-4 left-3 mx-auto max-w-xl [html:has([data-barra-inferior])_&]:bottom-[104px]";

  const region = (
    <div role="status" aria-live="polite" className={`pointer-events-none fixed z-40 flex flex-col gap-2 ${posicion}`}>
      {visibles.map((n) => (
        <div
          key={n.id}
          className={`${n.saliendo ? "animate-sale-abajo" : "animate-entra-abajo"} pointer-events-auto flex min-h-12 items-center justify-between gap-3 rounded-[10px] bg-notificacion py-1 pr-1 pl-4 text-cuerpo font-medium text-fondo shadow-menu`}
          aria-hidden={n.saliendo || undefined}
        >
          <span className="py-2">{n.texto}</span>
          {n.accion && (
            <button
              type="button"
              onClick={() => {
                n.accion!.alHacer();
                quitar(n.id);
              }}
              className="min-h-control-sm shrink-0 rounded-[7px] px-2.5 font-semibold text-enlace-notificacion underline-offset-3 hover:underline focus-visible:outline-2 focus-visible:outline-fondo"
            >
              {n.accion.texto}
            </button>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <Contexto.Provider value={notificar}>
      {children}
      {capa && hayVisibles ? createPortal(region, capa) : region}
    </Contexto.Provider>
  );
}
