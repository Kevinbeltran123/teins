import { useEffect, useState, useSyncExternalStore } from "react";

/*
  La vista en vivo de los documentos (ADR-0031). Las plantillas se cargan aparte, al abrir un documento: el resto de
  oficina no las paga. Mientras llegan, el lienzo muestra la forma de la hoja; si no llegan, lo dice y deja reintentar.
*/

export type Plantillas = typeof import("@teins/documentos");

let carga: Promise<Plantillas> | null = null;
const cargar = () =>
  (carga ??= import("@teins/documentos").catch((error: unknown) => {
    // Un fallo de red no se queda guardado: el siguiente intento vuelve a pedirlas.
    carga = null;
    throw error;
  }));

export function usePlantillas(): { plantillas: Plantillas | null; fallo: boolean; reintentar: () => void } {
  const [estado, setEstado] = useState<{ plantillas: Plantillas | null; fallo: boolean }>({ plantillas: null, fallo: false });
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    let vigente = true;
    cargar().then(
      (plantillas) => vigente && setEstado({ plantillas, fallo: false }),
      () => vigente && setEstado({ plantillas: null, fallo: true }),
    );
    return () => {
      vigente = false;
    };
  }, [intento]);
  return {
    ...estado,
    reintentar: () => {
      setEstado({ plantillas: null, fallo: false });
      setIntento((i) => i + 1);
    },
  };
}

/** Desde 1280 px la hoja cabe al lado del editor; en menos, se abre con "Vista previa" en una hoja lateral. */
const CABE_AL_LADO = "(min-width: 1280px)";
function suscribir(avisar: () => void) {
  const consulta = matchMedia(CABE_AL_LADO);
  consulta.addEventListener("change", avisar);
  return () => consulta.removeEventListener("change", avisar);
}
export const useHojaAlLado = () => useSyncExternalStore(suscribir, () => matchMedia(CABE_AL_LADO).matches);
