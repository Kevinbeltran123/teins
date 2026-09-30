import { useCallback, useRef, useState } from "react";

/**
 * Una acción que no se repite mientras corre: un doble toque, o un segundo toque antes de que termine el
 * primero, la hace una sola vez (crear un levantamiento, agregar una sección, enviar). El bloqueo es síncrono:
 * el segundo toque llega antes de que React vuelva a pintar el botón deshabilitado. `ocupado` es para mostrarlo.
 */
export function useSinRepetir<A extends unknown[]>(accion: (...argumentos: A) => Promise<unknown>) {
  const enCurso = useRef(false);
  const vigente = useRef(accion);
  vigente.current = accion;
  const [ocupado, setOcupado] = useState(false);
  const ejecutar = useCallback(async (...argumentos: A) => {
    if (enCurso.current) return;
    enCurso.current = true;
    setOcupado(true);
    try {
      await vigente.current(...argumentos);
    } finally {
      enCurso.current = false;
      setOcupado(false);
    }
  }, []);
  return [ejecutar, ocupado] as const;
}
