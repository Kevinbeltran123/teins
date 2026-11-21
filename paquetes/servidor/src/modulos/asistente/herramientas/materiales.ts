import { z } from "zod";
import { formatearDia, fechaEnColombia, pesos, resumirCantidades, sumarDecimales } from "@teins/dominio";
import { Uuid, type CeldaDelAsistente } from "@teins/protocolo";
import type { TxOrganizacion } from "../../../plataforma/base-de-datos";
import { problema } from "../../../plataforma/errores";
import type { ItemConPrecio } from "../../catalogo";
import type { CifraCandidata, Herramienta } from "../tipos";
import { cantidadConUnidad, contar, decimalColombiano, estadisticas, normalizarTexto, numeroColombiano, redondearArriba } from "./calculos";
import {
  describirFiltro,
  enLotes,
  esasVisitas,
  FiltroDelModelo,
  idsDeVisitas,
  LOTE,
  masRecientePrimero,
  MAXIMO_DE_VISITAS,
  referencia,
  TextoCorto,
  unicos,
  visitasConEstado,
  type DependenciasDeHerramientas,
  type VisitaConEstado,
} from "./comun";

/** Una lista de ids o un filtro, en un solo parámetro: no se pueden mandar los dos a la vez. */
const CualesVisitas = z.union([z.array(Uuid).min(1).max(MAXIMO_DE_VISITAS), FiltroDelModelo]);
type CualesVisitas = z.infer<typeof CualesVisitas>;
const CUALES =
  "`visitas`: para un periodo, un lugar o un servicio, un filtro como el de buscar_visitas ({ desde, hasta, ciudades, servicios, cliente }), que cubre todas las visitas que cumplen, hasta 1000; una lista de ids de buscar_visitas, solo para una lista concreta.";

/** «esas 5 visitas» o «las visitas de 2026 en Ibagué». */
const cuales = (visitas: CualesVisitas) => (Array.isArray(visitas) ? esasVisitas(unicos(visitas).length) : describirFiltro(visitas));

/** Las fuentes, las más recientes primero; con más de 200 se muestran esas y el título lo dice. */
function fuentesDe(visitas: readonly VisitaConEstado[], titulo: string) {
  const ordenadas = visitas.map((v) => v.fuente).sort(masRecientePrimero);
  const mostradas = ordenadas.slice(0, MAXIMO_DE_VISITAS);
  return { titulo: `${titulo}${ordenadas.length > mostradas.length ? ` (se muestran las ${MAXIMO_DE_VISITAS} más recientes)` : ""}`, visitas: mostradas };
}
const primeras = <T>(lista: readonly T[]) => lista.slice(0, MAXIMO_DE_VISITAS);

/** La llave con que `resumirCantidades` agrupa una línea: por ítem y unidad, o por descripción y unidad. */
const llaveDeTexto = (descripcion: string) => descripcion.trim().toLowerCase().replace(/\s+/g, " ");
const llave = (codigo: string | null, descripcion: string, unidad: string) => (codigo !== null ? `item\u0000${codigo}\u0000${unidad}` : `texto\u0000${llaveDeTexto(descripcion)}\u0000${unidad}`);

/** Las líneas vigentes de estos levantamientos (por lotes), con su visita y su ítem. */
async function lineasDe(tx: TxOrganizacion, deps: DependenciasDeHerramientas, visitas: readonly VisitaConEstado[], cuales: "revisados" | "pendientes") {
  const visitaDe = new Map(visitas.flatMap((v) => v[cuales].map((l) => [l, v.fuente.visitaId] as const)));
  const lineas = await enLotes([...visitaDe.keys()], LOTE, (lote) => deps.levantamientos.lineasVigentes(tx, lote));
  const items = new Map((await deps.catalogo.buscar(tx, { ids: unicos(lineas.flatMap((l) => (l.itemId ? [l.itemId] : []))) })).map((i) => [i.id, i]));
  return lineas.map((l) => ({ ...l, visitaId: visitaDe.get(l.levantamientoId)!, item: l.itemId ? items.get(l.itemId) : undefined }));
}

