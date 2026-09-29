import { Component, type ErrorInfo, type ReactNode } from "react";
import { Boton } from "./Boton";

/**
 * Si algo falla al dibujar, se muestra `respaldo` en vez de la pantalla en blanco. El error es de la pantalla, no de
 * los datos: lo guardado sigue ahí. La causa queda en la consola para soporte (ADR-0017).
 */
export class CapturaDeErrores extends Component<{ children: ReactNode; respaldo: ReactNode }, { fallo: boolean }> {
  override state = { fallo: false };

  static getDerivedStateFromError() {
    return { fallo: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("Falla al dibujar la pantalla", error, info.componentStack);
  }

  override render() {
    return this.state.fallo ? this.props.respaldo : this.props.children;
  }
}

/** Lo que se ve cuando una pantalla falla al dibujarse. Sin iconos: puede que lo que falló sea dibujar. */
export function FallaAlDibujar({ texto }: { texto: string }) {
  return (
    <div role="alert" className="aviso peligro flex flex-col items-start gap-3 rounded-panel bg-peligro-fondo px-4 py-3 text-cuerpo text-texto">
      <p>
        <b>{texto}</b> Lo que ya estaba guardado no se perdió.
      </p>
      <Boton tamano="pequeno" onClick={() => window.location.reload()}>
        Volver a cargar
      </Boton>
    </div>
  );
}
