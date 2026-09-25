import type { FastifyInstance } from "fastify";
import type { Cambio } from "@teins/protocolo";
import { enOrganizacion, type BaseDeDatos, type TxOrganizacion } from "../../plataforma/base-de-datos";
import { politicas } from "../../plataforma/politicas";
import { registrarOperacion } from "../../plataforma/rutas";
import { leerCambios, type CambioLeido } from "../cambios";
import { leerIdDeVersion, type Formatos } from "../formatos";
import type { Identidad } from "../identidad";
import type { Levantamientos } from "../levantamientos";
import type { Visitas } from "../visitas";

interface Dependencias {
  bd: BaseDeDatos;
  formatos: Pick<Formatos, "obtener">;
  visitas: Pick<Visitas, "asignadas">;
  levantamientos: Pick<Levantamientos, "estados">;
  identidad: Pick<Identidad, "permisoLocalHasta" | "nombres">;
}

interface Pedido {
  organizacionId: string;
  usuarioId: string;
  desde: number;
  app: number;
  limite: number;
}

/**
 * Bajada (ADR-0003): el registro dice qué cambió para el usuario; el contenido se lee al momento
 * del módulo dueño, así que varios cambios de la misma entidad bajan una sola vez con su estado actual.
 */
/** Primera versión de campo que entiende la revisión (estados y comentarios); a las anteriores se les manda "enviado". */
export const APP_CON_REVISION = 3;

export async function armarBajada(tx: TxOrganizacion, deps: Omit<Dependencias, "bd">, { organizacionId, usuarioId, desde, app, limite }: Pedido) {
  const leidos = await leerCambios(tx, usuarioId, desde, limite + 1);
  const hayMas = leidos.length > limite;
  const pagina = leidos.slice(0, limite);
  const puntoDeControl = pagina.at(-1)?.secuencia ?? desde;

  // El último cambio de cada entidad manda.
  const ultimos = new Map<string, CambioLeido>();
  for (const c of pagina) ultimos.set(`${c.entidad}:${c.entidadId}`, c);
  const de = (entidad: CambioLeido["entidad"], operacion: CambioLeido["operacion"] = "cambio") =>
    [...ultimos.values()].filter((c) => c.entidad === entidad && c.operacion === operacion).map((c) => c.entidadId);

  const cambios: Cambio[] = [];
  for (const id of de("formato")) {
    const version = leerIdDeVersion(id);
    const definicion = version && (await deps.formatos.obtener(tx, version.formato, version.version));
    // ADR-0015, punto 4: un dispositivo nunca recibe algo que no sabe mostrar.
    if (definicion && (definicion.appMinima ?? 0) <= app) cambios.push({ tipo: "formato", definicion });
  }

  const visitasCambiadas = de("visita");
  const asignadas = await deps.visitas.asignadas(tx, visitasCambiadas, usuarioId);
  for (const id of visitasCambiadas) {
    const visita = asignadas.get(id);
    cambios.push(visita ? { tipo: "visita", visita } : { tipo: "fuera_de_alcance", entidad: "visita", id });
  }
  for (const id of de("visita", "fuera_de_alcance")) cambios.push({ tipo: "fuera_de_alcance", entidad: "visita", id });

  const estados = await deps.levantamientos.estados(tx, de("levantamiento"), usuarioId);
  if (app < APP_CON_REVISION) {
    // N-1 (ADR-0015): su contrato solo conoce "enviado" y no trae comentarios.
    for (const l of estados) cambios.push({ tipo: "levantamiento", id: l.id, estado: "enviado", recibidoEn: l.recibidoEn.toISOString() });
  } else {
    const nombres = await deps.identidad.nombres(organizacionId, [...new Set(estados.flatMap((l) => l.comentarios.map((c) => c.autorId)))]);
    for (const l of estados) {
      cambios.push({
        tipo: "levantamiento",
        id: l.id,
        estado: l.estado,
        recibidoEn: l.recibidoEn.toISOString(),
        comentarios: l.comentarios.map((c) => ({
          id: c.id,
          texto: c.texto,
          ...(c.seccion ? { seccion: c.seccion } : {}),
          ...(c.campo ? { campo: c.campo } : {}),
          autor: nombres.get(c.autorId) ?? "Oficina",
          creadoEn: c.creadoEn.toISOString(),
        })),
      });
    }
  }

  return { cambios, puntoDeControl, hayMas };
}

/** Interfaz pública del módulo de sincronización: compone la bajada con las interfaces de los demás. */
export function crearSincronizacion({ bd, ...modulos }: Dependencias) {
  const { identidad } = modulos;
  return {
    registrarRutas(app: FastifyInstance) {
      registrarOperacion(app, "obtenerCambios", {
        politica: politicas.tecnico,
        manejar: async ({ consulta, actor }) => {
          const bajada = await enOrganizacion(bd, actor.organizacionId, (tx) => armarBajada(tx, modulos, { organizacionId: actor.organizacionId, usuarioId: actor.usuarioId, ...consulta }));
          // Cada contacto renueva el permiso de trabajo sin conexión (ADR-0009, parte 2).
          return { ...bajada, permisoLocalHasta: identidad.permisoLocalHasta() };
        },
      });
    },
  };
}
