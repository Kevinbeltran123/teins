import type { CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import type { DefinicionCampo, LineaCantidad } from "@teins/dominio";
import { Aviso, Boton, CampoSeleccion, Insignia, RefreshCw } from "@teins/ui";
import { consultasDeCatalogo, useVincular } from "../catalogo";
import { mensajeDeError, pideRecargar } from "../mensajes";
import type { Levantamiento } from "../revision";

/**
 * Tabla de cantidades con su vínculo al catálogo (iteración 11). Quien tiene la revisión elige el ítem
 * de cada línea; el técnico escribió texto libre y no lo elige (regla 6).
 */
export function LineasDeCantidad({ l, seccion, campo, lineas, mia, recargar }: { l: Levantamiento; seccion: string; campo: DefinicionCampo; lineas: readonly LineaCantidad[]; mia: boolean; recargar: () => void }) {
  const catalogo = useQuery({ ...consultasDeCatalogo.items(), enabled: mia });
  const vincular = useVincular(l.id);
  const vinculoDe = (linea: string) => l.vinculos.find((v) => v.seccion === seccion && v.campo === campo.clave && v.linea === linea);
  // Lo eligió el técnico y nadie lo ha cambiado (ADR-0025): quien revisa sabe qué confirmar.
  const deCampo = (linea: string) => vinculoDe(linea)?.elegidoEnCampo && <span className="sub">Elegido en campo</span>;

  function celda(linea: string) {
    const actual = vinculoDe(linea)?.item;
    if (!mia) {
      return actual ? (
        <>
          <span className="fuerte">{`${actual.codigo} · ${actual.descripcion}`}</span>
          {deCampo(linea)}
        </>
      ) : (
        <Insignia tono="alerta">Sin vincular</Insignia>
      );
    }
    if (catalogo.isPending) return <span className="sec">Cargando el catálogo…</span>;
    if (catalogo.isError) return <span className="msj-error">No se pudo cargar el catálogo</span>;
    const activos = catalogo.data.items.filter((i) => i.activo || i.id === actual?.id);
    if (activos.length === 0) return <span className="sec">El catálogo está vacío</span>;
    const numero = lineas.findIndex((x) => x.id === linea) + 1;
    return (
      <div style={{ maxWidth: 300 }}>
        <CampoSeleccion
          etiqueta={`Ítem del catálogo para la línea ${numero}`}
          etiquetaOculta
          vacio="Sin vincular"
          valor={actual?.id ?? ""}
          deshabilitado={vincular.isPending}
          onCambio={(itemId) => vincular.mutate({ version: l.version, seccion, campo: campo.clave, linea, itemId: itemId || null })}
          opciones={activos.map((i) => ({ valor: i.id, texto: `${i.codigo} · ${i.descripcion} (${i.unidad})` }))}
        />
        {deCampo(linea)}
      </div>
    );
  }

  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="tabla-caja">
        <table className="tabla" aria-label={campo.etiqueta}>
          <thead>
            <tr>
              <th scope="col">Material</th>
              <th scope="col" className="num">
                Cantidad
              </th>
              <th scope="col">Catálogo</th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((x, j) => (
              <tr key={x.id} style={{ "--i": j } as CSSProperties}>
                <td>
                  <span className="fuerte">{x.descripcion}</span>
                  {x.observacion && <span className="sub">{x.observacion}</span>}
                </td>
                <td className="num">
                  <span className="fuerte">{x.cantidad.replace(".", ",")}</span> <span className="sec">{x.unidad}</span>
                </td>
                <td>{celda(x.id)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {vincular.isError && (
        <Aviso tono="error">
          <b>{mensajeDeError(vincular.error)}</b>
          {pideRecargar(vincular.error) && (
            <div>
              <Boton tamano="pequeno" icono={RefreshCw} onClick={recargar}>
                Recargar
              </Boton>
            </div>
          )}
        </Aviso>
      )}
    </div>
  );
}
