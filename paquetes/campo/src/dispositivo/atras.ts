import { useEffect, useRef } from "react";

/*
  El botón atrás del teléfono (iteración 24c). Campo cambia de pantalla sin cambiar de dirección, así que atrás salía
  de la app. Mientras una pantalla ofrece volver, queda una entrada de más en el historial: atrás la consume y hace lo
  mismo que la flecha de la pantalla. La pantalla de más arriba manda; en el inicio no hay entrada y atrás sale.
*/

const MARCA = "teins-atras";
const pila: { current: () => void }[] = [];
let ignorarUno = false;

function alRetroceder() {
  if (ignorarUno) {
    ignorarUno = false;
    return;
  }
  const tope = pila.at(-1);
  if (!tope) return;
  // La entrada se repone antes de volver: si la pantalla de abajo también ofrece volver, atrás sigue funcionando.
  history.pushState({ [MARCA]: true }, "");
  tope.current();
}

let escuchando = false;

export function useBotonAtras(alVolver: () => void) {
  const vigente = useRef(alVolver);
  vigente.current = alVolver;
  useEffect(() => {
    // Un solo oyente para toda la app: así el retroceso que se provoca abajo siempre se consume.
    if (!escuchando) {
      window.addEventListener("popstate", alRetroceder);
      escuchando = true;
    }
    if (pila.length === 0) history.pushState({ [MARCA]: true }, "");
    pila.push(vigente);
    return () => {
      pila.splice(pila.indexOf(vigente), 1);
      if (pila.length > 0) return;
      // De vuelta en el inicio: se quita la entrada de más, así el siguiente atrás sale de la app.
      if ((history.state as Record<string, unknown> | null)?.[MARCA]) {
        ignorarUno = true;
        history.back();
      }
    };
  }, []);
}