export function sumarMateriales(deps: DependenciasDeHerramientas): Herramienta<{ visitas: CualesVisitas; texto?: string | undefined; items?: string[] | undefined }> {
  return {
    nombre: "sumar_materiales",
    descripcion:
      `Suma exacta de los materiales de los levantamientos revisados de unas visitas, por ítem del catálogo y unidad; lo no vinculado al catálogo, por descripción. Nunca suma unidades distintas. ${CUALES} \`texto\` filtra por la descripción o por el ítem; \`items\`, por ids del catálogo. Dice cuántas visitas aportaron y cuáles quedaron fuera por no estar revisadas.`,
    // Sin el modo estricto de la API, para tener margen ante su límite de parámetros opcionales: Zod es la única barrera.
    estricta: false,
    entrada: z.object({ visitas: CualesVisitas, texto: TextoCorto.optional(), items: z.array(Uuid).min(1).max(50).optional() }).strict(),
    etiquetas: ({ visitas }) => {
      const resto = `los materiales de ${cuales(visitas)}`;
      return { enCurso: `Sumando ${resto}`, hecha: `Sumó ${resto}` };
    },
    async ejecutar(tx, entrada) {
      const { texto, items } = entrada;
      const visitas = await visitasConEstado(tx, deps, await idsDeVisitas(tx, deps, entrada.visitas));
      const revisadas = visitas.filter((v) => v.fuente.revisado && !v.cancelada);
      // Una visita sin ningún levantamiento no es «sin revisar»: no hay nada que revisar ni a dónde llevar.
      const sinRevisar = visitas.filter((v) => !v.fuente.revisado && !v.cancelada && v.levantamientoId !== null);
      const sinLevantamiento = visitas.filter((v) => !v.cancelada && v.levantamientoId === null).length;
      const canceladas = visitas.filter((v) => v.cancelada);
      const porId = new Map(visitas.map((v) => [v.fuente.visitaId, v.fuente]));
      const fuenteDe = (r: { visitaId: string }) => porId.get(r.visitaId)!;
      const excluidas = [...sinRevisar.map((v) => ({ ...referencia(v), motivo: "sin_revisar" as const })), ...canceladas.map((v) => ({ ...referencia(v), motivo: "cancelada" as const }))];
      const buscado = texto ? normalizarTexto(texto) : undefined;
      const elegidos = items ? new Set(items) : undefined;
      const entra = (l: Awaited<ReturnType<typeof lineasDe>>[number]) =>
        (!elegidos || (l.itemId !== null && elegidos.has(l.itemId))) &&
        (!buscado || [l.descripcion, l.item?.codigo, l.item?.descripcion].some((t) => t !== undefined && normalizarTexto(t).includes(buscado)));
      const lineas = (await lineasDe(tx, deps, revisadas, "revisados")).filter(entra);
      // Las fuentes son las visitas que aportaron, y las sin revisar solo si tienen algo que habría entrado.
      const aportaron = new Set(lineas.map((l) => l.visitaId));
      const incluidas = revisadas.filter((v) => aportaron.has(v.fuente.visitaId));
      const pendientes = new Set((await lineasDe(tx, deps, sinRevisar, "pendientes")).filter(entra).map((l) => l.visitaId));
      const sinRevisarConLineas = sinRevisar.filter((v) => pendientes.has(v.fuente.visitaId));
      const visitasPorFila = new Map<string, Set<string>>();
      const itemPorCodigo = new Map<string, string>();
      for (const l of lineas) {
        const k = llave(l.item?.codigo ?? null, l.descripcion, l.unidad);
        visitasPorFila.set(k, (visitasPorFila.get(k) ?? new Set()).add(l.visitaId));
        if (l.item) itemPorCodigo.set(l.item.codigo, l.item.id);
      }
      const filas = resumirCantidades(lineas.map((l) => ({ descripcion: l.descripcion, cantidad: l.cantidad, unidad: l.unidad, item: l.item ? { codigo: l.item.codigo, descripcion: l.item.descripcion } : null })))
        .map((f) => ({ itemId: f.codigo !== null ? itemPorCodigo.get(f.codigo)! : null, codigo: f.codigo, descripcion: f.descripcion, unidad: f.unidad, cantidad: f.cantidad, visitas: visitasPorFila.get(llave(f.codigo, f.descripcion, f.unidad))?.size ?? 0 }))
        // Lo vinculado primero y, dentro de cada grupo, lo que más se usó: la primera cifra es la que se vino a buscar.
        .sort((a, b) => Number(a.codigo === null) - Number(b.codigo === null) || Number(b.cantidad) - Number(a.cantidad));
      const material = (f: (typeof filas)[number]): CeldaDelAsistente => (f.codigo !== null ? { texto: f.descripcion, detalle: f.codigo } : { texto: `«${f.descripcion}»`, marca: "sin_vincular" });
      const titulo = texto ? `${texto.charAt(0).toUpperCase()}${texto.slice(1)} por material` : "Materiales";
      return {
        resumen: filas.length === 0 ? "Ningún material" : contar(filas.length, "fila", "filas"),
        etiqueta: `Sumó ${texto ? `el ${texto.toLowerCase()}` : "los materiales"} de ${contar(incluidas.length, "visita revisada", "visitas revisadas")}`,
        datos: {
          filas,
          aportaron: incluidas.length,
          // Para nombrarlas: hasta 200, las más recientes.
          incluidas: primeras(incluidas.map(referencia).sort((a, b) => masRecientePrimero(fuenteDe(a), fuenteDe(b)))),
          excluidas: primeras(excluidas),
          sinLevantamiento,
        },
        tabla: {
          titulo,
          columnas: [
            { titulo: "Material", numerica: false },
            { titulo: "Cantidad", numerica: true },
            { titulo: "Visitas", numerica: true },
          ],
          filas: filas.map((f) => [material(f), { texto: cantidadConUnidad(f.cantidad, f.unidad) }, { texto: numeroColombiano(f.visitas) }]),
          ...(sinRevisarConLineas.length > 0 ? { nota: `${contar(sinRevisarConLineas.length, "visita sin revisar no entró", "visitas sin revisar no entraron")} en la suma.` } : {}),
        },
        fuentes: (() => {
          // Tope total de 200: primero las revisadas, las más recientes primero, y después las sin revisar.
          const todas = [...incluidas.map((v) => v.fuente).sort(masRecientePrimero), ...sinRevisarConLineas.map((v) => v.fuente).sort(masRecientePrimero)];
          const visitas = primeras(todas);
          const titulo = `De ${contar(incluidas.length, "visita revisada", "visitas revisadas")}${sinRevisarConLineas.length > 0 ? ` y ${numeroColombiano(sinRevisarConLineas.length)} sin revisar` : ""}`;
          return { titulo: todas.length > visitas.length ? `${titulo} (se muestran ${visitas.length})` : titulo, visitas };
        })(),
        cifras: filas.map((f, i) => ({ id: `fila-${i + 1}`, valor: decimalColombiano(f.cantidad), unidad: f.unidad, descripcion: `${f.descripcion} en ${contar(f.visitas, "visita", "visitas")}` })),
      };
    },
  };
}

