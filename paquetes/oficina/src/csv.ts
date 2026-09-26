/**
 * CSV para Excel en español (iteración 11, P29): punto y coma como separador, coma decimal y BOM para
 * que las tildes se lean bien. Se genera en el navegador: el servidor entrega los datos, no el archivo.
 */
import { aDecimalColombiano, resumirCantidades } from "@teins/dominio";
import type { Respuesta } from "@teins/protocolo";

type CantidadesDeVisita = Respuesta<"cantidadesDeVisita">;

/**
 * Una celda de texto libre (lo que escribió el técnico) no puede empezar como una fórmula: Excel la
 * ejecutaría al abrir el archivo. Se antepone un apóstrofo, que Excel muestra como texto.
 */
function celda(valor: string): string {
  const seguro = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  return /[;"\r\n]/.test(seguro) ? `"${seguro.replaceAll('"', '""')}"` : seguro;
}

export const aCsv = (filas: readonly (readonly string[])[]) => `﻿${filas.map((f) => f.map(celda).join(";")).join("\r\n")}\r\n`;

const ESTADOS = { enviado: "Por revisar", en_revision: "En revisión", revisado: "Revisado" } as const;

/** Detalle: una fila por línea, con la visita, el levantamiento, la ubicación y el vínculo al catálogo. */
export function csvDetalle({ visita, lineas }: CantidadesDeVisita): string {
  return aCsv([
    ["Fecha de la visita", "Cliente", "Sitio", "Levantamiento", "Estado", "Técnico", "Ubicación", "Descripción", "Cantidad", "Unidad", "Observación", "Código del catálogo", "Descripción del catálogo"],
    ...lineas.map((l) => [
      visita.programadaPara,
      visita.cliente,
      visita.sitio,
      l.levantamientoId.slice(0, 8),
      ESTADOS[l.estado],
      l.tecnico,
      l.ubicacion,
      l.descripcion,
      aDecimalColombiano(l.cantidad),
      l.unidad,
      l.observacion ?? "",
      l.item?.codigo ?? "",
      l.item?.descripcion ?? "",
    ]),
  ]);
}

/** Resumen: la suma por ítem del catálogo y unidad; lo no vinculado, por descripción y unidad. */
export function csvResumen({ lineas }: CantidadesDeVisita): string {
  return aCsv([
    ["Código del catálogo", "Descripción", "Cantidad", "Unidad", "Líneas"],
    ...resumirCantidades(lineas).map((f) => [f.codigo ?? "Sin vincular", f.descripcion, aDecimalColombiano(f.cantidad), f.unidad, String(f.lineas)]),
  ]);
}

/** Lee un CSV (RFC 4180) con el separador dado; las comillas dobles admiten separadores y saltos de línea. */
function leerFilas(texto: string, separador: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let valor = "";
  let entreComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]!;
    if (entreComillas) {
      if (c === '"' && texto[i + 1] === '"') {
        valor += '"';
        i++;
      } else if (c === '"') entreComillas = false;
      else valor += c;
    } else if (c === '"') entreComillas = true;
    else if (c === separador) {
      fila.push(valor);
      valor = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fila.push(valor);
      filas.push(fila);
      fila = [];
      valor = "";
    } else valor += c;
  }
  if (valor !== "" || fila.length > 0) {
    fila.push(valor);
    filas.push(fila);
  }
  return filas;
}

const sinTildes = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase();

export interface CatalogoLeido {
  items: { codigo: string; descripcion: string; unidad: string }[];
  /** Filas que no se pueden importar, con su número tal como lo ve Excel. */
  errores: string[];
}

/**
 * El catálogo que ya tiene TEINS (P28): código, descripción y unidad. Acepta punto y coma o coma, con o
 * sin encabezado; con encabezado, las columnas se reconocen por nombre en cualquier orden.
 */
export function leerCatalogo(texto: string): CatalogoLeido {
  const limpio = texto.replace(/^﻿/, "");
  const primera = limpio.split(/\r?\n/, 1)[0] ?? "";
  const separador = (primera.match(/;/g)?.length ?? 0) >= (primera.match(/,/g)?.length ?? 0) ? ";" : ",";
  const filas = leerFilas(limpio, separador);

  const encabezado = (filas[0] ?? []).map(sinTildes);
  const columna = (nombres: string[]) => encabezado.findIndex((c) => nombres.includes(c));
  const conEncabezado = columna(["codigo", "cod", "code"]) >= 0;
  const indices = conEncabezado
    ? { codigo: columna(["codigo", "cod", "code"]), descripcion: columna(["descripcion", "nombre", "item"]), unidad: columna(["unidad", "und", "unidad de medida"]) }
    : { codigo: 0, descripcion: 1, unidad: 2 };

  const items: CatalogoLeido["items"] = [];
  const errores: string[] = [];
  if (conEncabezado && (indices.descripcion < 0 || indices.unidad < 0)) {
    return { items, errores: ["El encabezado necesita las columnas Código, Descripción y Unidad."] };
  }
  filas.forEach((fila, i) => {
    if (conEncabezado && i === 0) return;
    if (fila.every((c) => c.trim() === "")) return;
    const [codigo, descripcion, unidad] = [indices.codigo, indices.descripcion, indices.unidad].map((j) => (fila[j] ?? "").trim()) as [string, string, string];
    const numero = i + 1;
    if (!codigo || !descripcion || !unidad) errores.push(`Fila ${numero}: le falta el código, la descripción o la unidad.`);
    else if (codigo.length > 40 || descripcion.length > 200 || unidad.length > 20) errores.push(`Fila ${numero}: el código admite 40 caracteres, la descripción 200 y la unidad 20.`);
    else items.push({ codigo, descripcion, unidad });
  });
  return { items, errores };
}

/** Descarga un texto como archivo, sin pasar por el servidor. */
export function descargar(nombre: string, contenido: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: "text/csv;charset=utf-8" }));
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
