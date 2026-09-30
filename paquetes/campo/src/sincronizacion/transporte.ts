import type { TIPO_ARCHIVO_BOCETO } from "@teins/dominio";
import { ErrorDeRed, type ClienteApi, type CuerpoEntrada, type EnviarLevantamiento, type Respuesta } from "@teins/protocolo";

/** Lo que el motor necesita del servidor. En las pruebas se reemplaza por un servidor falso con fallas inducidas. */
export interface Transporte {
  /** Campo sube fotos (JPEG) y bocetos (iteración 10). */
  autorizarSubida(archivo: { huella: string; bytes: number; tipo: "image/jpeg" | typeof TIPO_ARCHIVO_BOCETO }): Promise<Respuesta<"autorizarSubida">>;
  /** Carga directa al almacenamiento (ADR-0007). Un rechazo del almacenamiento lanza ErrorDeSubida. */
  subir(url: string, cabeceras: Record<string, string>, datos: ArrayBuffer): Promise<void>;
  confirmarSubida(huella: string): Promise<Respuesta<"confirmarSubida">>;
  enviarComando(comando: EnviarLevantamiento): Promise<Respuesta<"enviarComando">>;
  obtenerCambios(desde: number, app: number): Promise<Respuesta<"obtenerCambios">>;
  informarDispositivo(cuerpo: CuerpoEntrada<"informarDispositivo">): Promise<Respuesta<"informarDispositivo">>;
  consultarOrdenes(cuerpo: CuerpoEntrada<"consultarOrdenes">): Promise<Respuesta<"consultarOrdenes">>;
}

/** El almacenamiento rechazó la carga (firma vencida, huella distinta). Se vuelve a pedir autorización. */
export class ErrorDeSubida extends Error {
  constructor(readonly estado: number) {
    super(`El almacenamiento rechazó la foto (${estado})`);
    this.name = "ErrorDeSubida";
  }
}

export function transporteHttp(cliente: ClienteApi, f: typeof fetch = globalThis.fetch.bind(globalThis)): Transporte {
  return {
    autorizarSubida: (archivo) => cliente.llamar("autorizarSubida", { cuerpo: archivo }),
    async subir(url, cabeceras, datos) {
      let respuesta: Response;
      try {
        respuesta = await f(url, { method: "PUT", headers: cabeceras, body: datos });
      } catch (error) {
        throw new ErrorDeRed(error);
      }
      if (!respuesta.ok) throw new ErrorDeSubida(respuesta.status);
    },
    confirmarSubida: (huella) => cliente.llamar("confirmarSubida", { parametros: { huella } }),
    enviarComando: (comando) => cliente.llamar("enviarComando", { cuerpo: comando }),
    obtenerCambios: (desde, app) => cliente.llamar("obtenerCambios", { consulta: { desde, app } }),
    informarDispositivo: (cuerpo) => cliente.llamar("informarDispositivo", { cuerpo }),
    consultarOrdenes: (cuerpo) => cliente.llamar("consultarOrdenes", { cuerpo }),
  };
}
