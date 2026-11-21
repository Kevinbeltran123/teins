import { z } from "zod";
import { fechaEnColombia } from "@teins/dominio";
import type { FuenteDelAsistente } from "@teins/protocolo";
import type { Herramienta } from "../tipos";
import { contar, decimalColombiano, mesCorto, mesesEntre, normalizarTexto, numeroColombiano } from "./calculos";
import {
  acotado,
  clavesDeServicios,
  describirFiltro,
  deServicios,
  estadosDeVisitas,
  FechaDelModelo,
  FiltroDelModelo,
  ListaDeTextos,
  MAXIMO_DE_VISITAS,
  periodo,
  sitiosDe,
  TextoCorto,
  visitasDelFiltro,
  type DependenciasDeHerramientas,
} from "./comun";

/**
 * Agrupa nombres escritos de varias formas («Ibagué», «IBAGUE»): se muestra la forma con más visitas y, si empatan, la
 * primera en orden alfabético. Así el nombre no depende del orden en que llegan las filas.
 */
function agrupar<T>(filas: readonly T[], nombre: (f: T) => string | null, cuantas: (f: T) => number) {
  const grupos = new Map<string, { formas: Map<string, number>; total: number }>();
  let sinNombre = 0;
  for (const f of filas) {
    const n = nombre(f)?.trim();
    if (!n) {
      sinNombre += cuantas(f);
      continue;
    }
    const llave = normalizarTexto(n);
    const grupo = grupos.get(llave) ?? { formas: new Map<string, number>(), total: 0 };
    grupo.total += cuantas(f);
    grupo.formas.set(n, (grupo.formas.get(n) ?? 0) + cuantas(f));
    grupos.set(llave, grupo);
  }
  const ordenados = [...grupos.values()]
    .map((g) => ({ nombre: [...g.formas].sort(([x, a], [y, b]) => b - a || x.localeCompare(y, "es"))[0]![0], total: g.total }))
    .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, "es"));
  return { grupos: ordenados, sinNombre };
}

export function buscarEnCatalogo(deps: DependenciasDeHerramientas): Herramienta<{ texto: string }> {
  return {
    nombre: "buscar_en_catalogo",
    descripcion: "Busca ítems del catálogo por texto en el código o la descripción (sin mayúsculas ni tildes). Da id, código, descripción, unidad y precio vigente en pesos. Hasta 20.",
    entrada: z.object({ texto: TextoCorto }).strict(),
    etiquetas: ({ texto }) => ({ enCurso: `Buscando «${texto}» en el catálogo`, hecha: `Buscó «${texto}» en el catálogo` }),
    async ejecutar(tx, { texto }) {
      const items = (await deps.catalogo.buscar(tx, { texto })).slice(0, 20);
      return {
        resumen: items.length === 0 ? "Ningún ítem" : contar(items.length, "ítem", "ítems"),
        datos: {
          items: items.map((i) => ({
            id: i.id,
            codigo: i.codigo,
            descripcion: i.descripcion,
            unidad: i.unidad,
            precio: i.precio ? String(i.precio.valor) : null,
            precioDesde: i.precio ? fechaEnColombia(i.precio.desde) : null,
          })),
        },
      };
    },
  };
}

export function ciudades(deps: DependenciasDeHerramientas): Herramienta<Record<string, never>> {
  return {
    nombre: "ciudades",
    descripcion: "Las ciudades de los sitios con visitas sin cancelar y cuántas visitas tiene cada una. Sirve para elegir las ciudades de una región y decir cuáles se contaron.",
    entrada: z.object({}).strict(),
    etiquetas: () => ({ enCurso: "Revisando las ciudades con visitas", hecha: "Revisó las ciudades con visitas" }),
    async ejecutar(tx) {
      const porSitio = new Map<string, number>();
      for (const c of await acotado(deps.visitas.conteos(tx, {}, ["sitio"]))) if (c.sitioId) porSitio.set(c.sitioId, c.visitas);
      const sitios = await sitiosDe(tx, deps, [...porSitio.keys()]);
      const { grupos, sinNombre } = agrupar(sitios, (s) => s.ciudad, (s) => porSitio.get(s.id) ?? 0);
      return {
        resumen: grupos.length === 0 ? "Ninguna ciudad" : contar(grupos.length, "ciudad", "ciudades"),
        datos: { ciudades: grupos.map((g) => ({ ciudad: g.nombre, visitas: g.total })), visitasSinCiudad: sinNombre },
      };
    },
  };
}

