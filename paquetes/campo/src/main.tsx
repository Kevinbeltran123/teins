import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { sellarEnSegundoPlano } from "./datos/instancia";
import { solicitarPersistencia } from "./dispositivo/almacenamiento";
import "./estilos.css";

void solicitarPersistencia();
void sellarEnSegundoPlano();

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
