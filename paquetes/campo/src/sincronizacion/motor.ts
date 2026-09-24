import { ErrorApi, ErrorDeRed } from "@teins/protocolo";
import type { EnvioLocal } from "../datos/modelo";
import type { AlmacenSincronizacion } from "./almacen";
import { ErrorDeSubida, type Transporte } from "./transporte";

export const ESPERA_BASE_MS = 2_000;
export const ESPERA_MAXIMA_MS = 5 * 60_000;
/** Pasadas por sincronización: cubre "faltan archivos → súbelos → reintenta" sin bucles infinitos. */
const PASADAS_MAXIMAS = 3;

/**
 * Espera exponencial con variación aleatoria (ADR-0003, regla 6): muchos dispositivos que
 * recuperan señal a la vez no golpean al servidor en el mismo instante.
 */
export function espera(intentos: number, aleatorio: () => number): number {
  const tope = Math.min(ESPERA_MAXIMA_MS, ESPERA_BASE_MS * 2 ** Math.min(intentos, 20));
  return Math.round(tope * (0.5 + aleatorio() * 0.5));
}

export type ResultadoSincronizacion = "completa" | "sin_conexion";

export interface Motor {
  /** Sube fotos pendientes y procesa el outbox. Nunca corre dos veces a la vez. */
  sincronizar(): Promise<ResultadoSincronizacion>;
  /** Momento del próximo intento pendiente, para despertar justo a tiempo. */
  proximoIntento(): Promise<number | null>;
}

interface Dependencias {
  almacen: AlmacenSincronizacion;
  transporte: Transporte;
  /** Técnico con sesión en el dispositivo; sin sesión no se sincroniza nada. */
  usuarioActual: () => Promise<string | null>;
  reloj?: () => number;
  aleatorio?: () => number;
  /** Exclusión entre pestañas (Web Locks); sin ella, solo dentro de la pestaña. */
  bloquear?: <T>(tarea: () => Promise<T>) => Promise<T | "ocupado">;
}

class SinConexion extends Error {}

