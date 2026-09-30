import { abrirBase, repositorioDexie } from "./dexie";
import { sellarPendientes } from "./registros";

export const db = abrirBase();
export const repositorio = repositorioDexie(db);

let enCurso: Promise<void> | null = null;
let otraVez = false;

/**
 * Sella lo que quedó a la vista de antes del cifrado o de antes de conocer al responsable (ADR-0022).
 * Al abrir la app y al iniciar sesión; si se pide mientras corre, repite al terminar.
 */
export function sellarEnSegundoPlano(): Promise<void> {
  if (enCurso) {
    otraVez = true;
    return enCurso;
  }
  enCurso = (async () => {
    do {
      otraVez = false;
      await sellarPendientes(db).catch((error: unknown) => console.error("No se pudo cifrar lo pendiente", error));
    } while (otraVez);
  })().finally(() => {
    enCurso = null;
  });
  return enCurso;
}
