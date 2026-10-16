import { useEffect, useState } from "react";

/**
 * Vuelve a dibujar la pantalla cada minuto y al volver a ella (iteración 41): lo que depende de la hora («Hoy», «En
 * curso», «Terminar visita», «Mañana» después de medianoche) se recalcula aunque no llegue ningún dato nuevo, también
 * sin señal. Devuelve el momento del último repaso.
 */
export function useMinuto(): number {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const repasar = () => setAhora(Date.now());
    const intervalo = setInterval(repasar, 60_000);
    const alVolver = () => {
      if (document.visibilityState === "visible") repasar();
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, []);
  return ahora;
}
