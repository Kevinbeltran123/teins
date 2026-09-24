import { Component, useState, type ReactNode } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Aviso } from "@teins/ui";
import { Captura } from "./pantallas/Captura";
import { Inicio } from "./pantallas/Inicio";

class ErrorDeLectura extends Component<{ children: ReactNode }, { fallo: boolean }> {
  override state = { fallo: false };
  static getDerivedStateFromError() {
    return { fallo: true };
  }
  override render() {
    if (!this.state.fallo) return this.props.children;
    return (
      <main className="mx-auto max-w-xl px-4 py-8">
        <Aviso tono="error">
          No se pudo leer la información de este teléfono. No se borró nada. Cierra la app y vuelve a abrirla.
        </Aviso>
      </main>
    );
  }
}

export function App() {
  const [abierto, setAbierto] = useState<string>();
  const {
    needRefresh: [actualizacionDisponible],
    updateServiceWorker,
  } = useRegisterSW({
    // ADR-0015: buscar versión nueva al abrir (lo hace el registro) y al recuperar conexión.
    onRegisteredSW(_url, registro) {
      if (registro) window.addEventListener("online", () => void registro.update());
    },
  });

  return (
    <ErrorDeLectura>
      {abierto ? (
        <Captura id={abierto} volver={() => setAbierto(undefined)} />
      ) : (
        // La actualización solo se ofrece aquí, nunca dentro de un levantamiento abierto (ADR-0015).
        <Inicio
          abrir={setAbierto}
          actualizacion={{ disponible: actualizacionDisponible, aplicar: () => void updateServiceWorker(true) }}
        />
      )}
    </ErrorDeLectura>
  );
}
