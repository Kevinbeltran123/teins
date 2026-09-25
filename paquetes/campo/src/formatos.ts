import { useLiveQuery } from "dexie-react-hooks";
import { versionesVigentes, type Levantamiento, type VersionFormato } from "@teins/dominio";
import { db } from "./datos/instancia";
import { VERSION_APP } from "./version";

/** Versiones de formato en el teléfono, recibidas en la bajada (ADR-0006). `undefined` mientras carga. */
export function useFormatos(): VersionFormato[] | undefined {
  return useLiveQuery(() => db.formatos.toArray());
}

/** La versión exacta con que se creó el levantamiento: un borrador termina con la suya (regla 3). */
export function formatoDe(formatos: readonly VersionFormato[], levantamiento: Pick<Levantamiento, "formato" | "versionFormato">): VersionFormato | undefined {
  return formatos.find((f) => f.formato === levantamiento.formato && f.version === levantamiento.versionFormato);
}

/** Con qué versiones se crean los levantamientos nuevos. */
export const vigentes = (formatos: readonly VersionFormato[]) => versionesVigentes(formatos, VERSION_APP);

/** Nombre que ve el técnico. Las versiones viejas no lo tienen: se toma el de otra versión del mismo formato. */
export function nombreDeFormato(formatos: readonly VersionFormato[], formato: string): string {
  const conNombre = formatos.filter((f) => f.formato === formato && f.nombre).sort((a, b) => b.version - a.version)[0];
  return conNombre?.nombre ?? formato;
}
