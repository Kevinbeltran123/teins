import type { Task, TaskList } from "graphile-worker";
import { z } from "zod";
import type { Archivos } from "./modulos/archivos";
import type { NombreTrabajo, Trabajos } from "./plataforma/cola";

/** Datos de cada trabajo validados al ejecutarse: la cola guarda JSON y un trabajo viejo puede tener otra forma. */
const esquemas: { [N in NombreTrabajo]: z.ZodType<Trabajos[N]> } = {
  "archivos.verificar": z.object({ organizacionId: z.uuid(), huella: z.string().regex(/^[0-9a-f]{64}$/) }),
};

type Manejadores = { [N in NombreTrabajo]: (datos: Trabajos[N]) => Promise<void> };

/** Todo trabajo de `Trabajos` debe tener manejador: si falta uno, no compila. */
export function definirTareas({ archivos }: { archivos: Archivos }): TaskList {
  const manejadores: Manejadores = {
    "archivos.verificar": (datos) => archivos.verificar(datos),
  };
  return Object.fromEntries(
    (Object.keys(manejadores) as NombreTrabajo[]).map((nombre) => {
      const tarea: Task = async (datos) => manejadores[nombre](esquemas[nombre].parse(datos));
      return [nombre, tarea];
    }),
  );
}
