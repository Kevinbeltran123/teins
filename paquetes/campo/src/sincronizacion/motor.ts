import { TIPO_ARCHIVO_BOCETO } from "@teins/dominio";
import { ErrorApi, ErrorDeRed } from "@teins/protocolo";
import type { EnvioLocal } from "../datos/modelo";
import type { AlmacenSincronizacion } from "./almacen";
import { ErrorDeSubida, type Transporte } from "./transporte";

export const ESPERA_BASE_MS = 2_000;
export const ESPERA_MAXIMA_MS = 5 * 60_000;
/**
 * Sin señal no hay servidor al que darle respiro: la espera crece igual, pero solo hasta el ritmo del ciclo de respaldo,
 * para que el envío salga apenas vuelva la señal (iteración 51).
 */
export const ESPERA_MAXIMA_SIN_RED_MS = 30_000;
/** Pasadas por sincronización: cubre "faltan archivos → súbelos → reintenta" sin bucles infinitos. */
const PASADAS_MAXIMAS = 3;
/** Sin un motivo para bajar ya (abrir la app, recuperar señal, un envío recibido), se baja cada 5 minutos. */
export const INTERVALO_BAJADA_MS = 5 * 60_000;
/** Veces seguidas que pueden faltar archivos antes de decirle al técnico que una foto o un dibujo no sube. */
const INTENTOS_CON_ARCHIVOS_FALTANTES = 6;
/** Páginas por sincronización: un teléfono muy atrasado termina en la siguiente. */
const PAGINAS_MAXIMAS = 20;

/**
 * Mientras el técnico cambia la contraseña temporal, el servidor responde 403 a todo lo demás: no es un rechazo sin
 * remedio, se espera como un error pasajero (iteración 42). Sin esto se perdían terminaciones y respuestas en cola.
 */
const esperaAlCambioDeContrasena = (error: ErrorApi) => error.codigo === "cambio_de_contrasena_requerido";

/**
 * Espera exponencial con variación aleatoria (ADR-0003, regla 6): muchos dispositivos que
 * recuperan señal a la vez no golpean al servidor en el mismo instante.
 */
export function espera(intentos: number, aleatorio: () => number, maxima = ESPERA_MAXIMA_MS): number {
  const tope = Math.min(maxima, ESPERA_BASE_MS * 2 ** Math.min(intentos, 20));
  return Math.round(tope * (0.5 + aleatorio() * 0.5));
}

export type ResultadoSincronizacion = "completa" | "sin_conexion";

export interface Motor {
  /**
   * Sube fotos pendientes, procesa el outbox y baja cambios. Nunca corre dos veces a la vez.
   * `bajar` pide la bajada ya, sin esperar el intervalo. `programada`: la pide el temporizador o el ciclo de respaldo, y
   * sin señal espera su turno sin abrir nada; lo que pide el técnico, abrir la app o recuperar señal intenta de inmediato.
   */
  sincronizar(opciones?: { bajar?: boolean; programada?: boolean }): Promise<ResultadoSincronizacion>;
  /** Momento del próximo intento pendiente, para despertar justo a tiempo; sin señal, no antes de volver a buscarla. */
  proximoIntento(): Promise<number | null>;
}

interface Dependencias {
  almacen: AlmacenSincronizacion;
  transporte: Transporte;
  /** Técnico con sesión en el dispositivo; sin sesión no se sincroniza nada. */
  usuarioActual: () => Promise<string | null>;
  /** Versión de esta app: filtra formatos en la bajada y va en el informe de salud (ADR-0015, ADR-0017). */
  versionApp: number;
  reloj?: () => number;
  aleatorio?: () => number;
  /** Exclusión entre pestañas (Web Locks); sin ella, solo dentro de la pestaña. */
  bloquear?: <T>(tarea: () => Promise<T>) => Promise<T | "ocupado">;
}

class SinConexion extends Error {}

