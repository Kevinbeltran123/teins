import { ErrorDelModelo, type LlamadaAHerramienta, type MensajeDelModelo, type ModeloAsistente, type VueltaDelModelo } from "./modelo";

/*
  Modelo simulado (ADR-0060): un guion fijo por palabras clave que pide las herramientas reales por nombre y termina con
  `entregar_respuesta`. Lo usan las pruebas y el extremo a extremo; no gasta ni manda datos fuera. Solo fuera de producción.
*/

const CIUDADES_DEL_TOLIMA = ["ibague", "espinal", "melgar"];

interface Resultado {
  paso: number | null;
  datos: Record<string, unknown> | null;
  cifras: { id: string }[];
  error: boolean;
}

/** Una etapa del guion: con los resultados anteriores, pide herramientas o entrega la respuesta. */
type Etapa = (anteriores: Resultado[][]) => LlamadaAHerramienta[];

const sinUso = { entrada: 0, salida: 0, cacheLeida: 0, cacheEscrita: 0 };
let contador = 0;
const llamada = (nombre: string, entrada: unknown): LlamadaAHerramienta => ({ id: `simulada_${++contador}`, nombre, entrada });

/** `cifras`: los ids que se destacan; sin ellos, la primera cifra del paso. */
const entregar = (texto: string, r?: Resultado, cifras?: string[]) =>
  llamada("entregar_respuesta", {
    texto,
    destacado: r?.paso && r.cifras[0] ? { paso: r.paso, cifras: cifras ?? [r.cifras[0].id] } : null,
    tablas: r?.paso ? [r.paso] : [],
    fuentes: r?.paso ?? null,
    serie: r?.paso ?? null,
  });

const NO_PUEDO = "No puedo responder eso con los datos del sistema.";
const sinDatos = (que: string) => entregar(`No encontré ${que} en los datos del sistema, así que no puedo responder con cifras.`);
/** Un resultado con error o sin lo que el guion necesita: el guion termina diciéndolo, sin romperse. */
const fallo = (r: Resultado | undefined) => !r || r.error || !r.datos;
const lista = (r: Resultado | undefined, campo: string): Record<string, unknown>[] => {
  const valor = r?.datos?.[campo];
  return Array.isArray(valor) ? (valor as Record<string, unknown>[]) : [];
};
const sinTildes = (texto: string) => texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

