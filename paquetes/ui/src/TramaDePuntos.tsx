import { useMemo } from "react";

type Color = readonly [number, number, number];
const mezcla = (a: Color, b: Color, t: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i]! - v) * t)).join(" ")})`;
const FONDO: Color = [0x1e, 0x2a, 0x44];
const AZUL: Color = [0x2f, 0x6b, 0xff];
const AMARILLO: Color = [0xff, 0xc2, 0x1a];

/**
 * La trama de puntos de la marca (entrada de oficina y de campo): quieta, del azul de TEINS al amarillo hacia la
 * esquina inferior derecha. Se dibuja con un bucle, así no pesa en el paquete.
 */
export function TramaDePuntos({ ancho, alto, paso = 12, radio = 5 }: { ancho: number; alto: number; paso?: number; /** Radio del punto más grande. */ radio?: number }) {
  const puntos = useMemo(() => {
    const lista = [];
    for (let y = paso / 2; y < alto; y += paso) {
      for (let x = paso / 2; x < ancho; x += paso) {
        const t = Math.max(0, 1 - (Math.hypot((ancho - x) / ancho, (alto - y) / alto) / Math.SQRT2) * 1.25);
        const color = t < 0.55 ? mezcla(FONDO, AZUL, Math.min(1, t / 0.55)) : mezcla(AZUL, AMARILLO, Math.min(1, (t - 0.55) / 0.35));
        lista.push(<circle key={`${x}-${y}`} cx={x} cy={y} r={Math.max(0.8, 0.8 + t ** 1.2 * radio)} fill={color} opacity={0.35 + 0.65 * t} />);
      }
    }
    return lista;
  }, [ancho, alto, paso, radio]);
  return (
    <svg className="trama" viewBox={`0 0 ${ancho} ${alto}`} preserveAspectRatio="xMidYMid slice" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      {puntos}
    </svg>
  );
}
