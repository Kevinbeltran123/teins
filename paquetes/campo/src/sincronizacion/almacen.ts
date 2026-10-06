import type { Bajada, SaludDispositivo } from "@teins/protocolo";
import type { BaseCampo } from "../datos/base";
import type { ArchivoLocal, BajadaLocal, DispositivoLocal, EnvioLocal, EstadoServidorGuardado, RespuestaPendiente, TerminacionPendiente, VisitaGuardada } from "../datos/modelo";
import { enBorrado } from "../datos/cofre";
import { abrirArchivo, abrirEnvio, abrirRespuesta, abrirVisita, referencias, sellarArchivo, sellarEstado, sellarVisita } from "../datos/registros";
import { estadoAlmacenamiento } from "../dispositivo/almacenamiento";

/** Operaciones del motor sobre la base local. */
export interface AlmacenSincronizacion {
  /** Fotos pendientes de los levantamientos de este técnico: nunca se suben con la sesión de otro. */
  archivosPorSubir(tecnicoId: string): Promise<ArchivoLocal[]>;
  marcarSubida(huella: string): Promise<void>;
  registrarErrorDeSubida(huella: string, mensaje: string): Promise<void>;
  marcarPorSubir(huellas: readonly string[]): Promise<void>;
  enviosListos(ahora: number, tecnicoId: string): Promise<EnvioLocal[]>;
  /** Visitas que el técnico terminó en el teléfono y ya toca avisarle al servidor (ADR-0037). */
  terminacionesListas(ahora: number, tecnicoId: string): Promise<{ visitaId: string; terminacion: TerminacionPendiente }[]>;
  /** Otro intento más tarde; solo si sigue pendiente la misma terminación (misma llave). */
  reintentarTerminacion(tecnicoId: string, visitaId: string, llave: string, cambios: Pick<TerminacionPendiente, "intentos" | "proximoIntentoEn">): Promise<void>;
  /**
   * El servidor respondió: con `terminada`, la visita queda como él dice; con null (la rechazó sin remedio), se quita
   * la terminación local y la visita vuelve a lo que dice el servidor.
   */
  resolverTerminacion(tecnicoId: string, visitaId: string, llave: string, terminada: { en: string } | null): Promise<void>;
  /**
   * Respuestas a oficina que ya toca enviar (ADR-0040), en el orden en que se escribieron. Una que espera detiene las
   * siguientes de su levantamiento: el chat no se desordena en el servidor.
   */
  respuestasListas(ahora: number, tecnicoId: string): Promise<RespuestaPendiente[]>;
  reintentarRespuesta(llave: string, cambios: Pick<RespuestaPendiente, "intentos" | "proximoIntentoEn">): Promise<void>;
  /** El servidor la recibió (queda como enviada hasta que la trae la bajada) o la rechazó sin remedio (queda con su motivo). */
  resolverRespuesta(llave: string, resultado: Pick<RespuestaPendiente, "enviada"> | Pick<RespuestaPendiente, "rechazo">): Promise<void>;
  /** Cuándo toca el próximo intento pendiente de este técnico (envíos, terminaciones y respuestas), o null si no hay nada que esperar. */
  proximoIntento(tecnicoId: string): Promise<number | null>;
  /** Estado, intentos y errores: el comando es inmutable y va sellado. */
  actualizarEnvio(levantamientoId: string, cambios: Partial<Omit<EnvioLocal, "comando">>): Promise<void>;
  /** Un envío que quedó "enviando" porque la app se cerró en medio vuelve a pendiente. */
  recuperarInterrumpidos(): Promise<void>;
  /** Registra si el servidor respondió, para mostrar "sin conexión" aunque el navegador diga lo contrario. */
  registrarRed(alcanzable: boolean): Promise<void>;
  /** Tras iniciar sesión o actualizar la app, lo que esperaba por eso vuelve a la cola. */
  reanudar(desde: EnvioLocal["estado"]): Promise<void>;

