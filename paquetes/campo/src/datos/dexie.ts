import {
  agregarFoto,
  agregarRepeticion,
  archivosReferenciados,
  enviarLevantamiento,
  esBoceto,
  esFirma,
  leerBoceto,
  quitarRepeticion,
  renombrarRepeticion,
  responder,
  serializarBoceto,
  TIPO_ARCHIVO_BOCETO,
  type DocumentoBoceto,
  type Levantamiento,
  type ResultadoEnvio,
  type Valor,
  type ValorFirma,
} from "@teins/dominio";
import type { Table } from "dexie";
import { llaveDeEnvio } from "@teins/protocolo/llaves";
import type { BaseCampo } from "./base";
import type { ArchivoGuardado, EnvioLocal, LevantamientoGuardado, LevantamientoLocal } from "./modelo";
import { abrirArchivo, abrirLevantamiento, referencias, sellarArchivo, sellarEnvio, sellarLevantamiento } from "./registros";
import type { RepositorioLevantamientos } from "./repositorio";

export { abrirBase } from "./base";

/** Id de una repetición nueva: 8 caracteres en base 36, al azar (dominio no genera ids). */
export function nuevoIdDeRepeticion(): string {
  return [...crypto.getRandomValues(new Uint8Array(8))].map((b) => (b % 36).toString(36)).join("");
}

/** Reintentos de una escritura optimista: otra pestaña escribiendo el mismo levantamiento es rara. */
const INTENTOS_DE_ESCRITURA = 5;

/** Lo que una escritura hace sobre el levantamiento y, en la misma transacción, sobre otras tablas. */
interface Cambio<T> {
  resultado: T;
  /** Sin levantamiento nuevo no se escribe nada (por ejemplo, un envío con obligatorios pendientes). */
  levantamiento?: LevantamientoLocal;
  tablas?: Table[];
  /** Escrituras ya selladas que van en la transacción del levantamiento. */
  enTransaccion?: () => Promise<void>;
}

