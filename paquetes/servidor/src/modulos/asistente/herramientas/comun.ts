import { z } from "zod";
import { formatearDia, numeroDeOrden } from "@teins/dominio";
import type { FuenteDelAsistente } from "@teins/protocolo";
import type { TxOrganizacion } from "../../../plataforma/base-de-datos";
import { ErrorProblema, problema } from "../../../plataforma/errores";
import type { Catalogo } from "../../catalogo";
import type { ClientesYSitios } from "../../clientes";
import type { Formatos } from "../../formatos";
import type { Levantamientos } from "../../levantamientos";
import type { Visitas, VisitaParaConsultar } from "../../visitas";
import type { SitioConCliente } from "../../clientes";
import { esFechaReal, normalizarTexto, unirConY } from "./calculos";

/** Lo que las herramientas leen de los demás módulos, solo por su interfaz pública (ADR-0060). */
export interface DependenciasDeHerramientas {
  visitas: Pick<Visitas, "porFiltro" | "conteos" | "porOrden" | "resumenes" | "canceladas">;
  clientesYSitios: Pick<ClientesYSitios, "sitiosConCliente">;
  levantamientos: Pick<Levantamientos, "deVisitas" | "lineasVigentes" | "contenido">;
  catalogo: Pick<Catalogo, "buscar">;
  formatos: Pick<Formatos, "vigentes" | "obtener">;
}

/** Hasta cuántas visitas recibe una herramienta: las que devuelve `buscar_visitas`. */
export const MAXIMO_DE_VISITAS = 200;

/** Una fecha del modelo: AAAA-MM-DD y que exista ("2026-02-30" no). */
export const FechaDelModelo = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(esFechaReal, "Una fecha que exista, AAAA-MM-DD");

export const TextoCorto = z.string().trim().min(1).max(200);

export const ListaDeTextos = z.array(TextoCorto).min(1).max(50);

/** Qué visitas: un periodo, unas ciudades, unos servicios o un cliente. Lo usan las herramientas que leen muchas visitas. */
export const FiltroDelModelo = z
  .object({ desde: FechaDelModelo.optional(), hasta: FechaDelModelo.optional(), ciudades: ListaDeTextos.optional(), servicios: ListaDeTextos.optional(), cliente: TextoCorto.optional() })
  .strict();
export type FiltroDelModelo = z.infer<typeof FiltroDelModelo>;

/** Hasta cuántas visitas cubre una herramienta con un filtro: con más, pide acotar en vez de cortar en silencio. */
export const MAXIMO_DEL_FILTRO = 1000;
const MAS_DE_LAS_QUE_CABEN = `Más de ${MAXIMO_DEL_FILTRO} visitas: acote el periodo o el lugar`;

/** Lotes de ids: las lecturas aceptan hasta 1000 visitas o levantamientos, y 5000 sitios, por consulta. */
export const LOTE = 1000;
const LOTE_DE_SITIOS = 5000;

export async function enLotes<T>(ids: readonly string[], tamano: number, leer: (lote: string[]) => Promise<T[]>): Promise<T[]> {
  const todo: T[] = [];
  for (let i = 0; i < ids.length; i += tamano) todo.push(...(await leer(ids.slice(i, i + tamano))));
  return todo;
}

/** Los sitios de estos ids. Nunca sin ids: toda la organización puede pasar del tope. */
export const sitiosDe = (tx: TxOrganizacion, deps: DependenciasDeHerramientas, ids: readonly string[]): Promise<SitioConCliente[]> =>
  enLotes(unicos(ids), LOTE_DE_SITIOS, (lote) => deps.clientesYSitios.sitiosConCliente(tx, lote));

/**
 * Las lecturas cortan con `entrada_invalida` cuando hay demasiados grupos o sitios. El paso queda fallido con un mensaje
 * que le dice al modelo cómo reintentar.
 */
export async function acotado<T>(lectura: Promise<T>): Promise<T> {
  try {
    return await lectura;
  } catch (error) {
    if (error instanceof ErrorProblema && error.codigo === "entrada_invalida") throw problema("entrada_invalida", "Demasiados datos: acote el periodo, las ciudades o los servicios");
    throw error;
  }
}

export const unicos = <T>(lista: readonly T[]) => [...new Set(lista)];

/** "esa visita", "esas 5 visitas". */
export const esasVisitas = (n: number) => (n === 1 ? "esa visita" : `esas ${n} visitas`);

