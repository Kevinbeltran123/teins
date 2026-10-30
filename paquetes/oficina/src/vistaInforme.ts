import { useQueries } from "@tanstack/react-query";
import { bocetosReferenciados, esFirma, firmaASvg, fotosReferenciadas, hojaASvg, hojasDe, type ContenidoVersion } from "@teins/dominio";
import type { HojaDelInforme } from "@teins/documentos";
import type { Respuesta } from "@teins/protocolo";
import { consultas } from "./api";

/*
  Lo que la vista en vivo del informe necesita de cada levantamiento (ADR-0031), armado como lo arma el servidor al
  publicar y el worker al imprimir: el mismo capítulo, las fotos por su URL firmada y los bocetos y firmas en SVG.
*/

type Detalle = Respuesta<"obtenerLevantamiento">;

/** Lo que firma el capítulo (ADR-0051), que el informe en edición trae junto a sus candidatos. */
export type FirmasDelCapitulo = Pick<Respuesta<"obtenerInforme">["candidatos"][number], "tecnicoDocumento" | "revisorDocumento" | "revisadoEn">;

/** El capítulo de un levantamiento, como queda en la copia congelada de la versión. */
export const capituloDe = (d: Detalle, firmas: FirmasDelCapitulo = {}): ContenidoVersion["levantamientos"][number] => ({
  id: d.id,
  formato: d.formatoDefinicion,
  tecnico: d.tecnico.nombre,
  revisor: d.revisor?.nombre ?? "[Revisor]",
  ...(firmas.tecnicoDocumento ? { tecnicoDocumento: firmas.tecnicoDocumento } : {}),
  ...(firmas.revisorDocumento ? { revisorDocumento: firmas.revisorDocumento } : {}),
  ...(firmas.revisadoEn ? { revisadoEn: firmas.revisadoEn } : {}),
  recibidoEn: d.recibidoEn,
  respuestas: d.respuestas,
  ...(Object.keys(d.repeticiones).length > 0 ? { repeticiones: d.repeticiones } : {}),
});

/** Fotos, bocetos y firmas de los levantamientos. Lo que todavía no llegó no está: la plantilla pone su marcador. */
export function useRecursosDelInforme(detalles: readonly Detalle[]) {
  const huellasFotos = [...new Set(detalles.flatMap((d) => fotosReferenciadas(d.respuestas)))];
  const huellasBocetos = [...new Set(detalles.flatMap((d) => bocetosReferenciados(d.respuestas)))];
  const urls = useQueries({ queries: huellasFotos.map((h) => consultas.urlDeArchivo(h)) });
  const documentos = useQueries({ queries: huellasBocetos.map((h) => consultas.boceto(h)) });
  // Una firma es un boceto de una sola hoja (ADR-0024): se dibuja sin cuadrícula y recortada a sus trazos.
  const deFirmas = new Set(detalles.flatMap((d) => Object.values(d.respuestas).flatMap((seccion) => Object.values(seccion).flatMap((v) => (esFirma(v) ? [v.firma] : [])))));

  const fotos = new Map<string, string>();
  urls.forEach((u, i) => u.data && fotos.set(huellasFotos[i]!, u.data.url));
  const bocetos = new Map<string, HojaDelInforme[]>();
  const firmas = new Map<string, string>();
  documentos.forEach((q, i) => {
    const h = huellasBocetos[i]!;
    if (!q.data) return;
    if (deFirmas.has(h)) firmas.set(h, firmaASvg(q.data));
    else bocetos.set(h, hojasDe(q.data).map((hoja) => ({ nombre: hoja.nombre, vertical: hoja.alto > hoja.ancho, svg: hojaASvg(hoja) })));
  });
  return { fotos, bocetos, firmas };
}
