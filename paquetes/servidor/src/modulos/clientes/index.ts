import { randomUUID } from "node:crypto";
import { asc, eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { enOrganizacion, type BaseDeDatos, type TxOrganizacion } from "../../plataforma/base-de-datos";
import { problema } from "../../plataforma/errores";
import { politicas } from "../../plataforma/politicas";
import { registrarOperacion } from "../../plataforma/rutas";
import { registrar } from "../auditoria";
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

export interface ClienteConSitios {
  id: string;
  nombre: string;
  sitios: { id: string; nombre: string; direccion: string }[];
}

/**
 * Interfaz pública del módulo de clientes (soporte, capas simples). Oficina los crea desde su
 * pantalla (iteración 7) o con el comando `crear-cliente`.
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

  async listar(tx: TxOrganizacion): Promise<{ id: string; nombre: string }[]> {
    return tx.select({ id: clientes.id, nombre: clientes.nombre }).from(clientes).orderBy(asc(clientes.nombre));
  },

  async agregarSitio(tx: TxOrganizacion, { organizacionId, clienteId, nombre, direccion }: { organizacionId: string; clienteId: string; nombre: string; direccion: string }): Promise<string> {
    const id = randomUUID();
    await tx.insert(sitios).values({ id, organizacionId, clienteId, nombre: nombre.trim(), direccion: direccion.trim() });
    return id;
  },

  /** Clientes con sus sitios, por nombre; `ids` limita a esos clientes. */
  async conSitios(tx: TxOrganizacion, ids?: readonly string[]): Promise<ClienteConSitios[]> {
    const lista = await tx
      .select({ id: clientes.id, nombre: clientes.nombre })
      .from(clientes)
      .where(ids ? inArray(clientes.id, [...ids]) : undefined)
      .orderBy(asc(clientes.nombre));
    if (lista.length === 0) return [];
    const deEllos = await tx
      .select({ id: sitios.id, clienteId: sitios.clienteId, nombre: sitios.nombre, direccion: sitios.direccion })
      .from(sitios)
      .where(inArray(sitios.clienteId, lista.map((c) => c.id)))
      .orderBy(asc(sitios.nombre));
    return lista.map((c) => ({ ...c, sitios: deEllos.filter((s) => s.clienteId === c.id).map(({ id, nombre, direccion }) => ({ id, nombre, direccion })) }));
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

/** Operaciones de oficina sobre clientes y sitios (iteración 7). */
export function registrarRutasDeClientes(app: FastifyInstance, bd: BaseDeDatos): void {
  registrarOperacion(app, "listarClientes", {
    politica: politicas.oficina,
    manejar: async ({ actor }) => ({ clientes: await enOrganizacion(bd, actor.organizacionId, (tx) => clientesYSitios.conSitios(tx)) }),
  });

  registrarOperacion(app, "crearCliente", {
    politica: politicas.oficina,
    manejar: async ({ cuerpo, actor, correlacion }) =>
      enOrganizacion(bd, actor.organizacionId, async (tx) => {
        const { clienteId, sitioId } = await clientesYSitios.crear(tx, { organizacionId: actor.organizacionId, nombre: cuerpo.nombre, sitio: cuerpo.sitio });
        await registrar(tx, [
          { organizacionId: actor.organizacionId, agregadoTipo: "cliente", agregadoId: clienteId, tipoEvento: "cliente_creado", autorId: actor.usuarioId, correlacion, valorNuevo: { nombre: cuerpo.nombre, sitio: { id: sitioId, ...cuerpo.sitio } } },
        ]);
        return (await clientesYSitios.conSitios(tx, [clienteId]))[0]!;
      }),
  });

  registrarOperacion(app, "agregarSitio", {
    politica: politicas.oficina,
    manejar: async ({ parametros: { id }, cuerpo, actor, correlacion }) =>
      enOrganizacion(bd, actor.organizacionId, async (tx) => {
        if (!(await clientesYSitios.obtener(tx, id))) throw problema("no_encontrado", "El cliente no existe");
        const sitioId = await clientesYSitios.agregarSitio(tx, { organizacionId: actor.organizacionId, clienteId: id, ...cuerpo });
        await registrar(tx, [
          { organizacionId: actor.organizacionId, agregadoTipo: "cliente", agregadoId: id, tipoEvento: "sitio_agregado", autorId: actor.usuarioId, correlacion, valorNuevo: { id: sitioId, ...cuerpo } },
        ]);
        return (await clientesYSitios.conSitios(tx, [id]))[0]!;
      }),
  });
}
