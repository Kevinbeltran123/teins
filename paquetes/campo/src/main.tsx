import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ProveedorNotificaciones } from "@teins/ui";
import { App } from "./App";
import { sellarEnSegundoPlano } from "./datos/instancia";
import { solicitarPersistencia } from "./dispositivo/almacenamiento";
import "./estilos.css";

void solicitarPersistencia();
void sellarEnSegundoPlano();

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <ProveedorNotificaciones lugar="abajo">
      <App />
    </ProveedorNotificaciones>
  </StrictMode>,
);
