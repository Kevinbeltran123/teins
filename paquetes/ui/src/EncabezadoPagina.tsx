import type { ReactNode } from "react";

/**
 * Encabezado de pantalla de oficina (DESIGN.md, jerarquía; prototipos/oficina). El título es la sección elegida en
 * el menú o, en un detalle, lo que se está viendo. Debajo, una línea de datos cortos (`meta`) que reemplaza a las
 * tarjetas de resumen; a la derecha, la acción principal. Una línea fina lo separa del contenido.
 */
export function EncabezadoPagina({
  titulo,
  migas,
  estado,
  descripcion,
  acciones,
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
}) {
  return (
    <header className="cabeza">
      <div className="cabeza-txt">
        {migas && <nav aria-label="Migas de pan">{migas}</nav>}
        {/* El estado va junto al título, pero fuera de él: el título se lee solo ("Cotización COT-2026-0017"). */}
        <div className="titulo-fila">
          <h1>{titulo}</h1>
          {estado}
        </div>
        {descripcion && <div className="meta">{descripcion}</div>}
      </div>
      {acciones && <div className="acciones">{acciones}</div>}
    </header>
  );
}
