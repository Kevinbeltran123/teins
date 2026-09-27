import { useState } from "react";
import { CampoBusqueda, Dialogo, ElementoDeBoceto, Shapes } from "@teins/ui";
import type { SimboloLocal } from "../datos/modelo";
import { buscarSimbolos, porCategoria, recientes } from "../simbolos";

/**
 * La biblioteca de símbolos del editor (iteración 19, ADR-0027): buscar, los recientes y todos por categoría.
 * Sin textos de ayuda: cada símbolo con su dibujo y su nombre. Va con el editor, que se carga aparte; los símbolos
 * los lee la captura (leer la base desde aquí partía el JavaScript inicial de campo).
 */
export default function HojaSimbolos({ simbolos, elegir, cerrar }: { simbolos: readonly SimboloLocal[] | undefined; elegir: (simbolo: SimboloLocal) => void; cerrar: () => void }) {
  const [consulta, setConsulta] = useState("");
  const hay = (simbolos ?? []).some((s) => s.activo);
  const buscando = consulta.trim() !== "";
  const grupos = simbolos ? (buscando ? [{ categoria: "Resultados", simbolos: buscarSimbolos(simbolos, consulta) }] : [{ categoria: "Recientes", simbolos: recientes(simbolos) }, ...porCategoria(simbolos)]) : [];

  return (
    <Dialogo forma="inferior" titulo="Símbolos" alCerrar={cerrar} focoEnElDialogo>
      {simbolos === undefined ? (
        <div aria-busy="true" aria-label="Cargando los símbolos" className="h-40 rounded-control bg-fondo motion-safe:animate-pulse" />
      ) : !hay ? (
        <div className="flex flex-col items-center gap-2.5 px-2 py-6 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-panel-hundido text-texto-secundario [&_svg]:size-7">
            <Shapes aria-hidden />
          </span>
          <p className="text-cuerpo font-bold">Todavía no hay símbolos en este teléfono</p>
          <p className="text-ayuda text-texto-secundario">Llegan con la conexión, cuando oficina los publica.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <CampoBusqueda etiqueta="Buscar símbolo" ejemplo="Buscar símbolo" valor={consulta} onCambio={setConsulta} />
          {buscando && grupos[0]!.simbolos.length === 0 && (
            <p role="status" className="text-ayuda text-texto-secundario">
              No hay símbolos con «{consulta.trim()}».
            </p>
          )}
          {grupos
            .filter((g) => g.simbolos.length > 0)
            .map((g) => (
              <section key={g.categoria} aria-label={g.categoria} className="flex flex-col gap-2">
                {!buscando && <h3 className="text-cuerpo font-extrabold">{g.categoria}</h3>}
                <ul className="grid grid-cols-3 gap-2">
                  {g.simbolos.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => elegir(s)}
                        className="flex min-h-24 w-full flex-col items-center gap-1.5 rounded-control border border-division bg-panel px-1.5 pt-2.5 pb-2 text-center hover:bg-encima focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-superficie"
                      >
                        <svg aria-hidden viewBox="0 0 100 100" className="size-11">
                          <ElementoDeBoceto elemento={{ tipo: "simbolo", nombre: s.nombre, trazado: s.trazado, relleno: s.relleno, texto: s.texto, centro: [50, 50], tamano: 100, giro: 0 }} />
                        </svg>
                        <span className="text-ayuda leading-tight font-bold">{s.nombre}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>
      )}
    </Dialogo>
  );
}