export function crearMotor({ almacen, transporte: base, usuarioActual, reloj = Date.now, aleatorio = Math.random, bloquear }: Dependencias): Motor {
  // Cualquier respuesta del servidor, incluso un error del contrato, prueba que hay conexión.
  const conRed = <A extends unknown[], R>(llamada: (...a: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      try {
        const r = await llamada(...args);
        await almacen.registrarRed(true);
        return r;
      } catch (error) {
        await almacen.registrarRed(!(error instanceof ErrorDeRed));
        throw error;
      }
    };
  const transporte: Transporte = {
    autorizarSubida: conRed(base.autorizarSubida),
    subir: conRed(base.subir),
    confirmarSubida: conRed(base.confirmarSubida),
    enviarComando: conRed(base.enviarComando),
  };

  async function subirFotos(tecnicoId: string) {
    for (const archivo of await almacen.archivosPorSubir(tecnicoId)) {
      try {
        const autorizacion = await transporte.autorizarSubida({ huella: archivo.id, bytes: archivo.datos.byteLength, tipo: "image/jpeg" });
        if (autorizacion.estado === "autorizada") {
          await transporte.subir(autorizacion.url, autorizacion.cabeceras, archivo.datos);
          await transporte.confirmarSubida(archivo.id);
        }
        await almacen.marcarSubida(archivo.id);
      } catch (error) {
        if (error instanceof ErrorDeRed) throw new SinConexion();
        // Una foto con problemas no detiene las demás; queda pendiente y con su motivo a la vista.
        await almacen.registrarErrorDeSubida(archivo.id, error instanceof Error ? error.message : String(error));
        if (error instanceof ErrorApi && error.codigo === "no_autenticado") return;
        if (!(error instanceof ErrorApi) && !(error instanceof ErrorDeSubida)) throw error;
      }
    }
  }

  async function reintentarDespues(envio: EnvioLocal, codigo: string, mensaje: string, esperaMs?: number) {
    const intentos = envio.intentos + 1;
    await almacen.actualizarEnvio(envio.levantamientoId, {
      estado: "pendiente",
      intentos,
      proximoIntentoEn: reloj() + (esperaMs ?? espera(intentos, aleatorio)),
      ultimoError: { codigo, mensaje },
    });
  }

  /** Devuelve true si conviene otra pasada inmediata (faltaban archivos). */
  async function procesar(envio: EnvioLocal): Promise<boolean> {
    await almacen.actualizarEnvio(envio.levantamientoId, { estado: "enviando" });
    try {
      const resultado = await transporte.enviarComando(envio.comando);
      await almacen.actualizarEnvio(envio.levantamientoId, { estado: "recibido", recibidoEn: resultado.recibidoEn, ultimoError: undefined });
      return false;
    } catch (error) {
      if (error instanceof ErrorDeRed) {
        // Puede que el servidor sí lo haya recibido: el reintento es seguro por la llave de idempotencia.
        await reintentarDespues(envio, "sin_conexion", error.message);
        throw new SinConexion();
      }
      if (!(error instanceof ErrorApi)) throw error;
      const { codigo, problema } = error;
      switch (codigo) {
        case "archivos_faltantes":
          await almacen.marcarPorSubir(problema.faltantes ?? []);
          await almacen.actualizarEnvio(envio.levantamientoId, { estado: "pendiente", proximoIntentoEn: reloj(), ultimoError: { codigo, mensaje: error.message } });
          return true;
        case "archivos_en_verificacion":
          await reintentarDespues(envio, codigo, error.message, (problema.reintentarEnSegundos ?? 5) * 1000);
          return false;
        case "no_autenticado":
          await almacen.actualizarEnvio(envio.levantamientoId, { estado: "requiere_sesion", ultimoError: { codigo, mensaje: error.message } });
          return false;
        case "version_protocolo_no_soportada":
          await almacen.actualizarEnvio(envio.levantamientoId, { estado: "requiere_actualizar", ultimoError: { codigo, mensaje: error.message } });
          return false;
        default:
          if (error.reintentable) await reintentarDespues(envio, codigo, error.message);
          // Error permanente (ADR-0003): no se reintenta solo; el técnico lo ve.
          else await almacen.actualizarEnvio(envio.levantamientoId, { estado: "error", ultimoError: { codigo, mensaje: error.message } });
          return false;
      }
    }
  }

  async function unaVez(): Promise<ResultadoSincronizacion> {
    await almacen.recuperarInterrumpidos();
    const tecnicoId = await usuarioActual();
    if (!tecnicoId) return "completa";
    try {
      for (let pasada = 0; pasada < PASADAS_MAXIMAS; pasada++) {
        await subirFotos(tecnicoId);
        let otraPasada = false;
        for (const envio of await almacen.enviosListos(reloj(), tecnicoId)) {
          if (await procesar(envio)) otraPasada = true;
        }
        if (!otraPasada) break;
      }
      return "completa";
    } catch (error) {
      if (error instanceof SinConexion) return "sin_conexion";
      throw error;
    }
  }

  // Una sola sincronización a la vez; si se pide otra mientras corre, se repite al terminar.
  let enCurso: Promise<ResultadoSincronizacion> | null = null;
  let repetir = false;

  async function correr(): Promise<ResultadoSincronizacion> {
    let resultado: ResultadoSincronizacion;
    do {
      repetir = false;
      const r = bloquear ? await bloquear(unaVez) : await unaVez();
      resultado = r === "ocupado" ? "completa" : r;
    } while (repetir && resultado === "completa");
    return resultado;
  }

  return {
    async proximoIntento() {
      const tecnicoId = await usuarioActual();
      return tecnicoId ? almacen.proximoIntento(tecnicoId) : null;
    },
    sincronizar() {
      if (enCurso) {
        repetir = true;
        return enCurso;
      }
      enCurso = correr().finally(() => {
        enCurso = null;
      });
      return enCurso;
    },
  };
}

/** Exclusión entre pestañas con Web Locks (Safari 15.4+). Otra pestaña sincronizando no es un error. */
export function bloqueoEntrePestanas(): Dependencias["bloquear"] {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks) return undefined;
  return (tarea) => locks.request("teins-sincronizacion", { ifAvailable: true }, (lock) => (lock ? tarea() : "ocupado" as const));
}
