import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { aplicarTema, ProveedorNotificaciones } from "@teins/ui";
import { clienteDeConsultas } from "./api";
import { router } from "./rutas";
import "./estilos.css";

// El tema elegido en este equipo, antes de dibujar nada (DESIGN.md, "Tema").
aplicarTema();

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <QueryClientProvider client={clienteDeConsultas}>
      <ProveedorNotificaciones lugar="abajo-derecha">
        <RouterProvider router={router} />
      </ProveedorNotificaciones>
    </QueryClientProvider>
  </StrictMode>,
);