const UNIDADES_SUELTAS = new Set(["und", "un", "u", "unidad", "unidades"]);

/** Cómo se nombra la unidad de tamaño: «punto de red» y «puntos de red» si se cuenta por unidad; si no, su unidad («m»). */
function nombreDeTamano(item: ItemConPrecio): { singular: string; plural: string } {
  if (!UNIDADES_SUELTAS.has(item.unidad.trim().toLowerCase())) return { singular: item.unidad, plural: item.unidad };
  const singular = `${item.descripcion.charAt(0).toLowerCase()}${item.descripcion.slice(1)}`;
  const [primera = "", ...resto] = singular.split(" ");
  const plural = [/[aeiouáéíóú]$/i.test(primera) ? `${primera}s` : `${primera}es`, ...resto].join(" ");
  return { singular, plural };
}

const sumaDe = (lineas: readonly { cantidad: string }[]) => lineas.reduce((s, l) => sumarDecimales(s, l.cantidad), "0");

export function estimarMateriales(deps: DependenciasDeHerramientas): Herramienta<{ visitas: CualesVisitas; item: string; porItem: string; cantidad?: number | undefined }> {
  return {
    nombre: "estimar_materiales",
    descripcion:
      `Cuánto de un material (item) va por cada unidad de otro que mide el tamaño de la obra (porItem), por ejemplo metros de UTP por punto de red, en los levantamientos revisados de unas visitas: n, mínimo, mediana, percentil 80 y máximo. Con \`cantidad\` (el tamaño de la obra nueva), la proyección redondeada hacia arriba y su costo al precio vigente. Ids del catálogo de buscar_en_catalogo. ${CUALES}`,
    estricta: false,
    entrada: z.object({ visitas: CualesVisitas, item: Uuid, porItem: Uuid, cantidad: z.number().int().positive().max(1_000_000).optional() }).strict(),
    etiquetas: ({ visitas, cantidad }) => {
      const resto = `el estimado${cantidad ? ` para ${numeroColombiano(cantidad)}` : ""} con ${cuales(visitas)}`;
      return { enCurso: `Calculando ${resto}`, hecha: `Calculó ${resto}` };
    },
    async ejecutar(tx, entrada) {
      const { item: itemId, porItem: porItemId, cantidad } = entrada;
      const items = new Map((await deps.catalogo.buscar(tx, { ids: unicos([itemId, porItemId]) })).map((i) => [i.id, i]));
      const item = items.get(itemId);
      const porItem = items.get(porItemId);
      if (!item || !porItem) throw problema("no_encontrado", "Ese ítem no está en el catálogo");
      const visitas = await visitasConEstado(tx, deps, await idsDeVisitas(tx, deps, entrada.visitas));
      const revisadas = visitas.filter((v) => v.fuente.revisado && !v.cancelada);
      const lineas = await lineasDe(tx, deps, revisadas, "revisados");
      // Solo lo vinculado al ítem y en su unidad: nunca se mezclan unidades.
      const delItem = (v: VisitaConEstado, i: ItemConPrecio) => lineas.filter((l) => l.visitaId === v.fuente.visitaId && l.itemId === i.id && l.unidad === i.unidad);
      const porVisita = revisadas.flatMap((v) => {
        const material = sumaDe(delItem(v, item));
        const tamano = sumaDe(delItem(v, porItem));
        return Number(material) > 0 && Number(tamano) > 0 ? [{ visita: v, cantidad: material, tamano, valor: Number(material) / Number(tamano) }] : [];
      });
      const usadas = new Set(porVisita.map((p) => p.visita));
      const nombre = nombreDeTamano(porItem);
      const precio = item.precio ? { valor: item.precio.valor, desde: fechaEnColombia(item.precio.desde) } : null;
      const comun = {
        item: { id: item.id, codigo: item.codigo, descripcion: item.descripcion, unidad: item.unidad, precio: precio?.valor ?? null, precioDesde: precio?.desde ?? null },
        porItem: { id: porItem.id, codigo: porItem.codigo, descripcion: porItem.descripcion, unidad: porItem.unidad },
        omitidas: primeras(revisadas.filter((v) => !usadas.has(v)).map(referencia)),
        sinRevisar: primeras(visitas.filter((v) => !v.fuente.revisado && !v.cancelada && v.levantamientoId !== null).map(referencia)),
        sinLevantamiento: visitas.filter((v) => !v.cancelada && v.levantamientoId === null).length,
        canceladas: primeras(visitas.filter((v) => v.cancelada).map(referencia)),
      };
      const minuscula = (t: string) => `${t.charAt(0).toLowerCase()}${t.slice(1)}`;
      const etiqueta = `Calculó el ${minuscula(item.descripcion)} por ${nombre.singular} con ${contar(porVisita.length, "visita revisada", "visitas revisadas")}`;
      if (porVisita.length === 0) return { resumen: "Sin visitas con los dos materiales", etiqueta, datos: { ...comun, n: 0 } };

      const e = estadisticas(porVisita.map((p) => p.valor));
      const proyeccion = cantidad
        ? {
            cantidad,
            mediana: redondearArriba(e.mediana * cantidad),
            percentil80: redondearArriba(e.percentil80 * cantidad),
          }
        : null;
      const costo = (n: number) => (precio ? n * precio.valor : null);
      const porUnidad = (v: number) => `${numeroColombiano(v, 1)} ${item.unidad}`;
      const enPesos = (n: number) => {
        const c = costo(n);
        return c === null ? "Sin precio" : pesos(c);
      };
      const filaDe = (base: string, valor: number, proyectado: number | undefined) => [
        { texto: base },
        { texto: porUnidad(valor) },
        ...(proyectado !== undefined ? [{ texto: `${numeroColombiano(proyectado)} ${item.unidad}` }, { texto: enPesos(proyectado) }] : []),
      ];
      const cifras: CifraCandidata[] = proyeccion
        ? [
            { id: "proyeccion-p80", valor: numeroColombiano(proyeccion.percentil80), unidad: item.unidad, descripcion: `de ${item.descripcion} para ${numeroColombiano(proyeccion.cantidad)} ${nombre.plural}, con el percentil 80` },
            ...(precio ? [{ id: "costo-p80", valor: pesos(costo(proyeccion.percentil80)!), unidad: null, descripcion: "al precio vigente" }] : []),
          ]
        : [{ id: "percentil80", valor: numeroColombiano(e.percentil80, 1), unidad: item.unidad, descripcion: `de ${item.descripcion} por ${nombre.singular}, con el percentil 80` }];
      const notaDelPrecio = precio
        ? ` Precio de ${item.codigo}: ${pesos(precio.valor)} por ${item.unidad} desde el ${formatearDia(precio.desde, { day: "numeric", month: "long", year: "numeric" })}; las cantidades se redondean hacia arriba.`
        : proyeccion
          ? ` ${item.codigo} no tiene precio vigente.`
          : "";
      const tamanoTotal = porVisita.reduce((s, p) => sumarDecimales(s, p.tamano), "0");
      return {
        resumen: `${decimalColombiano(tamanoTotal)} ${tamanoTotal === "1" ? nombre.singular : nombre.plural}`,
        etiqueta,
        datos: {
          ...comun,
          n: e.n,
          minimo: e.minimo,
          mediana: e.mediana,
          percentil80: e.percentil80,
          maximo: e.maximo,
          porVisita: primeras(porVisita.map((p) => ({ ...referencia(p.visita), fecha: p.visita.fuente.fecha, cantidad: p.cantidad, tamano: p.tamano, valor: p.valor })).sort(masRecientePrimero)),
          proyeccion: proyeccion && { ...proyeccion, costoMediana: costo(proyeccion.mediana), costoPercentil80: costo(proyeccion.percentil80) },
        },
        cifras,
        tabla: {
          titulo: `${item.descripcion} por ${nombre.singular}`,
          columnas: [
            { titulo: "Base", numerica: false },
            { titulo: `Por ${nombre.singular}`, numerica: true },
            ...(proyeccion
              ? [
                  { titulo: `${numeroColombiano(proyeccion.cantidad)} ${proyeccion.cantidad === 1 ? nombre.singular : nombre.plural}`, numerica: true },
                  { titulo: "Al precio vigente", numerica: true },
                ]
              : []),
          ],
          filas: [filaDe("Mediana", e.mediana, proyeccion?.mediana), filaDe("Percentil 80", e.percentil80, proyeccion?.percentil80)],
          nota: `Por ${nombre.singular}, ${e.n === 1 ? "la visita da" : `las ${e.n} visitas van de`} ${e.n === 1 ? porUnidad(e.minimo) : `${numeroColombiano(e.minimo, 1)} a ${porUnidad(e.maximo)}`}.${notaDelPrecio}`,
        },
        fuentes: fuentesDe(porVisita.map((p) => p.visita), `De ${contar(e.n, "visita revisada", "visitas revisadas")}`),
      };
    },
  };
}
