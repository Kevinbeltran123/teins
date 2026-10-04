import { Aviso, Boton, LoaderCircle } from "@teins/ui";
import type { EstadoGuardado } from "../guardado";

/*
  Lo que se ve del guardado automático (prototipos/usabilidad-oficina): una sola línea en la barra, junto a «Publicar»,
  y el aviso cuando otra persona guardó antes.
*/

const TEXTO: Record<EstadoGuardado, string> = {
  guardado: "Guardado",
  pendiente: "Sin guardar",
  guardando: "Guardando",
  "sin-conexion": "Sin conexión · se guarda al volver",
  conflicto: "No se guardó",
  error: "No se guardó",
};

export function EstadoDeGuardado({ estado, reintentar }: { estado: EstadoGuardado; reintentar: () => void }) {
  const clase = { guardado: "", pendiente: "cambios", guardando: "", "sin-conexion": "cambios", conflicto: "mal", error: "mal" }[estado];
  return (
    <span className={`guardado ${clase}`} role="status">
      {estado === "guardando" ? <LoaderCircle aria-hidden size={12} className="motion-safe:animate-spin" /> : <i />}
      {TEXTO[estado]}
      {estado === "error" && (
        <button type="button" className="enlace-falta" onClick={reintentar}>
          Reintentar
        </button>
      )}
    </span>
  );
}

/** Otra persona guardó antes: no se pisa nada sin preguntar. `deAntes`: lo escrito en este equipo que no alcanzó a guardarse. */
export function AvisoDeConflicto({ que, deAntes, guardarLaMia, cargarLaGuardada }: { que: string; deAntes: boolean; guardarLaMia: () => void; cargarLaGuardada: () => void }) {
  return (
    <Aviso tono="alerta">
      <b>{deAntes ? `Lo que escribió en este equipo no alcanzó a guardarse, y después otra persona guardó ${que}.` : `Otra persona guardó ${que} mientras usted escribía.`}</b>
      <p className="m-0">{deAntes ? "Elija con cuál seguir." : "Sus últimos cambios no se guardaron, para no borrar lo de esa persona."}</p>
      <div className="flex gap-2 mt-2">
        <Boton tamano="pequeno" onClick={guardarLaMia}>
          Guardar la mía encima
        </Boton>
        <Boton tamano="pequeno" variante="fantasma" onClick={cargarLaGuardada}>
          Cargar la guardada
        </Boton>
      </div>
    </Aviso>
  );
}
