import { useEffect, useRef } from "react";
import { useNavigate, useRouterState, type HistoryState } from "@tanstack/react-router";

/**
 * Lo que pidió quien navegó hasta aquí (abrir un formulario desde ⌘K / Ctrl + K, la pestaña de un aviso): se atiende
 * una vez y se quita de esa entrada del historial, para que volver con Atrás o recargar no lo repita (iteración 42).
 * Se lee de la ubicación ya resuelta: mientras se carga la siguiente, la pantalla anterior sigue montada y no debe
 * tomar su pedido.
 */
export function usePedido<K extends keyof HistoryState>(clave: K, atender: (pedido: NonNullable<HistoryState[K]>) => void) {
  const pedido = useRouterState({ select: (s) => s.resolvedLocation?.state })?.[clave];
  const navegar = useNavigate();
  const vigente = useRef(atender);
  vigente.current = atender;
  useEffect(() => {
    if (pedido === undefined) return;
    vigente.current(pedido);
    void navegar({ to: ".", search: true, replace: true, resetScroll: false, state: (s) => ({ ...s, [clave]: undefined }) });
  }, [pedido, clave, navegar]);
}

/**
 * Lleva a una lista con su pedido. Si ya se está en ella, reemplaza la entrada del historial en vez de agregar otra
 * igual: así Atrás no se queda en la misma pantalla.
 */
export function useIrConPedido() {
  const navegar = useNavigate();
  return (ruta: "/visitas" | "/clientes" | "/cotizaciones", pedido: HistoryState) => navegar({ to: ruta, state: pedido, replace: window.location.pathname === ruta });
}
