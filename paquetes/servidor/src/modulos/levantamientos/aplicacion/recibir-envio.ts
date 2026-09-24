import { enviarLevantamiento, fotosReferenciadas, type Levantamiento } from "@teins/dominio";
import type { EnviarLevantamiento, ResultadoComando } from "@teins/protocolo";
import type { Actor } from "../../../plataforma/actor";
import { enOrganizacion, esViolacionUnica, type BaseDeDatos } from "../../../plataforma/base-de-datos";
import { problema } from "../../../plataforma/errores";
import {
  RESTRICCION_LEVANTAMIENTO,
  RESTRICCION_LLAVE,
  type PuertoArchivos,
  type PuertoFormatos,
  type RegistrarAuditoria,
  type RepositorioLevantamientos,
} from "./puertos";

export interface DependenciasEnvio {
  bd: BaseDeDatos;
  repositorio: RepositorioLevantamientos;
  formatos: PuertoFormatos;
  archivos: PuertoArchivos;
  registrarAuditoria: RegistrarAuditoria;
  reloj?: () => Date;
}

/** Espera sugerida cuando los archivos están en verificación: el worker suele tardar segundos. */
const SEGUNDOS_PARA_REINTENTAR = 5;

/**
 * Recibe `EnviarLevantamiento` en una sola transacción (ADR-0003, paso 4): llave de idempotencia,
 * validación completa con el validador de `dominio`, archivos verificados, agregado, auditoría y
 * resultado. Cualquier rechazo revierte todo, incluida la llave, y el dispositivo puede reintentar.
 */
export async function recibirEnvio(
  deps: DependenciasEnvio,
  actor: Actor,
  comando: EnviarLevantamiento,
  correlacion: string,
): Promise<ResultadoComando> {
  const { levantamiento: datos, llave } = comando;
  const reloj = deps.reloj ?? (() => new Date());

  try {
    return await enOrganizacion(deps.bd, actor.organizacionId, async (tx) => {
      await deps.repositorio.reservarLlave(tx, { llave, organizacionId: actor.organizacionId, usuarioId: actor.usuarioId, tipo: comando.tipo });

      const formato = await deps.formatos.obtener(tx, datos.formato, datos.versionFormato);
      if (!formato) throw problema("formato_desconocido", `${datos.formato} versión ${datos.versionFormato}`);

      // El mismo validador que corrió en el dispositivo (ADR-0010): no puede haber diferencias.
      const borrador: Levantamiento = {
        id: datos.id,
        formato: datos.formato,
        versionFormato: datos.versionFormato,
        estado: "borrador",
        respuestas: datos.respuestas,
        creadoEn: datos.creadoEn,
        actualizadoEn: datos.enviadoEn,
      };
      const envio = enviarLevantamiento(borrador, formato, new Date(datos.enviadoEn));
      if (!envio.ok) {
        throw problema("respuestas_invalidas", undefined, envio.motivo === "respuestas_invalidas" ? { errores: [...envio.errores] } : {});
      }

      // Llegada completa (QA-2): solo se registra cuando todos sus archivos están verificados.
      const huellas = fotosReferenciadas(datos.respuestas);
      const estados = await deps.archivos.estados(tx, huellas);
      const faltantes = huellas.filter((h) => {
        const estado = estados.get(h);
        return estado !== "subido" && estado !== "verificado";
      });
      if (faltantes.length > 0) throw problema("archivos_faltantes", undefined, { faltantes });
      const pendientes = huellas.filter((h) => estados.get(h) === "subido");
      if (pendientes.length > 0) {
        throw problema("archivos_en_verificacion", undefined, { pendientes, reintentarEnSegundos: SEGUNDOS_PARA_REINTENTAR });
      }

      const recibidoEn = reloj();
      await deps.repositorio.insertar(tx, {
        id: datos.id,
        organizacionId: actor.organizacionId,
        // El responsable es quien tiene la sesión, nunca lo que diga el dispositivo (regla 1).
        tecnicoId: actor.usuarioId,
        formato: datos.formato,
        versionFormato: datos.versionFormato,
        respuestas: datos.respuestas,
        cantidadFotos: huellas.length,
        creadoEnDispositivo: new Date(datos.creadoEn),
        enviadoEnDispositivo: new Date(datos.enviadoEn),
        recibidoEn,
      });

      const comun = {
        organizacionId: actor.organizacionId,
        agregadoTipo: "levantamiento" as const,
        agregadoId: datos.id,
        autorId: actor.usuarioId,
        correlacion,
      };
      // En borrador solo se registran creación y envío (ADR-0008): el detalle por campo empieza aquí.
      await deps.registrarAuditoria(tx, [
        { ...comun, tipoEvento: "levantamiento_creado", horaDispositivo: new Date(datos.creadoEn), valorNuevo: { formato: datos.formato, versionFormato: datos.versionFormato } },
        { ...comun, tipoEvento: "levantamiento_enviado", horaDispositivo: new Date(datos.enviadoEn), valorNuevo: { fotos: huellas.length } },
      ]);

      const resultado: ResultadoComando = { resultado: "aceptado", levantamientoId: datos.id, recibidoEn: recibidoEn.toISOString() };
      await deps.repositorio.guardarResultado(tx, llave, resultado);
      return resultado;
    });
  } catch (error) {
    if (esViolacionUnica(error, RESTRICCION_LLAVE)) {
      // Reintento o duplicado en vuelo: responde con el resultado guardado, igual que la primera vez.
      const previo = await enOrganizacion(deps.bd, actor.organizacionId, (tx) => deps.repositorio.comandoReservado(tx, llave));
      if (previo?.resultado && previo.usuarioId === actor.usuarioId) return previo.resultado;
      throw problema("conflicto", "Este levantamiento ya fue enviado por otra persona");
    }
    if (esViolacionUnica(error, RESTRICCION_LEVANTAMIENTO)) throw problema("conflicto", "El identificador del levantamiento ya existe");
    throw error;
  }
}