const dia = (fecha: string) => formatearDia(fecha, { day: "numeric", month: "long", year: "numeric" });

/** " de 2026", " del 1 de marzo de 2026 al 30 de junio de 2026", " desde el …", o nada. */
export function periodo(desde?: string, hasta?: string): string {
  if (desde?.endsWith("-01-01") && (!hasta || hasta === `${desde.slice(0, 4)}-12-31`)) return ` de ${desde.slice(0, 4)}`;
  if (desde && hasta) return ` del ${dia(desde)} al ${dia(hasta)}`;
  if (desde) return ` desde el ${dia(desde)}`;
  if (hasta) return ` hasta el ${dia(hasta)}`;
  return "";
}

export const deServicios = (servicios?: readonly string[]) => (servicios?.length ? ` de ${unirConY(servicios)}` : "");

/** "las visitas de UPS de 2026 en Ibagué y Espinal de «hotel»": para las etiquetas. */
export const describirFiltro = ({ desde, hasta, ciudades, servicios, cliente }: FiltroDelModelo) =>
  `las visitas${deServicios(servicios)}${periodo(desde, hasta)}${ciudades ? ` en ${unirConY(ciudades)}` : ""}${cliente ? ` de «${cliente}»` : ""}`;

/** Lo más reciente primero: por fecha programada y, el mismo día, por número de orden. */
export const masRecientePrimero = (a: { fecha: string; orden: string | null }, b: { fecha: string; orden: string | null }) =>
  b.fecha.localeCompare(a.fecha) || (b.orden ?? "").localeCompare(a.orden ?? "");

/**
 * Las claves de formato de los servicios que nombró el modelo: por la clave o por el nombre visible, sin mayúsculas ni
 * tildes y por contenido («UPS» encuentra «prueba-ups»). Sin servicios, undefined: no se filtra.
 */
export async function clavesDeServicios(tx: TxOrganizacion, deps: DependenciasDeHerramientas, servicios?: readonly string[]): Promise<string[] | undefined> {
  if (!servicios) return undefined;
  const buscados = servicios.map(normalizarTexto).filter(Boolean);
  const vigentes = await deps.formatos.vigentes(tx);
  return vigentes.filter((f) => buscados.some((b) => normalizarTexto(f.clave).includes(b) || normalizarTexto(f.nombre).includes(b))).map((f) => f.clave);
}

/** Los levantamientos de cada visita: los revisados (todos entran en las cuentas) y el que sirve de enlace. */
export interface EstadoDeVisita {
  revisados: string[];
  /** Los que todavía no están revisados. */
  pendientes: string[];
  /** El último revisado o, si ninguno, el último recibido. */
  levantamientoId: string | null;
}

export async function estadosDeVisitas(tx: TxOrganizacion, deps: DependenciasDeHerramientas, visitaIds: readonly string[]): Promise<Map<string, EstadoDeVisita>> {
  const estados = new Map<string, EstadoDeVisita>(visitaIds.map((id) => [id, { revisados: [], pendientes: [], levantamientoId: null }]));
  // `deVisitas` los da por fecha de recibido: el último de cada visita queda al final.
  const ultimos = new Map<string, string>();
  for (const l of await enLotes(visitaIds, LOTE, (lote) => deps.levantamientos.deVisitas(tx, lote))) {
    ultimos.set(l.visitaId, l.id);
    estados.get(l.visitaId)?.[l.estado === "revisado" ? "revisados" : "pendientes"].push(l.id);
  }
  for (const [visitaId, estado] of estados) estado.levantamientoId = estado.revisados.at(-1) ?? ultimos.get(visitaId) ?? null;
  return estados;
}

/** Una visita con lo que muestran las fuentes, en el orden pedido; las que no existen se omiten. */
export interface VisitaConEstado extends EstadoDeVisita {
  /** La pantalla no sabe llevar a una visita cancelada: nunca va en las fuentes. */
  cancelada: boolean;
  fuente: FuenteDelAsistente;
  servicio: string | null;
}

