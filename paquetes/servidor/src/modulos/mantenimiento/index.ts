import type { Almacenamiento } from "../../plataforma/almacenamiento";
import type { BaseDeDatos } from "../../plataforma/base-de-datos";
import { enOrganizacion } from "../../plataforma/base-de-datos";
import { borrarArchivosSinUso, recuperarArchivosAtascados } from "../archivos";
import { compactarRegistro } from "../cambios";
import { recuperarCotizacionesAtascados } from "../cotizaciones";
import { idsDeOrganizaciones, podarSesionesVencidas } from "../identidad";
import { recuperarInformesAtascados } from "../informes";
import { archivosEnUso } from "../levantamientos";
import { podarSesionesDelPortal } from "../portal";

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

/** Una sesión vencida se conserva un día, por si alguien pregunta por qué lo sacó. */
const SESION_VENCIDA_DESPUES_DE_MS = 24 * 60 * 60 * 1000;

/**
 * Poda de la tarea periódica (ADR-0044): sesiones vencidas y el registro de cambios compactado. Compactar usa la
 * conexión del dueño de la base: la aplicación no borra en el registro.
 */
export async function podarVencido({ negocio, propietario }: { negocio: BaseDeDatos; propietario: BaseDeDatos }, ahora = new Date()): Promise<number> {
  const antesDe = new Date(ahora.getTime() - SESION_VENCIDA_DESPUES_DE_MS);
  let podados = await podarSesionesVencidas(negocio, antesDe);
  for (const organizacionId of await idsDeOrganizaciones(negocio)) podados += await enOrganizacion(negocio, organizacionId, (tx) => podarSesionesDelPortal(tx, antesDe));
  return podados + (await compactarRegistro(propietario));
}

/**
 * Un archivo sin uso se borra pasado este plazo sin actividad (ADR-0007, ADR-0048): más que la copia más vieja de la
 * base (las mensuales del volumen, 3 meses; los volcados, 35 días) con un mes de margen. Restaurar cualquier copia
 * encuentra los archivos que esa base usaba.
 */
export const SIN_USO_DESPUES_DE_MS = 120 * 24 * 60 * 60 * 1000;

/** Limpieza de la tarea periódica (ADR-0048): archivos de campo que ningún levantamiento usa. Devuelve cuántos borró. */
export async function limpiarArchivosSinUso(
  { negocio, propietario, almacenamiento }: { negocio: BaseDeDatos; propietario: BaseDeDatos; almacenamiento: Almacenamiento },
  ahora = new Date(),
): Promise<number> {
  const antesDe = new Date(ahora.getTime() - SIN_USO_DESPUES_DE_MS);
  let borrados = 0;
  for (const organizacionId of await idsDeOrganizaciones(negocio)) {
    borrados += await borrarArchivosSinUso(propietario, almacenamiento, organizacionId, { antesDe, enUso: (tx, huellas) => archivosEnUso(tx, organizacionId, huellas) });
  }
  return borrados;
}