  /** Identidad del teléfono; se crea la primera vez que se necesita. */
  dispositivo(): Promise<DispositivoLocal>;
  salud(tecnicoId: string, versionApp: number): Promise<SaludDispositivo>;
  estadoBajada(tecnicoId: string): Promise<BajadaLocal | undefined>;
  /** Aplica una página de la bajada y avanza el punto de control en la misma transacción. */
  aplicarBajada(tecnicoId: string, bajada: Bajada, versionApp: number, ahora: string): Promise<void>;
  /**
   * El servidor cambió de época (ADR-0038): quita lo que bajó del servidor (visitas sin trabajo pendiente, estados y
   * catálogo) y deja el punto de control en cero. Al terminar de bajar todo, sale lo enviado y recibido que el servidor
   * ya no conoce. Los borradores, lo que falta por enviar, los formatos y los símbolos se quedan (regla 5).
   */
  reiniciarPorEpoca(tecnicoId: string, epoca: string, versionApp: number): Promise<void>;
  /** Permiso recibido al iniciar sesión; no toca el punto de control. */
  renovarPermiso(tecnicoId: string, permisoLocalHasta: string, versionApp: number): Promise<void>;
  marcarSesionVencida(tecnicoId: string): Promise<void>;
  /**
   * Orden de borrado (ADR-0009, QA-5; ADR-0022): primero destruye la clave del usuario revocado, con lo
   * que todo lo suyo queda ilegible al instante; después borra sus datos, sin tocar lo de otro usuario
   * del mismo teléfono, y deja pendiente avisarle al servidor.
   */
  borrarDatosDe(tecnicoId: string, ahora: string): Promise<void>;
  /** Termina un borrado que se interrumpió después de destruir la clave. Se puede repetir. */
  completarBorrados(): Promise<void>;
  borradosPorConfirmar(): Promise<string[]>;
  quitarConfirmados(ids: readonly string[]): Promise<void>;
}

/** El mismo sellado (cada uno lleva su vector de inicio aleatorio): nadie reescribió la visita entre tanto. */
function mismoSellado(a: VisitaGuardada, b: VisitaGuardada): boolean {
  if (!a.sellado || !b.sellado) return JSON.stringify(a) === JSON.stringify(b);
  return a.sellado.iv.length === b.sellado.iv.length && a.sellado.iv.every((x, i) => x === b.sellado!.iv[i]);
}

/** 32 bytes aleatorios en base64url. */
function secretoAleatorio(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

/** Lo que el técnico descartó en este teléfono (`teins-…:<id>`: sugerencias de llave y de avisos). */
function olvidarDescartesDe(tecnicoId: string) {
  try {
    const llaves = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i));
    for (const llave of llaves) if (llave?.startsWith("teins-") && llave.endsWith(`:${tecnicoId}`)) localStorage.removeItem(llave);
  } catch {
    // Sin almacenamiento del navegador no hay nada que olvidar.
  }
}

