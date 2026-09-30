import { useState } from "react";
import { BotonSiguiente, Check, Dialogo, Search } from "@teins/ui";
import { buscarEnCatalogo, frecuentes } from "../catalogo";
import type { ItemCatalogoLocal } from "../datos/modelo";

/**
 * El catálogo (iteración 17, ADR-0025) como en el prototipo aprobado: una hoja alta, el buscador arriba y
 * cada ítem con "Agregar", que se vuelve − cantidad + en el mismo lugar (Gojek en Mobbin). Buscar funciona
 * sin conexión; lo que no está se agrega como línea libre. Se carga aparte.
 */
export default function HojaCatalogo({
  items,
  unidades,
  usos,
  cantidadDe,
  elegir,
  sumar,
  libre,
  total,
  cerrar,
}: {
  items: readonly ItemCatalogoLocal[];
  unidades: readonly string[];
  /** Cuántas líneas usan cada ítem en este teléfono: ordena la lista. */
  usos: ReadonlyMap<string, number>;
  /** La cantidad del ítem en este levantamiento, si ya está. */
  cantidadDe: (item: ItemCatalogoLocal) => string | undefined;
  elegir: (item: ItemCatalogoLocal) => void;
  sumar: (item: ItemCatalogoLocal, delta: number) => void;
  libre: (descripcion: string) => void;
  total: number;
  cerrar: () => void;
}) {
  const [consulta, setConsulta] = useState("");
  const buscando = consulta.trim() !== "";
  const masUsados = frecuentes(items, usos, unidades);
  // Sin historial en este teléfono, se ofrece el catálogo tal cual (como en el prototipo), no una hoja vacía.
  const todos = items.filter((i) => i.activo && unidades.includes(i.unidad)).sort((a, b) => a.descripcion.localeCompare(b.descripcion, "es")).slice(0, 30);
  const lista = buscando ? buscarEnCatalogo(items, consulta, unidades, usos) : masUsados.length > 0 ? masUsados : todos;

  return (
    <Dialogo forma="hoja" titulo="Catálogo" alCerrar={cerrar} focoEnElDialogo>
      <div className="flex min-h-full flex-col gap-3">
        <label className="flex h-14 shrink-0 items-center gap-2.5 rounded-control border-2 border-acento bg-panel-hundido px-4 [&_svg]:size-5 [&_svg]:text-texto-secundario">
          <Search aria-hidden />
          <input
            type="search"
            aria-label="Buscar en el catálogo"
            placeholder="Nombre o código"
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            className="min-w-0 grow bg-transparent text-cuerpo outline-none placeholder:text-texto-secundario"
          />
        </label>
        {buscando ? (
          <p role="status" className="text-ayuda text-texto-secundario">
            {lista.length === 1 ? "1 ítem" : `${lista.length} ítems`}
          </p>
        ) : lista.length > 0 ? (
          <h3 className="text-ayuda font-extrabold text-texto-secundario">{masUsados.length > 0 ? "Los que más usas" : "Del catálogo"}</h3>
        ) : (
          <p className="text-ayuda text-texto-secundario">Escribe el nombre o el código del material.</p>
        )}
        {lista.length > 0 && (
          <ul aria-label={buscando ? "Resultados" : masUsados.length > 0 ? "Los que más usas" : "Del catálogo"} className="flex flex-col gap-2">
            {lista.map((item) => {
              const cantidad = cantidadDe(item);
              return (
                <li key={item.id} className="flex items-center gap-3 rounded-control bg-panel-hundido py-3 pr-3 pl-3.5">
                  <span className="flex min-w-0 grow flex-col">
                    <strong className="text-cuerpo leading-snug">{item.descripcion}</strong>
                    <span className="text-ayuda font-bold tracking-wide text-texto-secundario">
                      {item.codigo} · {item.unidad}
                    </span>
                  </span>
                  {cantidad === undefined ? (
                    <button
                      type="button"
                      onClick={() => elegir(item)}
                      aria-label={`Agregar ${item.descripcion}`}
                      className="h-11 shrink-0 rounded-control bg-superficie px-4 text-ayuda font-extrabold text-sobre-superficie active:scale-95 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-foco"
                    >
                      Agregar
                    </button>
                  ) : (
                    <span className="flex shrink-0 items-center rounded-control bg-panel motion-safe:animate-aparecer">
                      <button type="button" aria-label={`Menos ${item.descripcion}`} onClick={() => sumar(item, -1)} className="grid h-11 w-10 place-items-center text-subtitulo font-extrabold">
                        −
                      </button>
                      <output className="min-w-8 text-center text-cuerpo font-extrabold tabular-nums">{cantidad}</output>
                      <button type="button" aria-label={`Más ${item.descripcion}`} onClick={() => sumar(item, 1)} className="grid h-11 w-10 place-items-center text-subtitulo font-extrabold">
                        +
                      </button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {buscando && (
          <button type="button" onClick={() => libre(consulta.trim())} className="self-center py-2 text-center text-ayuda font-bold text-texto-secundario underline underline-offset-3">
            {`No está: agregar “${consulta.trim()}” como línea libre`}
          </button>
        )}
        <div className="sticky bottom-0 mt-auto flex bg-panel pt-3">
          <BotonSiguiente icono={Check} onClick={cerrar}>
            {`Listo · ${total === 1 ? "1 material" : `${total} materiales`}`}
          </BotonSiguiente>
        </div>
      </div>
    </Dialogo>
  );
}