export async function visitasConEstado(tx: TxOrganizacion, deps: DependenciasDeHerramientas, visitaIds: readonly string[]): Promise<VisitaConEstado[]> {
  const ids = unicos(visitaIds);
  const resumenes = await deps.visitas.resumenes(tx, ids);
  const estados = await estadosDeVisitas(tx, deps, ids);
  const canceladas = await deps.visitas.canceladas(tx, ids);
  return ids.flatMap((id) => {
    const v = resumenes.get(id);
    const estado = estados.get(id)!;
    if (!v) return [];
    return [
      {
        ...estado,
        cancelada: canceladas.has(id),
        servicio: v.formato ? v.motivo : null,
        fuente: {
          visitaId: id,
          levantamientoId: estado.levantamientoId,
          orden: v.ordenDeServicio === null ? null : numeroDeOrden(v.ordenDeServicio),
          fecha: v.programadaPara,
          cliente: v.cliente.nombre,
          sitio: v.sitio.nombre,
          ciudad: v.sitio.ciudad,
          revisado: estado.revisados.length > 0,
        },
      },
    ];
  });
}

/** Lo que el modelo ve de una visita para nombrarla: su id y su número de orden. */
export const referencia = (v: VisitaConEstado) => ({ visitaId: v.fuente.visitaId, orden: v.fuente.orden });

/**
 * El filtro en lo que entienden las lecturas: las claves de los servicios y, si nombra ciudades o cliente, los sitios que
 * cumplen. Esos sitios salen de los que tienen visitas en el periodo, nunca de toda la organización.
 */
async function resolverFiltro(tx: TxOrganizacion, deps: DependenciasDeHerramientas, { desde, hasta, ciudades, servicios, cliente }: FiltroDelModelo) {
  const formatos = await clavesDeServicios(tx, deps, servicios);
  if (!ciudades && !cliente) return { desde, hasta, formatos, sitios: undefined };
  const conVisitas = await acotado(deps.visitas.conteos(tx, { desde, hasta, formatos }, ["sitio"]));
  const buscadas = new Set(ciudades?.map(normalizarTexto));
  const delCliente = cliente ? normalizarTexto(cliente) : undefined;
  const sitios = (await sitiosDe(tx, deps, conVisitas.flatMap((c) => (c.sitioId ? [c.sitioId] : [])))).filter(
    (s) => (!ciudades || (s.ciudad !== null && buscadas.has(normalizarTexto(s.ciudad)))) && (!delCliente || normalizarTexto(s.cliente).includes(delCliente)),
  );
  return { desde, hasta, formatos, sitios };
}

/**
 * Todas las visitas sin cancelar que cumplen el filtro, las más recientes primero, con su sitio. Con más de 1000,
 * `entrada_invalida`: una suma sobre una parte daría una cifra menor sin avisar.
 */
export async function visitasDelFiltro(tx: TxOrganizacion, deps: DependenciasDeHerramientas, filtro: FiltroDelModelo): Promise<{ visitas: VisitaParaConsultar[]; sitios: Map<string, SitioConCliente> }> {
  const { desde, hasta, formatos, sitios } = await resolverFiltro(tx, deps, filtro);
  if (sitios?.length === 0) return { visitas: [], sitios: new Map() };
  const lotes: (string[] | undefined)[] = sitios ? [] : [undefined];
  for (let i = 0; sitios && i < sitios.length; i += LOTE) lotes.push(sitios.slice(i, i + LOTE).map((s) => s.id));
  const todas: VisitaParaConsultar[] = [];
  for (const sitioIds of lotes) {
    const { visitas, hayMas } = await deps.visitas.porFiltro(tx, { desde, hasta, formatos, sitioIds, limite: MAXIMO_DEL_FILTRO });
    todas.push(...visitas.filter((v) => !v.cancelada));
    if (hayMas || todas.length > MAXIMO_DEL_FILTRO) throw problema("entrada_invalida", MAS_DE_LAS_QUE_CABEN);
  }
  const conSitio = new Map((sitios ?? (await sitiosDe(tx, deps, todas.map((v) => v.sitioId)))).map((s) => [s.id, s]));
  todas.sort((a, b) => masRecientePrimero({ fecha: a.programadaPara, orden: a.ordenDeServicio }, { fecha: b.programadaPara, orden: b.ordenDeServicio }));
  return { visitas: todas, sitios: conSitio };
}

/** Las visitas de una herramienta: las de la lista que mandó el modelo o todas las del filtro. */
export async function idsDeVisitas(tx: TxOrganizacion, deps: DependenciasDeHerramientas, visitas: readonly string[] | FiltroDelModelo): Promise<string[]> {
  if (Array.isArray(visitas)) return [...visitas];
  return (await visitasDelFiltro(tx, deps, visitas as FiltroDelModelo)).visitas.map((v) => v.id);
}
