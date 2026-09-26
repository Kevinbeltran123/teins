import { useEffect, useState } from "react";
import { Boton, type TamanoBoton } from "./Boton";
import { Check, Copy } from "./iconos";

/**
 * Copia un texto que la persona tiene que entregar o guardar (una clave, un código). Confirma en el mismo botón,
 * sin notificación aparte: el resultado queda donde se hizo.
 */
export function BotonCopiar({ texto, etiqueta, tamano = "pequeno" }: { texto: string; /** Nombre accesible: "Copiar la clave". */ etiqueta: string; tamano?: TamanoBoton }) {
  const [estado, setEstado] = useState<"listo" | "copiado" | "fallo">("listo");
  useEffect(() => {
    if (estado === "listo") return;
    const t = setTimeout(() => setEstado("listo"), 2500);
    return () => clearTimeout(t);
  }, [estado]);

  return (
    <Boton
      tamano={tamano}
      variante="secundaria"
      icono={estado === "copiado" ? Check : Copy}
      aria-label={etiqueta}
      onClick={() => navigator.clipboard.writeText(texto).then(() => setEstado("copiado"), () => setEstado("fallo"))}
    >
      <span aria-live="polite">{estado === "copiado" ? "Copiado" : estado === "fallo" ? "No se pudo copiar" : "Copiar"}</span>
    </Boton>
  );
}
