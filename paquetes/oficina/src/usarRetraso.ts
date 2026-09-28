import { useEffect, useState } from "react";

/** El valor, un momento después de que deja de cambiar: la búsqueda no consulta en cada tecla. */
export function useRetrasado<T>(valor: T, ms = 250): T {
  const [retrasado, setRetrasado] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setRetrasado(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return retrasado;
}
