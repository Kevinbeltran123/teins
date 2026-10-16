import { useState } from "react";

/** El tema de la interfaz (DESIGN.md, "Tema"): el del sistema, salvo que la persona elija otro en este equipo. */
export type Tema = "sistema" | "claro" | "oscuro";

export const OPCIONES_DE_TEMA: readonly { valor: Tema; texto: string }[] = [
  { valor: "sistema", texto: "Del sistema" },
  { valor: "claro", texto: "Claro" },
  { valor: "oscuro", texto: "Oscuro" },
];

const LLAVE = "teins-tema";

export function temaGuardado(): Tema {
  try {
    const t = localStorage.getItem(LLAVE);
    return t === "claro" || t === "oscuro" ? t : "sistema";
  } catch {
    return "sistema";
  }
}

/** Pone el tema en <html>: tokens.css lo toma de data-tema (sin el atributo, sigue al sistema). */
export function aplicarTema(tema: Tema = temaGuardado()) {
  if (tema === "sistema") delete document.documentElement.dataset.tema;
  else document.documentElement.dataset.tema = tema;
}

/** El tema elegido, que se recuerda en el equipo y se aplica al cambiarlo. */
export function useTema() {
  const [tema, setTema] = useState(temaGuardado);
  const cambiar = (nuevo: Tema) => {
    try {
      if (nuevo === "sistema") localStorage.removeItem(LLAVE);
      else localStorage.setItem(LLAVE, nuevo);
    } catch {
      // Sin almacenamiento (navegación privada): el tema vale mientras la página siga abierta.
    }
    aplicarTema(nuevo);
    setTema(nuevo);
  };
  return [tema, cambiar] as const;
}
