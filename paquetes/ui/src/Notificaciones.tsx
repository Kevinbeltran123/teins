import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export interface Notificacion {
  /** Qué pasó, en participio: "Cliente creado", "Foto eliminada". Nunca un error: esos quedan donde ocurrieron. */
  texto: string;
  /** Una sola acción de una palabra, que también exista en la pantalla o que deshaga lo recién hecho. */
  accion?: { texto: string; alHacer: () => void } | undefined;
}

interface Visible extends Notificacion {
  id: number;
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
    setVisibles((lista) => lista.filter((n) => n.id !== id));
  }, []);

  const notificar = useCallback(
    (notificacion: Notificacion) => {
      const id = siguiente.current++;
      setVisibles((lista) => [...lista, { ...notificacion, id }].slice(-MAXIMO));
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

  const posicion =
    lugar === "abajo-derecha"
      ? "right-6 bottom-6 w-[min(400px,calc(100vw-48px))]"
      : "right-3 bottom-4 left-3 mx-auto max-w-xl [html:has([data-barra-inferior])_&]:bottom-[104px]";

  return (
    <Contexto.Provider value={notificar}>
      {children}
      <div role="status" aria-live="polite" className={`pointer-events-none fixed z-40 flex flex-col gap-2 ${posicion}`}>
        {visibles.map((n) => (
          <div
            key={n.id}
            className="pointer-events-auto flex min-h-12 animate-aparecer items-center justify-between gap-3 rounded-control bg-notificacion py-1 pr-1 pl-4 text-cuerpo text-sobre-superficie shadow-menu"
          >
            <span className="py-2">{n.texto}</span>
            {n.accion && (
              <button
                type="button"
                onClick={() => {
                  n.accion!.alHacer();
                  quitar(n.id);
                }}
                className="min-h-control-sm shrink-0 rounded-control px-3 font-extrabold text-acento hover:bg-sobre-superficie/10 focus-visible:outline-3 focus-visible:outline-acento"
              >
                {n.accion.texto}
              </button>
            )}
          </div>
        ))}
      </div>
    </Contexto.Provider>
  );
}