export function repositorioDexie(db: BaseCampo): RepositorioLevantamientos {
  async function obtener(id: string): Promise<LevantamientoLocal | undefined> {
    const g = await db.levantamientos.get(id);
    return g ? abrirLevantamiento(db, g) : undefined;
  }

  /**
   * En esta pestaña, las escrituras de un levantamiento van en fila y en el orden en que se pidieron:
   * la última tecla escrita es la que queda. Entre pestañas decide la comprobación optimista.
   */
  const filas = new Map<string, Promise<unknown>>();
  function enFila<T>(id: string, tarea: () => Promise<T>): Promise<T> {
    const anterior = filas.get(id) ?? Promise.resolve();
    const esta = anterior.catch(() => undefined).then(tarea);
    const cola = esta.catch(() => undefined);
    filas.set(id, cola);
    void cola.then(() => {
      if (filas.get(id) === cola) filas.delete(id);
    });
    return esta;
  }

  /**
   * Escritura optimista (ADR-0022): se abre, se calcula y se sella fuera de la transacción; dentro solo
   * se comprueba que nadie escribió entre tanto (`rev`) y se guarda todo junto. Si otra pestaña escribió,
   * se repite sobre lo nuevo: ninguna escritura pisa a otra.
   */
  function escribir<T>(id: string, preparar: (actual: LevantamientoLocal, guardado: LevantamientoGuardado) => Promise<Cambio<T>>): Promise<T> {
    return enFila(id, () => escribirYa(id, preparar));
  }

  async function escribirYa<T>(id: string, preparar: (actual: LevantamientoLocal, guardado: LevantamientoGuardado) => Promise<Cambio<T>>): Promise<T> {
    for (let intento = 0; intento < INTENTOS_DE_ESCRITURA; intento++) {
      const guardado = await db.levantamientos.get(id);
      if (!guardado) throw new Error(`Levantamiento ${id} no existe en el dispositivo`);
      const rev = guardado.rev ?? 0;
      const cambio = await preparar(await abrirLevantamiento(db, guardado), guardado);
      if (!cambio.levantamiento) return cambio.resultado;
      const nuevo = await sellarLevantamiento(db, cambio.levantamiento, rev + 1);
      const escrito = await db.transaction("rw", [db.levantamientos, ...(cambio.tablas ?? [])], async () => {
        const actual = await db.levantamientos.get(id);
        if (!actual) throw new Error(`Levantamiento ${id} no existe en el dispositivo`);
        if ((actual.rev ?? 0) !== rev) return false;
        await cambio.enTransaccion?.();
        await db.levantamientos.put(nuevo);
        return true;
      });
      if (escrito) return cambio.resultado;
    }
    throw new Error(`No se pudo guardar el levantamiento ${id}: cambió ${INTENTOS_DE_ESCRITURA} veces seguidas`);
  }

  const modificar = (id: string, cambio: (l: Levantamiento) => Levantamiento) =>
    escribir(id, async (actual) => ({ resultado: undefined, levantamiento: { ...cambio(actual), tecnicoId: actual.tecnicoId } }));

  /** El archivo se sella con la clave de quien tiene el levantamiento; si ya estaba, se conserva como está. */
  async function archivoParaGuardar(archivo: Omit<ArchivoGuardado, "iv" | "tecnicoId" | "cifrado">, tecnicoId: string | undefined) {
    return sellarArchivo(db, archivo, tecnicoId);
  }

  /**
   * Un documento de trazos (boceto o firma) como archivo por su huella, y la respuesta que apunta a él, en una
   * transacción. El documento anterior se borra si nada más lo usa. No sube hasta enviar (ADR-0019, ADR-0024).
   */
  async function guardarTrazos(id: string, seccion: string, campo: string, documento: DocumentoBoceto, valorDe: (huella: string) => Valor, ahora: Date): Promise<void> {
    // La huella se calcula antes: una transacción de IndexedDB no puede esperar otra cosa que a sí misma.
    const datos = new TextEncoder().encode(serializarBoceto(documento));
    const huella = [...new Uint8Array(await crypto.subtle.digest("SHA-256", datos))].map((b) => b.toString(16).padStart(2, "0")).join("");
    await escribir(id, async (actual) => {
      const anterior = actual.respuestas[seccion]?.[campo];
      const huellaAnterior = esBoceto(anterior) ? anterior.boceto : esFirma(anterior) ? anterior.firma : undefined;
      const archivo = await archivoParaGuardar({ id: huella, datos: datos.buffer as ArrayBuffer, tipo: TIPO_ARCHIVO_BOCETO, creadoEn: ahora.toISOString(), subida: "pendiente" }, actual.tecnicoId);
      return {
        resultado: undefined,
        levantamiento: { ...responder(actual, seccion, campo, valorDe(huella), ahora), tecnicoId: actual.tecnicoId },
        tablas: [db.archivos],
        async enTransaccion() {
          if (!(await db.archivos.get(huella))) await db.archivos.add(archivo);
          if (huellaAnterior && huellaAnterior !== huella) {
            // Las huellas de cada levantamiento están a la vista: no hace falta abrir ninguno.
            const enUso = (await db.levantamientos.toArray()).some((l) => l.id !== id && referencias(l).archivos.includes(huellaAnterior));
            if (!enUso) await db.archivos.delete(huellaAnterior);
          }
        },
      };
    });
  }

  return {
    async crear(levantamiento, tecnicoId) {
      await db.levantamientos.add(await sellarLevantamiento(db, { ...levantamiento, tecnicoId }, 0));
    },
    obtener,
    async listar(tecnicoId) {
      const propios = await db.levantamientos.where("tecnicoId").equals(tecnicoId).toArray();
      const abiertos = await Promise.all(propios.map((g) => abrirLevantamiento(db, g)));
      return abiertos.sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn));
    },
    async contarDeOtros(tecnicoId) {
      return db.levantamientos.filter((l) => l.tecnicoId !== undefined && l.tecnicoId !== tecnicoId).count();
    },
    asignarSinResponsable(tecnicoId) {
      // Quedan a la vista hasta que la siguiente pasada de `sellarPendientes` los selle con su clave.
      return db.transaction("rw", db.levantamientos, async () => {
        await db.levantamientos.filter((l) => l.tecnicoId === undefined).modify((l) => {
          l.tecnicoId = tecnicoId;
          l.rev = (l.rev ?? 0) + 1;
        });
      });
    },

    guardarRespuesta(id, seccion, campo, valor, ahora) {
      return modificar(id, (l) => responder(l, seccion, campo, valor, ahora));
    },

    guardarBoceto(id, seccion, campo, documento, ahora) {
      return guardarTrazos(id, seccion, campo, documento, (huella) => ({ boceto: huella }), ahora);
    },

    guardarFirma(id, seccion, campo, documento, { nombre, cargo, declaracion }, ahora) {
      const valor = (huella: string): ValorFirma => ({ firma: huella, nombre: nombre.trim(), ...(cargo?.trim() ? { cargo: cargo.trim() } : {}), firmadoEn: ahora.toISOString(), declaracion });
      return guardarTrazos(id, seccion, campo, documento, valor, ahora);
    },

    async obtenerBoceto(huella) {
      const archivo = await db.archivos.get(huella);
      return archivo ? leerBoceto(new TextDecoder().decode((await abrirArchivo(db, archivo)).datos)) : null;
    },

    agregarRepeticion(id, formato, seccion, ahora) {
      return modificar(id, (l) => agregarRepeticion(l, formato, seccion, nuevoIdDeRepeticion(), ahora));
    },
    renombrarRepeticion(id, seccion, repeticion, nombre, ahora) {
      return modificar(id, (l) => renombrarRepeticion(l, seccion, repeticion, nombre, ahora));
    },
    quitarRepeticion(id, seccion, repeticion, ahora) {
      return modificar(id, (l) => quitarRepeticion(l, seccion, repeticion, ahora));
    },

    agregarFoto(id, seccion, campo, archivo, ahora) {
      return escribir(id, async (actual) => {
        const sellado = await archivoParaGuardar({ ...archivo, subida: "pendiente" }, actual.tecnicoId);
        return {
          resultado: undefined,
          levantamiento: { ...agregarFoto(actual, seccion, campo, archivo.id, ahora), tecnicoId: actual.tecnicoId },
          tablas: [db.archivos],
          async enTransaccion() {
            // Direccionado por contenido: la misma foto dos veces es un solo archivo, y su estado de subida se conserva.
            if (!(await db.archivos.get(archivo.id))) await db.archivos.add(sellado);
          },
        };
      });
    },

    quitarFoto(id, seccion, campo, huella, ahora) {
      return escribir(id, async (actual) => {
        const fotos = actual.respuestas[seccion]?.[campo];
        if (!Array.isArray(fotos) || !fotos.includes(huella)) return { resultado: undefined };
        const restantes = (fotos as readonly string[]).filter((f) => f !== huella);
        const nuevo: LevantamientoLocal = { ...responder(actual, seccion, campo, restantes.length > 0 ? restantes : undefined, ahora), tecnicoId: actual.tecnicoId };
        return {
          resultado: undefined,
          levantamiento: nuevo,
          tablas: [db.archivos],
          async enTransaccion() {
            // Las huellas de cada levantamiento están a la vista: no hace falta abrir ninguno.
            const enUso =
              archivosReferenciados(nuevo.respuestas).includes(huella) ||
              (await db.levantamientos.toArray()).some((l) => l.id !== id && referencias(l).archivos.includes(huella));
            if (!enUso) await db.archivos.delete(huella);
          },
        };
      });
    },

    async obtenerArchivos(ids) {
      const archivos = (await db.archivos.bulkGet([...ids])).filter((a) => a !== undefined);
      return Promise.all(archivos.map((a) => abrirArchivo(db, a)));
    },
    todosLosArchivos: async () => Promise.all((await db.archivos.toArray()).map((a) => abrirArchivo(db, a))),
    todos: async () => Promise.all((await db.levantamientos.toArray()).map((g) => abrirLevantamiento(db, g))),

    enviar(id, formato, ahora) {
      return escribir<ResultadoEnvio>(id, async (levantamiento) => {
        if (!levantamiento.tecnicoId) throw new Error("El levantamiento no tiene responsable: inicie sesión");
        const tecnicoId = levantamiento.tecnicoId;
        const resultado = enviarLevantamiento(levantamiento, formato, ahora);
        if (!resultado.ok) return { resultado };
        const enviado = resultado.levantamiento;
        const envio: EnvioLocal = {
          levantamientoId: id,
          tecnicoId,
          comando: {
            tipo: "EnviarLevantamiento",
            llave: llaveDeEnvio(id),
            levantamiento: {
              id,
              formato: enviado.formato,
              versionFormato: enviado.versionFormato,
              // Sin visita solo los borradores de los cortes 0 y 1 (ADR-0015, expansión).
              ...(enviado.visitaId ? { visitaId: enviado.visitaId } : {}),
              respuestas: enviado.respuestas,
              // Solo con secciones repetibles: un levantamiento sin ellas viaja igual que antes (ADR-0015).
              ...(enviado.repeticiones ? { repeticiones: enviado.repeticiones } : {}),
              creadoEn: enviado.creadoEn,
              enviadoEn: enviado.enviadoEn!,
            },
          },
          estado: "pendiente",
          intentos: 0,
          proximoIntentoEn: ahora.getTime(),
          creadoEn: ahora.toISOString(),
        };
        const sellado = await sellarEnvio(db, envio);
        // Borrador → Enviado y el comando al outbox en la misma transacción (ADR-0018, nivel 3).
        return { resultado, levantamiento: { ...enviado, tecnicoId }, tablas: [db.envios], enTransaccion: async () => void (await db.envios.add(sellado)) };
      });
    },

    async reintentarEnvio(id) {
      await db.envios.update(id, { estado: "pendiente", proximoIntentoEn: 0, intentos: 0 });
    },
  };
}
