import { crearClienteApi } from "@teins/protocolo";
import { leerUsuario } from "../datos/base";
import { db } from "../datos/instancia";
import { almacenDexie } from "./almacen";
import { bloqueoEntrePestanas, crearMotor } from "./motor";
import { transporteHttp } from "./transporte";

export const cliente = crearClienteApi();
export const almacen = almacenDexie(db);

const bloquear = bloqueoEntrePestanas();
export const motor = crearMotor({
  almacen,
  transporte: transporteHttp(cliente),
  usuarioActual: async () => (await leerUsuario(db))?.id ?? null,
  ...(bloquear ? { bloquear } : {}),
});

let despertador: number | undefined;
/** Espera máxima de un temporizador del navegador; más allá se recalcula. */
const ESPERA_MAXIMA_TEMPORIZADOR = 10 * 60_000;

/**
 * Sincroniza y deja programado el próximo intento exacto: la espera exponencial y la que pide
 * el servidor se respetan al milisegundo, no al ritmo del ciclo de respaldo.
 */
export function sincronizarEnSegundoPlano(): void {
  motor
    .sincronizar()
    .then(() => motor.proximoIntento())
    .then((proximo) => {
      window.clearTimeout(despertador);
      if (proximo === null) return;
      const espera = Math.min(ESPERA_MAXIMA_TEMPORIZADOR, Math.max(0, proximo - Date.now()) + 50);
      despertador = window.setTimeout(sincronizarEnSegundoPlano, espera);
    })
    .catch((error: unknown) => console.error("La sincronización falló", error));
}

/**
 * Sin sincronización en segundo plano en Safari (ADR-0002): se sincroniza al abrir, al recuperar
 * señal, al volver a la app y cada 30 segundos mientras está abierta. Sin trabajo pendiente no hay red.
 */
export function programarSincronizacion(): () => void {
  const alVolverVisible = () => {
    if (document.visibilityState === "visible") sincronizarEnSegundoPlano();
  };
  window.addEventListener("online", sincronizarEnSegundoPlano);
  document.addEventListener("visibilitychange", alVolverVisible);
  // Respaldo: si un temporizador se pierde (pestaña suspendida), el ciclo lo recupera.
  const intervalo = window.setInterval(sincronizarEnSegundoPlano, 30_000);
  sincronizarEnSegundoPlano();
  return () => {
    window.removeEventListener("online", sincronizarEnSegundoPlano);
    document.removeEventListener("visibilitychange", alVolverVisible);
    window.clearInterval(intervalo);
    window.clearTimeout(despertador);
  };
}