export function crearMotor({ almacen, transporte: base, usuarioActual, versionApp, reloj = Date.now, aleatorio = Math.random, bloquear }: Dependencias): Motor {
  /**
   * Sin señal, la espera es del teléfono y no de cada envío (iteración 51): sin respuesta del servidor no hay intento que
   * contar, así que nada acumula espera y, al volver la señal, todo sale de inmediato. Vive en memoria: al abrir la app
   * de nuevo se intenta enseguida.
   */
  let fallasDeRed = 0;
  let buscarSenalEn = 0;

  // Cualquier respuesta del servidor, incluso un error del contrato, prueba que hay conexión.
  const conRed = <A extends unknown[], R>(llamada: (...a: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      try {
        const r = await llamada(...args);
        fallasDeRed = buscarSenalEn = 0;
        await almacen.registrarRed(true);
        return r;
      } catch (error) {
        if (!(error instanceof ErrorDeRed)) fallasDeRed = buscarSenalEn = 0;
        await almacen.registrarRed(!(error instanceof ErrorDeRed));
        throw error;
      }
    };
  const transporte: Transporte = {
    autorizarSubida: conRed(base.autorizarSubida),
    subir: conRed(base.subir),
    confirmarSubida: conRed(base.confirmarSubida),
    enviarComando: conRed(base.enviarComando),
    obtenerCambios: conRed(base.obtenerCambios),
    informarDispositivo: conRed(base.informarDispositivo),
    consultarOrdenes: conRed(base.consultarOrdenes),
    terminarVisita: conRed(base.terminarVisita),
    responderComentario: conRed(base.responderComentario),
  };

  /** Alguna llamada respondió "no autenticado" en esta sincronización: puede ser una revocación. */
  let sesionRechazada = false;
  /** Se recibió un envío: su estado según el servidor baja en la misma sincronización. */
  let huboRecibidos = false;

  async function subirArchivos(tecnicoId: string) {
    // De a uno (ADR-0022): sin señal falla el primero y los demás ni se abren.
    for (const huella of await almacen.huellasPorSubir(tecnicoId)) {
      const archivo = await almacen.archivoPorSubir(huella);
      if (!archivo) continue;
      try {
        // Fotos (JPEG) o bocetos: cada archivo sube con el tipo con que se guardó (iteración 10).
        const tipo = archivo.tipo === TIPO_ARCHIVO_BOCETO ? TIPO_ARCHIVO_BOCETO : "image/jpeg";
        const autorizacion = await transporte.autorizarSubida({ huella: archivo.id, bytes: archivo.datos.byteLength, tipo });
        if (autorizacion.estado === "autorizada") {
          await transporte.subir(autorizacion.url, autorizacion.cabeceras, archivo.datos);
          await transporte.confirmarSubida(archivo.id);
        }
        await almacen.marcarSubida(archivo.id);
      } catch (error) {
        if (error instanceof ErrorDeRed) throw new SinConexion();
        // Una foto con problemas no detiene las demás; queda pendiente y con su motivo a la vista.
        await almacen.registrarErrorDeSubida(archivo.id, error instanceof Error ? error.message : String(error));
        if (error instanceof ErrorApi && error.codigo === "no_autenticado") {
          sesionRechazada = true;
          return;
        }
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
      huboRecibidos = true;
      return false;
    } catch (error) {
      if (error instanceof ErrorDeRed) {
        // Puede que el servidor sí lo haya recibido: el reintento es seguro por la llave de idempotencia. No suma intento
        // ni espera propia: espera la señal con el resto del teléfono.
        await almacen.actualizarEnvio(envio.levantamientoId, { estado: "pendiente", ultimoError: { codigo: "sin_conexion", mensaje: error.message } });
        throw new SinConexion();
      }
      if (!(error instanceof ErrorApi)) throw error;
      const { codigo, problema } = error;
      switch (codigo) {
        case "archivos_faltantes":
          await almacen.marcarPorSubir(problema.faltantes ?? []);
          // La primera vez se suben y se reintenta en la misma sincronización.
          if (envio.ultimoError?.codigo !== "archivos_faltantes") {
            await almacen.actualizarEnvio(envio.levantamientoId, { estado: "pendiente", proximoIntentoEn: reloj(), ultimoError: { codigo, mensaje: error.message } });
            return true;
          }
          // Si siguen faltando, algo los rechaza: espera cada vez más y, al final, lo dice en lugar de dar vueltas.
          if (envio.intentos + 1 >= INTENTOS_CON_ARCHIVOS_FALTANTES) {
            await almacen.actualizarEnvio(envio.levantamientoId, { estado: "error", intentos: envio.intentos + 1, ultimoError: { codigo, mensaje: error.message } });
            return false;
          }
          await reintentarDespues(envio, codigo, error.message);
          return false;
        case "archivos_en_verificacion":
          // Lo que pide el servidor, y cada vez más si sigue sin verificarse (el worker caído): no consulta cada 5 s sin fin.
          await reintentarDespues(envio, codigo, error.message, Math.max((problema.reintentarEnSegundos ?? 5) * 1000, espera(envio.intentos + 1, aleatorio)));
          return false;
        case "no_autenticado":
          sesionRechazada = true;
          await almacen.actualizarEnvio(envio.levantamientoId, { estado: "requiere_sesion", ultimoError: { codigo, mensaje: error.message } });
          return false;
        case "version_protocolo_no_soportada":
          await almacen.actualizarEnvio(envio.levantamientoId, { estado: "requiere_actualizar", versionAppRechazada: versionApp, ultimoError: { codigo, mensaje: error.message } });
          return false;
        default:
          if (error.reintentable || esperaAlCambioDeContrasena(error)) await reintentarDespues(envio, codigo, error.message);
          // Error permanente (ADR-0003): no se reintenta solo; el técnico lo ve.
          else await almacen.actualizarEnvio(envio.levantamientoId, { estado: "error", ultimoError: { codigo, mensaje: error.message } });
          return false;
      }
    }
  }

  /**
   * Visitas terminadas en el teléfono (ADR-0037), con la misma espera que los envíos. Sin red siguen pendientes; un
   * rechazo sin remedio (cancelada, ya no es suya) quita la terminación local: manda lo que diga el servidor.
   */
  async function enviarTerminaciones(tecnicoId: string) {
    for (const { visitaId, terminacion } of await almacen.terminacionesListas(reloj(), tecnicoId)) {
      const { llave, en } = terminacion;
      const intentos = terminacion.intentos + 1;
      const despues = () => almacen.reintentarTerminacion(tecnicoId, visitaId, llave, { intentos, proximoIntentoEn: reloj() + espera(intentos, aleatorio) });
      try {
        const { terminada } = await transporte.terminarVisita(visitaId, { llave, en });
        await almacen.resolverTerminacion(tecnicoId, visitaId, llave, terminada);
        // La visita terminada baja en la misma sincronización.
        huboRecibidos = true;
      } catch (error) {
        // Sin señal espera con el resto del teléfono, sin sumar intento.
        if (error instanceof ErrorDeRed) throw new SinConexion();
        if (!(error instanceof ErrorApi)) throw error;
        if (error.codigo === "no_autenticado") {
          // Se envía al volver a iniciar sesión.
          sesionRechazada = true;
          return;
        }
        // Una app vieja que el servidor ya no acepta también espera: la terminación sale al actualizarla.
        if (error.reintentable || error.codigo === "version_protocolo_no_soportada" || esperaAlCambioDeContrasena(error)) await despues();
        else await almacen.resolverTerminacion(tecnicoId, visitaId, llave, null);
      }
    }
  }

  /**
   * Respuestas a oficina (ADR-0040), con la misma espera que los envíos. Sin red siguen en la cola; un rechazo sin
   * remedio (ya revisado, el comentario ya no existe) las deja en el teléfono con su motivo y no se reintentan.
   */
  async function enviarRespuestas(tecnicoId: string) {
    const detenidos = new Set<string>();
    for (const r of await almacen.respuestasListas(reloj(), tecnicoId)) {
      // Una que falló detiene las siguientes del mismo chat: llegan en el orden en que se escribieron.
      if (detenidos.has(r.levantamientoId)) continue;
      const intentos = r.intentos + 1;
      const despues = async () => {
        detenidos.add(r.levantamientoId);
        await almacen.reintentarRespuesta(r.llave, { intentos, proximoIntentoEn: reloj() + espera(intentos, aleatorio) });
      };
      try {
        const mensaje = await transporte.responderComentario(r.levantamientoId, r.comentarioId, { llave: r.llave, texto: r.texto });
        await almacen.resolverRespuesta(r.llave, { enviada: { id: mensaje.id, creadoEn: mensaje.creadoEn } });
        // La conversación con su mensaje baja en la misma sincronización.
        huboRecibidos = true;
      } catch (error) {
        // Sin señal espera con el resto del teléfono, sin sumar intento; las siguientes del chat esperan detrás.
        if (error instanceof ErrorDeRed) throw new SinConexion();
        if (!(error instanceof ErrorApi)) throw error;
        if (error.codigo === "no_autenticado") {
          sesionRechazada = true;
          return;
        }
        if (error.reintentable || error.codigo === "version_protocolo_no_soportada" || esperaAlCambioDeContrasena(error)) await despues();
        else await almacen.resolverRespuesta(r.llave, { rechazo: error.codigo === "estado_invalido" ? "revisado" : error.codigo === "no_encontrado" ? "no_existe" : "invalida" });
      }
    }
  }

  /** Fuera del outbox: la red corta la sincronización; una sesión rechazada se revisa al final; lo demás espera al próximo ciclo. */
  function tolerar(error: unknown): void {
    if (error instanceof ErrorDeRed) throw new SinConexion();
    if (!(error instanceof ErrorApi)) throw error;
    if (error.codigo === "no_autenticado") sesionRechazada = true;
  }

  async function tocaBajar(tecnicoId: string, pedida: boolean): Promise<boolean> {
    const previa = await almacen.estadoBajada(tecnicoId);
    if (pedida || huboRecibidos || !previa?.ultimaEn || previa.versionApp !== versionApp) return true;
    // Con la sesión vencida no se insiste cada ciclo: se reintenta al iniciar sesión o al volver a abrir.
    return !previa.sesionVencida && reloj() - Date.parse(previa.ultimaEn) >= INTERVALO_BAJADA_MS;
  }

  /** Informe de salud (ADR-0017) y bajada por páginas desde el punto de control (ADR-0003). */
  async function bajar(tecnicoId: string) {
    try {
      await transporte.informarDispositivo({ ...(await almacen.dispositivo()), salud: await almacen.salud(tecnicoId, versionApp) });
    } catch (error) {
      tolerar(error);
    }
    if (sesionRechazada) return;
    const previa = await almacen.estadoBajada(tecnicoId);
    // Una app actualizada puede mostrar formatos que antes se saltó: baja desde cero (ADR-0015, punto 4).
    let desde = previa && previa.versionApp === versionApp ? previa.puntoDeControl : 0;
    let epoca = previa?.epoca;
    try {
      for (let pagina = 0; pagina < PAGINAS_MAXIMAS; pagina++) {
        const bajada = await transporte.obtenerCambios(desde, versionApp);
        // Otra época (ADR-0038): lo que bajó antes ya no existe en el servidor. Se quita y se baja todo desde cero; la
        // primera época que ve el teléfono solo se guarda.
        if (bajada.epoca && epoca && bajada.epoca !== epoca) {
          await almacen.reiniciarPorEpoca(tecnicoId, bajada.epoca, versionApp);
          epoca = bajada.epoca;
          desde = 0;
          continue;
        }
        await almacen.aplicarBajada(tecnicoId, bajada, versionApp, new Date(reloj()).toISOString());
        desde = bajada.puntoDeControl;
        if (!bajada.hayMas) break;
      }
    } catch (error) {
      tolerar(error);
    }
  }

  /**
   * ¿Sesión vencida o revocación? La revocación borró las sesiones, así que se pregunta con el secreto
   * del dispositivo (ADR-0009). Borra lo de cada usuario revocado y confirma el borrado al servidor.
   */
  async function atenderOrdenes(): Promise<void> {
    for (let vuelta = 0; vuelta < 2; vuelta++) {
      // Un borrado se confirma solo cuando no queda nada: si se interrumpió tras destruir la clave, se termina.
      await almacen.completarBorrados();
      const confirmados = await almacen.borradosPorConfirmar();
      let ordenes: { borrar: string[] };
      try {
        ordenes = await transporte.consultarOrdenes({ ...(await almacen.dispositivo()), confirmados });
      } catch (error) {
        tolerar(error);
        // El servidor no conoce este dispositivo: no hay órdenes que cumplir.
        return;
      }
      await almacen.quitarConfirmados(confirmados);
      for (const usuario of ordenes.borrar) await almacen.borrarDatosDe(usuario, new Date(reloj()).toISOString());
      if (ordenes.borrar.length === 0) return;
    }
  }

  async function unaVez(bajadaPedida: boolean, programada: boolean): Promise<ResultadoSincronizacion> {
    // Sin señal, el temporizador y el ciclo de respaldo esperan su turno sin abrir nada (iteración 51).
    if (programada && reloj() < buscarSenalEn) return "sin_conexion";
    await almacen.recuperarInterrumpidos();
    // Lo que esperaba una app nueva sale apenas corre una versión distinta de la que el servidor rechazó.
    await almacen.reanudarTrasActualizar(versionApp);
    sesionRechazada = false;
    huboRecibidos = false;
    try {
      // Un borrado anterior que no alcanzó a confirmarse, aunque ya no haya nadie con sesión.
      if ((await almacen.borradosPorConfirmar()).length > 0) await atenderOrdenes();
      const tecnicoId = await usuarioActual();
      if (!tecnicoId) return "completa";

      for (let pasada = 0; pasada < PASADAS_MAXIMAS; pasada++) {
        await subirArchivos(tecnicoId);
        let otraPasada = false;
        for (const envio of await almacen.enviosListos(reloj(), tecnicoId)) {
          if (await procesar(envio)) otraPasada = true;
        }
        if (!otraPasada) break;
      }
      if (!sesionRechazada) await enviarTerminaciones(tecnicoId);
      if (!sesionRechazada) await enviarRespuestas(tecnicoId);
      if (!sesionRechazada && (await tocaBajar(tecnicoId, bajadaPedida))) {
        await bajar(tecnicoId);
        // Con el estado al día, lo revisado y viejo sale del teléfono (ADR-0044).
        await almacen.podarRevisadosAntiguos(tecnicoId, reloj());
      }

      if (sesionRechazada) {
        await atenderOrdenes();
        // Si no hubo orden de borrado para este usuario, sus datos siguen: solo falta iniciar sesión.
        if ((await usuarioActual()) === tecnicoId) await almacen.marcarSesionVencida(tecnicoId);
      }
      return "completa";
    } catch (error) {
      if (error instanceof SinConexion) {
        fallasDeRed++;
        buscarSenalEn = reloj() + espera(fallasDeRed, aleatorio, ESPERA_MAXIMA_SIN_RED_MS);
        return "sin_conexion";
      }
      throw error;
    }
  }

  // Una sola sincronización a la vez; si se pide otra mientras corre, se repite al terminar.
  let enCurso: Promise<ResultadoSincronizacion> | null = null;
  let repetir = false;
  let bajadaPedida = false;
  /** La pidió alguien que no es el temporizador ni el ciclo de respaldo: no espera la señal. */
  let pedidaYa = false;

  async function correr(): Promise<ResultadoSincronizacion> {
    let resultado: ResultadoSincronizacion;
    do {
      repetir = false;
      const pedida = bajadaPedida;
      const programada = !pedidaYa;
      bajadaPedida = pedidaYa = false;
      const r = bloquear ? await bloquear(() => unaVez(pedida, programada)) : await unaVez(pedida, programada);
      resultado = r === "ocupado" ? "completa" : r;
    } while (repetir && resultado === "completa");
    return resultado;
  }

  return {
    async proximoIntento() {
      const tecnicoId = await usuarioActual();
      const proximo = tecnicoId ? await almacen.proximoIntento(tecnicoId) : null;
      // Sin señal, nada se intenta antes de volver a buscarla.
      return proximo === null ? null : Math.max(proximo, buscarSenalEn);
    },
    sincronizar({ bajar = false, programada = false } = {}) {
      if (bajar) bajadaPedida = true;
      if (!programada) pedidaYa = true;
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