export function almacenDexie(db: BaseCampo): AlmacenSincronizacion {
  function borrarRegistrosDe(tecnicoId: string) {
    olvidarDescartesDe(tecnicoId);
    const tablas = [db.levantamientos, db.archivos, db.envios, db.visitas, db.estadosServidor, db.bajadas, db.respuestasPendientes, db.lecturasDeChat];
    return db.transaction("rw", tablas, async () => {
      const propios = await db.levantamientos.where("tecnicoId").equals(tecnicoId).toArray();
      const deOtros = await db.levantamientos.filter((l) => l.tecnicoId !== tecnicoId).toArray();
      // Los archivos se direccionan por contenido: uno que también usa otra persona se conserva.
      const enUso = new Set(deOtros.flatMap((l) => referencias(l).archivos));
      await db.archivos.bulkDelete(propios.flatMap((l) => referencias(l).archivos).filter((h) => !enUso.has(h)));
      await db.levantamientos.bulkDelete(propios.map((l) => l.id));
      await db.envios.where("tecnicoId").equals(tecnicoId).delete();
      await db.visitas.where("tecnicoId").equals(tecnicoId).delete();
      await db.estadosServidor.where("tecnicoId").equals(tecnicoId).delete();
      await db.bajadas.delete(tecnicoId);
      await db.respuestasPendientes.where("tecnicoId").equals(tecnicoId).delete();
      await db.lecturasDeChat.where("tecnicoId").equals(tecnicoId).delete();
    });
  }

  /**
   * Después de bajar todo desde cero, el servidor ya dijo el estado de cada levantamiento que conoce: uno enviado y
   * recibido sin estado se borró en el servidor. Sale con sus fotos y su envío; un archivo que usa otro se conserva.
   */
  async function podarEnviadosSinServidor(tecnicoId: string) {
    const conocidos = new Set((await db.estadosServidor.where("tecnicoId").equals(tecnicoId).primaryKeys()) as string[]);
    const recibidos = new Set((await db.envios.where("tecnicoId").equals(tecnicoId).filter((e) => e.estado === "recibido").toArray()).map((e) => e.levantamientoId));
    const todos = await db.levantamientos.toArray();
    const salen = todos.filter((l) => l.tecnicoId === tecnicoId && l.estado === "enviado" && recibidos.has(l.id) && !conocidos.has(l.id));
    if (salen.length === 0) return;
    const enUso = new Set(todos.filter((l) => !salen.includes(l)).flatMap((l) => referencias(l).archivos));
    await db.archivos.bulkDelete(salen.flatMap((l) => referencias(l).archivos).filter((h) => !enUso.has(h)));
    await db.levantamientos.bulkDelete(salen.map((l) => l.id));
    await db.envios.bulkDelete(salen.map((l) => l.id));
  }

  return {
    async archivosPorSubir(tecnicoId) {
      const propios = await db.levantamientos.where("tecnicoId").equals(tecnicoId).toArray();
      // Las fotos suben por adelantado; los bocetos, solo del levantamiento ya enviado (ADR-0019, parte 3).
      const huellas = new Set(propios.flatMap((l) => (l.estado === "borrador" ? referencias(l).fotos : referencias(l).archivos)));
      const pendientes = (await db.archivos.where("subida").equals("pendiente").primaryKeys()).filter((h) => huellas.has(h));
      // Se abren al subir: al servidor llegan los bytes originales, con la huella que los nombra.
      const archivos = (await db.archivos.bulkGet(pendientes)).filter((a) => a !== undefined);
      return Promise.all(archivos.map((a) => abrirArchivo(db, a)));
    },
    async marcarSubida(huella) {
      await db.archivos.update(huella, { subida: "subida", ultimoErrorDeSubida: undefined });
    },
    async registrarErrorDeSubida(huella, mensaje) {
      await db.archivos.update(huella, { ultimoErrorDeSubida: mensaje });
    },
    async marcarPorSubir(huellas) {
      await db.archivos.where("id").anyOf([...huellas]).modify({ subida: "pendiente" });
    },
    async enviosListos(ahora, tecnicoId) {
      const pendientes = await db.envios.where("estado").equals("pendiente").filter((e) => e.tecnicoId === tecnicoId).toArray();
      const listos = pendientes.filter((e) => e.proximoIntentoEn <= ahora).sort((a, b) => a.creadoEn.localeCompare(b.creadoEn));
      return Promise.all(listos.map((e) => abrirEnvio(db, e)));
    },
    async terminacionesListas(ahora, tecnicoId) {
      // Pocas visitas por técnico: se filtran sin índice, y la base local no cambia de versión.
      const visitas = await db.visitas.where("tecnicoId").equals(tecnicoId).toArray();
      return visitas.flatMap((v) => (v.terminacionPendiente && v.terminacionPendiente.proximoIntentoEn <= ahora ? [{ visitaId: v.id, terminacion: v.terminacionPendiente }] : []));
    },
    reintentarTerminacion(tecnicoId, visitaId, llave, cambios) {
      return db.transaction("rw", db.visitas, async () => {
        const actual = await db.visitas.get([tecnicoId, visitaId]);
        if (actual?.terminacionPendiente?.llave === llave) await db.visitas.update([tecnicoId, visitaId], { terminacionPendiente: { ...actual.terminacionPendiente, ...cambios } });
      });
    },
    async resolverTerminacion(tecnicoId, visitaId, llave, terminada) {
      const previa = await db.visitas.get([tecnicoId, visitaId]);
      if (previa?.terminacionPendiente?.llave !== llave) return;
      // Se sella antes: dentro de la transacción no cabe WebCrypto (ADR-0022).
      const { terminacionPendiente: _t, ...visita } = await abrirVisita(db, previa);
      const nueva = terminada ? await sellarVisita(db, { ...visita, terminada }) : undefined;
      await db.transaction("rw", db.visitas, async () => {
        const actual = await db.visitas.get([tecnicoId, visitaId]);
        if (actual?.terminacionPendiente?.llave !== llave) return;
        // Si una bajada la cambió entre tanto, lo sellado ya no sirve: se reintenta (el servidor responde lo mismo).
        if (nueva && mismoSellado(actual, previa)) await db.visitas.put(nueva);
        else if (!nueva) await db.visitas.update([tecnicoId, visitaId], { terminacionPendiente: undefined });
      });
    },
    async respuestasListas(ahora, tecnicoId) {
      const porEnviar = await db.respuestasPendientes.where("tecnicoId").equals(tecnicoId).filter((r) => !r.enviada && !r.rechazo).toArray();
      const abiertas = (await Promise.all(porEnviar.map((g) => abrirRespuesta(db, g)))).sort((a, b) => a.creadaEn.localeCompare(b.creadaEn));
      const detenidos = new Set<string>();
      return abiertas.filter((r) => {
        if (detenidos.has(r.levantamientoId)) return false;
        if (r.proximoIntentoEn <= ahora) return true;
        detenidos.add(r.levantamientoId);
        return false;
      });
    },
    async reintentarRespuesta(llave, cambios) {
      await db.respuestasPendientes.update(llave, cambios);
    },
    async resolverRespuesta(llave, resultado) {
      await db.respuestasPendientes.update(llave, resultado);
    },
    async proximoIntento(tecnicoId) {
      const pendientes = await db.envios.where("estado").equals("pendiente").filter((e) => e.tecnicoId === tecnicoId).toArray();
      const terminaciones = (await db.visitas.where("tecnicoId").equals(tecnicoId).toArray()).flatMap((v) => (v.terminacionPendiente ? [v.terminacionPendiente.proximoIntentoEn] : []));
      // Un chat espera a su primera respuesta detenida: las que van detrás no salen antes (`respuestasListas`).
      const porChat = new Map<string, number>();
      for (const r of await db.respuestasPendientes.where("tecnicoId").equals(tecnicoId).toArray()) {
        if (!r.enviada && !r.rechazo) porChat.set(r.levantamientoId, Math.max(porChat.get(r.levantamientoId) ?? 0, r.proximoIntentoEn));
      }
      const respuestas = [...porChat.values()];
      const momentos = [...pendientes.map((e) => e.proximoIntentoEn), ...terminaciones, ...respuestas];
      return momentos.length === 0 ? null : Math.min(...momentos);
    },
    async actualizarEnvio(levantamientoId, cambios) {
      await db.envios.update(levantamientoId, cambios);
    },
    async recuperarInterrumpidos() {
      await db.envios.where("estado").equals("enviando").modify({ estado: "pendiente" });
    },
    async registrarRed(alcanzable) {
      const actual = await db.ajustes.get("red");
      if (actual?.clave === "red" && actual.valor.alcanzable === alcanzable) return;
      await db.ajustes.put({ clave: "red", valor: { alcanzable, desde: new Date().toISOString() } });
    },
    async reanudar(desde) {
      await db.envios.where("estado").equals(desde).modify({ estado: "pendiente", proximoIntentoEn: 0 });
    },

    dispositivo() {
      return db.transaction("rw", db.ajustes, async () => {
        const actual = await db.ajustes.get("dispositivo");
        if (actual?.clave === "dispositivo") return actual.valor;
        const nuevo = { id: crypto.randomUUID(), secreto: secretoAleatorio() };
        await db.ajustes.put({ clave: "dispositivo", valor: nuevo });
        return nuevo;
      });
    },

    async salud(tecnicoId, versionApp) {
      const pendientes = (await db.envios.where("tecnicoId").equals(tecnicoId).toArray()).filter((e) => e.estado !== "recibido");
      const conError = pendientes.filter((e) => e.ultimoError && e.ultimoError.codigo !== "sin_conexion").sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
      const almacenamiento = await estadoAlmacenamiento().catch(() => undefined);
      const { usoBytes, cuotaBytes } = almacenamiento ?? {};
      return {
        versionApp,
        versionEsquemaLocal: db.verno,
        pendientes: pendientes.length,
        pendienteMasAntiguo: pendientes.map((e) => e.creadoEn).sort()[0] ?? null,
        bytesUsados: usoBytes ?? null,
        bytesDisponibles: usoBytes !== undefined && cuotaBytes !== undefined ? Math.max(0, cuotaBytes - usoBytes) : null,
        persistente: almacenamiento?.persistente ?? null,
        // Solo el código: nunca contenido del levantamiento (ADR-0017).
        ultimoError: conError[0]?.ultimoError?.codigo ?? null,
      };
    },

    estadoBajada: (tecnicoId) => db.bajadas.get(tecnicoId),

    async aplicarBajada(tecnicoId, bajada, versionApp, ahora) {
      // Visitas y comentarios se sellan antes: dentro de la transacción no cabe WebCrypto (ADR-0022).
      const sellados = new Map<number, VisitaGuardada | EstadoServidorGuardado>();
      for (const [i, cambio] of bajada.cambios.entries()) {
        if (cambio.tipo === "visita") sellados.set(i, await sellarVisita(db, { ...cambio.visita, tecnicoId }));
        if (cambio.tipo === "levantamiento") {
          sellados.set(i, await sellarEstado(db, { id: cambio.id, tecnicoId, estado: cambio.estado, recibidoEn: cambio.recibidoEn, comentarios: cambio.comentarios }));
        }
      }
      return db.transaction("rw", [db.formatos, db.visitas, db.estadosServidor, db.bajadas, db.levantamientos, db.catalogo, db.simbolos, db.archivos, db.envios, db.respuestasPendientes], async () => {
        for (const [i, cambio] of bajada.cambios.entries()) {
          switch (cambio.tipo) {
            case "formato":
              await db.formatos.put(cambio.definicion);
              break;
            case "visita": {
              // Una terminación que todavía no sale se conserva; si el servidor ya la tiene terminada, manda la suya.
              const pendiente = cambio.visita.terminada ? undefined : (await db.visitas.get([tecnicoId, cambio.visita.id]))?.terminacionPendiente;
              await db.visitas.put({ ...(sellados.get(i) as VisitaGuardada), ...(pendiente ? { terminacionPendiente: pendiente } : {}) });
              break;
            }
            case "fuera_de_alcance": {
              const empezados = await db.levantamientos.where("tecnicoId").equals(tecnicoId).filter((l) => l.visitaId === cambio.id).count();
              if (empezados > 0) await db.visitas.update([tecnicoId, cambio.id], { fueraDeAlcance: true, ...(cambio.motivo ? { motivoSalida: cambio.motivo } : {}) });
              else await db.visitas.delete([tecnicoId, cambio.id]);
              break;
            }
            case "levantamiento": {
              await db.estadosServidor.put(sellados.get(i) as EstadoServidorGuardado);
              // Lo que el servidor ya devuelve en la conversación sale de la cola (ADR-0040): se ve el suyo.
              const llegadas = (cambio.comentarios ?? []).flatMap((c) => (c.respuestas ?? []).flatMap((r) => (r.llave ? [r.llave] : [])));
              if (llegadas.length > 0) await db.respuestasPendientes.bulkDelete(llegadas);
              break;
            }
            case "item_catalogo":
              await db.catalogo.put(cambio.item);
              break;
            case "simbolo":
              await db.simbolos.put(cambio.simbolo);
              break;
          }
        }
        const previa = await db.bajadas.get(tecnicoId);
        const epoca = bajada.epoca ?? previa?.epoca;
        // Terminó de bajar todo tras cambiar la época (ADR-0038): lo enviado y recibido que el servidor ya no conoce sale.
        if (previa?.podar && !bajada.hayMas) await podarEnviadosSinServidor(tecnicoId);
        await db.bajadas.put({
          tecnicoId,
          puntoDeControl: bajada.puntoDeControl,
          versionApp,
          ultimaEn: ahora,
          permisoLocalHasta: bajada.permisoLocalHasta,
          ...(epoca ? { epoca } : {}),
          ...(previa?.podar && bajada.hayMas ? { podar: true } : {}),
        });
      });
    },

    reiniciarPorEpoca(tecnicoId, epoca, versionApp) {
      return db.transaction("rw", [db.levantamientos, db.envios, db.visitas, db.estadosServidor, db.catalogo, db.bajadas], async () => {
        const recibidos = new Set((await db.envios.where("tecnicoId").equals(tecnicoId).filter((e) => e.estado === "recibido").toArray()).map((e) => e.levantamientoId));
        // Lo que no ha salido del teléfono es trabajo: su visita se queda, como reasignada (regla 5). Si sigue en el
        // servidor, vuelve con la bajada.
        const conTrabajo = new Set(
          (await db.levantamientos.where("tecnicoId").equals(tecnicoId).toArray()).flatMap((l) => (l.visitaId && !(l.estado === "enviado" && recibidos.has(l.id)) ? [l.visitaId] : [])),
        );
        for (const v of await db.visitas.where("tecnicoId").equals(tecnicoId).toArray()) {
          if (conTrabajo.has(v.id) || v.terminacionPendiente) await db.visitas.update([tecnicoId, v.id], { fueraDeAlcance: true });
          else await db.visitas.delete([tecnicoId, v.id]);
        }
        await db.estadosServidor.where("tecnicoId").equals(tecnicoId).delete();
        await db.catalogo.clear();
        const previa = await db.bajadas.get(tecnicoId);
        if (previa) await db.bajadas.put({ ...previa, puntoDeControl: 0, versionApp, epoca, podar: true });
      });
    },

    renovarPermiso(tecnicoId, permisoLocalHasta, versionApp) {
      return db.transaction("rw", db.bajadas, async () => {
        const previa = await db.bajadas.get(tecnicoId);
        await db.bajadas.put({ puntoDeControl: 0, versionApp, ...previa, tecnicoId, permisoLocalHasta, sesionVencida: false });
      });
    },

    async marcarSesionVencida(tecnicoId) {
      await db.bajadas.update(tecnicoId, { sesionVencida: true });
    },

    async borrarDatosDe(tecnicoId, ahora) {
      // Un archivo con la clave del revocado que también usa otra persona pasa a la clave de esa persona
      // antes de destruir la suya: el borrado de uno nunca le quita una foto al otro. Si solo lo usa un
      // borrador sin responsable, vuelve a quedar a la vista, como el borrador (ADR-0022, parte 5). Quien
      // también tiene un borrado pendiente no cuenta: lo suyo se va a borrar y su clave ya no está.
      const borrando = await enBorrado(db);
      const deOtros = await db.levantamientos.filter((l) => l.tecnicoId !== tecnicoId && !(l.tecnicoId && borrando.has(l.tecnicoId))).toArray();
      const usadosPorOtros = new Map<string, string | undefined>();
      // Primero los que tienen responsable: cifrada con la clave de alguien es mejor que a la vista.
      for (const l of deOtros.sort((a, b) => Number(a.tecnicoId === undefined) - Number(b.tecnicoId === undefined))) {
        for (const h of referencias(l).archivos) if (!usadosPorOtros.has(h)) usadosPorOtros.set(h, l.tecnicoId);
      }
      for (const [huella, otro] of usadosPorOtros) {
        const archivo = await db.archivos.get(huella);
        if (archivo?.tecnicoId !== tecnicoId) continue;
        const resellado = await sellarArchivo(db, await abrirArchivo(db, archivo), otro);
        await db.transaction("rw", db.archivos, async () => {
          const actual = await db.archivos.get(huella);
          if (actual?.tecnicoId === tecnicoId) await db.archivos.put({ ...resellado, subida: actual.subida, ultimoErrorDeSubida: actual.ultimoErrorDeSubida });
        });
      }

      // 1. La clave, la sesión y la marca de borrado pendiente, juntas: desde aquí nada de lo suyo se lee.
      await db.transaction("rw", [db.claves, db.ajustes], async () => {
        await db.claves.delete(tecnicoId);
        const usuario = await db.ajustes.get("usuario");
        if (usuario?.clave === "usuario" && usuario.valor.id === tecnicoId) {
          await db.ajustes.delete("usuario");
          await db.ajustes.put({ clave: "acceso_cerrado", valor: { nombre: usuario.valor.nombre, en: ahora } });
        }
        const pendientes = await db.ajustes.get("borrados_por_confirmar");
        const lista = pendientes?.clave === "borrados_por_confirmar" ? pendientes.valor : [];
        if (!lista.includes(tecnicoId)) await db.ajustes.put({ clave: "borrados_por_confirmar", valor: [...lista, tecnicoId] });
      });
      // 2. Los datos. Si esto se interrumpe, lo que quede es ilegible y `completarBorrados` lo termina.
      await borrarRegistrosDe(tecnicoId);
    },

    async completarBorrados() {
      const ajuste = await db.ajustes.get("borrados_por_confirmar");
      for (const tecnicoId of ajuste?.clave === "borrados_por_confirmar" ? ajuste.valor : []) await borrarRegistrosDe(tecnicoId);
    },

    async borradosPorConfirmar() {
      const ajuste = await db.ajustes.get("borrados_por_confirmar");
      return ajuste?.clave === "borrados_por_confirmar" ? ajuste.valor : [];
    },

    quitarConfirmados(ids) {
      return db.transaction("rw", db.ajustes, async () => {
        const ajuste = await db.ajustes.get("borrados_por_confirmar");
        if (ajuste?.clave !== "borrados_por_confirmar") return;
        const restantes = ajuste.valor.filter((id) => !ids.includes(id));
        if (restantes.length === 0) await db.ajustes.delete("borrados_por_confirmar");
        else await db.ajustes.put({ clave: "borrados_por_confirmar", valor: restantes });
      });
    },
  };
}
