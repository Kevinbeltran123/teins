import { sql } from "drizzle-orm";
import type { TxOrganizacion } from "./base-de-datos";

/** Trabajos conocidos y sus datos. Agregar uno aquí obliga a registrar su manejador en el worker. */
export interface Trabajos {
  "archivos.verificar": { organizacionId: string; huella: string };
  "informes.generarPdf": { organizacionId: string; versionId: string };
  "avisos.enviar": { organizacionId: string; suscripcionId: string; titulo: string; cuerpo: string; etiqueta: string; ruta?: string | undefined };
  "envios.enviar": { organizacionId: string; envioId: string; pdfRuta: string };
  "cotizaciones.generarPdf": { organizacionId: string; versionId: string };
}
export type NombreTrabajo = keyof Trabajos;

export interface OpcionesTrabajo {
  /** Deduplica: si ya hay un trabajo con esta llave en cola, se reemplaza. */
  llave?: string;
  /** Cola con nombre: sus trabajos corren de a uno (ADR-0012, regla 3). */
  cola?: string;
  intentosMaximos?: number;
}

/**
 * Puerto de la cola (ADR-0012, regla 6). Encolar ocurre dentro de la transacción del negocio:
 * si la transacción se revierte, el trabajo no existe. La cola es el outbox.
 */
export async function encolar<N extends NombreTrabajo>(
  tx: TxOrganizacion,
  trabajo: N,
  datos: Trabajos[N],
  opciones: OpcionesTrabajo = {},
): Promise<void> {
  await tx.execute(
    sql`select cola.encolar(${trabajo}, ${JSON.stringify(datos)}::jsonb, ${opciones.cola ?? null}, ${opciones.llave ?? null}, ${opciones.intentosMaximos ?? 10})`,
  );
}
