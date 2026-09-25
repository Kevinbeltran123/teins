import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { TxOrganizacion } from "../../plataforma/base-de-datos";
import { calcularHash, VERSION_FORMATO_REGISTRO, type ContenidoRegistro } from "./cadena";
import { registros } from "./esquema";

export type TipoEvento =
  | "levantamiento_creado"
  | "levantamiento_enviado"
  | "inicio_de_sesion"
  | "visita_creada"
  | "visita_reasignada"
  | "visita_reprogramada"
  | "visita_cancelada"
  | "cliente_creado"
  | "sitio_agregado"
  | "usuario_desactivado"
  | "usuario_creado"
  | "contrasena_restablecida"
  | "administrador_cambiado"
  | "segundo_factor_activado"
  | "segundo_factor_desactivado"
  | "borrado_local_confirmado"
  | "revision_tomada"
  | "revision_reasignada"
  | "campo_corregido"
  | "levantamiento_revisado"
  | "comentario_agregado"
  | "informe_publicado"
  | "version_retirada"
  | "acceso_cliente_creado"
  | "acceso_cliente_regenerado"
  | "ingreso_portal"
  | "descarga_portal";
export type TipoAgregado = "levantamiento" | "organizacion" | "visita" | "usuario" | "informe" | "acceso_cliente" | "cliente";

export interface EntradaAuditoria {
  organizacionId: string;
  agregadoTipo: TipoAgregado;
  agregadoId: string;
  tipoEvento: TipoEvento;
  autorId: string;
  correlacion: string;
  rutaCampo?: string;
  valorAnterior?: unknown;
  valorNuevo?: unknown;
  horaDispositivo?: Date;
  motivo?: string;
}

/**
 * Registra eventos en la misma transacción del cambio que describen. Si la transacción se
 * revierte, el registro tampoco existe. Un bloqueo por cadena serializa solo esa cadena.
 */
export async function registrar(tx: TxOrganizacion, entradas: readonly EntradaAuditoria[], ahora = new Date()): Promise<void> {
  const porCadena = Map.groupBy(entradas, (e) => `${e.agregadoTipo}:${e.agregadoId}`);
  for (const [llave, grupo] of porCadena) {
    const { organizacionId, agregadoTipo, agregadoId } = grupo[0]!;
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${organizacionId}:${llave}`}, 0))`);
    const [ultimo] = await tx
      .select({ secuencia: registros.secuencia, hash: registros.hash })
      .from(registros)
      .where(and(eq(registros.organizacionId, organizacionId), eq(registros.agregadoTipo, agregadoTipo), eq(registros.agregadoId, agregadoId)))
      .orderBy(desc(registros.secuencia))
      .limit(1);

    let secuencia = ultimo?.secuencia ?? 0;
    let hashAnterior = ultimo?.hash ?? null;
    for (const e of grupo) {
      secuencia++;
      const contenido: ContenidoRegistro = {
        organizacionId,
        agregadoTipo,
        agregadoId,
        secuencia,
        tipoEvento: e.tipoEvento,
        rutaCampo: e.rutaCampo ?? null,
        valorAnterior: e.valorAnterior ?? null,
        valorNuevo: e.valorNuevo ?? null,
        autorId: e.autorId,
        horaServidor: ahora,
        horaDispositivo: e.horaDispositivo ?? null,
        correlacion: e.correlacion,
        motivo: e.motivo ?? null,
      };
      const hash = calcularHash(VERSION_FORMATO_REGISTRO, contenido, hashAnterior);
      await tx.insert(registros).values({
        id: randomUUID(),
        ...contenido,
        versionFormatoRegistro: VERSION_FORMATO_REGISTRO,
        hashAnterior,
        hash,
      });
      hashAnterior = hash;
    }
  }
}

export type ResultadoVerificacion = { integra: true; eslabones: number } | { integra: false; primerEslabonRoto: number };

export interface RegistroLeido {
  secuencia: number;
  tipoEvento: string;
  rutaCampo: string | null;
  valorAnterior: unknown;
  valorNuevo: unknown;
  autorId: string;
  horaServidor: Date;
  horaDispositivo: Date | null;
  correlacion: string;
  motivo: string | null;
}

/** La cadena de un agregado, en orden: el historial legible que ve oficina (ADR-0008). */
export async function leerCadena(tx: TxOrganizacion, organizacionId: string, agregadoTipo: TipoAgregado, agregadoId: string): Promise<RegistroLeido[]> {
  return tx
    .select({
      secuencia: registros.secuencia,
      tipoEvento: registros.tipoEvento,
      rutaCampo: registros.rutaCampo,
      valorAnterior: registros.valorAnterior,
      valorNuevo: registros.valorNuevo,
      autorId: registros.autorId,
      horaServidor: registros.horaServidor,
      horaDispositivo: registros.horaDispositivo,
      correlacion: registros.correlacion,
      motivo: registros.motivo,
    })
    .from(registros)
    .where(and(eq(registros.organizacionId, organizacionId), eq(registros.agregadoTipo, agregadoTipo), eq(registros.agregadoId, agregadoId)))
    .orderBy(asc(registros.secuencia));
}

/** Recalcula la cadena de un agregado y reporta el primer eslabón roto (ADR-0008). */
export async function verificarCadena(
  tx: TxOrganizacion,
  organizacionId: string,
  agregadoTipo: TipoAgregado,
  agregadoId: string,
): Promise<ResultadoVerificacion> {
  const filas = await tx
    .select()
    .from(registros)
    .where(and(eq(registros.organizacionId, organizacionId), eq(registros.agregadoTipo, agregadoTipo), eq(registros.agregadoId, agregadoId)))
    .orderBy(asc(registros.secuencia));

  let hashAnterior: Buffer | null = null;
  for (const [i, f] of filas.entries()) {
    // Solo el contenido firmado: nunca id, hash ni versión, que no forman parte de la serialización.
    const contenido: ContenidoRegistro = {
      organizacionId: f.organizacionId,
      agregadoTipo: f.agregadoTipo,
      agregadoId: f.agregadoId,
      secuencia: f.secuencia,
      tipoEvento: f.tipoEvento,
      rutaCampo: f.rutaCampo,
      valorAnterior: f.valorAnterior,
      valorNuevo: f.valorNuevo,
      autorId: f.autorId,
      horaServidor: f.horaServidor,
      horaDispositivo: f.horaDispositivo,
      correlacion: f.correlacion,
      motivo: f.motivo,
    };
    const esperado = calcularHash(f.versionFormatoRegistro, contenido, hashAnterior);
    const encadenado = (f.hashAnterior === null && hashAnterior === null) || (f.hashAnterior !== null && hashAnterior !== null && f.hashAnterior.equals(hashAnterior));
    if (f.secuencia !== i + 1 || !encadenado || !esperado.equals(f.hash)) return { integra: false, primerEslabonRoto: i + 1 };
    hashAnterior = f.hash;
  }
  return { integra: true, eslabones: filas.length };
}
