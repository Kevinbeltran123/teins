import type { ReactNode } from "react";

/** Un dato en modo lectura (levantamiento enviado). */
export function ValorLeido({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-ayuda text-texto-secundario">{etiqueta}</span>
      <span className="text-campo font-bold break-words">{children}</span>
    </div>
  );
}
