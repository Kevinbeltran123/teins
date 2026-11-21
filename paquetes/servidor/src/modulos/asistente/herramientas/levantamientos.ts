import { z } from "zod";
import { bloquesVisibles, campoVisible, describirValor, esCantidades, esNoObtenido, esOpciones, type DefinicionCampo, type Valor } from "@teins/dominio";
import { Uuid } from "@teins/protocolo";
import { problema } from "../../../plataforma/errores";
import type { ContenidoDeLevantamiento } from "../../levantamientos";
import type { Herramienta } from "../tipos";
import { cantidadConUnidad, contar, estadisticas, normalizarTexto, numeroColombiano, preguntaPorPersona, redactar } from "./calculos";
import { TextoCorto, visitasConEstado, type DependenciasDeHerramientas } from "./comun";

/** Lo que nunca sale de un levantamiento (ADR-0060): fotos (con su sello de ubicación), croquis y firmas. */
const SIN_SALIR = new Set<DefinicionCampo["tipo"]>(["foto", "boceto", "firma"]);

/** Tope de levantamientos que lee `valores_de_campo`: los más recientes. */
const MAXIMO_DE_LEVANTAMIENTOS = 200;

const ESTADOS: Record<string, string> = { enviado: "Esperando revisión", en_revision: "En revisión", revisado: "Revisado" };

/** Un valor como lo lee una persona, con los correos y celulares de los textos libres cambiados. */
function valorLegible(campo: DefinicionCampo, valor: Valor): string {
  // Bajo una etiqueta que pregunta por una persona, lo escrito a mano es un dato personal; las opciones del formato
  // («Vigilante») son roles y salen igual.
  if (preguntaPorPersona(campo.etiqueta) && !esNoObtenido(valor)) {
    if (campo.tipo === "texto") return "[dato personal]";
    if (campo.tipo === "opcion" && typeof valor === "string" && !campo.opciones.includes(valor)) return "[dato personal]";
    if (campo.tipo === "opciones" && esOpciones(valor) && valor.otro) return [...valor.elegidas, "[dato personal]"].join(", ");
  }
  if (campo.tipo === "cantidades" && esCantidades(valor)) {
    return valor.map((l) => `${redactar(l.descripcion)}: ${cantidadConUnidad(l.cantidad, l.unidad)}${l.observacion ? ` (${redactar(l.observacion)})` : ""}`).join("; ");
  }
  return redactar(describirValor(campo, valor));
}

