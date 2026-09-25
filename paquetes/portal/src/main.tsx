import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { clienteDeConsultas } from "./api";
import { App } from "./App";
import "./estilos.css";

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <QueryClientProvider client={clienteDeConsultas}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
