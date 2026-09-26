import type { ReactNode } from "react";

/**
 * Encabezado de pantalla (DESIGN.md, jerarquía). El título es la sección elegida en el menú o, en un detalle, lo
 * que se está viendo; nada en la pantalla es más grande. Las migas solo existen cuando hay un nivel superior al
 * que volver; la descripción, solo si explica algo que el título no dice.
 */
export function EncabezadoPagina({
  titulo,
  migas,
  estado,
  descripcion,
  acciones,
}: {
  titulo: string;
  /** El nivel superior, como enlace: "Levantamientos", "Informes". */
  migas?: ReactNode;
  /** El estado de lo que se ve, junto al título (Primer). */
  estado?: ReactNode;
  descripcion?: ReactNode;
  /** A la derecha: la acción principal de la pantalla, y a lo sumo una secundaria. */
  acciones?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        {migas && <nav aria-label="Migas de pan" className="text-ayuda text-texto-secundario">{migas}</nav>}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-titulo leading-tight font-extrabold tracking-tight">{titulo}</h1>
          {estado}
        </div>
        {descripcion && <div className="max-w-3xl text-cuerpo text-texto-secundario">{descripcion}</div>}
      </div>
      {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
    </header>
  );
}
