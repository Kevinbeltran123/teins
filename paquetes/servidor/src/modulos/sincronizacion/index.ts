import type { FastifyInstance } from "fastify";
import { fechaEnColombia, VERSION_APP_CATALOGO, VERSION_APP_SIMBOLOS } from "@teins/dominio";
import type { Cambio } from "@teins/protocolo";
import { enOrganizacion, type BaseDeDatos, type TxOrganizacion } from "../../plataforma/base-de-datos";
import { politicas } from "../../plataforma/politicas";
import { registrarOperacion } from "../../plataforma/rutas";
import type { Catalogo } from "../catalogo";
import { leerCambios, leerEpoca, type CambioLeido } from "../cambios";
import { leerIdDeVersion, type Formatos } from "../formatos";
import type { Identidad } from "../identidad";
import type { Levantamientos } from "../levantamientos";
import type { Simbolos } from "../simbolos";
import type { Visitas } from "../visitas";

interface Dependencias {
  bd: BaseDeDatos;
  formatos: Pick<Formatos, "obtener">;
  visitas: Pick<Visitas, "asignadas" | "canceladas" | "porCerrar" | "cerrar" | "cerradas">;
  levantamientos: Pick<Levantamientos, "estados" | "conteosPorVisita">;
  identidad: Pick<Identidad, "permisoLocalHasta" | "nombres">;
  catalogo: Pick<Catalogo, "items">;
  simbolos: Pick<Simbolos, "porId">;
}

interface Pedido {
  organizacionId: string;
  usuarioId: string;
  desde: number;
  app: number;
  limite: number;
}

/** Primera versión de campo que entiende la revisión (estados y comentarios); a las anteriores se les manda "enviado". */
export const APP_CON_REVISION = 3;

/** Primera versión de campo que entiende la salida de una visita atendida (ADR-0041). */
export const APP_CON_CIERRE = 15;


/**
 * Antes de bajar, las visitas atendidas de días anteriores se cierran (ADR-0041): terminadas o con algún levantamiento
 * recibido. Lo de hoy no, por si hace falta otro levantamiento; lo atrasado sin atender tampoco, oficina lo decide.
 */
async function cerrarAtendidas(tx: TxOrganizacion, deps: Omit<Dependencias, "bd">, organizacionId: string, usuarioId: string) {
  const hoy = fechaEnColombia();
  const atendidas = await deps.visitas.porCerrar(tx, usuarioId, hoy, deps.levantamientos.conteosPorVisita);
  await deps.visitas.cerrar(tx, organizacionId, atendidas, hoy);
}

/**
 * Bajada (ADR-0003): el registro dice qué cambió para el usuario; el contenido se lee al momento
 * del módulo dueño, así que varios cambios de la misma entidad bajan una sola vez con su estado actual.
 */
export async function armarBajada(tx: TxOrganizacion, deps: Omit<Dependencias, "bd">, { organizacionId, usuarioId, desde, app, limite }: Pedido) {
  await cerrarAtendidas(tx, deps, organizacionId, usuarioId);
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
  const visitasQueSalen = de("visita", "fuera_de_alcance");
  const asignadas = await deps.visitas.asignadas(tx, visitasCambiadas, usuarioId);
  // El teléfono le dice al técnico por qué sale la visita (iteración 7).
  const canceladas = await deps.visitas.canceladas(tx, [...visitasCambiadas, ...visitasQueSalen]);
  const cerradas = await deps.visitas.cerradas(tx, [...visitasCambiadas, ...visitasQueSalen]);
  const sale = (id: string): Cambio => ({ tipo: "fuera_de_alcance", entidad: "visita", id, motivo: canceladas.has(id) ? "cancelada" : cerradas.has(id) ? "atendida" : "reasignada" });
  // Una app anterior no conoce la salida por atendida (ADR-0041): la tomaría por una reasignación. Ya no se la muestra.
  const saleSiLaConoce = (id: string) => {
    if (!cerradas.has(id) || canceladas.has(id) || app >= APP_CON_CIERRE) cambios.push(sale(id));
  };
  for (const id of visitasCambiadas) {
    const visita = asignadas.get(id);
    if (visita) cambios.push({ tipo: "visita", visita });
    else saleSiLaConoce(id);
  }
  for (const id of visitasQueSalen) saleSiLaConoce(id);

  const estados = await deps.levantamientos.estados(tx, de("levantamiento"), usuarioId);
  if (app < APP_CON_REVISION) {
    // N-1 (ADR-0015): su contrato solo conoce "enviado" y no trae comentarios.
    for (const l of estados) cambios.push({ tipo: "levantamiento", id: l.id, estado: "enviado", recibidoEn: l.recibidoEn.toISOString() });
  } else {
    const nombres = await deps.identidad.nombres(organizacionId, [...new Set(estados.flatMap((l) => l.comentarios.flatMap((c) => [c.autorId, ...c.respuestas.map((r) => r.autorId)])))], tx);
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
          ...(c.editadoEn ? { editadoEn: c.editadoEn.toISOString() } : {}),
          // La conversación (ADR-0040): la app 13 no la conoce y la descarta al validar.
          ...(c.respuestas.length > 0
            ? {
                respuestas: c.respuestas.map((r) => ({
                  id: r.id,
                  texto: r.texto,
                  de: r.de,
                  autor: nombres.get(r.autorId) ?? (r.de === "oficina" ? "Oficina" : "Técnico"),
                  creadoEn: r.creadoEn.toISOString(),
                  ...(r.llave ? { llave: r.llave } : {}),
                  ...(r.leido !== undefined ? { leido: r.leido } : {}),
                })),
              }
            : {}),
        })),
      });
    }
  }

  // Catálogo (ADR-0025): una app anterior no conoce este tipo de cambio y rechazaría toda la bajada. Al
  // actualizarse baja todo de nuevo, así que no pierde ningún ítem.
  if (app >= VERSION_APP_CATALOGO) {
    const items = await deps.catalogo.items(tx, de("item_catalogo"));
    for (const item of items.values()) cambios.push({ tipo: "item_catalogo", item });
  }

  // Símbolos de los bocetos (ADR-0027): igual que el catálogo, desde la app 10.
  if (app >= VERSION_APP_SIMBOLOS) {
    for (const simbolo of await deps.simbolos.porId(tx, de("simbolo"))) cambios.push({ tipo: "simbolo", simbolo });
  }

  return { cambios, puntoDeControl, hayMas, epoca: await leerEpoca(tx) };
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
