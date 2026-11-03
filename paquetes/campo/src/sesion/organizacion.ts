import { db } from "../datos/instancia";
import { cliente } from "../sincronizacion/instancia";

/**
 * El nombre de la organización sale en la franja de la foto de llegada (ADR-0052). Quien inició sesión antes de la
 * versión 16 no lo tiene guardado: se pide una vez, con señal; sin ella, la foto sale sin él y se intenta la próxima vez.
 */
export async function completarOrganizacion(): Promise<void> {
  if (await db.ajustes.get("organizacion")) return;
  const { organizacion } = await cliente.llamar("obtenerSesion");
  await db.ajustes.put({ clave: "organizacion", valor: organizacion.nombre });
}
