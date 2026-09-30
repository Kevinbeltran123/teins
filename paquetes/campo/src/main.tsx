import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CapturaDeErrores, FallaAlDibujar, ProveedorNotificaciones } from "@teins/ui";
import { App } from "./App";
import { sellarEnSegundoPlano } from "./datos/instancia";
import { solicitarPersistencia } from "./dispositivo/almacenamiento";
import "./estilos.css";

void solicitarPersistencia();
void sellarEnSegundoPlano();

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <ProveedorNotificaciones lugar="abajo">
      {/* Lo capturado vive en el teléfono: un fallo al dibujar no lo toca, y volver a cargar lo muestra otra vez. */}
      <CapturaDeErrores
        respaldo={
          <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 pt-[max(2.5rem,env(safe-area-inset-top))]">
            <FallaAlDibujar texto="Algo falló al mostrar esta pantalla." />
          </main>
        }
      >
        <App />
      </CapturaDeErrores>
    </ProveedorNotificaciones>
  </StrictMode>,
);
