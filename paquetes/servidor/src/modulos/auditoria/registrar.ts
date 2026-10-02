import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { BaseDeDatos, TxOrganizacion } from "../../plataforma/base-de-datos";
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
  | "visita_terminada"
  | "cliente_creado"
  | "sitio_agregado"
  | "contacto_creado"
  | "contacto_editado"
  | "contacto_quitado"
  | "item_catalogo_creado"
  | "item_catalogo_actualizado"
  | "precio_cambiado"
  | "catalogo_importado"
  | "linea_vinculada"
  | "usuario_desactivado"
  | "usuario_reactivado"
  | "usuario_creado"
  | "contrasena_restablecida"
  | "administrador_cambiado"
  | "segundo_factor_activado"
  | "llave_de_acceso_creada"
  | "llave_de_acceso_quitada"
  | "contrasena_cambiada"
  | "segundo_factor_quitado"
  | "borrado_local_confirmado"
  | "revision_tomada"
  | "revision_reasignada"
  | "campo_corregido"
  | "levantamiento_revisado"
  | "comentario_agregado"
  | "informe_publicado"
  | "version_retirada"
  | "informe_enviado"
  | "envio_cancelado"
  | "envio_reanudado"
  | "cliente_editado"
  | "cliente_archivado"
  | "cliente_recuperado"
  | "sitio_editado"
  | "sitio_archivado"
  | "sitio_recuperado"
  | "comentario_editado"
  | "comentario_retirado"
  | "comentario_restaurado"
  | "cotizacion_creada"
  | "cotizacion_publicada"
  | "cotizacion_enviada"
  | "acceso_cliente_creado"
  | "acceso_cliente_regenerado"
  | "ingreso_portal"
  | "descarga_portal";
export type TipoAgregado = "levantamiento" | "organizacion" | "visita" | "usuario" | "informe" | "acceso_cliente" | "cliente" | "item_catalogo" | "cotizacion";

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

/**
 * La cadena de un agregado, en orden, y si está íntegra: el historial legible que ve oficina (ADR-0008).
 * Se lee una sola vez para mostrarla y verificarla.
 */
export async function leerCadena(
  tx: TxOrganizacion,
  organizacionId: string,
  agregadoTipo: TipoAgregado,
  agregadoId: string,
): Promise<{ eventos: RegistroLeido[]; verificacion: ResultadoVerificacion }> {
  const filas = await filasDeCadena(tx, organizacionId, agregadoTipo, agregadoId);
  return {
    eventos: filas.map((f) => ({
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
    })),
    verificacion: verificar(filas),
  };
}

/** Recalcula la cadena de un agregado y reporta el primer eslabón roto (ADR-0008). */
export async function verificarCadena(
  tx: TxOrganizacion,
  organizacionId: string,
  agregadoTipo: TipoAgregado,
  agregadoId: string,
): Promise<ResultadoVerificacion> {
  return verificar(await filasDeCadena(tx, organizacionId, agregadoTipo, agregadoId));
}

const filasDeCadena = (tx: TxOrganizacion, organizacionId: string, agregadoTipo: TipoAgregado, agregadoId: string) =>
  tx
    .select()
    .from(registros)
    .where(and(eq(registros.organizacionId, organizacionId), eq(registros.agregadoTipo, agregadoTipo), eq(registros.agregadoId, agregadoId)))
    .orderBy(asc(registros.secuencia));

function verificar(filas: (typeof registros.$inferSelect)[]): ResultadoVerificacion {
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

/**
 * Todas las cadenas de la base, para verificarlas después de restaurar una copia (ADR-0016, nivel 4).
 * Solo con la conexión del dueño: la seguridad por fila no deja ver otras organizaciones.
 */
export async function todasLasCadenas(bd: BaseDeDatos): Promise<{ organizacionId: string; agregadoTipo: TipoAgregado; agregadoId: string }[]> {
  const filas = await bd
    .selectDistinct({ organizacionId: registros.organizacionId, agregadoTipo: registros.agregadoTipo, agregadoId: registros.agregadoId })
    .from(registros)
    .orderBy(registros.organizacionId, registros.agregadoTipo, registros.agregadoId);
  return filas.map((f) => ({ ...f, agregadoTipo: f.agregadoTipo as TipoAgregado }));
}
