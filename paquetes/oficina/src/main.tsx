import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { ProveedorNotificaciones } from "@teins/ui";
import { clienteDeConsultas } from "./api";
import { router } from "./rutas";
import "./estilos.css";

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <QueryClientProvider client={clienteDeConsultas}>
      <ProveedorNotificaciones lugar="abajo-derecha">
        <RouterProvider router={router} />
      </ProveedorNotificaciones>
    </QueryClientProvider>
  </StrictMode>,
);
