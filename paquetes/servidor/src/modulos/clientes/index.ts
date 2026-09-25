import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import type { TxOrganizacion } from "../../plataforma/base-de-datos";
import { clientes, sitios } from "./esquema";

export interface Sitio {
  id: string;
  clienteId: string;
  cliente: string;
  nombre: string;
  direccion: string;
}

export interface NuevoCliente {
  organizacionId: string;
  nombre: string;
  sitio: { nombre: string; direccion: string };
}

/**
 * Interfaz pública del módulo de clientes (soporte, capas simples). Por ahora solo se crean por
 * comando; las pantallas de oficina llegan con la gestión de visitas y clientes.
 */
export const clientesYSitios = {
  async crear(tx: TxOrganizacion, { organizacionId, nombre, sitio }: NuevoCliente): Promise<{ clienteId: string; sitioId: string }> {
    const clienteId = randomUUID();
    const sitioId = randomUUID();
    await tx.insert(clientes).values({ id: clienteId, organizacionId, nombre: nombre.trim() });
    await tx.insert(sitios).values({ id: sitioId, organizacionId, clienteId, nombre: sitio.nombre.trim(), direccion: sitio.direccion.trim() });
    return { clienteId, sitioId };
  },

  async obtener(tx: TxOrganizacion, id: string): Promise<{ id: string; nombre: string } | undefined> {
    const [fila] = await tx.select({ id: clientes.id, nombre: clientes.nombre }).from(clientes).where(eq(clientes.id, id));
    return fila;
  },

  async sitios(tx: TxOrganizacion, ids: readonly string[]): Promise<Map<string, Sitio>> {
    if (ids.length === 0) return new Map();
    const filas = await tx
      .select({ id: sitios.id, clienteId: sitios.clienteId, cliente: clientes.nombre, nombre: sitios.nombre, direccion: sitios.direccion })
      .from(sitios)
      .innerJoin(clientes, eq(clientes.id, sitios.clienteId))
      .where(inArray(sitios.id, [...ids]));
    return new Map(filas.map((f) => [f.id, f]));
  },
};

export type ClientesYSitios = typeof clientesYSitios;
