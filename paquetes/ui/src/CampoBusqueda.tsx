import { Search } from "./iconos";

/**
 * Buscar dentro de una lista que crece sin límite (clientes, catálogo). Va en la barra de la lista, sin etiqueta
 * visible: el icono y el texto de ejemplo dicen qué hace, y la etiqueta queda para el lector de pantalla.
 */
export function CampoBusqueda({ etiqueta, ejemplo, valor, onCambio }: { etiqueta: string; /** "Nombre del cliente". */ ejemplo: string; valor: string; onCambio: (valor: string) => void }) {
  return (
    <label className="flex min-h-control w-full max-w-sm items-center gap-2 rounded-control border-[1.5px] border-borde-control bg-panel px-3 text-texto-secundario has-focus:border-borde-activo has-focus:shadow-[0_0_0_3px_var(--t-foco)]">
      <Search aria-hidden className="size-4 shrink-0" />
      <span className="sr-only">{etiqueta}</span>
      <input type="search" value={valor} placeholder={ejemplo} onChange={(e) => onCambio(e.target.value)} className="min-w-0 grow bg-transparent text-cuerpo text-texto outline-none placeholder:text-texto-secundario" />
    </label>
  );
}
