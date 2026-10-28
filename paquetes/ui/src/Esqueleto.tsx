/**
 * Cargando con la forma real de lo que viene (DESIGN.md, movimiento): así el contenido no salta al llegar.
 * El pulso es CSS y se detiene con movimiento reducido.
 */
export function EsqueletoTabla({ etiqueta, filas = 5, columnas = 4 }: { etiqueta: string; filas?: number; columnas?: number }) {
  return (
    <div aria-busy="true" aria-label={etiqueta} className="overflow-hidden rounded-panel border border-division bg-panel">
      <div className="h-11 border-b border-division bg-panel-hundido" />
      {Array.from({ length: filas }, (_, f) => (
        <div key={f} className="flex items-center gap-6 border-b border-division px-5 py-4 last:border-0">
          {Array.from({ length: columnas }, (_, c) => (
            <div key={c} className={`h-3.5 rounded-control bg-division motion-safe:animate-pulse ${c === 0 ? "w-1/4" : "w-1/6"}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Una línea de texto que todavía no llega (el resumen de un encabezado): ocupa su renglón y nada salta debajo. */
export function EsqueletoTexto({ etiqueta }: { etiqueta: string }) {
  // La barra va en línea dentro de un span: así el span mide un renglón del texto que reemplaza, también dentro de un flex.
  return (
    <span aria-busy="true" aria-label={etiqueta}>
      <span className="inline-block h-3 w-56 rounded-control bg-division align-middle motion-safe:animate-pulse" />
    </span>
  );
}

/** Tarjetas o paneles: el alto aproximado de lo que llega. */
export function EsqueletoBloques({ etiqueta, altos }: { etiqueta: string; altos: readonly ("bajo" | "medio" | "alto")[] }) {
  const alto = { bajo: "h-20", medio: "h-36", alto: "h-64" };
  return (
    <div aria-busy="true" aria-label={etiqueta} className="flex flex-col gap-4">
      {altos.map((a, i) => (
        <div key={i} className={`rounded-panel border border-division bg-panel motion-safe:animate-pulse ${alto[a]}`} />
      ))}
    </div>
  );
}
