import { useState } from "react";
import { bloqueOcultoPorOmision, bloquesVisibles, campoOcultoPorOmision, claveOcultable, elegir, mostrarTodo, ocultosDe, tieneBloquePropio, type Bloque, type DefinicionCampo, type SeleccionInforme } from "@teins/dominio";
import type { Respuesta } from "@teins/protocolo";
import { Check } from "@teins/ui";

type Detalle = Respuesta<"obtenerLevantamiento">;

const plural = (n: number, uno: string, varios: string) => (n === 1 ? `1 ${uno}` : `${n} ${varios}`);

/**
 * Qué sale de un levantamiento en el informe (ADR-0039, prototipos/informe-y-firma): cada bloque con su interruptor y,
 * en los que tienen fotos, «Elegir fotos». Lo mismo se hace sobre la hoja con «Ocultar»; lo oculto sigue en el
 * levantamiento para oficina.
 */
export function QueSaleEnElInforme({ detalle, seleccion, alCambiar, fotos }: { detalle: Detalle; seleccion: SeleccionInforme; alCambiar: (s: SeleccionInforme) => void; fotos: ReadonlyMap<string, string> }) {
  const [eligiendo, setEligiendo] = useState<string | null>(null);
  // Lo que el formato oculta por sus condiciones no sale: no hay qué elegir (ADR-0058).
  const lista = bloquesVisibles(detalle.formatoDefinicion, detalle.repeticiones, detalle.respuestas);
  const oculto = ocultosDe(seleccion, detalle.id);
  const valores = (b: Bloque) => detalle.respuestas[b.clave] ?? {};
  const conValor = (b: Bloque) => b.seccion.campos.filter((c) => valores(b)[c.clave] !== undefined);
  // Un bloque sale apagado si se ocultó entero o si todo lo que tiene son partes ocultas (el croquis de campo, solo).
  const apagado = (b: Bloque) => oculto.bloque(b) || (conValor(b).length > 0 && conValor(b).every((c) => tieneBloquePropio(c) && oculto.campo(b, c)));
  const huellas = (b: Bloque, c: DefinicionCampo) => {
    const v = valores(b)[c.clave];
    return c.tipo === "foto" && Array.isArray(v) ? (v as readonly string[]) : [];
  };

  function alternar(b: Bloque) {
    const clave = claveOcultable(detalle.id, b.clave);
    if (!apagado(b)) return alCambiar(elegir(seleccion, clave, true, bloqueOcultoPorOmision(b)));
    let s = elegir(seleccion, clave, false, bloqueOcultoPorOmision(b));
    for (const c of conValor(b)) if (tieneBloquePropio(c) && oculto.campo(b, c)) s = elegir(s, claveOcultable(detalle.id, b.clave, c.clave), false, campoOcultoPorOmision(c));
    alCambiar(s);
  }

  function resumen(b: Bloque): string {
    const datos = conValor(b).filter((c) => !tieneBloquePropio(c)).length;
    const partes = [datos > 0 ? plural(datos, "dato", "datos") : ""];
    for (const c of conValor(b)) {
      if (!tieneBloquePropio(c) || oculto.campo(b, c)) continue;
      if (c.tipo === "foto") {
        const todas = huellas(b, c);
        const salen = todas.filter((h) => !oculto.foto(b, c, h)).length;
        partes.push(salen === todas.length ? plural(todas.length, "foto", "fotos") : `${salen} de ${todas.length} fotos`);
      } else partes.push(c.etiqueta);
    }
    return partes.filter(Boolean).join(" · ") || "Sin datos";
  }

  const porque = (b: Bloque) =>
    bloqueOcultoPorOmision(b) && !seleccion.ocultos.includes(claveOcultable(detalle.id, b.clave))
      ? "Solo para la empresa (lo marca el formato)"
      : conValor(b).some((c) => c.tipo === "boceto")
        ? "Croquis de campo: adjunte el plano en Planos anexos"
        : "";
  const fuera = lista.filter(apagado).map((b) => b.titulo);
  const fotosFuera = lista.filter((b) => !apagado(b)).flatMap((b) => conValor(b).filter((c) => c.tipo === "foto" && !oculto.campo(b, c)).flatMap((c) => huellas(b, c).filter((h) => oculto.foto(b, c, h)))).length;
  const loQueNoSale = [...fuera, ...(fotosFuera > 0 ? [plural(fotosFuera, "foto", "fotos")] : [])];

  return (
    <div className="que-sale" aria-label={`Qué sale de ${detalle.formatoDefinicion.nombre ?? detalle.formato} en el informe`} role="group">
      <div className="titulo-q">
        <span>Qué sale en el informe</span>
        {loQueNoSale.length > 0 && (
          <button type="button" className="enlace-q" onClick={() => alCambiar(mostrarTodo(seleccion, detalle.id, detalle.formatoDefinicion, detalle.repeticiones))}>
            Mostrar todo
          </button>
        )}
      </div>
      {lista.map((b) => {
        const off = apagado(b);
        const conFotos = !off && conValor(b).some((c) => c.tipo === "foto" && !oculto.campo(b, c) && huellas(b, c).length > 0);
        const abierto = conFotos && eligiendo === b.clave;
        // Lo que no sale dentro de un bloque que sí sale (el croquis de un cuarto con otros datos).
        const partesFuera = off ? [] : conValor(b).filter((c) => tieneBloquePropio(c) && oculto.campo(b, c));
        return (
          <div key={b.clave} className={`sec-q ${off ? "apagada" : ""}`}>
            <span className="nom">
              {b.titulo}
              {conFotos && (
                <button type="button" className="enlace-q" aria-expanded={abierto} onClick={() => setEligiendo(abierto ? null : b.clave)}>
                  {abierto ? "Listo" : "Elegir fotos"}
                </button>
              )}
            </span>
            <button type="button" role="switch" aria-checked={!off} aria-label={`${b.titulo} en el informe`} className="interruptor" onClick={() => alternar(b)}>
              <i />
            </button>
            <span className="det">{off ? "No sale" : resumen(b)}</span>
            {off && porque(b) && <span className="motivo">{porque(b)}</span>}
            {partesFuera.map((c) => (
              <span key={c.clave} className="motivo">
                {`${c.etiqueta} no sale · `}
                <button type="button" className="enlace-q" onClick={() => alCambiar(elegir(seleccion, claveOcultable(detalle.id, b.clave, c.clave), false, campoOcultoPorOmision(c)))}>
                  Mostrar
                </button>
              </span>
            ))}
            {abierto && (
              <span className="fotos-q">
                {conValor(b)
                  .filter((c) => c.tipo === "foto")
                  .flatMap((c) =>
                    huellas(b, c).map((h, n) => {
                      const sale = !oculto.foto(b, c, h);
                      return (
                        <button
                          key={h}
                          type="button"
                          aria-pressed={sale}
                          aria-label={`Foto ${n + 1} de ${c.etiqueta.toLowerCase()}: ${sale ? "sale" : "no sale"}`}
                          className={`mini-f ${sale ? "" : "fuera"}`}
                          onClick={() => alCambiar(elegir(seleccion, claveOcultable(detalle.id, b.clave, c.clave, h), sale, false))}
                        >
                          {fotos.get(h) ? <img src={fotos.get(h)} alt="" /> : <span className="sin-foto">[FOTO]</span>}
                          <span className="marca">{sale && <Check aria-hidden />}</span>
                        </button>
                      );
                    }),
                  )}
              </span>
            )}
          </div>
        );
      })}
      {loQueNoSale.length > 0 && <p className="resumen-q">{`No salen: ${loQueNoSale.join(", ")}. Siguen en el levantamiento para oficina.`}</p>}
    </div>
  );
}