export function buscarVisitas(deps: DependenciasDeHerramientas): Herramienta<FiltroDelModelo> {
  return {
    nombre: "buscar_visitas",
    descripcion:
      "Visitas sin cancelar con número de orden, fecha programada, cliente, sitio, ciudad, servicio y si su levantamiento está revisado, las más recientes primero. Filtros opcionales: fechas AAAA-MM-DD inclusivas, ciudades (sin mayúsculas ni tildes), servicios (clave o nombre del formato) y parte del nombre del cliente. Da el total y hasta 200; con más de 1000 pide acotar. Para sumar o estimar sobre un periodo, un lugar o un servicio no hace falta: use `filtro` en sumar_materiales o estimar_materiales.",
    // Junto con los filtros de sumar y estimar pasan del límite de opcionales del modo estricto de la API.
    estricta: false,
    entrada: FiltroDelModelo,
    etiquetas: (filtro) => {
      const resto = describirFiltro(filtro);
      return { enCurso: `Buscando ${resto}`, hecha: `Buscó ${resto}` };
    },
    async ejecutar(tx, filtro) {
      const { visitas, sitios } = await visitasDelFiltro(tx, deps, filtro);
      const estados = await estadosDeVisitas(tx, deps, visitas.map((v) => v.id));
      const filas = visitas.map((v) => {
        const sitio = sitios.get(v.sitioId);
        const estado = estados.get(v.id)!;
        const fuente: FuenteDelAsistente = {
          visitaId: v.id,
          levantamientoId: estado.levantamientoId,
          orden: v.ordenDeServicio,
          fecha: v.programadaPara,
          cliente: sitio?.cliente ?? "",
          sitio: sitio?.nombre ?? "",
          ciudad: sitio?.ciudad ?? null,
          revisado: estado.revisados.length > 0,
        };
        return { fuente, conLevantamiento: estado.levantamientoId !== null, servicio: v.formato?.nombre ?? null, servicioClave: v.formato?.clave ?? null };
      });
      const revisadas = filas.filter((f) => f.fuente.revisado).length;
      const sinLevantamiento = filas.filter((f) => !f.conLevantamiento).length;
      const sinRevisar = filas.length - revisadas - sinLevantamiento;
      const mostradas = filas.slice(0, MAXIMO_DE_VISITAS);
      return {
        resumen:
          filas.length === 0
            ? "Ninguna visita"
            : [`${contar(revisadas, "revisada", "revisadas")}`, `${numeroColombiano(sinRevisar)} sin revisar`, ...(sinLevantamiento > 0 ? [`${numeroColombiano(sinLevantamiento)} sin levantamiento`] : [])].join(", "),
        datos: {
          total: filas.length,
          revisadas,
          sinRevisar,
          sinLevantamiento,
          // Lo que no cupo: las más antiguas. Para verlas, acotar la búsqueda.
          hayMas: filas.length > mostradas.length,
          visitas: mostradas.map(({ fuente: f, servicio, servicioClave }) => ({ visitaId: f.visitaId, orden: f.orden, fecha: f.fecha, cliente: f.cliente, sitio: f.sitio, ciudad: f.ciudad, servicio, servicioClave, revisado: f.revisado })),
        },
        fuentes: {
          titulo: `${contar(filas.length, "visita", "visitas")}${filas.length > mostradas.length ? ` (se muestran las ${MAXIMO_DE_VISITAS} más recientes)` : ""}`,
          visitas: mostradas.map((f) => f.fuente),
        },
      };
    },
  };
}

type Agrupacion = "mes" | "servicio" | "ciudad" | "cliente";

interface EntradaContarVisitas {
  desde?: string | undefined;
  hasta?: string | undefined;
  servicios?: string[] | undefined;
  agruparPor: Agrupacion;
}

const NOMBRE_DEL_GRUPO: Record<Agrupacion, string> = { mes: "Mes", servicio: "Servicio", ciudad: "Ciudad", cliente: "Cliente" };

