import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** La barra superior de oficina (Marco): el encabezado pone ahí dónde se está y el camino de vuelta. */
export const DestinoBarraSuperior = createContext<HTMLElement | null>(null);
/** La derecha de esa barra: las acciones de un documento en vivo, que ocupa todo el alto (ADR-0031). */
export const DestinoAccionesBarra = createContext<HTMLElement | null>(null);

/**
 * Encabezado de pantalla de oficina (DESIGN.md, jerarquía; prototipos/oficina). El título es la sección elegida en
 * el menú o, en un detalle, lo que se está viendo. Debajo, una línea de datos cortos (`meta`) que reemplaza a las
 * tarjetas de resumen; a la derecha, la acción principal. Con la barra superior del marco (Precisión), la ubicación
 * ("Levantamientos / Clínica Santa Fe") va en ella y las migas salen del encabezado.
 */
export function EncabezadoPagina({
  titulo,
  migas,
  estado,
  descripcion,
  acciones,
  accionesEnBarra = false,
}: {
  titulo: ReactNode;
  /** El nivel superior, como enlace con la clase `migas`: "Levantamientos", "Informes". */
  migas?: ReactNode;
  /** El estado de lo que se ve, junto al título. */
  estado?: ReactNode;
  /** Datos cortos bajo el título, cada uno en su propio `<span>`. */
  descripcion?: ReactNode;
  /** A la derecha: la acción principal de la pantalla, y a lo sumo una secundaria. */
  acciones?: ReactNode;
  /** En un documento en vivo, las acciones van a la barra superior (prototipos/vista-en-vivo). */
  accionesEnBarra?: boolean;
}) {
  const barra = useContext(DestinoBarraSuperior);
  const destinoAcciones = useContext(DestinoAccionesBarra);
  const arriba = accionesEnBarra && destinoAcciones;
  return (
    <header className="cabeza">
      {barra &&
        createPortal(
          migas ? (
            <>
              {migas}
              <span aria-hidden>/</span>
              <b>{titulo}</b>
            </>
          ) : (
            <b>{titulo}</b>
          ),
          barra,
        )}
      <div className="cabeza-txt">
        {migas && !barra && <nav aria-label="Migas de pan">{migas}</nav>}
        {/* El estado va junto al título, pero fuera de él: el título se lee solo ("Cotización COT-2026-0017"). */}
        <div className="titulo-fila">
          <h1>{titulo}</h1>
          {estado}
        </div>
        {descripcion && <div className="meta">{descripcion}</div>}
      </div>
      {acciones && (arriba ? createPortal(<div className="acciones">{acciones}</div>, destinoAcciones) : <div className="acciones">{acciones}</div>)}
    </header>
  );
}
