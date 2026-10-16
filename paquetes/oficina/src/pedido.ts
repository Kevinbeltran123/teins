import { useEffect, useRef } from "react";
import { useLocation, useNavigate, type HistoryState } from "@tanstack/react-router";

/**
 * Lo que pidió quien navegó hasta aquí (abrir un formulario desde ⌘K / Ctrl + K, la pestaña de un aviso): se atiende
 * una vez y se quita de esa entrada del historial, para que volver con Atrás o recargar no lo repita (iteración 42).
 */
export function usePedido<K extends keyof HistoryState>(clave: K, atender: (pedido: NonNullable<HistoryState[K]>) => void) {
  const pedido = useLocation({ select: (l) => l.state })[clave];
  const navegar = useNavigate();
  const vigente = useRef(atender);
  vigente.current = atender;
  useEffect(() => {
    if (pedido === undefined) return;
    vigente.current(pedido);
    void navegar({ to: ".", search: true, replace: true, resetScroll: false, state: (s) => ({ ...s, [clave]: undefined }) });
  }, [pedido, clave, navegar]);
}
