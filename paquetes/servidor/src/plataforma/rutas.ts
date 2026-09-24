import type { FastifyInstance, FastifyRequest, RouteOptions } from "fastify";
import type { z } from "zod";
import {
  CABECERA_VERSION,
  operaciones,
  VERSION_MINIMA_ACEPTADA,
  VERSION_PROTOCOLO,
  type Consulta,
  type Cuerpo,
  type NombreOperacion,
  type Operacion,
  type Parametros,
  type Respuesta,
} from "@teins/protocolo";
import type { Actor } from "./actor";
import { problema } from "./errores";
import { evaluar, type Politica } from "./politicas";

declare module "fastify" {
  interface FastifyContextConfig {
    politica?: Politica;
    operacion?: NombreOperacion;
  }
  interface FastifyInstance {
    resolverActor(solicitud: FastifyRequest): Promise<Actor | null>;
  }
}

export interface Entrada<N extends NombreOperacion> {
  cuerpo: Cuerpo<N>;
  parametros: Parametros<N>;
  consulta: Consulta<N>;
  actor: Actor;
  correlacion: string;
}

export type Manejador<N extends NombreOperacion> = (entrada: Entrada<N>) => Promise<Respuesta<N>>;

/** `/api/archivos/{huella}` → `/api/archivos/:huella` */
const rutaFastify = (ruta: string) => ruta.replace(/\{(\w+)\}/g, ":$1");

function validar<T extends z.ZodType>(esquema: T | undefined, valor: unknown, donde: string): z.output<T> | undefined {
  if (!esquema) return undefined;
  const resultado = esquema.safeParse(valor ?? {});
  if (!resultado.success) {
    throw problema("entrada_invalida", `Revise ${donde}`, {
      campos: resultado.error.issues.slice(0, 20).map((i) => ({ ruta: [donde, ...i.path].join("."), mensaje: i.message })),
    });
  }
  return resultado.data;
}

function verificarVersion(solicitud: FastifyRequest) {
  const version = Number(solicitud.headers[CABECERA_VERSION]);
  // Regla N-1 (ADR-0015): se aceptan la versión actual y la anterior.
  if (!Number.isInteger(version) || version < VERSION_MINIMA_ACEPTADA || version > VERSION_PROTOCOLO) {
    throw problema("version_protocolo_no_soportada", undefined, { versionMinima: VERSION_MINIMA_ACEPTADA });
  }
}

/**
 * Registra una operación del contrato con su política. La entrada se valida con los esquemas
 * de `protocolo` y la salida también: un campo de más o de menos es un error del servidor, no del cliente.
 */
export function registrarOperacion<N extends NombreOperacion>(
  app: FastifyInstance,
  nombre: N,
  opciones: { politica: Exclude<Politica, { tipo: "publica" }>; manejar: Manejador<N> },
): void {
  const op: Operacion = operaciones[nombre];
  app.route({
    method: op.metodo,
    url: rutaFastify(op.ruta),
    config: { politica: opciones.politica, operacion: nombre },
    handler: async (solicitud, respuesta) => {
      if (op.sincronizacion) verificarVersion(solicitud);
      const actor = await app.resolverActor(solicitud);
      const decision = evaluar(opciones.politica, actor);
      if (decision !== "permitido") throw problema(decision);
      const resultado = await opciones.manejar({
        cuerpo: validar(op.cuerpo, solicitud.body, "cuerpo") as Cuerpo<N>,
        parametros: validar(op.parametros, solicitud.params, "parametros") as Parametros<N>,
        consulta: validar(op.consulta, solicitud.query, "consulta") as Consulta<N>,
        actor: actor!,
        correlacion: solicitud.id,
      });
      respuesta.status(op.estadoExito);
      return op.respuesta.parse(resultado);
    },
  });
}

/** Rutas fuera del contrato (salud, especificación, autenticación). Deben declarar por qué son públicas. */
export function registrarRutaPublica(app: FastifyInstance, opciones: Omit<RouteOptions, "config"> & { motivo: string }): void {
  const { motivo, ...ruta } = opciones;
  app.route({ ...ruta, config: { politica: { tipo: "publica", motivo } } });
}

/** Denegar por defecto (ADR-0009): una ruta sin política impide arrancar el servidor. */
export function exigirPoliticas(app: FastifyInstance, registradas: Set<string>): void {
  app.addHook("onRoute", (ruta) => {
    if (!ruta.config?.politica) {
      throw new Error(`La ruta ${String(ruta.method)} ${ruta.url} no declara política de autorización`);
    }
    for (const metodo of [ruta.method].flat()) registradas.add(`${metodo} ${ruta.url}`);
  });
}
