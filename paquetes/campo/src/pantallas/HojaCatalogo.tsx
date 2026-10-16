import { useState } from "react";
import { Boton, CircleCheck, Dialogo, Search } from "@teins/ui";
import { buscarEnCatalogo, frecuentes } from "../catalogo";
import type { ItemCatalogoLocal } from "../datos/modelo";

/**
 * El catálogo (iteración 17, ADR-0025) como en el prototipo aprobado: una hoja alta, el buscador arriba y
 * cada ítem con "Agregar", que se vuelve − cantidad + en el mismo lugar (Gojek en Mobbin). Buscar funciona
 * sin conexión; lo que no está se agrega como línea libre. Se carga aparte.
 *
 * Cada "Agregar" ya guarda la línea (iteración 32): abajo no hay un botón que parezca confirmar, sino una franja que
 * dice lo que ya pasó ("2 agregados a Materiales") y a dónde lleva el botón, solo cuando se agregó algo.
 */
export default function HojaCatalogo({
  items,
  unidades,
  usos,
  cantidadDe,
  elegir,
  sumar,
  libre,
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
  cerrar: () => void;
}) {
  const [consulta, setConsulta] = useState("");
  // Lo agregado desde que se abrió la hoja, en el orden en que se agregó.
  const [agregados, setAgregados] = useState<readonly ItemCatalogoLocal[]>([]);
  const siguenAgregados = agregados.filter((item) => cantidadDe(item) !== undefined);
  const buscando = consulta.trim() !== "";
  const masUsados = frecuentes(items, usos, unidades);
  // Sin historial en este teléfono, se ofrece el catálogo tal cual (como en el prototipo), no una hoja vacía.
  const todos = items.filter((i) => i.activo && unidades.includes(i.unidad)).sort((a, b) => a.descripcion.localeCompare(b.descripcion, "es")).slice(0, 30);
  const lista = buscando ? buscarEnCatalogo(items, consulta, unidades, usos) : masUsados.length > 0 ? masUsados : todos;

  return (
    <Dialogo forma="hoja" titulo="Agregar del catálogo" alCerrar={cerrar} focoEnElDialogo>
      <div className="flex min-h-full flex-col gap-3">
        <label className="flex h-control shrink-0 items-center gap-2.5 rounded-control border border-borde-control bg-panel px-4 focus-within:border-borde-activo focus-within:ring-4 focus-within:ring-superficie-suave [&_svg]:size-5 [&_svg]:text-texto-secundario">
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
          <ul
            aria-label={buscando ? "Resultados" : masUsados.length > 0 ? "Los que más usas" : "Del catálogo"}
            className="overflow-hidden rounded-panel border border-division bg-panel [&>li+li]:border-t [&>li+li]:border-division"
          >
            {lista.map((item) => {
              const cantidad = cantidadDe(item);
              return (
                <li key={item.id} className="flex items-center gap-3 py-2.5 pr-3 pl-4">
                  <span className="flex min-w-0 grow flex-col">
                    <strong className="text-cuerpo leading-snug font-medium">{item.descripcion}</strong>
                    <span className="text-ayuda text-texto-secundario">
                      {item.codigo} · {item.unidad}
                    </span>
                  </span>
                  {cantidad === undefined ? (
                    <button
                      type="button"
                      onClick={() => {
                        elegir(item);
                        setAgregados((lista) => [...lista.filter((x) => x.id !== item.id), item]);
                      }}
                      aria-label={`Agregar ${item.descripcion}`}
                      className="h-11 shrink-0 rounded-control border border-borde-control px-4 text-[15px] font-medium text-superficie active:scale-95 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-foco"
                    >
                      + Agregar
                    </button>
                  ) : (
                    <span className="flex shrink-0 items-center rounded-control border-[1.5px] border-borde-activo bg-superficie-suave text-superficie motion-safe:animate-aparecer">
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
        {siguenAgregados.length > 0 && (
          <div role="status" className="sticky bottom-0 -mx-6 mt-auto flex items-center gap-3 border-t border-division bg-panel px-6 pt-3 motion-safe:animate-entra-abajo">
            <span className="flex min-w-0 grow flex-col">
              <strong className="flex items-center gap-1.5 text-cuerpo font-semibold whitespace-nowrap [&_svg]:size-[18px] [&_svg]:text-exito-texto">
                <CircleCheck aria-hidden />
                {siguenAgregados.length === 1 ? "1 agregado" : `${siguenAgregados.length} agregados`}
              </strong>
              <span className="truncate text-ayuda text-texto-secundario">{`En Materiales: ${siguenAgregados.map((item) => `${item.descripcion} × ${cantidadDe(item)}`).join(", ")}`}</span>
            </span>
            <Boton variante="principal" onClick={cerrar}>
              Ver materiales
            </Boton>
          </div>
        )}
      </div>
    </Dialogo>
  );
}
