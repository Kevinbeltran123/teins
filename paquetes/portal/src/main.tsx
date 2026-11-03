import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { aplicarTema, CapturaDeErrores, FallaAlDibujar } from "@teins/ui";
import { clienteDeConsultas } from "./api";
import { App } from "./App";
import "./estilos.css";

// El tema elegido en este equipo, antes del primer dibujo (DESIGN.md, "Tema"): claro, oscuro o el del sistema.
aplicarTema();

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <QueryClientProvider client={clienteDeConsultas}>
      <CapturaDeErrores
        respaldo={
          <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-10">
            <FallaAlDibujar texto="Algo falló al mostrar el portal." />
          </main>
        }
      >
        <App />
      </CapturaDeErrores>
    </QueryClientProvider>
  </StrictMode>,
);
