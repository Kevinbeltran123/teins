import { TramaDePuntos } from "./TramaDePuntos";

/** El panel de la entrada de oficina: la trama de puntos quieta con la marca (prototipos/oficina). Estilos en oficina.css. */
export function PanelDeMarca() {
  return (
    <div className="lado-marca" aria-hidden>
      <TramaDePuntos ancho={600} alto={860} />
      <div className="marca-grande">TEINS</div>
    </div>
  );
}
