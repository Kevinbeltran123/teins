import type { BaseCampo } from "./base";
import type { TerminacionPendiente } from "./modelo";

/**
 * "Terminar visita" (ADR-0037): queda en el teléfono al instante, también sin señal, y el motor la envía. Un segundo
 * toque no crea otra: devuelve la que ya estaba, con su misma llave, para que el servidor la vea una sola vez.
 */
export function terminarVisita(db: BaseCampo, tecnicoId: string, visitaId: string, ahora: Date): Promise<TerminacionPendiente> {
  return db.transaction("rw", db.visitas, async () => {
    const visita = await db.visitas.get([tecnicoId, visitaId]);
    if (!visita) throw new Error("La visita ya no está en este teléfono");
    if (visita.terminacionPendiente) return visita.terminacionPendiente;
    const terminacion: TerminacionPendiente = { llave: crypto.randomUUID(), en: ahora.toISOString(), intentos: 0, proximoIntentoEn: 0 };
    await db.visitas.update([tecnicoId, visitaId], { terminacionPendiente: terminacion });
    return terminacion;
  });
}
