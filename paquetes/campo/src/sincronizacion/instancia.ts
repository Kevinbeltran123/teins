import { crearClienteApi } from "@teins/protocolo";
import { leerUsuario } from "../datos/base";
import { db } from "../datos/instancia";
import { almacenDexie } from "./almacen";
import { bloqueoEntrePestanas, crearMotor } from "./motor";
import { transporteHttp } from "./transporte";
import { VERSION_APP } from "../version";

export const cliente = crearClienteApi();
export const almacen = almacenDexie(db);

const bloquear = bloqueoEntrePestanas();
export const motor = crearMotor({
  almacen,
  transporte: transporteHttp(cliente),
  usuarioActual: async () => (await leerUsuario(db))?.id ?? null,
  versionApp: VERSION_APP,
  ...(bloquear ? { bloquear } : {}),
});

let despertador: number | undefined;
/** Espera máxima de un temporizador del navegador; más allá se recalcula. */
const ESPERA_MAXIMA_TEMPORIZADOR = 10 * 60_000;

/**
 * Sincroniza y deja programado el próximo intento exacto: la espera exponencial y la que pide
 * el servidor se respetan al milisegundo, no al ritmo del ciclo de respaldo. `bajar` trae los
 * cambios del servidor ya, sin esperar el intervalo de la bajada.
 */
export function sincronizarEnSegundoPlano(opciones: { bajar?: boolean } = {}): void {
  motor
    .sincronizar(opciones)
    .then(() => motor.proximoIntento())
    .then((proximo) => {
      window.clearTimeout(despertador);
      if (proximo === null) return;
      const espera = Math.min(ESPERA_MAXIMA_TEMPORIZADOR, Math.max(0, proximo - Date.now()) + 50);
      despertador = window.setTimeout(() => sincronizarEnSegundoPlano(), espera);
    })
    .catch((error: unknown) => console.error("La sincronización falló", error));
}

/**
 * Sin sincronización en segundo plano en Safari (ADR-0002): se sincroniza al abrir, al recuperar
 * señal, al volver a la app y cada 30 segundos mientras está abierta. Abrir, recuperar señal y volver
 * traen la bajada de inmediato; el ciclo de 30 segundos solo envía lo pendiente y baja cada 5 minutos.
 */
export function programarSincronizacion(): () => void {
  const conBajada = () => sincronizarEnSegundoPlano({ bajar: true });
  const alVolverVisible = () => {
    if (document.visibilityState === "visible") conBajada();
  };
  window.addEventListener("online", conBajada);
  document.addEventListener("visibilitychange", alVolverVisible);
  // Respaldo: si un temporizador se pierde (pestaña suspendida), el ciclo lo recupera.
  const intervalo = window.setInterval(() => sincronizarEnSegundoPlano(), 30_000);
  conBajada();
  return () => {
    window.removeEventListener("online", conBajada);
    document.removeEventListener("visibilitychange", alVolverVisible);
    window.clearInterval(intervalo);
    window.clearTimeout(despertador);
  };
}
