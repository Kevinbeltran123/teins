import { useState } from "react";
import { Boton, CampoBusqueda, Dialogo } from "@teins/ui";
import { buscarEnCatalogo, frecuentes } from "../catalogo";
import type { ItemCatalogoLocal } from "../datos/modelo";

/**
 * Agregar del catálogo (iteración 17, ADR-0025): buscar sin conexión o elegir entre los que más usa el
 * técnico. Lo que no está se agrega como línea libre con lo que ya escribió. Se carga aparte.
 */
export default function HojaCatalogo({
  items,
  unidades,
  usos,
  elegir,
  libre,
  cerrar,
}: {
  items: readonly ItemCatalogoLocal[];
  unidades: readonly string[];
  /** Cuántas líneas usan cada ítem en este teléfono: ordena la lista. */
  usos: ReadonlyMap<string, number>;
  elegir: (item: ItemCatalogoLocal) => void;
  libre: (descripcion: string) => void;
  cerrar: () => void;
}) {
  const [consulta, setConsulta] = useState("");
  const buscando = consulta.trim() !== "";
  const lista = buscando ? buscarEnCatalogo(items, consulta, unidades, usos) : frecuentes(items, usos, unidades);

  return (
    <Dialogo forma="inferior" titulo="Agregar del catálogo" alCerrar={cerrar}>
      <div className="flex flex-col gap-3">
        <CampoBusqueda etiqueta="Buscar en el catálogo" ejemplo="Buscar por nombre o código" valor={consulta} onCambio={setConsulta} />
        {buscando ? (
          <p role="status" className="text-ayuda text-texto-secundario">
            {lista.length === 1 ? "1 ítem" : `${lista.length} ítems`}
          </p>
        ) : lista.length > 0 ? (
          <h3 className="text-ayuda font-extrabold text-texto-secundario">Los que más usas</h3>
        ) : (
          <p className="text-ayuda text-texto-secundario">Escribe el nombre o el código del material.</p>
        )}
        {lista.length > 0 && (
          <ul aria-label={buscando ? "Resultados" : "Los que más usas"} className="flex flex-col">
            {lista.map((item) => (
              <li key={item.id} className="border-b border-division last:border-0">
                <button
                  type="button"
                  onClick={() => elegir(item)}
                  className="flex min-h-tactil w-full flex-col justify-center gap-0.5 rounded-control px-1 py-2 text-left hover:bg-encima focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-superficie"
                >
                  <span className="text-cuerpo font-bold">{item.descripcion}</span>
                  <span className="text-ayuda text-texto-secundario">
                    {item.codigo} · {item.unidad}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {buscando && (
          <Boton variante="fantasma" className="self-start" onClick={() => libre(consulta.trim())}>
            No está: agregar “{consulta.trim()}” como línea libre
          </Boton>
        )}
      </div>
    </Dialogo>
  );
}
