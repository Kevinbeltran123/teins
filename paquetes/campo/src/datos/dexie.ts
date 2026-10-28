import {
  agregarFoto,
  agregarRepeticion,
  archivosReferenciados,
  claveDeRepeticion,
  enviarLevantamiento,
  esBoceto,
  esFirma,
  leerBoceto,
  LIMITES_BOCETO,
  quitarRepeticion,
  renombrarRepeticion,
  responder,
  restaurarRepeticion,
  serializarBoceto,
  sinRespuestasHuerfanas,
  TIPO_ARCHIVO_BOCETO,
  type DocumentoBoceto,
  type ErrorValidacion,
  type Levantamiento,
  type ResultadoEnvio,
  type Valor,
  type ValorFirma,
} from "@teins/dominio";
import type { Table } from "dexie";
import { llaveDeEnvio } from "@teins/protocolo/llaves";
import type { BaseCampo } from "./base";
import { DIAS_EN_LA_PAPELERA, type ArchivoGuardado, type EnvioLocal, type LevantamientoGuardado, type LevantamientoLocal } from "./modelo";
import { visitaDe } from "./lecturas";
import { abrirArchivo, abrirLevantamiento, referencias, sellarArchivo, sellarEnvio, sellarLevantamiento } from "./registros";
import { VisitaConOtroBorrador, type RepositorioLevantamientos } from "./repositorio";

export { abrirBase } from "./base";

/** Id de una repetición nueva: 8 caracteres en base 36, al azar (dominio no genera ids). */
export function nuevoIdDeRepeticion(): string {
  return [...crypto.getRandomValues(new Uint8Array(8))].map((b) => (b % 36).toString(36)).join("");
}

