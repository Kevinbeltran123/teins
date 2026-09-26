import { archivosReferenciados, fotosReferenciadas } from "@teins/dominio";
import type { Bajada, SaludDispositivo } from "@teins/protocolo";
import type { BaseCampo } from "../datos/base";
import type { ArchivoLocal, BajadaLocal, DispositivoLocal, EnvioLocal } from "../datos/modelo";
import { estadoAlmacenamiento } from "../dispositivo/almacenamiento";

/** Operaciones del motor sobre la base local. */
export interface AlmacenSincronizacion {
  /** Fotos pendientes de los levantamientos de este técnico: nunca se suben con la sesión de otro. */
  archivosPorSubir(tecnicoId: string): Promise<ArchivoLocal[]>;
  marcarSubida(huella: string): Promise<void>;
  registrarErrorDeSubida(huella: string, mensaje: string): Promise<void>;
  marcarPorSubir(huellas: readonly string[]): Promise<void>;
  enviosListos(ahora: number, tecnicoId: string): Promise<EnvioLocal[]>;
  /** Cuándo toca el próximo intento pendiente de este técnico, o null si no hay nada que esperar. */
  proximoIntento(tecnicoId: string): Promise<number | null>;
  actualizarEnvio(levantamientoId: string, cambios: Partial<EnvioLocal>): Promise<void>;
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
  /** Permiso recibido al iniciar sesión; no toca el punto de control. */
  renovarPermiso(tecnicoId: string, permisoLocalHasta: string, versionApp: number): Promise<void>;
  marcarSesionVencida(tecnicoId: string): Promise<void>;
  /**
   * Orden de borrado (ADR-0009, QA-5): borra todo lo del usuario revocado en una transacción, sin tocar
   * lo de otro usuario del mismo teléfono, y deja pendiente avisarle al servidor.
   */
  borrarDatosDe(tecnicoId: string, ahora: string): Promise<void>;
  borradosPorConfirmar(): Promise<string[]>;
  quitarConfirmados(ids: readonly string[]): Promise<void>;
}

/** 32 bytes aleatorios en base64url. */
function secretoAleatorio(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function almacenDexie(db: BaseCampo): AlmacenSincronizacion {
  return {
    async archivosPorSubir(tecnicoId) {
      const propios = await db.levantamientos.where("tecnicoId").equals(tecnicoId).toArray();
      // Las fotos suben por adelantado; los bocetos, solo del levantamiento ya enviado (ADR-0019, parte 3).
      const huellas = new Set(propios.flatMap((l) => (l.estado === "borrador" ? fotosReferenciadas(l.respuestas) : archivosReferenciados(l.respuestas))));
      const pendientes = await db.archivos.where("subida").equals("pendiente").toArray();
      return pendientes.filter((a) => huellas.has(a.id));
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
      return pendientes.filter((e) => e.proximoIntentoEn <= ahora).sort((a, b) => a.creadoEn.localeCompare(b.creadoEn));
    },
    async proximoIntento(tecnicoId) {
      const pendientes = await db.envios.where("estado").equals("pendiente").filter((e) => e.tecnicoId === tecnicoId).toArray();
      return pendientes.length === 0 ? null : Math.min(...pendientes.map((e) => e.proximoIntentoEn));
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

    aplicarBajada(tecnicoId, bajada, versionApp, ahora) {
      return db.transaction("rw", [db.formatos, db.visitas, db.estadosServidor, db.bajadas, db.levantamientos], async () => {
        for (const cambio of bajada.cambios) {
          switch (cambio.tipo) {
            case "formato":
              await db.formatos.put(cambio.definicion);
              break;
            case "visita":
              await db.visitas.put({ ...cambio.visita, tecnicoId });
              break;
            case "fuera_de_alcance": {
              const empezados = await db.levantamientos.where("tecnicoId").equals(tecnicoId).filter((l) => l.visitaId === cambio.id).count();
              if (empezados > 0) await db.visitas.update([tecnicoId, cambio.id], { fueraDeAlcance: true, ...(cambio.motivo ? { motivoSalida: cambio.motivo } : {}) });
              else await db.visitas.delete([tecnicoId, cambio.id]);
              break;
            }
            case "levantamiento":
              await db.estadosServidor.put({ id: cambio.id, tecnicoId, estado: cambio.estado, recibidoEn: cambio.recibidoEn, comentarios: cambio.comentarios });
              break;
          }
        }
        await db.bajadas.put({ tecnicoId, puntoDeControl: bajada.puntoDeControl, versionApp, ultimaEn: ahora, permisoLocalHasta: bajada.permisoLocalHasta });
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

    borrarDatosDe(tecnicoId, ahora) {
      const tablas = [db.levantamientos, db.archivos, db.envios, db.visitas, db.estadosServidor, db.bajadas, db.ajustes];
      return db.transaction("rw", tablas, async () => {
        const propios = await db.levantamientos.where("tecnicoId").equals(tecnicoId).toArray();
        const deOtros = await db.levantamientos.filter((l) => l.tecnicoId !== tecnicoId).toArray();
        // Los archivos se direccionan por contenido: uno que también usa otra persona se conserva.
        const enUso = new Set(deOtros.flatMap((l) => archivosReferenciados(l.respuestas)));
        await db.archivos.bulkDelete(propios.flatMap((l) => archivosReferenciados(l.respuestas)).filter((h) => !enUso.has(h)));
        await db.levantamientos.bulkDelete(propios.map((l) => l.id));
        await db.envios.where("tecnicoId").equals(tecnicoId).delete();
        await db.visitas.where("tecnicoId").equals(tecnicoId).delete();
        await db.estadosServidor.where("tecnicoId").equals(tecnicoId).delete();
        await db.bajadas.delete(tecnicoId);

        const usuario = await db.ajustes.get("usuario");
        if (usuario?.clave === "usuario" && usuario.valor.id === tecnicoId) {
          await db.ajustes.delete("usuario");
          await db.ajustes.put({ clave: "acceso_cerrado", valor: { nombre: usuario.valor.nombre, en: ahora } });
        }
        const pendientes = await db.ajustes.get("borrados_por_confirmar");
        const lista = pendientes?.clave === "borrados_por_confirmar" ? pendientes.valor : [];
        if (!lista.includes(tecnicoId)) await db.ajustes.put({ clave: "borrados_por_confirmar", valor: [...lista, tecnicoId] });
      });
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
