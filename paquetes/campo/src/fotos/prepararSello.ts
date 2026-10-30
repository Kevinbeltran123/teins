import type { SelloDeFoto } from "@teins/dominio";
import { cliente } from "../sincronizacion/instancia";
import type { DatosDelSello, PosicionDeLlegada } from "./sello";

/** Lo máximo que se espera por la hora de red y el mapa, juntos: la foto nunca se bloquea por ellos (ADR-0052). */
export const ESPERA_DEL_SELLO_MS = 3_000;

/** Lo que resuelve en `null` si tarda más de `ms` o falla: un complemento no detiene la foto. */
const conTope = <T>(promesa: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([promesa.catch(() => null), new Promise<null>((listo) => setTimeout(() => listo(null), ms))]);

/**
 * Reúne lo que dice la franja al tomar la foto. La hora de red y el mapa se piden en paralelo y solo con señal, y la foto
 * sale con lo que haya a los 3 segundos: sin señal, sin permiso de ubicación o con el servicio de mapas caído, igual se
 * guarda. Las coordenadas solo salen si el formato las pide (`sello.ubicacion`) y el teléfono las dio.
 */
export async function prepararSello(entrada: {
  sello: SelloDeFoto;
  posicion: PosicionDeLlegada | null;
  lugar: DatosDelSello["lugar"];
  direccion: string | undefined;
  ciudad: string | undefined;
  ahora?: Date;
}): Promise<DatosDelSello> {
  const { sello, posicion, lugar, direccion, ciudad } = entrada;
  const ahora = entrada.ahora ?? new Date();
  const conSenal = typeof navigator === "undefined" || navigator.onLine !== false;
  const ubicacion = sello.ubicacion && posicion ? { lat: posicion.lat, lon: posicion.lon, precision: posicion.precision } : undefined;
  const [hora, mapa] = await Promise.all([
    conSenal ? conTope(cliente.llamar("horaDelServidor"), ESPERA_DEL_SELLO_MS) : null,
    conSenal && sello.mapa && ubicacion ? conTope(cliente.llamar("mapaDeLlegada", { consulta: { lat: ubicacion.lat, lon: ubicacion.lon } }), ESPERA_DEL_SELLO_MS) : null,
  ]);
  return { ahora, horaDeRed: hora ? new Date(hora.ahora) : null, ubicacion, direccion, ciudad, lugar, ...(mapa ? { mapa } : {}) };
}