export function leerLevantamiento(deps: DependenciasDeHerramientas): Herramienta<{ orden?: string | undefined; levantamientoId?: string | undefined }> {
  return {
    nombre: "leer_levantamiento",
    descripcion:
      "Lee un levantamiento por el número de orden de su visita (por ejemplo «0041») o por su id: cliente, sitio, ciudad, fecha, servicio, estado y cada sección con sus campos. Sin fotos, firmas, croquis ni coordenadas; los correos y celulares de los textos vienen cambiados por [correo] y [celular]. Use exactamente uno de los dos.",
    entrada: z
      .object({ orden: z.string().regex(/^\d{1,9}$/).optional(), levantamientoId: Uuid.optional() })
      .strict()
      .refine((e) => (e.orden === undefined) !== (e.levantamientoId === undefined), "Exactamente uno: orden o levantamientoId"),
    etiquetas: ({ orden }) => {
      const resto = `el levantamiento${orden ? ` de la orden ${orden}` : ""}`;
      return { enCurso: `Leyendo ${resto}`, hecha: `Leyó ${resto}` };
    },
    async ejecutar(tx, { orden, levantamientoId }) {
      let id = levantamientoId;
      if (orden !== undefined) {
        const visitaId = await deps.visitas.porOrden(tx, Number(orden));
        if (!visitaId) throw problema("no_encontrado", `No hay una visita con la orden ${orden}`);
        const levantamientos = await deps.levantamientos.deVisitas(tx, [visitaId]);
        id = (levantamientos.filter((l) => l.estado === "revisado").at(-1) ?? levantamientos.at(-1))?.id;
        if (!id) throw problema("no_encontrado", `La orden ${orden} no tiene levantamiento`);
      }
      const contenido = await deps.levantamientos.contenido(tx, id!);
      if (!contenido) throw problema("no_encontrado", "No existe ese levantamiento");
      const [visita] = await visitasConEstado(tx, deps, [contenido.visitaId]);
      const secciones = bloquesVisibles(contenido.definicion, contenido.repeticiones, contenido.respuestas).flatMap((b) => {
        const respuestas = contenido.respuestas[b.clave] ?? {};
        const campos = b.seccion.campos.flatMap((c) => {
          const valor = respuestas[c.clave];
          if (SIN_SALIR.has(c.tipo) || valor === undefined || !campoVisible(c, b.clave, contenido.respuestas)) return [];
          return [{ etiqueta: c.etiqueta, valor: valorLegible(c, valor) }];
        });
        return campos.length > 0 ? [{ titulo: b.titulo, campos }] : [];
      });
      const fuente = visita?.fuente;
      return {
        resumen: contar(secciones.length, "sección", "secciones"),
        datos: {
          levantamientoId: contenido.id,
          visitaId: contenido.visitaId,
          orden: fuente?.orden ?? null,
          fecha: fuente?.fecha ?? null,
          cliente: fuente?.cliente ?? null,
          sitio: fuente?.sitio ?? null,
          ciudad: fuente?.ciudad ?? null,
          servicio: visita?.servicio ?? contenido.definicion.nombre ?? contenido.formato,
          estado: ESTADOS[contenido.estado] ?? contenido.estado,
          secciones,
        },
        tabla: {
          titulo: `Levantamiento${fuente?.orden ? ` de la orden ${fuente.orden}` : ""}`,
          columnas: [
            { titulo: "Sección", numerica: false },
            { titulo: "Dato", numerica: false },
            { titulo: "Valor", numerica: false },
          ],
          filas: secciones.flatMap((s) => s.campos.map((c) => [{ texto: s.titulo }, { texto: c.etiqueta }, { texto: c.valor }])),
        },
        ...(fuente && !visita?.cancelada ? { fuentes: { titulo: "De 1 levantamiento", visitas: [{ ...fuente, levantamientoId: contenido.id, revisado: contenido.estado === "revisado" }] } } : {}),
      };
    },
  };
}

type Conteo = Map<string, number>;

