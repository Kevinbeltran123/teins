import type { Task, TaskList } from "graphile-worker";
import { z } from "zod";
import type { Archivos } from "./modulos/archivos";
import type { Avisos } from "./modulos/avisos";
import type { Cotizaciones } from "./modulos/cotizaciones";
import type { Envios } from "./modulos/envios";
import type { Informes } from "./modulos/informes";
import type { NombreTrabajo, Trabajos } from "./plataforma/cola";

/** Datos de cada trabajo validados al ejecutarse: la cola guarda JSON y un trabajo viejo puede tener otra forma. */
const esquemas: { [N in NombreTrabajo]: z.ZodType<Trabajos[N]> } = {
  "archivos.verificar": z.object({ organizacionId: z.uuid(), huella: z.string().regex(/^[0-9a-f]{64}$/) }),
  "informes.generarPdf": z.object({ organizacionId: z.uuid(), versionId: z.uuid() }),
  "avisos.enviar": z.object({ organizacionId: z.uuid(), suscripcionId: z.uuid(), titulo: z.string(), cuerpo: z.string(), etiqueta: z.string() }),
  "envios.enviar": z.object({ organizacionId: z.uuid(), envioId: z.uuid(), pdfRuta: z.string().min(1) }),
  "cotizaciones.generarPdf": z.object({ organizacionId: z.uuid(), versionId: z.uuid() }),
};

/** `ultimoIntento`: el manejador deja visible un fallo permanente en lugar de quedar "en curso" (ADR-0012, regla 4). */
type Manejadores = { [N in NombreTrabajo]: (datos: Trabajos[N], contexto: { ultimoIntento: boolean }) => Promise<void> };

/** Todo trabajo de `Trabajos` debe tener manejador: si falta uno, no compila. */
export function definirTareas({
  archivos,
  informes,
  avisos,
  envios,
  cotizaciones,
}: {
  archivos: Archivos;
  informes: Pick<Informes, "generarPdf">;
  avisos: Pick<Avisos, "enviar">;
  envios: Pick<Envios, "enviar">;
  cotizaciones: Pick<Cotizaciones, "generarPdf">;
}): TaskList {
  const manejadores: Manejadores = {
    "archivos.verificar": (datos) => archivos.verificar(datos),
    "informes.generarPdf": (datos, contexto) => informes.generarPdf(datos, contexto),
    "avisos.enviar": (datos) => avisos.enviar(datos),
    "envios.enviar": (datos, contexto) => envios.enviar(datos, contexto),
    "cotizaciones.generarPdf": (datos, contexto) => cotizaciones.generarPdf(datos, contexto),
  };
  return Object.fromEntries(
    (Object.keys(manejadores) as NombreTrabajo[]).map((nombre) => {
      const tarea: Task = async (datos, ayudas) =>
        manejadores[nombre](esquemas[nombre].parse(datos) as never, { ultimoIntento: ayudas.job.attempts >= ayudas.job.max_attempts });
      return [nombre, tarea];
    }),
  );
}
