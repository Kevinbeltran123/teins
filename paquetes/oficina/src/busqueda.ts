import { normalizarTexto } from "@teins/ui";

/*
  Buscar en todo (iteración 37, prototipos/usabilidad-oficina, «Buscar e ir»): clientes, visitas, levantamientos,
  informes y cotizaciones, más las acciones y las secciones. Se arma con las mismas consultas de cada lista, así que
  ve lo mismo que la persona ve en ellas: los levantamientos los busca el servidor (llegan por páginas); lo demás ya
  está completo en oficina y se busca aquí.
*/

export interface Resultado {
  tipo: "accion" | "ir" | "cliente" | "visita" | "levantamiento" | "informe" | "cotizacion";
  id: string;
  titulo: string;
  detalle?: string;
}

export interface Fuentes {
  recientes: Resultado[];
  acciones: Resultado[];
  secciones: Resultado[];
  clientes: Resultado[];
  visitas: Resultado[];
  /** Ya buscados por el servidor: no se vuelven a filtrar. */
  levantamientos: Resultado[];
  informes: Resultado[];
  cotizaciones: Resultado[];
}

export interface Grupo {
  grupo: string;
  resultados: Resultado[];
}

/** Cada palabra tiene que estar en el título o en el detalle, sin importar tildes ni mayúsculas. */
function coincideCon(palabras: string[], r: Resultado) {
  const texto = normalizarTexto(`${r.titulo} ${r.detalle ?? ""}`);
  return palabras.every((p) => texto.includes(p));
}

export function resultadosDeBusqueda(busqueda: string, f: Fuentes, porGrupo = 4): Grupo[] {
  const palabras = normalizarTexto(busqueda).split(/\s+/).filter(Boolean);
  const grupos: [string, Resultado[]][] =
    palabras.length === 0
      ? [
          ["Recientes", f.recientes],
          ["Acciones", f.acciones],
        ]
      : [
          ["Acciones", f.acciones.filter((r) => coincideCon(palabras, r))],
          ["Ir a", f.secciones.filter((r) => coincideCon(palabras, r))],
          ["Clientes", f.clientes.filter((r) => coincideCon(palabras, r))],
          ["Visitas", f.visitas.filter((r) => coincideCon(palabras, r))],
          ["Levantamientos", f.levantamientos],
          ["Informes", f.informes.filter((r) => coincideCon(palabras, r))],
          ["Cotizaciones", f.cotizaciones.filter((r) => coincideCon(palabras, r))],
        ];
  return grupos.filter(([, l]) => l.length > 0).map(([grupo, l]) => ({ grupo, resultados: l.slice(0, porGrupo) }));
}