function haceUnAno(hoy: string): string {
  const fecha = new Date(`${hoy}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() - 365);
  return fecha.toISOString().slice(0, 10);
}

/**
 * Las etapas que arman el filtro de visitas del último año para sumar o estimar: con «tolima», antes las ciudades y solo
 * Ibagué, Espinal y Melgar. El filtro cubre todas las visitas que cumplen, sin depender de una lista de `buscar_visitas`.
 */
function etapasDelFiltro(hoy: string, tolima: boolean): Etapa[] {
  return tolima ? [() => [llamada("ciudades", {})]] : [];
}
type Filtro = { desde: string; ciudades?: string[] };
function filtroDe(r: Resultado[][], hoy: string, tolima: boolean): Filtro | null {
  const desde = haceUnAno(hoy);
  if (!tolima) return { desde };
  const ciudades = r
    .flat()
    .flatMap((x) => lista(x, "ciudades"))
    .map((c) => String(c.ciudad ?? ""))
    .filter((c) => CIUDADES_DEL_TOLIMA.includes(sinTildes(c)));
  return ciudades.length > 0 ? { desde, ciudades } : null;
}

const dondeBusco = (tolima: boolean) => (tolima ? "las visitas del último año en Ibagué, Espinal y Melgar.\n- Di por hecho que esas ciudades son las del Tolima." : "las visitas del último año.");

function etapasPara(pregunta: string, hoy: string): Etapa[] {
  const p = sinTildes(pregunta);
  const tolima = p.includes("tolima");
  if (p.includes("presupuest")) {
    const cantidad = Number(p.match(/\d+/)?.[0] ?? 40);
    // El modelo no guarda estado entre vueltas: cada etapa lee lo que necesita de los resultados.
    const itemsDe = (r: Resultado[][]) => (r[0] ?? []).map((x) => lista(x, "items")[0]);
    return [
      () => [llamada("buscar_en_catalogo", { texto: "UTP" }), llamada("buscar_en_catalogo", { texto: "punto de red" })],
      ...etapasDelFiltro(hoy, tolima),
      (r) => {
        const [utp, punto] = itemsDe(r);
        if (!utp || !punto) return [sinDatos("el cable UTP o el punto de red en el catálogo")];
        const filtro = filtroDe(r, hoy, tolima);
        if (!filtro) return [sinDatos("visitas en ciudades del Tolima")];
        return [llamada("estimar_materiales", { visitas: filtro, item: utp.id, porItem: punto.id, cantidad })];
      },
      (r) => {
        const estimado = r.at(-1)?.[0];
        if (fallo(estimado)) return [sinDatos("visitas revisadas con esos materiales")];
        return [entregar(`Estimé el cable UTP para ${cantidad} puntos de red con el percentil 80 de lo que se usó por punto en ${dondeBusco(tolima)}\n- Con pocas visitas, el estimado es orientativo.`, estimado, ["proyeccion-p80", "costo-p80"])];
      },
    ];
  }
  if (p.includes("cable")) {
    return [
      () => [llamada("buscar_en_catalogo", { texto: "cable" })],
      ...etapasDelFiltro(hoy, tolima),
      (r) => {
        if (fallo(r[0]![0])) return [sinDatos("cable en el catálogo")];
        const filtro = filtroDe(r, hoy, tolima);
        if (!filtro) return [sinDatos("visitas en ciudades del Tolima")];
        return [llamada("sumar_materiales", { visitas: filtro, texto: "cable" })];
      },
      (r) => {
        const suma = r.at(-1)?.[0];
        if (fallo(suma)) return [sinDatos("materiales revisados de esas visitas")];
        return [entregar(`Sumé el cable de los levantamientos revisados de ${dondeBusco(tolima)}\n- Las visitas sin revisar quedaron fuera.`, suma)];
      },
    ];
  }
  if (p.includes("mes") || p.includes("ups")) {
    return [
      () => [llamada("contar_visitas", { desde: haceUnAno(hoy), agruparPor: "mes" })],
      (r) => {
        const conteo = r[0]![0];
        if (fallo(conteo)) return [sinDatos("visitas para contar")];
        return [entregar("Conté las visitas de cada mes del último año.", conteo)];
      },
    ];
  }
  if (p.includes("resum")) {
    return [
      () => [llamada("buscar_visitas", { desde: haceUnAno(hoy) })],
      (r) => {
        const revisada = lista(r[0]![0], "visitas")
          .filter((v) => v.revisado === true && typeof v.orden === "string")
          .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))[0];
        if (!revisada) return [sinDatos("un levantamiento revisado")];
        return [llamada("leer_levantamiento", { orden: revisada.orden })];
      },
      (r) => {
        const leido = r[1]![0];
        if (fallo(leido)) return [sinDatos("ese levantamiento")];
        return [entregar("Este es el resumen del último levantamiento revisado, con lo que registró el técnico.", leido)];
      },
    ];
  }
  return [() => [entregar(NO_PUEDO)]];
}

function leerResultado(r: { contenido: string; esError: boolean }): Resultado {
  if (r.esError) return { paso: null, datos: null, cifras: [], error: true };
  try {
    const valor = JSON.parse(r.contenido) as { paso?: number; datos?: unknown; cifras?: { id: string }[] };
    const datos = valor.datos && typeof valor.datos === "object" ? (valor.datos as Record<string, unknown>) : null;
    return { paso: valor.paso ?? null, datos, cifras: valor.cifras ?? [], error: false };
  } catch {
    return { paso: null, datos: null, cifras: [], error: true };
  }
}

export function modeloSimulado({ pausaMs = 0 }: { pausaMs?: number } = {}): ModeloAsistente {
  return {
    nombre: "simulado",
    async responder({ mensajes, senal }): Promise<VueltaDelModelo> {
      // Una pausa corta para que la pantalla alcance a mostrar cada paso.
      if (pausaMs > 0) await new Promise((listo) => setTimeout(listo, pausaMs, undefined));
      // Como el modelo real: el corte por tiempo es un error del modelo con su mensaje, no una excepción cualquiera.
      if (senal?.aborted) throw new ErrorDelModelo("La respuesta tardó demasiado. Vuelva a preguntar.", "tiempo_agotado");
      const ultimaPregunta = mensajes.findLastIndex((m) => m.tipo === "texto" && m.rol === "user");
      const texto = (mensajes[ultimaPregunta] as Extract<MensajeDelModelo, { tipo: "texto" }> | undefined)?.texto ?? "";
      // El bucle antepone la fecha de hoy a la pregunta.
      const hoy = texto.match(/^Hoy es (\d{4}-\d{2}-\d{2})\./)?.[1] ?? new Date().toISOString().slice(0, 10);
      const pregunta = texto.replace(/^Hoy es \d{4}-\d{2}-\d{2}\.\s*/, "");
      const resultados = mensajes
        .slice(ultimaPregunta + 1)
        .flatMap((m) => (m.tipo === "resultados" ? [m.resultados.map(leerResultado)] : []));
      const etapas = etapasPara(pregunta, hoy);
      const llamadas = (etapas[resultados.length] ?? etapas.at(-1)!)(resultados);
      return { motivo: "tool_use", texto: "", llamadas, contenido: { llamadas }, uso: sinUso };
    },
  };
}