/** El servidor no guarda el carácter nulo y rechazaría el envío para siempre: sale del texto antes de enviar (iteración 42). */
function sinNulos<T>(valor: T): T {
  if (typeof valor === "string") return valor.replaceAll("\u0000", "") as T;
  if (Array.isArray(valor)) return valor.map(sinNulos) as T;
  if (typeof valor === "object" && valor !== null) return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, sinNulos(v)])) as T;
  return valor;
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

  /** Borra de la papelera los que cumplen `cuales`, con las fotos y dibujos que nada más usa. Devuelve cuántos. */
  function borrarDescartados(cuales: (g: LevantamientoGuardado) => boolean): Promise<number> {
    return db.transaction("rw", [db.levantamientos, db.archivos, db.envios], async () => {
      const borrados = await db.levantamientos.filter((g) => !!g.descartadoEn && cuales(g)).toArray();
      if (borrados.length === 0) return 0;
      const quedan = await db.levantamientos.filter((g) => !borrados.some((v) => v.id === g.id)).toArray();
      // Las huellas de cada levantamiento están a la vista: no hace falta abrir ninguno.
      const enUso = new Set(quedan.flatMap((g) => referencias(g).archivos));
      const huellas = [...new Set(borrados.flatMap((g) => referencias(g).archivos))].filter((h) => !enUso.has(h));
      await db.archivos.bulkDelete(huellas);
      await db.levantamientos.bulkDelete(borrados.map((g) => g.id));
      // Un envío rechazado se descarta con su levantamiento: sin él, quedaría contando como «por enviar».
      await db.envios.bulkDelete(borrados.map((g) => g.id));
      return borrados.length;
    });
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

  // Lo que el dominio deja igual (una escritura tardía a un tablero quitado) no se escribe.
  const modificar = (id: string, cambio: (l: Levantamiento) => Levantamiento) =>
    escribir(id, async (actual) => {
      const nuevo = cambio(actual);
      return nuevo === actual ? { resultado: undefined } : { resultado: undefined, levantamiento: { ...nuevo, tecnicoId: actual.tecnicoId } };
    });

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
      const nuevo = responder(actual, seccion, campo, valorDe(huella), ahora);
      if (nuevo === actual) return { resultado: undefined };
      const anterior = actual.respuestas[seccion]?.[campo];
      const huellaAnterior = esBoceto(anterior) ? anterior.boceto : esFirma(anterior) ? anterior.firma : undefined;
      const archivo = await archivoParaGuardar({ id: huella, datos: datos.buffer as ArrayBuffer, tipo: TIPO_ARCHIVO_BOCETO, creadoEn: ahora.toISOString(), subida: "pendiente" }, actual.tecnicoId);
      return {
        resultado: undefined,
        levantamiento: { ...nuevo, tecnicoId: actual.tecnicoId },
        tablas: [db.archivos],
        async enTransaccion() {
          if (!(await db.archivos.get(huella))) await db.archivos.add(archivo);
          if (huellaAnterior && huellaAnterior !== huella) {
            // Las huellas de cada levantamiento están a la vista: no hace falta abrir ninguno. Otro campo de este mismo
            // levantamiento puede tener el mismo documento (iteración 42).
            const enUso =
              archivosReferenciados(nuevo.respuestas).includes(huellaAnterior) ||
              (await db.levantamientos.toArray()).some((l) => l.id !== id && referencias(l).archivos.includes(huellaAnterior));
            if (!enUso) await db.archivos.delete(huellaAnterior);
          }
        },
      };
    });
  }

  /** Bocetos y firmas cuyo archivo pesa más de lo que recibe el servidor (iteración 42): se dicen antes de enviar. */
  async function trazosPesados(l: Levantamiento): Promise<ErrorValidacion[]> {
    const errores: ErrorValidacion[] = [];
    for (const [seccion, valores] of Object.entries(l.respuestas)) {
      for (const [campo, valor] of Object.entries(valores)) {
        const huella = esBoceto(valor) ? valor.boceto : esFirma(valor) ? valor.firma : undefined;
        const archivo = huella ? await db.archivos.get(huella) : undefined;
        if (archivo && (await abrirArchivo(db, archivo)).datos.byteLength > LIMITES_BOCETO.bytes) errores.push({ seccion, campo, codigo: "archivo_muy_grande" });
      }
    }
    return errores;
  }

  return {
    async crear(levantamiento, tecnicoId, lugar) {
      await db.levantamientos.add(await sellarLevantamiento(db, { ...levantamiento, tecnicoId, ...(lugar ? { lugar } : {}) }, 0));
    },
    obtener,
    async listar(tecnicoId) {
      const propios = await db.levantamientos.where("tecnicoId").equals(tecnicoId).filter((g) => !g.descartadoEn).toArray();
      const abiertos = await Promise.all(propios.map((g) => abrirLevantamiento(db, g)));
      return abiertos.sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn));
    },
    async descartados(tecnicoId) {
      const propios = await db.levantamientos.where("tecnicoId").equals(tecnicoId).filter((g) => !!g.descartadoEn).toArray();
      const abiertos = await Promise.all(propios.map((g) => abrirLevantamiento(db, g)));
      return abiertos.sort((a, b) => b.descartadoEn!.localeCompare(a.descartadoEn!));
    },
    descartar(id, ahora) {
      return escribir(id, async (actual) => {
        // Un borrador nunca enviado, o uno que oficina rechazó para siempre (el envío quedó en error y nunca entró):
        // lo que oficina recibió ya es suyo y no se descarta.
        const envio = await db.envios.get(id);
        const rechazado = actual.estado === "enviado" && envio?.estado === "error";
        if (actual.estado !== "borrador" && !rechazado) throw new Error("Solo se descarta un borrador o un envío rechazado");
        if (envio && !rechazado) throw new Error("Este levantamiento ya se envió");
        if (rechazado && (await db.estadosServidor.get(id))) throw new Error("Oficina ya recibió este levantamiento");
        if (!rechazado) return { resultado: undefined, levantamiento: { ...actual, descartadoEn: ahora.toISOString() } };
        return {
          resultado: undefined,
          levantamiento: { ...actual, descartadoEn: ahora.toISOString() },
          tablas: [db.envios, db.estadosServidor],
          async enTransaccion() {
            // Si en medio se reintentó o llegó a oficina, ya no se descarta (ADR-0046).
            if ((await db.envios.get(id))?.estado !== "error" || (await db.estadosServidor.get(id))) throw new Error("El envío cambió mientras se descartaba");
          },
        };
      });
    },
    recuperar(id) {
      return escribir(id, async (actual) => {
        const otroEnLaVisita =
          actual.visitaId !== undefined &&
          (await db.levantamientos.filter((g) => g.id !== id && g.visitaId === actual.visitaId && g.estado === "borrador" && !g.descartadoEn && g.tecnicoId === actual.tecnicoId).count()) > 0;
        const { descartadoEn: _d, ...sinDescarte } = actual;
        const recuperado: LevantamientoLocal = otroEnLaVisita ? { ...sinDescarte, visitaId: undefined } : sinDescarte;
        return { resultado: { suelto: otroEnLaVisita }, levantamiento: recuperado };
      });
    },
    vaciarPapelera(ahora) {
      const limite = new Date(ahora.getTime() - DIAS_EN_LA_PAPELERA * 24 * 60 * 60 * 1000).toISOString();
      return borrarDescartados((g) => g.descartadoEn! < limite);
    },
    vaciarPapeleraDe(tecnicoId) {
      return borrarDescartados((g) => g.tecnicoId === tecnicoId);
    },
    async limpiarArchivosSinUso() {
      return db.transaction("rw", [db.levantamientos, db.archivos], async () => {
        // Las huellas de cada levantamiento están a la vista, de todas las personas del teléfono y también de la papelera.
        const enUso = new Set((await db.levantamientos.toArray()).flatMap((g) => referencias(g).archivos));
        const sobran = (await db.archivos.toCollection().primaryKeys()).filter((h) => !enUso.has(h));
        await db.archivos.bulkDelete(sobran);
        return sobran.length;
      });
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
      return escribir(id, async (actual) => {
        const posicion = actual.repeticiones?.[seccion]?.findIndex((r) => r.id === repeticion) ?? -1;
        const quitada = posicion >= 0 ? actual.repeticiones![seccion]![posicion]! : undefined;
        return {
          resultado: quitada && { repeticion: { ...quitada }, posicion, respuestas: actual.respuestas[claveDeRepeticion(seccion, repeticion)] },
          levantamiento: { ...quitarRepeticion(actual, seccion, repeticion, ahora), tecnicoId: actual.tecnicoId },
        };
      });
    },
    restaurarRepeticion(id, seccion, repeticion, posicion, respuestas, ahora) {
      return modificar(id, (l) => restaurarRepeticion(l, seccion, repeticion, posicion, respuestas, ahora));
    },

    agregarFoto(id, seccion, campo, archivo, ahora) {
      return escribir(id, async (actual) => {
        const nuevo = agregarFoto(actual, seccion, campo, archivo.id, ahora);
        // Una foto que termina de procesarse después de quitar su tablero no se guarda: nada la usaría.
        if (nuevo === actual) return { resultado: undefined };
        const sellado = await archivoParaGuardar({ ...archivo, subida: "pendiente" }, actual.tecnicoId);
        return {
          resultado: undefined,
          levantamiento: { ...nuevo, tecnicoId: actual.tecnicoId },
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

    enviar(id, formato, ahora) {
      return escribir<ResultadoEnvio>(id, async (guardado) => {
        if (!guardado.tecnicoId) throw new Error("El levantamiento no tiene responsable: inicie sesión");
        const tecnicoId = guardado.tecnicoId;
        // Lo que el servidor rechazaría para siempre sin que el técnico pudiera arreglarlo sale antes (iteración 42).
        const limpio = sinRespuestasHuerfanas(guardado);
        const levantamiento = { ...limpio, respuestas: sinNulos(limpio.respuestas), ...(limpio.repeticiones ? { repeticiones: sinNulos(limpio.repeticiones) } : {}) };
        const resultado = enviarLevantamiento(levantamiento, formato, ahora);
        if (!resultado.ok) return { resultado };
        const pesados = await trazosPesados(resultado.levantamiento);
        if (pesados.length > 0) return { resultado: { ok: false, motivo: "respuestas_invalidas", errores: pesados } };
        // Un borrador de antes de la iteración 42 no lo traía: se copia de su visita, que todavía está en el teléfono.
        const visita = !levantamiento.lugar && levantamiento.visitaId ? await visitaDe(db, tecnicoId, levantamiento.visitaId) : null;
        const lugar = levantamiento.lugar ?? (visita ? { cliente: visita.cliente.nombre, sitio: visita.sitio.nombre } : undefined);
        const enviado: LevantamientoLocal = { ...resultado.levantamiento, ...(lugar ? { lugar } : {}) };
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

    volverABorrador(id) {
      return escribir(id, async (actual) => {
        // Solo lo que oficina nunca recibió (ADR-0045): un envío rechazado para siempre, sin estado del servidor.
        const envio = await db.envios.get(id);
        if (actual.estado !== "enviado" || envio?.estado !== "error" || (await db.estadosServidor.get(id))) throw new Error("Solo vuelve a borrador un envío que oficina no recibió");
        const otroEnLaVisita =
          actual.visitaId !== undefined &&
          (await db.levantamientos.filter((g) => g.id !== id && g.visitaId === actual.visitaId && g.estado === "borrador" && !g.descartadoEn && g.tecnicoId === actual.tecnicoId).count()) > 0;
        if (otroEnLaVisita) throw new VisitaConOtroBorrador();
        const { enviadoEn: _enviadoEn, ...sinEnvio } = actual;
        return {
          resultado: undefined,
          levantamiento: { ...sinEnvio, estado: "borrador" },
          tablas: [db.envios, db.estadosServidor],
          async enTransaccion() {
            // Si en medio se reintentó o llegó a oficina, ya no vuelve: no se toca.
            if ((await db.envios.get(id))?.estado !== "error" || (await db.estadosServidor.get(id))) throw new Error("El envío cambió mientras volvía a borrador");
            await db.envios.delete(id);
          },
        };
      });
    },
  };
}
