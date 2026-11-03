import { useEffect, useRef, useState } from "react";
import { mejorPosicion, VENTANA_DE_POSICION_MS, type EstadoDeUbicacion, type PosicionDeLlegada } from "./sello";

/**
 * Mientras el paso con una foto con sello de ubicación está a la vista, el teléfono sigue la posición y guarda la mejor de
 * los últimos 2 minutos (ADR-0052); se apaga al salir del paso. Así, al tocar «Tomar foto» ya hay una posición lista y la
 * foto no espera al GPS. Sin permiso o sin la API, el estado lo dice y la foto sale sin coordenadas.
 */
export function useUbicacion(activa: boolean) {
  const [estado, setEstado] = useState<EstadoDeUbicacion>("buscando");
  const mejor = useRef<PosicionDeLlegada | null>(null);
  const [, redibujar] = useState(0);
  useEffect(() => {
    if (!activa) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setEstado("no_disponible");
      return;
    }
    setEstado(mejor.current ? "lista" : "buscando");
    const seguimiento = navigator.geolocation.watchPosition(
      (p) => {
        mejor.current = mejorPosicion(mejor.current, { lat: p.coords.latitude, lon: p.coords.longitude, precision: p.coords.accuracy, en: Date.now() });
        setEstado("lista");
        redibujar((n) => n + 1);
      },
      (error) => setEstado(error.code === error.PERMISSION_DENIED ? "sin_permiso" : mejor.current ? "lista" : "buscando"),
      { enableHighAccuracy: true, maximumAge: 10_000 },
    );
    // Sin lecturas nuevas (un cuarto sin GPS), la línea debe dejar de decir «lista» cuando la última caduca.
    const repaso = setInterval(() => redibujar((n) => n + 1), 15_000);
    return () => {
      navigator.geolocation.clearWatch(seguimiento);
      clearInterval(repaso);
    };
  }, [activa]);
  return {
    estado,
    /** La mejor posición que todavía vale (hasta 2 minutos), o null. */
    vigente: () => (mejor.current && Date.now() - mejor.current.en <= VENTANA_DE_POSICION_MS ? mejor.current : null),
  };
}
