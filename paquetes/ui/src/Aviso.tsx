import type { ReactNode } from "react";

const tonos = {
  info: "border-superficie text-texto",
  alerta: "border-sync-pendiente text-sync-pendiente",
  error: "border-error text-error",
};

/** Mensaje en el flujo de la pantalla; role="alert" solo para errores. */
export function Aviso({ tono = "info", children }: { tono?: keyof typeof tonos; children: ReactNode }) {
  return (
    <div
      role={tono === "error" ? "alert" : "status"}
      className={`rounded-panel border-2 bg-panel px-4 py-3 text-cuerpo ${tonos[tono]}`}
    >
      {children}
    </div>
  );
}
