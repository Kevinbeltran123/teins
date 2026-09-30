import { useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../datos/instancia";

function suscribir(avisar: () => void) {
  window.addEventListener("online", avisar);
  window.addEventListener("offline", avisar);
  return () => {
    window.removeEventListener("online", avisar);
    window.removeEventListener("offline", avisar);
  };
}

/** Lo que dice el navegador. Puede decir "en línea" sin serlo (red sin internet, portal cautivo). */
export function useConexionDelNavegador(): boolean {
  return useSyncExternalStore(suscribir, () => navigator.onLine);
}

/**
 * ¿Se puede hablar con el servidor? Combina el navegador con el resultado real del último intento
 * del motor, que solo se actualiza cuando hay algo que enviar: úselo para el estado de lo pendiente.
 */
export function useServidorAlcanzable(): boolean {
  const navegador = useConexionDelNavegador();
  const red = useLiveQuery(async () => {
    const ajuste = await db.ajustes.get("red");
    return ajuste?.clave === "red" ? ajuste.valor : undefined;
  });
  return navegador && red?.alcanzable !== false;
}