export function contarVisitas(deps: DependenciasDeHerramientas): Herramienta<EntradaContarVisitas> {
  return {
    nombre: "contar_visitas",
    descripcion:
      "Cuenta las visitas sin cancelar, revisadas o no, agrupadas por mes (AAAA-MM, con serie para el gráfico), servicio, ciudad o cliente. Filtros opcionales: fechas AAAA-MM-DD inclusivas y servicios (clave o nombre del formato).",
    entrada: z.object({ desde: FechaDelModelo.optional(), hasta: FechaDelModelo.optional(), servicios: ListaDeTextos.optional(), agruparPor: z.enum(["mes", "servicio", "ciudad", "cliente"]) }).strict(),
    etiquetas: ({ desde, hasta, servicios, agruparPor }) => {
      const resto = `las visitas${deServicios(servicios)}${periodo(desde, hasta)} por ${agruparPor}`;
      return { enCurso: `Contando ${resto}`, hecha: `Contó ${resto}` };
    },
    async ejecutar(tx, { desde, hasta, servicios, agruparPor }) {
      const formatos = await clavesDeServicios(tx, deps, servicios);
      const conteos = await acotado(deps.visitas.conteos(tx, { desde, hasta, formatos }, [agruparPor === "mes" ? "mes" : agruparPor === "servicio" ? "formato" : "sitio"]));
      const total = conteos.reduce((s, c) => s + c.visitas, 0);
      let grupos: { grupo: string; visitas: number }[];
      if (agruparPor === "mes") {
        const porMes = new Map<string, number>();
        for (const c of conteos) if (c.mes) porMes.set(c.mes, (porMes.get(c.mes) ?? 0) + c.visitas);
        const meses = [...porMes.keys()].sort((a, b) => a.localeCompare(b));
        // Los meses sin visitas también van: en el gráfico, un hueco es un dato.
        grupos = meses.length === 0 ? [] : mesesEntre(meses[0]!, meses.at(-1)!).map((mes) => ({ grupo: mes, visitas: porMes.get(mes) ?? 0 }));
      } else if (agruparPor === "servicio") {
        const nombres = new Map((await deps.formatos.vigentes(tx)).map((f) => [f.clave, f.nombre]));
        const { grupos: g, sinNombre } = agrupar(conteos, (c) => (c.formato ? (nombres.get(c.formato) ?? c.formato) : null), (c) => c.visitas);
        grupos = [...g.map((x) => ({ grupo: x.nombre, visitas: x.total })), ...(sinNombre ? [{ grupo: "Sin servicio", visitas: sinNombre }] : [])];
      } else {
        const sitios = new Map((await sitiosDe(tx, deps, conteos.flatMap((c) => (c.sitioId ? [c.sitioId] : [])))).map((s) => [s.id, s]));
        const sitioDe = (c: (typeof conteos)[number]) => (c.sitioId ? sitios.get(c.sitioId) : undefined);
        const nombre = agruparPor === "ciudad" ? (c: (typeof conteos)[number]) => sitioDe(c)?.ciudad ?? null : (c: (typeof conteos)[number]) => sitioDe(c)?.cliente ?? null;
        const { grupos: g, sinNombre } = agrupar(conteos, nombre, (c) => c.visitas);
        grupos = [...g.map((x) => ({ grupo: x.nombre, visitas: x.total })), ...(sinNombre ? [{ grupo: agruparPor === "ciudad" ? "Sin ciudad" : "Sin cliente", visitas: sinNombre }] : [])];
      }
      const variosAnios = agruparPor === "mes" && grupos.length > 0 && grupos[0]!.grupo.slice(0, 4) !== grupos.at(-1)!.grupo.slice(0, 4);
      const etiquetaDe = (g: string) => (agruparPor !== "mes" ? g : variosAnios ? `${mesCorto(g)} ${g.slice(2, 4)}` : mesCorto(g));
      const descripcion = `visitas${deServicios(servicios)}${periodo(desde, hasta)}`;
      return {
        resumen: contar(total, "visita", "visitas"),
        datos: { grupos, total },
        cifras: [{ id: "total", valor: decimalColombiano(String(total)), unidad: null, descripcion }],
        tabla: {
          titulo: `Visitas${deServicios(servicios)} por ${agruparPor}`,
          columnas: [
            { titulo: NOMBRE_DEL_GRUPO[agruparPor], numerica: false },
            { titulo: "Visitas", numerica: true },
          ],
          filas: grupos.map((g) => [{ texto: agruparPor === "mes" ? `${mesCorto(g.grupo)} ${g.grupo.slice(0, 4)}` : g.grupo }, { texto: numeroColombiano(g.visitas) }]),
        },
        ...(agruparPor === "mes" ? { serie: { titulo: `Visitas${deServicios(servicios)} por mes`, puntos: grupos.map((g) => ({ etiqueta: etiquetaDe(g.grupo), valor: g.visitas })) } } : {}),
      };
    },
  };
}
