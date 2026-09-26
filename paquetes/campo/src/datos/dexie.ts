import { agregarFoto, agregarRepeticion, enviarLevantamiento, quitarRepeticion, renombrarRepeticion, responder, type Levantamiento } from "@teins/dominio";
import { llaveDeEnvio } from "@teins/protocolo/llaves";
import type { BaseCampo } from "./base";
import type { RepositorioLevantamientos } from "./repositorio";

export { abrirBase } from "./base";

/** Id de una repetición nueva: 8 caracteres en base 36, al azar (dominio no genera ids). */
export function nuevoIdDeRepeticion(): string {
  return [...crypto.getRandomValues(new Uint8Array(8))].map((b) => (b % 36).toString(36)).join("");
}

export function repositorioDexie(db: BaseCampo): RepositorioLevantamientos {
  async function modificar(id: string, cambio: (l: Levantamiento) => Levantamiento) {
    const levantamiento = await db.levantamientos.get(id);
    if (!levantamiento) throw new Error(`Levantamiento ${id} no existe en el dispositivo`);
    await db.levantamientos.put(cambio(levantamiento));
  }

  return {
    async crear(levantamiento, tecnicoId) {
      await db.levantamientos.add({ ...levantamiento, tecnicoId });
    },
    obtener: (id) => db.levantamientos.get(id),
    async listar(tecnicoId) {
      const propios = await db.levantamientos.where("tecnicoId").equals(tecnicoId).toArray();
      return propios.sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn));
    },
    async contarDeOtros(tecnicoId) {
      return db.levantamientos.filter((l) => l.tecnicoId !== undefined && l.tecnicoId !== tecnicoId).count();
    },
    asignarSinResponsable(tecnicoId) {
      return db.transaction("rw", db.levantamientos, async () => {
        await db.levantamientos.filter((l) => l.tecnicoId === undefined).modify({ tecnicoId });
      });
    },

    guardarRespuesta(id, seccion, campo, valor, ahora) {
      return db.transaction("rw", db.levantamientos, () => modificar(id, (l) => responder(l, seccion, campo, valor, ahora)));
    },

    agregarRepeticion(id, formato, seccion, ahora) {
      return db.transaction("rw", db.levantamientos, () => modificar(id, (l) => agregarRepeticion(l, formato, seccion, nuevoIdDeRepeticion(), ahora)));
    },
    renombrarRepeticion(id, seccion, repeticion, nombre, ahora) {
      return db.transaction("rw", db.levantamientos, () => modificar(id, (l) => renombrarRepeticion(l, seccion, repeticion, nombre, ahora)));
    },
    quitarRepeticion(id, seccion, repeticion, ahora) {
      return db.transaction("rw", db.levantamientos, () => modificar(id, (l) => quitarRepeticion(l, seccion, repeticion, ahora)));
    },

    agregarFoto(id, seccion, campo, archivo, ahora) {
      return db.transaction("rw", db.levantamientos, db.archivos, async () => {
        // Direccionado por contenido: la misma foto dos veces es un solo archivo, y su estado de subida se conserva.
        if (!(await db.archivos.get(archivo.id))) await db.archivos.add({ ...archivo, subida: "pendiente" });
        await modificar(id, (l) => agregarFoto(l, seccion, campo, archivo.id, ahora));
      });
    },

    async obtenerArchivos(ids) {
      const archivos = await db.archivos.bulkGet([...ids]);
      return archivos.filter((a) => a !== undefined);
    },
    todosLosArchivos: () => db.archivos.toArray(),
    todos: () => db.levantamientos.toArray(),

    enviar(id, formato, ahora) {
      return db.transaction("rw", db.levantamientos, db.envios, async () => {
        const levantamiento = await db.levantamientos.get(id);
        if (!levantamiento) throw new Error(`Levantamiento ${id} no existe en el dispositivo`);
        if (!levantamiento.tecnicoId) throw new Error("El levantamiento no tiene responsable: inicie sesión");
        const tecnicoId = levantamiento.tecnicoId;
        const resultado = enviarLevantamiento(levantamiento, formato, ahora);
        if (!resultado.ok) return resultado;
        const enviado = resultado.levantamiento;
        await db.levantamientos.put(enviado);
        await db.envios.add({
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
        });
        return resultado;
      });
    },

    async reintentarEnvio(id) {
      await db.envios.update(id, { estado: "pendiente", proximoIntentoEn: 0, intentos: 0 });
    },
  };
}
