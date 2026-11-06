/**
 * El ensayo de carga (iteración 51, QA-14) vive en su propia organización, con usuarios numerados: lo prepara
 * `cli/preparar-ensayo.ts` y lo corre `ensayo/ensayo-de-carga.ts`. Así nunca se mezcla con los datos de demostración.
 * Datos ficticios (R5); nunca en producción.
 */
export const ORGANIZACION_DEL_ENSAYO = "00000000-0000-4000-8000-000000000051";

export type RolDelEnsayo = "tecnico" | "oficina";

/** `ensayo.tecnico.01`, `ensayo.oficina.05`… */
export const usuarioDelEnsayo = (rol: RolDelEnsayo, numero: number) => `ensayo.${rol}.${String(numero).padStart(2, "0")}`;
