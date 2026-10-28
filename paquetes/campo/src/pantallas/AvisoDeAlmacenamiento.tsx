import { useEffect, useState } from "react";
import { Aviso } from "@teins/ui";
import { estadoAlmacenamiento, estaInstalada, type EstadoAlmacenamiento } from "../dispositivo/almacenamiento";

/** El aviso de datos no persistentes queda a la vista en "Tu cuenta": pide hacer algo antes de capturar. */
export function AvisoDeAlmacenamiento() {
  const [estado, setEstado] = useState<EstadoAlmacenamiento>();
  useEffect(() => {
    estadoAlmacenamiento().then(setEstado, () => setEstado(undefined));
  }, []);
  // Sin instalar, el aviso de instalación de Inicio ya lo explica.
  if (!estado || estado.persistente || !estaInstalada()) return null;
  return <Aviso tono="alerta">El teléfono no garantiza conservar los datos. Avísale a soporte antes de capturar.</Aviso>;
}
