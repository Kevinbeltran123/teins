import type { BaseDeDatos } from "../../plataforma/base-de-datos";
import { enOrganizacion } from "../../plataforma/base-de-datos";
import { recuperarArchivosAtascados } from "../archivos";
import { recuperarCotizacionesAtascados } from "../cotizaciones";
import { idsDeOrganizaciones } from "../identidad";
import { recuperarInformesAtascados } from "../informes";

/**
 * Más que la ventana de reintentos de un trabajo (10 intentos de Graphile, unas 10 horas): antes, volver a encolar
 * reiniciaría los intentos de uno que todavía reintenta y nunca llegaría a su estado final (ADR-0043).
 */
export const ATASCADO_DESPUES_DE_MS = 12 * 60 * 60 * 1000;

/**
 * Tarea periódica del worker (ADR-0043): lo que quedó a medias en cada organización vuelve a la cola, cada módulo por
 * su interfaz pública. Devuelve cuántos trabajos volvió a encolar.
 */
export async function recuperarTrabajosAMedias(bd: BaseDeDatos, ahora = new Date()): Promise<number> {
  const antesDe = new Date(ahora.getTime() - ATASCADO_DESPUES_DE_MS);
  let recuperados = 0;
  for (const organizacionId of await idsDeOrganizaciones(bd)) {
    recuperados += await enOrganizacion(bd, organizacionId, async (tx) => {
      const archivos = await recuperarArchivosAtascados(tx, organizacionId, antesDe);
      const informes = await recuperarInformesAtascados(tx, organizacionId, antesDe);
      const cotizaciones = await recuperarCotizacionesAtascados(tx, organizacionId, antesDe);
      return archivos + informes + cotizaciones;
    });
  }
  return recuperados;
}