export function valoresDeCampo(deps: DependenciasDeHerramientas): Herramienta<{ formato: string; campo: string; visitas?: string[] | undefined }> {
  return {
    nombre: "valores_de_campo",
    descripcion:
      "En los levantamientos revisados de un formato (clave o nombre), cuántas veces salió cada opción de un campo de opción u opciones, o el n, mínimo, mediana y máximo de un campo numérico (medida), por unidad. `campo`: su clave o su etiqueta. Con `visitas`, solo las de esas visitas; sin ellas, las visitas sin cancelar de los últimos 12 meses. Lee los 200 levantamientos revisados más recientes.",
    entrada: z.object({ formato: TextoCorto, campo: TextoCorto, visitas: z.array(Uuid).min(1).max(1000).optional() }).strict(),
    etiquetas: ({ campo }) => ({ enCurso: `Contando los valores de «${campo}»`, hecha: `Contó los valores de «${campo}»` }),
    async ejecutar(tx, { formato, campo, visitas }, { hoy }) {
      const buscado = normalizarTexto(formato);
      const claves = new Set([formato, ...(await deps.formatos.vigentes(tx)).filter((f) => normalizarTexto(f.clave) === buscado || normalizarTexto(f.nombre) === buscado).map((f) => f.clave)]);
      let visitaIds = visitas;
      if (!visitaIds) {
        const desde = new Date(`${hoy}T12:00:00Z`);
        desde.setUTCDate(desde.getUTCDate() - 365);
        const delAnio = await deps.visitas.porFiltro(tx, { desde: desde.toISOString().slice(0, 10), hasta: hoy });
        if (delAnio.hayMas) throw problema("entrada_invalida", "Demasiadas visitas: acote el periodo");
        visitaIds = delAnio.visitas.filter((v) => !v.cancelada).map((v) => v.id);
      }
      const revisados = (await deps.levantamientos.deVisitas(tx, visitaIds))
        .filter((l) => l.estado === "revisado" && claves.has(l.formato))
        .sort((a, b) => b.recibidoEn.getTime() - a.recibidoEn.getTime())
        .slice(0, MAXIMO_DE_LEVANTAMIENTOS);

      const campoBuscado = normalizarTexto(campo);
      const coincide = (c: DefinicionCampo) => normalizarTexto(c.clave) === campoBuscado || normalizarTexto(c.etiqueta) === campoBuscado;
      const opciones: Conteo = new Map();
      const numeros = new Map<string, number[]>();
      let etiqueta: string | undefined;
      let tipo: DefinicionCampo["tipo"] | undefined;
      let leidos = 0;
      for (const { id } of revisados) {
        const contenido: ContenidoDeLevantamiento | undefined = await deps.levantamientos.contenido(tx, id);
        if (!contenido) continue;
        let tiene = false;
        for (const b of bloquesVisibles(contenido.definicion, contenido.repeticiones, contenido.respuestas)) {
          for (const c of b.seccion.campos.filter(coincide)) {
            if (c.tipo !== "opcion" && c.tipo !== "opciones" && c.tipo !== "medida") throw problema("entrada_invalida", `«${c.etiqueta}» no es un campo de opción, opciones ni número`);
            etiqueta ??= c.etiqueta;
            tipo ??= c.tipo;
            tiene = true;
            const valor = contenido.respuestas[b.clave]?.[c.clave];
            if (valor === undefined || !campoVisible(c, b.clave, contenido.respuestas)) continue;
            const sumar = (o: string) => opciones.set(o, (opciones.get(o) ?? 0) + 1);
            if (esNoObtenido(valor)) sumar("No se pudo obtener");
            else if (c.tipo === "opcion" && typeof valor === "string") sumar(c.opciones.includes(valor) ? valor : "Otro");
            else if (c.tipo === "opciones" && esOpciones(valor)) {
              for (const o of valor.elegidas) sumar(c.opciones.includes(o) ? o : "Otro");
              if (valor.otro) sumar("Otro");
            } else if (c.tipo === "medida" && typeof valor === "object" && "valor" in valor && "unidad" in valor) {
              numeros.set(valor.unidad, [...(numeros.get(valor.unidad) ?? []), Number(valor.valor)]);
            }
          }
        }
        if (tiene) leidos++;
      }
      if (!tipo) throw problema("no_encontrado", `No hay levantamientos revisados de ese formato con el campo «${campo}»`);

      if (tipo === "medida") {
        const porUnidad = [...numeros].map(([unidad, valores]) => {
          const e = estadisticas(valores);
          return { unidad, n: e.n, minimo: e.minimo, mediana: e.mediana, maximo: e.maximo };
        });
        const num = (v: number) => numeroColombiano(v, Number.isInteger(v) ? 0 : 1);
        return {
          resumen: contar(leidos, "levantamiento", "levantamientos"),
          datos: { campo: etiqueta, tipo: "numero", levantamientos: leidos, porUnidad },
          tabla: {
            titulo: etiqueta!,
            columnas: [
              { titulo: "Unidad", numerica: false },
              { titulo: "Valores", numerica: true },
              { titulo: "Mínimo", numerica: true },
              { titulo: "Mediana", numerica: true },
              { titulo: "Máximo", numerica: true },
            ],
            filas: porUnidad.map((u) => [{ texto: u.unidad }, { texto: numeroColombiano(u.n) }, { texto: num(u.minimo) }, { texto: num(u.mediana) }, { texto: num(u.maximo) }]),
          },
        };
      }
      const conteos = [...opciones].map(([opcion, veces]) => ({ opcion, veces })).sort((a, b) => b.veces - a.veces || a.opcion.localeCompare(b.opcion, "es"));
      return {
        resumen: contar(leidos, "levantamiento", "levantamientos"),
        datos: { campo: etiqueta, tipo, levantamientos: leidos, conteos },
        tabla: {
          titulo: etiqueta!,
          columnas: [
            { titulo: "Opción", numerica: false },
            { titulo: "Veces", numerica: true },
          ],
          filas: conteos.map((c) => [{ texto: c.opcion }, { texto: numeroColombiano(c.veces) }]),
        },
      };
    },
  };
}
