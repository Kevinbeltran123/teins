import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "./iconos";

/** El texto va siempre en el color de texto (7:1 sobre el fondo teñido); el tono lo llevan el fondo y el icono. */
const tonos = {
  info: { fondo: "bg-superficie-suave", icono: Info, color: "text-superficie" },
  exito: { fondo: "bg-exito-fondo", icono: CircleCheck, color: "text-exito-texto" },
  alerta: { fondo: "bg-alerta-fondo", icono: TriangleAlert, color: "text-alerta-texto" },
  error: { fondo: "bg-peligro-fondo", icono: CircleAlert, color: "text-error" },
};

/**
 * Mensaje en el flujo de la pantalla, junto a lo que lo causó. Para lo que la persona debe leer y quizá resolver;
 * lo que solo confirma algo hecho va en una notificación. role="alert" solo para errores.
 */
export function Aviso({ tono = "info", children }: { tono?: keyof typeof tonos; children: ReactNode }) {
  const { fondo, icono: Icono, color } = tonos[tono];
  return (
    <div role={tono === "error" ? "alert" : "status"} className={`flex gap-3 rounded-panel px-4 py-3 text-cuerpo text-texto ${fondo}`}>
      <Icono aria-hidden className={`mt-0.5 size-5 shrink-0 ${color}`} />
      <div className="min-w-0 grow">{children}</div>
    </div>
  );
}
